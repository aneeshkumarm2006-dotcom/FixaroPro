import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { homeForRole, isClientRole, isCleanerRole, isAdminRole } from "@/lib/role-routing";

// Role-aware landing after sign-in.
//
// Query params:
//   ?from=portal  → only CLIENT accounts allowed; staff are bounced back
//   ?from=admin   → only admin/ops accounts allowed; crew are bounced back
//   ?from=crew    → only EMPLOYEE accounts allowed; admins/clients are bounced back
async function signOutSafely(hdrs: Headers) {
  try { await auth.api.signOut({ headers: hdrs }); } catch { /* ignore */ }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const baseUrl = `${url.protocol}//${url.host}`;
  const from = url.searchParams.get("from");

  const hdrs = await headers();
  const session = await auth.api.getSession({ headers: hdrs });

  if (!session) {
    return NextResponse.redirect(`${baseUrl}/sign-in`);
  }

  const role = (session.user as { role?: string }).role;

  // Customer portal — staff not allowed
  if (from === "portal" && !isClientRole(role)) {
    await signOutSafely(hdrs);
    return NextResponse.redirect(`${baseUrl}/portal/login?error=staff_account`);
  }

  // Admin login — crew members not allowed
  if (from === "admin" && isCleanerRole(role)) {
    await signOutSafely(hdrs);
    return NextResponse.redirect(`${baseUrl}/sign-in?error=crew_account`);
  }

  // Crew login — non-crew not allowed
  if (from === "crew" && !isCleanerRole(role)) {
    await signOutSafely(hdrs);
    return NextResponse.redirect(`${baseUrl}/crew-sign-in?error=wrong_account`);
  }

  return NextResponse.redirect(`${baseUrl}${homeForRole(role)}`);
}
