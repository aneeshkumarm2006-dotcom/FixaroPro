import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { homeForRole, isClientRole } from "@/lib/role-routing";

// Role-aware landing after sign-in.
//
// Query params:
//   ?from=portal  → the visitor came from /portal/login. Only CLIENT accounts
//                   are allowed here; staff accounts are signed out and bounced
//                   back to /portal/login with an error.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const baseUrl = `${url.protocol}//${url.host}`;
  const from = url.searchParams.get("from");

  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    return NextResponse.redirect(`${baseUrl}/sign-in`);
  }

  const role = (session.user as { role?: string }).role;

  // Enforce role at the customer portal login.
  if (from === "portal" && !isClientRole(role)) {
    // Sign the staff account out so they don't sit in a half-state.
    try {
      await auth.api.signOut({ headers: await headers() });
    } catch {
      // Ignore — worst case the user is signed in but in the wrong area.
    }
    return NextResponse.redirect(
      `${baseUrl}/portal/login?error=staff_account`
    );
  }

  return NextResponse.redirect(`${baseUrl}${homeForRole(role)}`);
}
