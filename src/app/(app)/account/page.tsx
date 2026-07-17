import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/page-guards";
import { db } from "@/db";
import AccountClient from "./AccountClient";

export const metadata = {
  title: "Account · Fixaro",
};

/**
 * Self-service account/profile page for the signed-in staff user (any non-client
 * role). CLIENT users never reach the (app) group — the layout bounces them to
 * /portal, and requireStaff() denies them here too (defense in depth).
 *
 * The record is always the session user's own — there is no id in the URL, and
 * the underlying updateUserSettings action re-scopes every write to
 * session.user.id server-side, so there is no IDOR surface.
 */
export default async function AccountPage() {
  const session = await requireStaff();

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true, phone: true, role: true },
  });

  if (!user) redirect("/sign-in");

  return (
    <AccountClient
      initial={{
        name: user.name ?? "",
        email: user.email ?? "",
        phone: user.phone ?? "",
        role: user.role,
      }}
    />
  );
}
