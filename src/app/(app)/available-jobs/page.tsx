import { requireCleaner } from "@/lib/page-guards";
import { db } from "@/db";
import AvailableJobsClient from "./AvailableJobsClient";
import { Briefcase } from "lucide-react";

export default async function AvailableJobsPage() {
  const session = await requireCleaner();

  const now = new Date();

  // Jobs that: are upcoming, not cancelled, not fully staffed, and the cleaner hasn't already claimed
  const jobs = await db.job.findMany({
    where: {
      startTime: { gte: now },
      status: { notIn: ["CANCELLED", "COMPLETED"] },
      cleaners: { none: { id: session.user.id } },
    },
    include: {
      cleaners: { select: { id: true } },
    },
    orderBy: { startTime: "asc" },
    take: 100,
  });

  // Filter to only jobs that still need cleaners
  const openJobs = jobs.filter((j) => j.cleaners.length < j.requiredCleaners);

  const serialized = openJobs.map((j) => ({
    id: j.id,
    jobNumber: j.jobNumber,
    startTime: j.startTime.toISOString(),
    isFlexible: j.isFlexible,
    location: j.location,
    jobType: j.jobType,
    price: j.price,
    bedCount: j.bedCount,
    bathCount: j.bathCount,
    requiredCleaners: j.requiredCleaners,
    claimedCount: j.cleaners.length,
    notes: j.notes,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl !font-light tracking-tight text-[#005F6A] flex items-center gap-3">
          <Briefcase className="w-7 h-7" /> Available Jobs
        </h1>
        <p className="text-sm text-[#005F6A]/70 mt-1">
          Open shifts you can claim. Jobs disappear once they&apos;re fully staffed.
        </p>
      </div>

      <AvailableJobsClient jobs={serialized} />
    </div>
  );
}
