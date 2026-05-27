import { getCachedSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { isAdminRole, isClientRole } from "@/lib/role-routing";
import signOut from "./actions/signOut";
import Sidebar from "./Sidebar";
import CleanerSidebar from "./CleanerSidebar";
import InstallPrompt from "@/components/InstallPrompt";

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

  if (!isAdmin) {
    return (
      <div className="cl-app-shell">
        <CleanerSidebar user={userWithRole} signOutAction={signOut} />
        <main className="cl-app-main">
          <div className="cl-app-main-inner">
            {children}
          </div>
        </main>
        <InstallPrompt />
      </div>
    );
  }

  return (
    <Sidebar user={userWithRole} isAdmin={isAdmin} signOutAction={signOut}>
      {children}
    </Sidebar>
  );
}
