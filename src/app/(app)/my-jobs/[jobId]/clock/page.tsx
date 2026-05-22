import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import ClockPageClient from "./ClockPageClient";

type PageProps = { params: Promise<{ jobId: string }> };

export default async function ClockPage({ params }: PageProps) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");

  const { jobId } = await params;

  const job = await db.job.findUnique({
    where: { id: jobId },
    include: { cleaners: { select: { id: true } } },
  });

  if (!job) redirect("/my-jobs");

  const isEmployee = job.employeeId === session.user.id;
  const isCleaner = (job as any).cleaners?.some((c: any) => c.id === session.user.id);
  if (!isEmployee && !isCleaner) redirect("/my-jobs");

  const j = job as any;

  return (
    <ClockPageClient
      jobId={job.id}
      clientName={job.clientName}
      startTime={job.startTime?.toISOString() ?? null}
      endTime={job.endTime?.toISOString() ?? null}
      status={job.status}
      clockInTime={j.clockInTime?.toISOString() ?? null}
      clockOutTime={j.clockOutTime?.toISOString() ?? null}
    />
  );
}
