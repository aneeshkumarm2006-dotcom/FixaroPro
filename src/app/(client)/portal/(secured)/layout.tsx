import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import signOut from "../actions/portalSignOut";
import PortalShell from "@/components/customer/PortalShell";
import RatingPopup from "../RatingPopup";
import { getPendingClientRating } from "../actions/ratingActions";
import { getRuntimeConfig } from "@/lib/config/service-config";
import { ServiceConfigProvider } from "@/lib/config/ServiceConfigProvider";

export const metadata = {
  title: "My Fixaro",
};

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    redirect("/portal/login");
  }

  const role = (session.user as { role?: string }).role;
  if (role && role !== "CLIENT") {
    redirect("/dashboard");
  }

  // Resolve display name + email — prefer Client record, fall back to User.
  const email = session.user.email?.toLowerCase() ?? "";
  const client = email
    ? await db.client.findFirst({
        where: { email },
        select: { name: true, email: true },
      })
    : null;
  const name = client?.name ?? session.user.name ?? "Customer";
  const pendingRating = await getPendingClientRating();

  // The portal renders service labels, the materials line and the cancellation
  // fee/window in its copy — all admin-editable config (SOP §3, stage 8).
  const config = await getRuntimeConfig();

  return (
    <ServiceConfigProvider config={config}>
      <PortalShell user={{ name, email }} signOutAction={signOut}>
        {pendingRating && <RatingPopup pending={pendingRating} />}
        {children}
      </PortalShell>
    </ServiceConfigProvider>
  );
}
