"use client";

import { useMemo, useState } from "react";
import { Clock, Bell, Check } from "lucide-react";
import Card from "@/components/ui/Card";
import { markWaitlistNotified } from "../actions/markWaitlistNotified";
import { updateWaitlistStatus } from "../actions/updateWaitlistStatus";

type Status = "WAITING" | "NOTIFIED" | "CONVERTED" | "EXPIRED" | "CANCELLED";

interface Entry {
  id: string;
  preferredDate: string;
  email: string;
  name: string | null;
  phone: string | null;
  serviceType: string | null;
  bedCount: number | null;
  bathCount: number | null;
  notes: string | null;
  status: Status;
  notifiedAt: string | null;
  createdAt: string;
}

const STATUS_CONFIG: Record<Status, { label: string; className: string }> = {
  WAITING: { label: "Waiting", className: "bg-amber-100 text-amber-800" },
  NOTIFIED: { label: "Notified", className: "bg-blue-100 text-blue-800" },
  CONVERTED: { label: "Converted", className: "bg-emerald-100 text-emerald-800" },
  EXPIRED: { label: "Expired", className: "bg-gray-100 text-gray-600" },
  CANCELLED: { label: "Cancelled", className: "bg-gray-100 text-gray-500" },
};

export default function WaitlistPageClient({ entries }: { entries: Entry[] }) {
  const [filter, setFilter] = useState<Status | "ALL">("ALL");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (filter === "ALL") return entries;
    return entries.filter((e) => e.status === filter);
  }, [entries, filter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: entries.length };
    for (const e of entries) c[e.status] = (c[e.status] || 0) + 1;
    return c;
  }, [entries]);

  async function handleNotify(id: string) {
    setBusyId(id);
    setError(null);
    const res = await markWaitlistNotified(id);
    setBusyId(null);
    if (!res.success) setError(res.error || "Failed to notify");
  }

  async function handleStatus(id: string, status: Status) {
    setBusyId(id);
    setError(null);
    await updateWaitlistStatus({ id, status });
    setBusyId(null);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl !font-light tracking-tight text-[#005F6A] flex items-center gap-3">
          <Clock className="w-7 h-7" /> Waitlist
        </h1>
        <p className="text-sm text-[#005F6A]/70 mt-1">
          Customers waiting for a slot to open on their preferred date.
        </p>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <Card variant="default" className="p-5">
        <div className="flex flex-wrap gap-1 mb-5">
          {(["ALL", "WAITING", "NOTIFIED", "CONVERTED", "EXPIRED", "CANCELLED"] as const).map(
            (f) => {
              const active = filter === f;
              const count = counts[f] ?? 0;
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 rounded-full text-xs transition-colors ${
                    active
                      ? "bg-[#005F6A] text-white"
                      : "bg-[#005F6A]/5 text-[#005F6A] hover:bg-[#005F6A]/10"
                  }`}>
                  {f === "ALL" ? "All" : STATUS_CONFIG[f as Status].label}
                  {count > 0 && (
                    <span
                      className={`ml-1.5 ${
                        active ? "text-white/70" : "text-[#005F6A]/50"
                      }`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            }
          )}
        </div>

        {filtered.length === 0 ? (
          <div className="text-center text-sm text-[#005F6A]/60 py-12">
            No waitlist entries to show.
          </div>
        ) : (
          <div className="rounded-xl overflow-hidden bg-[#005F6A]/5">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wide text-[#005F6A]/60">
                  <th className="px-4 py-3">Preferred date</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Service</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#005F6A]/10">
                {filtered.map((w) => {
                  const cfg = STATUS_CONFIG[w.status];
                  return (
                    <tr key={w.id} className="text-[#005F6A]">
                      <td className="px-4 py-3">
                        <div className="font-medium">
                          {new Date(w.preferredDate).toLocaleDateString()}
                        </div>
                        <div className="text-[10px] text-[#005F6A]/50">
                          Added {new Date(w.createdAt).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{w.name || "—"}</div>
                        <div className="text-xs text-[#005F6A]/60">{w.email}</div>
                        {w.phone && (
                          <div className="text-xs text-[#005F6A]/60">{w.phone}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {w.serviceType && (
                          <div className="text-[#005F6A]/70">{w.serviceType}</div>
                        )}
                        {(w.bedCount !== null || w.bathCount !== null) && (
                          <div className="text-[#005F6A]/60">
                            {w.bedCount ?? "?"} bed · {w.bathCount ?? "?"} bath
                          </div>
                        )}
                        {w.notes && (
                          <div className="text-[10px] text-[#005F6A]/50 mt-1 max-w-[180px] truncate">
                            {w.notes}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div
                          className={`inline-block px-2 py-1 rounded-full text-[10px] font-medium ${cfg.className}`}>
                          {cfg.label}
                        </div>
                        {w.notifiedAt && (
                          <div className="text-[10px] text-[#005F6A]/50 mt-1">
                            Notified{" "}
                            {new Date(w.notifiedAt).toLocaleDateString()}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex flex-col gap-1 items-end">
                          {w.status === "WAITING" && (
                            <button
                              type="button"
                              onClick={() => handleNotify(w.id)}
                              disabled={busyId === w.id}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#005F6A] text-white text-xs hover:bg-[#005F6A]/90 disabled:opacity-50">
                              <Bell className="w-3.5 h-3.5" /> Notify
                            </button>
                          )}
                          {w.status === "NOTIFIED" && (
                            <button
                              type="button"
                              onClick={() => handleStatus(w.id, "CONVERTED")}
                              disabled={busyId === w.id}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs hover:bg-emerald-700 disabled:opacity-50">
                              <Check className="w-3.5 h-3.5" /> Mark converted
                            </button>
                          )}
                          {(w.status === "WAITING" || w.status === "NOTIFIED") && (
                            <button
                              type="button"
                              onClick={() => handleStatus(w.id, "CANCELLED")}
                              disabled={busyId === w.id}
                              className="text-[10px] text-[#005F6A]/50 hover:text-red-600">
                              Cancel
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
