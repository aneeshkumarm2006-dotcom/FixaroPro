import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import signOut from "./actions/signOut";
import Sidebar from "./Sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/sign-in");
  }

  const { user } = session;
  const userWithRole = user as typeof user & {
    role: "OWNER" | "ADMIN" | "EMPLOYEE";
  };
  const isAdmin =
    userWithRole.role === "OWNER" || userWithRole.role === "ADMIN";

  return (
    <Sidebar
      user={userWithRole}
      isAdmin={isAdmin}
      signOutAction={signOut}>
      {children}
    </Sidebar>
  );
}
