import { requireAdmin } from "@/lib/page-guards";
import { db } from "@/db";
import TrainingDocsClient from "./TrainingDocsClient";

export const metadata = {
  title: "Training & Documents · Fixaro",
};

export default async function TrainingDocsPage() {
  // Page-level guard: only OWNER/ADMIN roles reach this route. Everyone else is
  // redirected to their role home before any data is queried or rendered.
  const session = await requireAdmin();
  const employeeId = session.user.id;

  // Real training modules (active only) + the current user's own progress +
  // whether each module has a quiz. Mirrors the query in /training/page.tsx.
  const modules = await db.trainingModule.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: {
      quizzes: { select: { id: true } },
      progress: { where: { employeeId }, take: 1 },
    },
  });

  // Real documents + the current user's signature status for each.
  const documents = await db.document.findMany({
    orderBy: [{ createdAt: "desc" }],
    include: {
      signatures: {
        where: { employeeId },
        take: 1,
        select: { status: true, signedAt: true },
      },
    },
  });

  // Real activity feed (admin-only view — the route is admin-gated above):
  // recent document signings + recent training completions across all staff.
  const [recentSignatures, recentCompletions] = await Promise.all([
    db.documentSignature.findMany({
      where: { status: "SIGNED", signedAt: { not: null } },
      orderBy: { signedAt: "desc" },
      take: 8,
      include: {
        employee: { select: { name: true } },
        document: { select: { title: true } },
      },
    }),
    db.trainingProgress.findMany({
      where: { status: "COMPLETED", completedAt: { not: null } },
      orderBy: { completedAt: "desc" },
      take: 8,
      include: {
        employee: { select: { name: true } },
        module: { select: { title: true } },
      },
    }),
  ]);

  const moduleData = modules.map((m) => {
    const p = m.progress[0];
    return {
      id: m.id,
      title: m.title,
      description: m.description,
      duration: m.duration,
      isRequired: m.isRequired,
      hasQuiz: m.quizzes.length > 0,
      status: (p?.status ?? "NOT_STARTED") as
        | "NOT_STARTED"
        | "IN_PROGRESS"
        | "COMPLETED"
        | "FAILED",
      videoProgress: p?.videoProgress ?? 0,
      quizScore: p?.quizScore ?? null,
    };
  });

  const documentData = documents.map((d) => {
    const sig = d.signatures[0];
    return {
      id: d.id,
      title: d.title,
      description: d.description,
      version: d.version,
      status: (sig?.status ?? "NONE") as
        | "SIGNED"
        | "PENDING"
        | "REVOKED"
        | "NONE",
      signedAt: sig?.signedAt?.toISOString() ?? null,
    };
  });

  const activity = [
    ...recentSignatures.map((s) => ({
      id: `sig-${s.id}`,
      who: s.employee?.name ?? "Team member",
      title: s.document?.title ?? "Document",
      action: "signed" as const,
      at: s.signedAt!.toISOString(),
    })),
    ...recentCompletions.map((p) => ({
      id: `prog-${p.id}`,
      who: p.employee?.name ?? "Team member",
      title: p.module?.title ?? "Training module",
      action: "completed" as const,
      at: p.completedAt!.toISOString(),
    })),
  ]
    .sort((a, b) => (a.at < b.at ? 1 : -1))
    .slice(0, 10);

  return (
    <div className="h-full overflow-hidden overflow-y-auto p-8">
      <TrainingDocsClient
        modules={moduleData}
        documents={documentData}
        activity={activity}
      />
    </div>
  );
}
