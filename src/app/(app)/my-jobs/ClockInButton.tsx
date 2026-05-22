"use client";

import { LogIn } from "lucide-react";
import { useRouter } from "next/navigation";

interface ClockInButtonProps {
  jobId: string;
  jobStartTime: Date | null;
  disabled?: boolean;
}

export default function ClockInButton({
  jobId,
  disabled = false,
}: ClockInButtonProps) {
  const router = useRouter();

  return (
    <button
      className="cl-jd-clock"
      onClick={() => router.push(`/my-jobs/${jobId}/clock`)}
      disabled={disabled}>
      <LogIn size={13} />
      Clock in
    </button>
  );
}
