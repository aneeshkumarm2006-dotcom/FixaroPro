import { getCachedSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { isAdminRole, isClientRole } from "@/lib/role-routing";
import signOut from "./actions/signOut";
import Sidebar from "./Sidebar";
import CleanerSidebar from "./CleanerSidebar";
import InstallPrompt from "@/components/InstallPrompt";
import { InstallProvider } from "@/components/InstallContext";
import PresenceHeartbeat from "@/components/PresenceHeartbeat";
import { getRuntimeConfig, ensureServiceConfigSeeded } from "@/lib/config/service-config";
import { ServiceConfigProvider } from "@/lib/config/ServiceConfigProvider";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getCachedSession();

  if (!session) {
    redirect("/sign-in");
  }

  const { user } = session;
  const userWithRole = user as typeof user & { role: string };

  if (isClientRole(userWithRole.role)) {
    redirect("/portal");
  }

  const isAdmin = isAdminRole(userWithRole.role);

  // Bootstrap the config tables from the TS defaults on the first admin visit —
  // the same pattern the notification catalog uses (settings/page.tsx). Until
  // this runs, getRuntimeConfig() serves those same defaults, so the app is
  // correct either way; seeding just makes them editable. Never throws.
  if (isAdmin) await ensureServiceConfigSeeded();

  // Admin and provider surfaces (job cards, calendar, eligibility, bid cards)
  // render service labels and prices from the catalog, so they need it too.
  const config = await getRuntimeConfig();

  if (!isAdmin) {
    return (
      <ServiceConfigProvider config={config}>
        <InstallProvider>
          <div className="cl-app-shell">
            <CleanerSidebar user={userWithRole} signOutAction={signOut} />
            <main className="cl-app-main">
              <div className="cl-app-main-inner">
                {children}
              </div>
            </main>
            <InstallPrompt />
            <PresenceHeartbeat />
          </div>
        </InstallProvider>
      </ServiceConfigProvider>
    );
  }

  return (
    <ServiceConfigProvider config={config}>
      <Sidebar user={userWithRole} isAdmin={isAdmin} signOutAction={signOut}>
        <PresenceHeartbeat />
        {children}
      </Sidebar>
    </ServiceConfigProvider>
  );
}
