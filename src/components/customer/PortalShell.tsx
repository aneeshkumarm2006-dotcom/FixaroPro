"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, CalendarClock, UserCircle, LogOut, Sparkles } from "lucide-react";

interface PortalShellProps {
  user: { name: string; email: string };
  signOutAction: () => void | Promise<void>;
  children: React.ReactNode;
}

export default function PortalShell({
  user,
  signOutAction,
  children,
}: PortalShellProps) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/portal" ? pathname === "/portal" : pathname.startsWith(href);

  const initials = user.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
  const firstName = user.name.split(/\s+/)[0] ?? user.name;
  const lastInitial = user.name.split(/\s+/)[1]?.[0] ?? "";

  return (
    <div className="cl-customer">
      <div className="cl-portal">
        <aside className="cl-psidebar">
          <div className="cl-psidebar-logo">
            <span
              className="cl-logo-mark"
              style={{ background: "#fff", color: "var(--primary)" }}>
              <Sparkles size={18} strokeWidth={1.8} />
            </span>
            <span>cleano</span>
          </div>

          <nav>
            <ul className="cl-pnav" aria-label="Portal sections">
              <li>
                <Link
                  href="/portal"
                  className={isActive("/portal") && pathname === "/portal" ? "active" : ""}>
                  <Home size={16} />
                  <span>Overview</span>
                </Link>
              </li>
              <li>
                <Link
                  href="/portal/bookings"
                  className={pathname.startsWith("/portal/bookings") ? "active" : ""}>
                  <CalendarClock size={16} />
                  <span>Bookings</span>
                </Link>
              </li>
              <li>
                <Link
                  href="/portal/account"
                  className={pathname.startsWith("/portal/account") ? "active" : ""}>
                  <UserCircle size={16} />
                  <span>Account</span>
                </Link>
              </li>
            </ul>
          </nav>

          <div style={{ marginTop: "auto" }}>
            <Link
              href="/book"
              className="cl-btn"
              style={{
                background: "#fff",
                color: "var(--primary)",
                height: 44,
                fontSize: 13,
                fontWeight: 600,
                width: "100%",
                marginBottom: 16,
                boxShadow: "0 4px 12px rgba(0,0,0,0.18)",
              }}>
              + New booking
            </Link>

            <div className="cl-psidebar-user">
              <span className="cl-psidebar-avatar">{initials || "C"}</span>
              <div className="cl-psidebar-user-meta">
                <strong>
                  {firstName} {lastInitial ? `${lastInitial}.` : ""}
                </strong>
                <span>{user.email}</span>
              </div>
              <form action={signOutAction}>
                <button
                  type="submit"
                  className="cl-psidebar-signout"
                  aria-label="Sign out">
                  <LogOut size={14} />
                </button>
              </form>
            </div>
          </div>
        </aside>

        <main className="cl-pmain">
          <div className="cl-pmain-inner cl-fade-up">{children}</div>
        </main>
      </div>
    </div>
  );
}
