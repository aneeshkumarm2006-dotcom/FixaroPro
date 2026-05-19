import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { homeForRole } from "@/lib/role-routing";

// Role-aware landing after sign-in. The sign-in / sign-up flows redirect here
// instead of to a hardcoded /dashboard.
export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });

  const url = new URL(req.url);
  const baseUrl = `${url.protocol}//${url.host}`;

  if (!session) {
    return NextResponse.redirect(`${baseUrl}/sign-in`);
  }

  const role = (session.user as { role?: string }).role;
  return NextResponse.redirect(`${baseUrl}${homeForRole(role)}`);
}
