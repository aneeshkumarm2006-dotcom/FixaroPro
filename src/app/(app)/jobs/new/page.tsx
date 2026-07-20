import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { revalidatePath } from "next/cache";
import { homeForRole, isAdminRole } from "@/lib/role-routing";
import { requireAdmin } from "@/lib/page-guards";
import { logAudit } from "@/lib/audit";
import {
  BUSINESS_TZ,
  businessDateOnly,
  parseBusinessDateTime,
} from "@/lib/timezone";
import { businessDateKey } from "@/lib/availability-exceptions";
import { getRuntimeConfig } from "@/lib/config/service-config";
import { findService } from "@/lib/config/types";
import CleanerSelector from "./CleanerSelector";
import JobTypeSelector from "./JobTypeSelector";
import SubmitButton from "./SubmitButton";
import DeleteButton from "./DeleteButton";
import ClientLinkSelector from "./ClientLinkSelector";
import { ControlledDatePicker, ControlledTimePicker } from "./DateTimePicker";
import PaymentTypeSelect from "./PaymentTypeSelect";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import PriceSummary from "./PriceSummary";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function JobFormPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; error?: string }>;
}) {
  const { edit: jobId, error: formError } = await searchParams;
  const isEditing = !!jobId;

  // Admin-app roles only. This page creates/edits/DELETES jobs and writes price,
  // employee pay and payment status, so "is signed in" was never the right bar —
  // it let any EMPLOYEE or CLIENT open the form. Matches the /jobs page guard.
  const session = await requireAdmin();

  // Get existing job if editing
  let existingJob = null;
  if (isEditing) {
    existingJob = await db.job.findUnique({
      where: { id: jobId },
      include: {
        cleaners: true,
      },
    });

    if (!existingJob || existingJob.employeeId !== session.user.id) {
      redirect("/jobs");
    }
  }

  // Get all users to populate the cleaners dropdown
  const users = await db.user.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      availabilities: {
        select: {
          day: true,
          startTime: true,
          endTime: true,
          isAvailable: true,
          effectiveFrom: true,
          effectiveTo: true,
        },
      },
    },
  });

  const usersForSelector = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    availability: u.availabilities.map((a) => ({
      day: a.day,
      startTime: a.startTime,
      endTime: a.endTime,
      isAvailable: a.isAvailable,
      effectiveFrom: a.effectiveFrom?.toISOString() ?? null,
      effectiveTo: a.effectiveTo?.toISOString() ?? null,
    })),
  }));

  // Get all clients for the client selector
  const clients = await db.client.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      address: true,
      email: true,
      phone: true,
      discountPercent: true,
      defaultPaymentMethodId: true,
    },
  });

  async function saveJob(formData: FormData) {
    "use server";

    // Re-authenticate INSIDE the action. A server action is a public POST
    // endpoint — the guard on the page render above does not protect it, so the
    // role check has to be repeated here. Admin-app roles only: this writes
    // price, employeePay, tips and payment status onto any job by id
    // (SOP §2.2/§12 — money, pay and charges are admin-only).
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    const role = (session?.user as { role?: string } | undefined)?.role;
    if (!session || !isAdminRole(role)) {
      // Fail closed, and hand back a destination rather than throwing an
      // unhandled error at the client (which is what `session!.user.id` did).
      redirect(homeForRole(role));
    }

    // Get selected cleaner IDs from form
    const cleanerIds = formData.getAll("cleaners") as string[];

    const editingJobId = (formData.get("jobId") as string | null) || null;

    const backToForm = (reason: string) =>
      editingJobId
        ? `/jobs/new?edit=${encodeURIComponent(editingJobId)}&error=${reason}`
        : `/jobs/new?error=${reason}`;

    // Parse all form fields according to schema
    const startDate = formData.get("startDate") as string;
    const startTime = formData.get("startTime") as string;
    const endDate = formData.get("endDate") as string;
    const endTime = formData.get("endTime") as string;

    const validPaymentTypes = [
      "CASH",
      "CHEQUE",
      "E_TRANSFER",
      "CREDIT_CARD",
      "OTHER",
    ];
    const rawPaymentType = (formData.get("paymentType") as string) || "";
    const paymentType = validPaymentTypes.includes(rawPaymentType)
      ? rawPaymentType
      : null;
    const rawClientId = (formData.get("clientId") as string) || "";
    const clientId = rawClientId || null;

    const clientName = ((formData.get("clientName") as string) || "").trim();
    if (!clientName) {
      redirect(backToForm("clientname"));
    }

    // jobType is an allow-listed SERVICE VALUE from the runtime catalog (the
    // same vocabulary the booking flow writes), never free text — the crew board
    // filters `jobType in eligibleTypes` and the equipment/kit matching keys off
    // it, so an unknown code produces a job nobody can see or prepare for.
    // Looked up UNFILTERED so an existing job on a retired service can still be
    // saved without silently losing its type.
    const rawJobType = ((formData.get("jobType") as string) || "").trim();
    let jobType: string | null = null;
    if (rawJobType) {
      const cfg = await getRuntimeConfig();
      if (!findService(cfg, rawJobType)) {
        redirect(backToForm("service"));
      }
      jobType = rawJobType;
    }

    const price = formData.get("price")
      ? parseFloat(formData.get("price") as string)
      : null;

    let discountAmount = formData.get("discountAmount")
      ? parseFloat(formData.get("discountAmount") as string)
      : null;

    // Auto-apply client default discount if admin didn't enter one
    if (
      (discountAmount === null || discountAmount === 0) &&
      clientId &&
      price !== null &&
      price > 0
    ) {
      const c = await db.client.findUnique({
        where: { id: clientId },
        select: { discountPercent: true },
      });
      const pct = c?.discountPercent ?? 0;
      if (pct > 0) {
        discountAmount = +(price * (pct / 100)).toFixed(2);
      }
    }

    // Date + time are REQUIRED. They used to fall back to `new Date()`, which
    // silently stamped "now" on a blank submission. Parsed in BUSINESS_TZ, not
    // the server's timezone — `new Date("2026-07-20T09:00")` on a UTC host
    // stored a 9 AM Toronto pick as 09:00Z (= 5 AM Toronto).
    const parsedStart = parseBusinessDateTime(startDate, startTime);
    const parsedJobDate = businessDateOnly(startDate);
    if (!parsedStart || !parsedJobDate) {
      redirect(backToForm("datetime"));
    }

    // End is optional, but if BOTH parts are supplied they must be valid and
    // after the start — a silently-dropped end time produced open-ended jobs.
    let parsedEnd: Date | null = null;
    if (endDate || endTime) {
      parsedEnd = parseBusinessDateTime(endDate, endTime);
      if (!parsedEnd || parsedEnd <= parsedStart) {
        redirect(backToForm("endtime"));
      }
    }

    const jobData: any = {
      employeeId: session.user.id,
      clientName,
      clientId,
      description: (formData.get("description") as string) || null,
      jobType,
      location: (formData.get("location") as string) || null,
      jobDate: parsedJobDate,
      startTime: parsedStart,
      endTime: parsedEnd,
      price,
      employeePay: formData.get("employeePay")
        ? parseFloat(formData.get("employeePay") as string)
        : null,
      totalTip: formData.get("totalTip")
        ? parseFloat(formData.get("totalTip") as string)
        : null,
      parking: formData.get("parking")
        ? parseFloat(formData.get("parking") as string)
        : null,
      paymentReceived: formData.get("paymentReceived") === "on",
      invoiceSent: formData.get("invoiceSent") === "on",
      notes: (formData.get("notes") as string) || null,
      paymentType,
      discountAmount,
      // bedCount/bathCount deliberately not written — they are cleaning-era
      // fields with no meaning for handyman work.
      payRateMultiplier: formData.get("payRateMultiplier")
        ? parseFloat(formData.get("payRateMultiplier") as string)
        : 1.0,
    };

    if (editingJobId) {
      // Confirm the target exists before writing. Fails closed on a crafted or
      // stale id instead of surfacing a raw Prisma P2025 to the client.
      const target = await db.job.findUnique({
        where: { id: editingJobId },
        select: { id: true },
      });
      if (!target) {
        redirect("/jobs");
      }

      // UPDATE existing job
      await db.job.update({
        where: { id: editingJobId },
        data: {
          ...jobData,
          cleaners:
            cleanerIds.length > 0
              ? {
                  set: cleanerIds.map((id) => ({ id })),
                }
              : undefined,
        },
      });

      revalidatePath("/jobs");
      redirect(`/jobs/${editingJobId}`);
    } else {
      // CREATE new job
      // Only add cleaners if there are any selected
      if (cleanerIds.length > 0) {
        jobData.cleaners = {
          connect: cleanerIds.map((id) => ({ id })),
        };
      }

      await db.job.create({
        data: jobData,
      });

      revalidatePath("/jobs");
      redirect("/jobs");
    }
  }

  async function deleteJob(formData: FormData) {
    "use server";

    // Server actions are public POST endpoints. Before this guard, ANY caller —
    // signed out, a CLIENT, a stale EMPLOYEE session — could permanently delete
    // ANY job by posting its id. Admin-app roles only, checked inside the
    // action, fail closed.
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    const role = (session?.user as { role?: string } | undefined)?.role;
    if (!session || !isAdminRole(role)) {
      redirect(homeForRole(role));
    }

    const jobId = ((formData.get("jobId") as string) || "").trim();
    if (!jobId) {
      redirect("/jobs");
    }

    // Snapshot the financially-material fields BEFORE the delete. A hard delete
    // of a job that carried money (price, provider pay, deposit/payment state)
    // would otherwise leave no reconstructable record of what was destroyed.
    const target = await db.job.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        jobNumber: true,
        status: true,
        price: true,
        employeePay: true,
        paymentReceived: true,
        paymentType: true,
        depositPaid: true,
        depositPaidAt: true,
        tipAmount: true,
        invoiceSent: true,
        stripePaymentIntentId: true,
        depositPaymentIntentId: true,
        clientId: true,
        clientName: true,
        jobType: true,
        jobDate: true,
        startTime: true,
      },
    });
    if (!target) {
      // Already gone (or never existed). Idempotent: same outcome, no error, and
      // no signal to the caller about which ids exist.
      redirect("/jobs");
    }

    // Written before the delete so the trail exists even if the delete then
    // fails; logAudit never throws into this action.
    await logAudit({
      entityType: "Job",
      entityId: target.id,
      action: "JOB_DELETED",
      field: "job",
      // Full snapshot as oldValue — the deletion is reconstructable from this.
      oldValue: JSON.stringify({
        id: target.id,
        jobNumber: target.jobNumber,
        status: target.status,
        price: target.price,
        employeePay: target.employeePay,
        paymentReceived: target.paymentReceived,
        paymentType: target.paymentType,
        depositPaid: target.depositPaid,
        depositPaidAt: target.depositPaidAt?.toISOString() ?? null,
        tipAmount: target.tipAmount,
        invoiceSent: target.invoiceSent,
        stripePaymentIntentId: target.stripePaymentIntentId,
        depositPaymentIntentId: target.depositPaymentIntentId,
        clientId: target.clientId,
        clientName: target.clientName,
        jobType: target.jobType,
        jobDate: target.jobDate?.toISOString() ?? null,
        startTime: target.startTime?.toISOString() ?? null,
        deletedAt: new Date().toISOString(),
      }),
      newValue: null,
      actorId: session.user.id,
      actorEmail: session.user.email ?? null,
      description: `Permanently deleted job #${target.jobNumber} (${target.clientName}) — status ${target.status}, price ${target.price ?? "n/a"}, provider pay ${target.employeePay ?? "n/a"}, payment received ${target.paymentReceived}.`,
    });

    await db.job.delete({
      where: { id: jobId },
    });

    revalidatePath("/jobs");
    redirect("/jobs");
  }

  // Get selected cleaner IDs for editing
  const selectedCleanerIds = existingJob?.cleaners.map((c) => c.id) || [];

  return (
    <div className="max-w-[68rem] mx-auto text-black pb-24">
      {/* Back button */}
      <Link
        href="/jobs"
        className="inline-flex items-center gap-1.5 text-sm mb-6 hover:opacity-70 transition-opacity"
        style={{ color: "var(--primary-60)" }}
      >
        <ArrowLeft size={14} />
        Back to Jobs
      </Link>

      {/* Page header */}
      <header style={{ marginBottom: 36 }}>
        <p
          style={{
            fontSize: 11,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "var(--primary-60)",
            marginBottom: 6,
          }}
        >
          {isEditing ? "Edit" : "Create"}
        </p>
        <h1
          style={{
            fontSize: "clamp(32px, 4vw, 46px)",
            fontWeight: 300,
            lineHeight: 1.1,
            color: "var(--ink)",
            margin: 0,
          }}
        >
          {isEditing ? (
            <>Edit <em style={{ fontStyle: "italic" }}>service job.</em></>
          ) : (
            <>New <em style={{ fontStyle: "italic" }}>service job.</em></>
          )}
        </h1>
        <p style={{ marginTop: 10, fontSize: 15, color: "var(--primary-60)" }}>
          Fill in the details below. You can update most fields later from the job detail page.
        </p>
      </header>

      {formError && (
        <div
          role="alert"
          style={{
            marginBottom: 20,
            padding: "12px 16px",
            borderRadius: 12,
            background: "rgba(220,38,38,0.06)",
            border: "1px solid rgba(220,38,38,0.20)",
            fontSize: 13,
            color: "var(--error)",
          }}
        >
          {FORM_ERRORS[formError] ?? "We couldn't save that job. Please review the form and try again."}
        </div>
      )}

      <form action={saveJob} className="space-y-5">
        {isEditing && existingJob && (
          <input type="hidden" name="jobId" value={existingJob.id} />
        )}

        {/* Basic Information */}
        <SectionCard title="Basic information" subtitle="Who, what, where">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
            <FieldWrap label="Link client" hint="Pulls in saved name + address">
              <ClientLinkSelector
                clients={clients}
                defaultValue={existingJob?.clientId || ""}
              />
            </FieldWrap>

            <FieldWrap label="Client name" required>
              <Input
                type="text"
                id="clientName"
                name="clientName"
                required
                defaultValue={existingJob?.clientName || ""}
                placeholder="e.g. Alexis Juarez"
              />
            </FieldWrap>

            <FieldWrap label="Job type">
              <JobTypeSelector initialValue={existingJob?.jobType} />
            </FieldWrap>

            <FieldWrap label="Location" hint="Address or general area">
              <Input
                type="text"
                id="location"
                name="location"
                defaultValue={existingJob?.location || ""}
                placeholder="123 rue Sainte-Catherine, Montréal"
              />
            </FieldWrap>

            <div className="md:col-span-2">
              <FieldWrap label="Description">
                <Textarea
                  id="description"
                  name="description"
                  rows={2}
                  defaultValue={existingJob?.description || ""}
                  placeholder="Brief description of the job…"
                />
              </FieldWrap>
            </div>
          </div>
        </SectionCard>

        {/* Date & Time */}
        <SectionCard
          title="Date & time"
          subtitle={`Scheduled window — entered and stored in ${BUSINESS_TZ.replace("_", " ")} time`}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
            {/* Prefilled and submitted as BUSINESS-timezone wall clock, which is
                how the server action parses them back. Rendering the stored
                instant with toISOString() showed a 9 AM job as "13:00". */}
            <FieldWrap label="Start date" required>
              <ControlledDatePicker
                name="startDate"
                defaultValue={
                  existingJob?.startTime
                    ? businessDateKey(new Date(existingJob.startTime))
                    : ""
                }
                size="md"
              />
            </FieldWrap>

            <FieldWrap label="Start time" required>
              <ControlledTimePicker
                name="startTime"
                defaultValue={
                  existingJob?.startTime
                    ? businessTimeValue(new Date(existingJob.startTime))
                    : ""
                }
                size="md"
              />
            </FieldWrap>

            <FieldWrap label="End date">
              <ControlledDatePicker
                name="endDate"
                defaultValue={
                  existingJob?.endTime
                    ? businessDateKey(new Date(existingJob.endTime))
                    : ""
                }
                size="md"
              />
            </FieldWrap>

            <FieldWrap label="End time">
              <ControlledTimePicker
                name="endTime"
                defaultValue={
                  existingJob?.endTime
                    ? businessTimeValue(new Date(existingJob.endTime))
                    : ""
                }
                size="md"
              />
            </FieldWrap>
          </div>
        </SectionCard>

        {/* Team */}
        <SectionCard title="Team" subtitle="Assign Pros to this job">
          <CleanerSelector
            users={usersForSelector}
            initialSelectedIds={selectedCleanerIds}
          />
        </SectionCard>

        {/* Pricing & Payment */}
        <SectionCard title="Pricing & payment" subtitle="Charges, costs, and payment method">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
            <MoneyFieldWrap label="Price" id="price" name="price" defaultValue={existingJob?.price} />
            <MoneyFieldWrap label="Employee pay" id="employeePay" name="employeePay" defaultValue={existingJob?.employeePay} />
            <MoneyFieldWrap label="Total tip" id="totalTip" name="totalTip" defaultValue={existingJob?.totalTip} />
            <MoneyFieldWrap label="Parking" id="parking" name="parking" defaultValue={existingJob?.parking} />
            <MoneyFieldWrap label="Discount amount" id="discountAmount" name="discountAmount" defaultValue={existingJob?.discountAmount} />

            <FieldWrap label="Payment type">
              <PaymentTypeSelect defaultValue={existingJob?.paymentType || ""} />
            </FieldWrap>

            {/* Bed / bath counts removed — cleaning-era fields with no meaning
                for handyman work. Scope now comes from the service type. */}
          </div>

          <PriceSummary />
        </SectionCard>

        {/* Notes */}
        <SectionCard title="Additional details" subtitle="Notes for the team">
          <FieldWrap label="Notes">
            <Textarea
              id="notes"
              name="notes"
              rows={4}
              defaultValue={existingJob?.notes || ""}
              placeholder="Pets, parking, door codes, sensitive surfaces, special requirements…"
            />
          </FieldWrap>
        </SectionCard>

        {/* Sticky footer */}
        <div
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            background: "rgba(250, 247, 242, 0.92)",
            backdropFilter: "blur(8px)",
            borderTop: "1px solid rgba(232,93,4,0.10)",
            padding: "14px 32px",
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            gap: 12,
            zIndex: 40,
          }}
        >
          {isEditing && existingJob && (
            <form action={deleteJob} style={{ marginRight: "auto" }}>
              <input type="hidden" name="jobId" value={existingJob.id} />
              <DeleteButton />
            </form>
          )}
          <Link href={isEditing ? `/jobs/${existingJob?.id}` : "/jobs"}>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </Link>
          <SubmitButton isEditing={isEditing} />
        </div>
      </form>
    </div>
  );
}

// ─── Form-error copy ───
// Generic, non-leaky messages keyed by the reason the server action bounced.
const FORM_ERRORS: Record<string, string> = {
  datetime: "Start date and start time are required. Please pick both and try again.",
  endtime: "The end date and time must be a valid moment after the start.",
  clientname: "Client name is required.",
  service: "That service isn't in the catalog. Please pick a service from the list.",
};

/** Stored instant → "HH:mm" wall clock in BUSINESS_TZ, for the time picker. */
function businessTimeValue(d: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: BUSINESS_TZ,
    hourCycle: "h23",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

// ─── Section card ───
function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        background: "#fff",
        border: "1px solid rgba(232,93,4,0.08)",
        borderRadius: 16,
        padding: "24px 28px",
        boxShadow: "0 1px 6px rgba(232,93,4,0.05)",
      }}
    >
      <div style={{ marginBottom: 20 }}>
        <h2
          style={{
            margin: 0,
            fontSize: 17,
            fontWeight: 600,
            color: "var(--ink)",
            letterSpacing: "-0.005em",
          }}
        >
          {title}
        </h2>
        {subtitle && (
          <p style={{ margin: "3px 0 0", fontSize: 13, color: "var(--primary-60)" }}>
            {subtitle}
          </p>
        )}
      </div>
      {children}
    </section>
  );
}

// ─── Field wrapper ───
function FieldWrap({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        style={{
          display: "block",
          fontSize: 12,
          fontWeight: 600,
          color: "var(--primary-60)",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          marginBottom: 6,
        }}
      >
        {label}
        {required && <span style={{ color: "var(--error)", marginLeft: 3 }}>*</span>}
        {hint && (
          <span style={{ textTransform: "none", letterSpacing: 0, fontWeight: 400, marginLeft: 6 }}>
            · {hint}
          </span>
        )}
      </label>
      {children}
    </div>
  );
}

// ─── Money field wrapper ───
function MoneyFieldWrap({
  label,
  id,
  name,
  defaultValue,
}: {
  label: string;
  id: string;
  name: string;
  defaultValue?: number | null;
}) {
  return (
    <FieldWrap label={label}>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm pointer-events-none" style={{ color: "var(--primary-50)" }}>
          $
        </span>
        <Input
          type="number"
          step="0.01"
          min="0"
          id={id}
          name={name}
          defaultValue={defaultValue ?? ""}
          placeholder="0.00"
          className="pl-7"
        />
      </div>
    </FieldWrap>
  );
}
