import { db } from "@/db";
import RateForm from "./RateForm";

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function RatePage({ params }: PageProps) {
  const { token } = await params;

  // Special demo tokens (from design) — render fallback states without a DB hit.
  const demoFallback =
    token === "expired" || token === "already" || token === "notfound"
      ? token
      : null;

  if (demoFallback) {
    return (
      <RateForm
        fallback={demoFallback as "expired" | "already" | "notfound"}
        token={token}
      />
    );
  }

  const tokenRow = await db.jobRatingToken.findUnique({
    where: { token },
    include: {
      job: {
        select: {
          id: true,
          jobNumber: true,
          jobDate: true,
          clientName: true,
          location: true,
          cleaners: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!tokenRow) {
    return <RateForm fallback="notfound" token={token} />;
  }
  if (tokenRow.usedAt) {
    return <RateForm fallback="already" token={token} />;
  }
  if (tokenRow.expiresAt && tokenRow.expiresAt < new Date()) {
    return <RateForm fallback="expired" token={token} />;
  }

  return (
    <RateForm
      token={token}
      jobNumber={tokenRow.job.jobNumber}
      jobDate={tokenRow.job.jobDate?.toISOString() ?? null}
      location={tokenRow.job.location}
      cleaners={tokenRow.job.cleaners}
    />
  );
}
