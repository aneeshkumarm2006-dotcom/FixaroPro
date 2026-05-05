"use client";

import { useEffect, useState } from "react";
import { Calendar } from "lucide-react";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { getAvailability } from "../../actions/getAvailability";
import {
  setAvailability,
  type AvailabilitySlotInput,
} from "../../actions/setAvailability";
import type { AvailabilityDay } from "@prisma/client";
import { SectionCard, Field, Feedback, Msg } from "./_shared";

const DAYS: { key: AvailabilityDay; label: string }[] = [
  { key: "MONDAY", label: "Monday" },
  { key: "TUESDAY", label: "Tuesday" },
  { key: "WEDNESDAY", label: "Wednesday" },
  { key: "THURSDAY", label: "Thursday" },
  { key: "FRIDAY", label: "Friday" },
  { key: "SATURDAY", label: "Saturday" },
  { key: "SUNDAY", label: "Sunday" },
];

interface DayRow {
  day: AvailabilityDay;
  isAvailable: boolean;
  startTime: string;
  endTime: string;
}

const DEFAULT_ROW = (day: AvailabilityDay): DayRow => ({
  day,
  isAvailable: false,
  startTime: "09:00",
  endTime: "17:00",
});

interface AvailabilityTabProps {
  employeeId?: string;
}

export default function AvailabilityTab({ employeeId }: AvailabilityTabProps) {
  const [rows, setRows] = useState<DayRow[]>(() => DAYS.map((d) => DEFAULT_ROW(d.key)));
  const [isRecurring, setIsRecurring] = useState(true);
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [effectiveTo, setEffectiveTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const res = await getAvailability(employeeId);
      if (cancelled) return;
      if (res.success) {
        const byDay = new Map(res.slots.map((s) => [s.day, s]));
        setRows(
          DAYS.map((d) => {
            const slot = byDay.get(d.key);
            if (!slot) return DEFAULT_ROW(d.key);
            return {
              day: d.key,
              isAvailable: slot.isAvailable,
              startTime: slot.startTime,
              endTime: slot.endTime,
            };
          })
        );
        const first = res.slots[0];
        if (first) {
          setIsRecurring(first.isRecurring);
          setEffectiveFrom(
            first.effectiveFrom
              ? new Date(first.effectiveFrom).toISOString().split("T")[0]
              : ""
          );
          setEffectiveTo(
            first.effectiveTo
              ? new Date(first.effectiveTo).toISOString().split("T")[0]
              : ""
          );
        }
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

  function updateRow(day: AvailabilityDay, patch: Partial<DayRow>) {
    setRows((prev) =>
      prev.map((r) => (r.day === day ? { ...r, ...patch } : r))
    );
  }

  async function handleSave() {
    setSaving(true);
    setMsg(null);

    for (const r of rows) {
      if (r.isAvailable && r.startTime >= r.endTime) {
        setMsg({
          type: "error",
          text: `End time must be after start time on ${r.day}.`,
        });
        setSaving(false);
        return;
      }
    }

    const slots: AvailabilitySlotInput[] = rows.map((r) => ({
      day: r.day,
      startTime: r.startTime,
      endTime: r.endTime,
      isAvailable: r.isAvailable,
      isRecurring,
      effectiveFrom: effectiveFrom || null,
      effectiveTo: effectiveTo || null,
    }));

    const res = await setAvailability({ employeeId, slots });
    if (res.success) {
      setMsg({ type: "success", text: "Availability saved." });
    } else {
      setMsg({ type: "error", text: res.error || "Failed to save." });
    }
    setSaving(false);
  }

  return (
    <SectionCard
      title="Weekly Availability"
      description="Mark the days and hours you're available for jobs."
      icon={Calendar}>
      {loading ? (
        <p className="text-sm text-[#005F6A]/60">Loading availability...</p>
      ) : (
        <div className="space-y-4">
          <div className="space-y-2">
            {rows.map((row) => {
              const label = DAYS.find((d) => d.key === row.day)?.label ?? row.day;
              return (
                <div
                  key={row.day}
                  className="grid grid-cols-[110px_auto_1fr_auto_1fr] gap-2 items-center p-3 rounded-xl bg-[#005F6A]/5">
                  <span className="text-sm font-[400] text-[#005F6A]">
                    {label}
                  </span>
                  <label className="flex items-center gap-2 text-xs text-[#005F6A] select-none">
                    <input
                      type="checkbox"
                      checked={row.isAvailable}
                      onChange={(e) =>
                        updateRow(row.day, { isAvailable: e.target.checked })
                      }
                      className="accent-[#005F6A]"
                    />
                    Available
                  </label>
                  <Input
                    variant="form"
                    type="time"
                    value={row.startTime}
                    disabled={!row.isAvailable}
                    onChange={(e) =>
                      updateRow(row.day, { startTime: e.target.value })
                    }
                  />
                  <span className="text-xs text-[#005F6A]/60">to</span>
                  <Input
                    variant="form"
                    type="time"
                    value={row.endTime}
                    disabled={!row.isAvailable}
                    onChange={(e) =>
                      updateRow(row.day, { endTime: e.target.value })
                    }
                  />
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
            <label className="flex items-center gap-2 text-sm text-[#005F6A] select-none">
              <input
                type="checkbox"
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
                className="accent-[#005F6A]"
              />
              Recurring weekly
            </label>
            <Field label="Effective From">
              <Input
                variant="form"
                type="date"
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
              />
            </Field>
            <Field label="Effective To">
              <Input
                variant="form"
                type="date"
                value={effectiveTo}
                onChange={(e) => setEffectiveTo(e.target.value)}
              />
            </Field>
          </div>

          {msg && <Feedback msg={msg} />}

          <div className="flex justify-end">
            <Button
              type="button"
              variant="action"
              border={false}
              disabled={saving}
              onClick={handleSave}
              className="rounded-xl px-6 py-2.5">
              {saving ? "Saving..." : "Save Availability"}
            </Button>
          </div>
        </div>
      )}
    </SectionCard>
  );
}
