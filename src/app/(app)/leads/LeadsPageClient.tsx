"use client";

import { useMemo, useState } from "react";
import { Flame, Search, ExternalLink } from "lucide-react";
import Card from "@/components/ui/Card";
import { updateLeadStatus } from "../actions/updateLeadStatus";

type Status = "NEW" | "CONTACTED" | "CONVERTED" | "DEAD" | "OUT_OF_AREA";

interface Lead {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  postalCode: string | null;
  dropOffStep: number | null;
  serviceType: string | null;
  bedCount: number | null;
  bathCount: number | null;
  preferredDate: string | null;
  isFlexible: boolean;
  preferredSlot: string | null;
  status: Status;
  source: string | null;
  lastActivityAt: string;
  createdAt: string;
  convertedJob: { id: string; jobNumber: number; jobDate: string | null } | null;
}

const STATUS_CONFIG: Record<Status, { label: string; className: string }> = {
  NEW: {
    label: "New",
    className: "bg-amber-100 text-amber-800",
  },
  CONTACTED: {
    label: "Contacted",
    className: "bg-blue-100 text-blue-800",
  },
  CONVERTED: {
    label: "Converted",
    className: "bg-emerald-100 text-emerald-800",
  },
  DEAD: {
    label: "Dead",
    className: "bg-gray-100 text-gray-600",
  },
  OUT_OF_AREA: {
    label: "Out of area",
    className: "bg-orange-100 text-orange-700",
  },
};

const STATUS_FILTERS: { value: Status | "ALL"; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "NEW", label: "New" },
  { value: "CONTACTED", label: "Contacted" },
  { value: "CONVERTED", label: "Converted" },
  { value: "OUT_OF_AREA", label: "Out of area" },
  { value: "DEAD", label: "Dead" },
];

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function LeadsPageClient({ leads }: { leads: Lead[] }) {
  const [filter, setFilter] = useState<Status | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [updating, setUpdating] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let out = leads;
    if (filter !== "ALL") out = out.filter((l) => l.status === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      out = out.filter(
        (l) =>
          l.email.toLowerCase().includes(q) ||
          (l.name && l.name.toLowerCase().includes(q)) ||
          (l.phone && l.phone.includes(q)) ||
          (l.postalCode && l.postalCode.toLowerCase().includes(q))
      );
    }
    return out;
  }, [leads, filter, search]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: leads.length };
    for (const l of leads) c[l.status] = (c[l.status] || 0) + 1;
    return c;
  }, [leads]);

  async function handleStatusChange(id: string, status: Status) {
    setUpdating(id);
    await updateLeadStatus({ id, status });
    setUpdating(null);
    // Page revalidation handled server-side via revalidatePath.
    // The list will refresh on next navigation; for instant feedback we'd
    // bump a local state mirror.
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl !font-light tracking-tight text-[#005F6A] flex items-center gap-3">
          <Flame className="w-7 h-7" /> Leads
        </h1>
        <p className="text-sm text-[#005F6A]/70 mt-1">
          Hot leads and abandoned bookings from the public form.
        </p>
      </div>

      <Card variant="default" className="p-5">
        <div className="flex flex-wrap items-center gap-3 mb-5">
          <div className="flex flex-wrap gap-1">
            {STATUS_FILTERS.map((f) => {
              const active = filter === f.value;
              const count = counts[f.value] ?? 0;
              return (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setFilter(f.value)}
                  className={`px-3 py-1.5 rounded-full text-xs transition-colors ${
                    active
                      ? "bg-[#005F6A] text-white"
                      : "bg-[#005F6A]/5 text-[#005F6A] hover:bg-[#005F6A]/10"
                  }`}>
                  {f.label}
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
            })}
          </div>
          <div className="flex-1 min-w-[200px] relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#005F6A]/40" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search email, name, phone, postal..."
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-[#005F6A]/5 text-sm text-[#005F6A] placeholder:text-[#005F6A]/40 focus:outline-none focus:ring-2 focus:ring-[#005F6A]/20"
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center text-sm text-[#005F6A]/60 py-12">
            No leads match these filters yet.
          </div>
        ) : (
          <div className="rounded-xl overflow-hidden bg-[#005F6A]/5">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wide text-[#005F6A]/60">
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Property</th>
                  <th className="px-4 py-3">Preferred</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Activity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#005F6A]/10">
                {filtered.map((l) => {
                  const cfg = STATUS_CONFIG[l.status];
                  return (
                    <tr key={l.id} className="text-[#005F6A]">
                      <td className="px-4 py-3">
                        <div className="font-medium">
                          {l.name || "—"}
                        </div>
                        <div className="text-xs text-[#005F6A]/60">
                          {l.email}
                        </div>
                        {l.phone && (
                          <div className="text-xs text-[#005F6A]/60">
                            {l.phone}
                          </div>
                        )}
                        {l.postalCode && (
                          <div className="text-[10px] font-mono mt-0.5 text-[#005F6A]/50">
                            {l.postalCode}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {l.bedCount !== null || l.bathCount !== null ? (
                          <div className="text-xs">
                            {l.bedCount ?? "?"} bed · {l.bathCount ?? "?"} bath
                          </div>
                        ) : (
                          <span className="text-xs text-[#005F6A]/40">—</span>
                        )}
                        {l.serviceType && (
                          <div className="text-[10px] text-[#005F6A]/50">
                            {l.serviceType}
                          </div>
                        )}
                        {l.dropOffStep !== null && (
                          <div className="text-[10px] text-[#005F6A]/40 mt-1">
                            Stopped at step {l.dropOffStep}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {l.preferredDate ? (
                          <>
                            <div>
                              {new Date(l.preferredDate).toLocaleDateString()}
                            </div>
                            <div className="text-[#005F6A]/60">
                              {l.isFlexible
                                ? "Flexible"
                                : l.preferredSlot || "—"}
                            </div>
                          </>
                        ) : (
                          <span className="text-[#005F6A]/40">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={l.status}
                          disabled={updating === l.id}
                          onChange={(e) =>
                            handleStatusChange(l.id, e.target.value as Status)
                          }
                          className={`px-2 py-1 rounded-full text-[10px] font-medium border-0 focus:outline-none focus:ring-2 focus:ring-[#005F6A]/20 ${cfg.className}`}>
                          {Object.entries(STATUS_CONFIG).map(([s, c]) => (
                            <option key={s} value={s}>
                              {c.label}
                            </option>
                          ))}
                        </select>
                        {l.convertedJob && (
                          <a
                            href={`/jobs/${l.convertedJob.id}`}
                            className="text-[10px] text-emerald-700 hover:underline mt-1 flex items-center gap-1">
                            Job #{l.convertedJob.jobNumber}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-[#005F6A]/60">
                        {formatRelative(l.lastActivityAt)}
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
