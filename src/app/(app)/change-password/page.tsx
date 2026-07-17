import { requireStaff } from "@/lib/page-guards";
import ChangePasswordClient from "./ChangePasswordClient";

export const metadata = {
  title: "Change password · Fixaro",
};

/**
 * Self-service password change for the signed-in staff user. The actual change
 * runs through better-auth's `authClient.changePassword`, which requires the
 * current password and never exposes/handles a raw hash on our side.
 *
 * Authorization: requireStaff() denies CLIENT users (and unauthenticated
 * visitors redirect to /sign-in). Fail closed — the server guard runs before
 * the client form is ever rendered.
 */
export default async function ChangePasswordPage() {
  await requireStaff();
  return <ChangePasswordClient />;
}
