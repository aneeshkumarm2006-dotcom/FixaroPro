"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import Button from "@/components/ui/Button";
import {
  getNotificationPrefs,
  updateNotificationPrefs,
} from "../../actions/updateNotificationPrefs";
import {
  DEFAULT_NOTIFICATION_PREFS,
  type NotificationPrefs,
} from "../../actions/notificationPrefsConstants";
import { SectionCard, Feedback, Msg } from "./_shared";

interface ToggleRow {
  key: keyof NotificationPrefs;
  label: string;
  description: string;
}

const ROWS: ToggleRow[] = [
  {
    key: "newJob",
    label: "New job assigned",
    description: "When a new job is assigned to you.",
  },
  {
    key: "jobReminder",
    label: "Job reminders",
    description: "Reminder before an upcoming job.",
  },
  {
    key: "payProcessed",
    label: "Pay processed",
    description: "When a payout is approved or paid.",
  },
  {
    key: "ratingReceived",
    label: "Rating received",
    description: "When a client or admin rates your work.",
  },
  {
    key: "documentToSign",
    label: "Document to sign",
    description: "When you have a new document awaiting signature.",
  },
  {
    key: "trainingAssigned",
    label: "Training assigned",
    description: "When a new training module is required.",
  },
  {
    key: "multiplierChange",
    label: "Multiplier change",
    description: "When your pay rate multiplier changes tiers.",
  },
  {
    key: "lowInventory",
    label: "Low inventory",
    description: "When your assigned supplies run low.",
  },
];

interface NotificationSectionProps {
  employeeId?: string;
}

export default function NotificationSection({
  employeeId,
}: NotificationSectionProps) {
  const [prefs, setPrefs] = useState<NotificationPrefs>(
    DEFAULT_NOTIFICATION_PREFS
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const res = await getNotificationPrefs(employeeId);
      if (cancelled) return;
      if (res.success) {
        setPrefs(res.prefs);
      } else {
        setMsg({ type: "error", text: res.error });
      }
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [employeeId]);

  async function handleSave() {
    setSaving(true);
    setMsg(null);
    const res = await updateNotificationPrefs({ employeeId, prefs });
    if (res.success) {
      setMsg({ type: "success", text: "Notification preferences saved." });
    } else {
      setMsg({ type: "error", text: res.error || "Failed to save." });
    }
    setSaving(false);
  }

  function toggle(key: keyof NotificationPrefs) {
    setPrefs((p) => ({ ...p, [key]: !p[key] }));
  }

  return (
    <SectionCard
      title="Notification Preferences"
      description="Choose which notifications you want to receive."
      icon={Bell}>
      {loading ? (
        <p className="text-sm text-[#005F6A]/60">Loading preferences...</p>
      ) : (
        <div className="space-y-3">
          {ROWS.map((row) => (
            <label
              key={row.key}
              className="flex items-start justify-between gap-3 p-3 rounded-xl bg-[#005F6A]/5 cursor-pointer hover:bg-[#005F6A]/10 transition-colors">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-[500] text-[#005F6A]">
                  {row.label}
                </p>
                <p className="text-xs text-[#005F6A]/60 mt-0.5">
                  {row.description}
                </p>
              </div>
              <input
                type="checkbox"
                checked={prefs[row.key]}
                onChange={() => toggle(row.key)}
                className="mt-1 accent-[#005F6A] w-4 h-4 cursor-pointer"
              />
            </label>
          ))}

          {msg && <Feedback msg={msg} />}

          <div className="flex justify-end pt-2">
            <Button
              type="button"
              variant="action"
              border={false}
              disabled={saving}
              onClick={handleSave}
              className="rounded-xl px-6 py-2.5">
              {saving ? "Saving..." : "Save Preferences"}
            </Button>
          </div>
        </div>
      )}
    </SectionCard>
  );
}
