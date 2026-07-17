import { redirect } from "next/navigation";
import { requireSession } from "@/lib/page-guards";
import { homeForRole } from "@/lib/role-routing";
import { getStrikeSummary } from "@/lib/strikes";
import StrikesClient from "./StrikesClient";

export const metadata = {
  title: "My strikes · Fixaro",
};

/**
 * Provider-facing strike history. Every Pro sees ONLY their own accountability
 * strikes — read-only. There is no id in the URL, so there is nothing to tamper
 * with (no IDOR surface): the record is always scoped to session.user.id.
 *
 * Authorization: field providers only (EMPLOYEE / FIELD_LEAD). Admins/owners are
 * not field staff and don't accrue strikes, so they are bounced to their own
 * home. Clients never reach the (app) group (the layout redirects them). Fail
 * closed — any role we don't explicitly allow is denied.
 */
export default async function StrikesPage() {
  const session = await requireSession();
  const role = (session.user as { role?: string }).role;

  if (role !== "EMPLOYEE" && role !== "FIELD_LEAD") {
    redirect(homeForRole(role));
  }

  // Reuse the exact shape the admin employees/[id] page renders from.
  const summary = await getStrikeSummary(session.user.id);

  return <StrikesClient summary={summary} />;
}
