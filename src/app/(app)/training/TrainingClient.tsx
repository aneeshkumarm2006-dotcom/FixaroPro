"use client";

import { useMemo } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import {
  GraduationCap,
  Play,
  CheckCircle2,
  AlertCircle,
  Clock,
  ChevronRight,
} from "lucide-react";

type ModuleStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "FAILED";

interface ModuleData {
  id: string;
  title: string;
  description: string | null;
  videoUrl: string | null;
  duration: number | null;
  isRequired: boolean;
  hasQuiz: boolean;
  progress: {
    status: ModuleStatus;
    videoProgress: number;
    quizScore: number | null;
    quizAttempts: number;
    completedAt: string | null;
  } | null;
}

interface TrainingClientProps {
  modules: ModuleData[];
}

function statusInfo(status: ModuleStatus) {
  switch (status) {
    case "COMPLETED":
      return {
        label: "Completed",
        icon: CheckCircle2,
        variant: "success" as const,
      };
    case "IN_PROGRESS":
      return {
        label: "In Progress",
        icon: Play,
        variant: "warning" as const,
      };
    case "FAILED":
      return {
        label: "Failed",
        icon: AlertCircle,
        variant: "error" as const,
      };
    default:
      return {
        label: "Not Started",
        icon: Clock,
        variant: "default" as const,
      };
  }
}

function formatDuration(seconds: number | null) {
  if (!seconds) return null;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest === 0 ? `${h} hr` : `${h}h ${rest}m`;
}

export default function TrainingClient({ modules }: TrainingClientProps) {
  const required = useMemo(
    () => modules.filter((m) => m.isRequired),
    [modules]
  );
  const optional = useMemo(
    () => modules.filter((m) => !m.isRequired),
    [modules]
  );

  const totalRequired = required.length;
  const completedRequired = required.filter(
    (m) => m.progress?.status === "COMPLETED"
  ).length;
  const overallPct =
    totalRequired === 0
      ? 100
      : Math.round((completedRequired / totalRequired) * 100);

  return (
    <div className="max-w-[80rem] mx-auto space-y-6">
      <div>
        <h1 className="text-3xl !font-light tracking-tight text-[#005F6A]">
          Training
        </h1>
        <p className="text-sm text-[#005F6A]/70 !font-light mt-1">
          Complete required modules to stay certified
        </p>
      </div>

      <Card variant="cleano_light" className="p-6">
        <div className="flex items-center justify-between gap-6 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-[#005F6A]/10 rounded-2xl">
              <GraduationCap className="w-6 h-6 text-[#005F6A]" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-[#005F6A]/70">
                Required Progress
              </p>
              <p className="text-2xl font-[400] text-[#005F6A]">
                {completedRequired} of {totalRequired} complete
              </p>
            </div>
          </div>
          <div className="flex-1 min-w-[12rem] max-w-md">
            <div className="h-3 bg-[#005F6A]/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#005F6A] transition-all duration-500"
                style={{ width: `${overallPct}%` }}
              />
            </div>
            <p className="text-xs text-[#005F6A]/70 mt-1 text-right">
              {overallPct}%
            </p>
          </div>
        </div>
      </Card>

      <ModuleSection
        title="Required Modules"
        modules={required}
        emptyText="No required modules assigned."
      />

      <ModuleSection
        title="Optional Modules"
        modules={optional}
        emptyText="No optional modules available."
      />
    </div>
  );
}

function ModuleSection({
  title,
  modules,
  emptyText,
}: {
  title: string;
  modules: ModuleData[];
  emptyText: string;
}) {
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-[350] tracking-tight text-[#005F6A]">
        {title}
      </h2>
      {modules.length === 0 ? (
        <Card variant="ghost" className="p-8">
          <p className="text-sm text-[#005F6A]/60 text-center">{emptyText}</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {modules.map((m) => (
            <ModuleRow key={m.id} module={m} />
          ))}
        </div>
      )}
    </div>
  );
}

function ModuleRow({ module: m }: { module: ModuleData }) {
  const status = m.progress?.status ?? "NOT_STARTED";
  const info = statusInfo(status);
  const Icon = info.icon;
  const duration = formatDuration(m.duration);
  const videoPct = Math.round((m.progress?.videoProgress ?? 0) * 100);

  return (
    <Link
      href={`/training/${m.id}`}
      className="block p-4 border border-[#005F6A]/10 rounded-2xl bg-white hover:bg-[#005F6A]/3 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-[400] text-[#005F6A]">{m.title}</h3>
            <Badge variant={info.variant} size="sm">
              <Icon className="w-3 h-3 mr-1" />
              {info.label}
            </Badge>
            {m.isRequired && (
              <Badge variant="cleano" size="sm">
                Required
              </Badge>
            )}
            {m.hasQuiz && (
              <Badge variant="default" size="sm">
                Quiz
              </Badge>
            )}
          </div>
          {m.description && (
            <p className="text-xs text-[#005F6A]/60 mt-1 line-clamp-2">
              {m.description}
            </p>
          )}
          <div className="flex items-center gap-4 mt-2 text-xs text-[#005F6A]/60">
            {duration && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {duration}
              </span>
            )}
            {status === "IN_PROGRESS" && (
              <span>{videoPct}% watched</span>
            )}
            {m.progress?.quizScore != null && (
              <span>
                Quiz: {Math.round(m.progress.quizScore * 100)}%
                {m.progress.quizAttempts > 1 &&
                  ` (${m.progress.quizAttempts} attempts)`}
              </span>
            )}
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-[#005F6A]/40 flex-shrink-0" />
      </div>
    </Link>
  );
}
