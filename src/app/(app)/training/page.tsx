import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import TrainingClient from "./TrainingClient";

export default async function TrainingPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/sign-in");
  }

  const employeeId = session.user.id;

  const modules = await db.trainingModule.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: {
      quizzes: { select: { id: true } },
      progress: {
        where: { employeeId },
        take: 1,
      },
    },
  });

  const moduleData = modules.map((m) => {
    const progress = m.progress[0];
    return {
      id: m.id,
      title: m.title,
      description: m.description,
      videoUrl: m.videoUrl,
      duration: m.duration,
      isRequired: m.isRequired,
      hasQuiz: m.quizzes.length > 0,
      progress: progress
        ? {
            status: progress.status,
            videoProgress: progress.videoProgress,
            quizScore: progress.quizScore,
            quizAttempts: progress.quizAttempts,
            completedAt: progress.completedAt?.toISOString() || null,
          }
        : null,
    };
  });

  return (
    <div className="h-full overflow-hidden overflow-y-auto p-8">
      <TrainingClient modules={moduleData} />
    </div>
  );
}
