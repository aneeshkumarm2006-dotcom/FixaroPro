import { getCachedSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { isAdminRole, isClientRole } from "@/lib/role-routing";
import signOut from "./actions/signOut";
import Sidebar from "./Sidebar";

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

  // Clients never see the staff app — bounce them to their portal.
  if (isClientRole(userWithRole.role)) {
    redirect("/portal");
  }

  const isAdmin = isAdminRole(userWithRole.role);

  return (
    <Sidebar user={userWithRole} isAdmin={isAdmin} signOutAction={signOut}>
      {children}
    </Sidebar>
  );
}
