import { redirect } from "next/navigation";

// Public self-service sign-up is disabled.
//
// Fixaro accounts are never self-created:
//   • Staff (OWNER/ADMIN/OPS_MANAGER/FIELD_LEAD/EMPLOYEE) are created by an
//     admin from the Employees screen (see actions/createEmployee.ts), which
//     writes the user row directly and sets `role` explicitly.
//   • Customers claim their account through /portal/setup, which links to an
//     existing Client record.
//
// Anyone landing here (old bookmark, stale link) is sent to sign-in.
//
// NOTE: this page is only the UI. better-auth's POST /api/auth/sign-up/email
// endpoint stays reachable because /portal/setup depends on it. The real
// protection is that `User.role` now defaults to CLIENT (migration
// 20260710010000_default_role_client), so that endpoint cannot mint staff.
export default function SignUpDisabled() {
  redirect("/sign-in");
}
