import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { revalidatePath } from "next/cache";
import JobDetailView from "./JobDetailView";
import AdminJobOpsPanel from "./AdminJobOpsPanel";
import EquipmentReadinessPanel from "./EquipmentReadinessPanel";
import JobChatPanel from "./JobChatPanel";
import { computeJobBilling, getBillingConfig } from "@/lib/billing";
import { getEligibleProviderIdsFor } from "@/lib/eligibility";

export default async function JobPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { id } = await params;
  const search = await searchParams;
  const logsPage = Number(search.logsPage) || 1;
  const logsPerPage = 10;

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/sign-in");
  }

  const job = await db.job.findUnique({
    where: { id },
    include: {
      employee: true,
      cleaners: true,
      client: true,
      addOns: true,
      productUsage: {
        include: {
          product: true,
        },
      },
      _count: {
        select: { logs: true },
      },
    },
  });

  if (!job) {
    redirect("/jobs");
  }

  // Check if user has access to view this job
  if (
    job.employeeId !== session.user.id &&
    (session.user as any).role !== "OWNER" &&
    (session.user as any).role !== "ADMIN"
  ) {
    redirect("/jobs");
  }

  // Fetch all users for the cleaner selector
  const users = await db.user.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
    },
  });

  const clients = await db.client.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      address: true,
      discountPercent: true,
      defaultPaymentMethodId: true,
    },
  });

  // Fetch paginated logs separately
  const totalLogs = job._count.logs;
  const logs = await db.jobLog.findMany({
    where: { jobId: id },
    include: {
      user: true,
    },
    orderBy: {
      createdAt: "desc",
    },
    skip: (logsPage - 1) * logsPerPage,
    take: logsPerPage,
  });

  // Rating status — the (one) rating token for this job drives the banner.
  const ratingToken = await db.jobRatingToken.findFirst({
    where: { jobId: id },
    orderBy: { createdAt: "asc" },
    select: {
      ratingStars: true,
      ratherNotAnswer: true,
      usedAt: true,
      emailSentAt: true,
      popupShownAt: true,
    },
  });
  const ratingStatus = ratingToken
    ? {
        state: (ratingToken.usedAt
          ? ratingToken.ratherNotAnswer
            ? "skipped"
            : "rated"
          : ratingToken.popupShownAt
          ? "shown"
          : ratingToken.emailSentAt
          ? "sent"
          : "none") as "none" | "sent" | "shown" | "rated" | "skipped",
        stars: ratingToken.ratingStars,
        emailSentAt: ratingToken.emailSentAt?.toISOString() ?? null,
        ratedAt:
          ratingToken.usedAt && !ratingToken.ratherNotAnswer
            ? ratingToken.usedAt.toISOString()
            : null,
      }
    : null;

  // Fetch all photos uploaded for this job
  const photos = await db.jobPhoto.findMany({
    where: { jobId: id },
    include: {
      employee: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Customer-attached review photos (submitted with the star rating).
  const reviewPhotos = await db.reviewPhoto.findMany({
    where: { jobId: id },
    orderBy: { createdAt: "desc" },
    select: { id: true, url: true, rating: true, createdAt: true },
  });

  // Calculate total cost of products used
  const totalProductCost = job.productUsage.reduce((sum, usage) => {
    return sum + usage.quantity * usage.product.costPerUnit;
  }, 0);

  // Check if user is admin
  const isAdmin =
    (session.user as any).role === "OWNER" ||
    (session.user as any).role === "ADMIN";

  // Server action to delete job
  async function deleteJob() {
    "use server";

    await db.job.delete({
      where: { id },
    });

    revalidatePath("/jobs");
    redirect("/jobs");
  }

  // Transform data for client component
  const jobData = {
    id: job.id,
    clientName: job.clientName,
    clientId: job.clientId,
    location: job.location,
    apartmentNumber: job.apartmentNumber,
    description: job.description,
    jobType: job.jobType,
    jobDate: job.jobDate?.toISOString() || null,
    startTime: job.startTime.toISOString(),
    endTime: job.endTime?.toISOString() || null,
    clockInTime: job.clockInTime?.toISOString() || null,
    clockOutTime: job.clockOutTime?.toISOString() || null,
    status: job.status,
    price: job.price,
    employeePay: job.employeePay,
    totalTip: job.totalTip,
    parking: job.parking,
    paymentReceived: job.paymentReceived,
    isCashJob: job.isCashJob,
    invoiceSent: job.invoiceSent,
    notes: job.notes,
    paymentType: job.paymentType,
    discountAmount: job.discountAmount,
    bedCount: job.bedCount,
    bathCount: job.bathCount,
    halfBathCount: job.halfBathCount,
    payRateMultiplier: job.payRateMultiplier,
    depositPaid: job.depositPaid,
    depositPaymentIntentId: job.depositPaymentIntentId,
    // Needed so the refund cap/copy reflect the real amount collected at booking
    // (materials deposit or the painting $119 charge), not a hardcoded $20.
    materialsType: job.materialsType,
    materialsAmount: job.materialsAmount,
    // Service-specific intake (SOP v4.2 §4).
    paintRepairArea: job.paintRepairArea,
    paintRepairSurface: job.paintRepairSurface,
    acType: job.acType,
    acLocation: job.acLocation,
    acMountType: job.acMountType,
    clientHasAcUnit: job.clientHasAcUnit,
    addOns: job.addOns.map((a) => ({
      id: a.id,
      name: a.name,
      price: a.price,
    })),
    employee: job.employee
      ? { id: job.employee.id, name: job.employee.name }
      : { id: "", name: "Unassigned" },
    cleaners: job.cleaners.map((c) => ({ id: c.id, name: c.name })),
    cancellationRequestedAt: job.cancellationRequestedAt?.toISOString() ?? null,
    rescheduleRequestedAt: job.rescheduleRequestedAt?.toISOString() ?? null,
    afterPhotoConsent: job.afterPhotoConsent,
    afterPhotoConsentAt: job.afterPhotoConsentAt?.toISOString() ?? null,
    afterPhotoOverrideAt: job.afterPhotoOverrideAt?.toISOString() ?? null,
  };

  const productUsageData = job.productUsage.map((usage) => ({
    id: usage.id,
    quantity: usage.quantity,
    notes: usage.notes,
    product: {
      id: usage.product.id,
      name: usage.product.name,
      unit: usage.product.unit,
      costPerUnit: usage.product.costPerUnit,
    },
  }));

  const logsData = logs.map((log) => ({
    id: log.id,
    action: log.action,
    field: log.field,
    oldValue: log.oldValue,
    newValue: log.newValue,
    description: log.description,
    createdAt: log.createdAt.toISOString(),
    user: log.user ? { id: log.user.id, name: log.user.name } : null,
  }));

  const photosData = photos.map((photo) => ({
    id: photo.id,
    url: photo.url,
    caption: photo.caption,
    kind: photo.kind,
    createdAt: photo.createdAt.toISOString(),
    // INTAKE photos are customer-uploaded and have no employee.
    employee: photo.employee
      ? { id: photo.employee.id, name: photo.employee.name }
      : null,
  }));

  const reviewPhotosData = reviewPhotos.map((photo) => ({
    id: photo.id,
    url: photo.url,
    rating: photo.rating,
    createdAt: photo.createdAt.toISOString(),
  }));

  // Admin ops panel (SOP §9/§10): charge-review breakdown, painting bid
  // controls, and deposit reconciliation. Self-contained — rendered alongside
  // the existing detail view.
  let opsPanel: React.ReactNode = null;
  if (isAdmin) {
    const billingCfg = await getBillingConfig();
    const billing = computeJobBilling(job, billingCfg);

    let painting = null as null | {
      status: string | null;
      finalAmount: number | null;
      acceptedBidAmount: number | null;
      quoteRangeMin: number | null;
      quoteRangeMax: number | null;
      surplusRate: number;
      bids: { id: string; bidderName: string; amount: number; isWinning: boolean }[];
    };
    let providerOptions: { id: string; name: string }[] = [];
    if (job.jobType === "PAINTING") {
      const bids = await db.paintingBid.findMany({
        where: { jobId: job.id },
        include: { bidder: { select: { name: true } } },
        orderBy: { amount: "asc" },
      });
      painting = {
        status: job.paintingStatus,
        finalAmount: job.paintingFinalAmount,
        acceptedBidAmount: job.acceptedBidAmount,
        quoteRangeMin: job.quoteRangeMin,
        quoteRangeMax: job.quoteRangeMax,
        surplusRate: job.paintingSurplusRate ?? 1.35,
        bids: bids.map((b) => ({ id: b.id, bidderName: b.bidder.name, amount: b.amount, isWinning: b.isWinning })),
      };
      const eligibleIds = await getEligibleProviderIdsFor("PAINTING");
      if (eligibleIds.length > 0) {
        const provs = await db.user.findMany({
          where: { id: { in: eligibleIds } },
          select: { id: true, name: true },
        });
        providerOptions = provs;
      }
    }

    opsPanel = (
      <AdminJobOpsPanel
        jobId={job.id}
        billing={billing}
        painting={painting}
        providerOptions={providerOptions}
      />
    );
  }

  return (
    <>
      <JobDetailView
        job={jobData}
        productUsage={productUsageData}
        logs={logsData}
        photos={photosData}
        reviewPhotos={reviewPhotosData}
        totalLogs={totalLogs}
        logsPage={logsPage}
        logsPerPage={logsPerPage}
        totalProductCost={totalProductCost}
        isAdmin={isAdmin}
        onDeleteJob={deleteJob}
        users={users}
        clients={clients}
        ratingStatus={ratingStatus}
      />
      {opsPanel}
      {/* Fix #7 — pre-job equipment readiness (not submitted / pending /
          approved / rejected) so ops can see whether the Pro has prepped. */}
      <EquipmentReadinessPanel jobId={job.id} />
      {/* Per-job chat (office ↔ Pro ↔ client). The panel's server actions
          re-derive the sender role from the session, so posting here is gated
          to real participants regardless of who loads the page. */}
      <div style={{ marginTop: 24, maxWidth: 720 }}>
        <JobChatPanel
          jobId={job.id}
          viewerName={session.user.name}
          audienceLabel="the Pro & client"
        />
      </div>
    </>
  );
}
