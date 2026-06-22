import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { ScrollText } from "lucide-react";

const ADMIN_ROLES = ["OWNER", "ADMIN", "OPS_MANAGER"];

// Cross-entity high-impact audit log (SOP §9): eligibility changes, deposit
// adjustments, cancellation fees, provider overrides — who/what/when/why.
export default async function AuditPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");
  const role = (session.user as { role?: string }).role;
  if (!role || !ADMIN_ROLES.includes(role)) redirect("/dashboard");

  const entries = await db.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <ScrollText size={22} /> Audit Log
        </h1>
        <p className="text-sm text-neutral-500 mt-1">
          High-impact changes: eligibility, deposits, refunds, cancellation fees, and provider
          overrides. Most recent 200 events.
        </p>
      </header>

      {entries.length === 0 ? (
        <p className="text-sm text-neutral-500">No audit entries yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-neutral-200">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-neutral-500 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">When</th>
                <th className="px-3 py-2 font-medium">Action</th>
                <th className="px-3 py-2 font-medium">Entity</th>
                <th className="px-3 py-2 font-medium">Change</th>
                <th className="px-3 py-2 font-medium">Actor</th>
                <th className="px-3 py-2 font-medium">Reason</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-t border-neutral-100 align-top">
                  <td className="px-3 py-2 whitespace-nowrap text-neutral-500">
                    {e.createdAt.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 font-medium text-neutral-800">{e.action}</td>
                  <td className="px-3 py-2 text-neutral-600">
                    {e.entityType}
                    <span className="text-neutral-400"> · {e.entityId.slice(0, 8)}</span>
                  </td>
                  <td className="px-3 py-2 text-neutral-600">
                    {e.field ? <span className="text-neutral-400">{e.field}: </span> : null}
                    {e.oldValue != null ? `${e.oldValue} → ` : ""}
                    {e.newValue ?? ""}
                    <div className="text-neutral-500">{e.description}</div>
                  </td>
                  <td className="px-3 py-2 text-neutral-600 whitespace-nowrap">{e.actorEmail ?? "—"}</td>
                  <td className="px-3 py-2 text-neutral-500">{e.reason ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
