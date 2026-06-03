"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, CalendarClock, UserCircle, LogOut, Menu, X } from "lucide-react";
import Image from "next/image";

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
  const [open, setOpen] = useState(false);

  // Close the drawer whenever the route changes.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Lock body scroll while the drawer is open on mobile.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

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
      {/* Mobile top bar (hidden on desktop via CSS) */}
      <header className="cl-portal-topbar">
        <button
          className="cl-portal-burger"
          onClick={() => setOpen(true)}
          aria-label="Open menu">
          <Menu size={20} />
        </button>
        <span className="cl-portal-topbar-title">Fixaro</span>
        <span style={{ flex: 1 }} />
        <span className="cl-portal-topbar-avatar">{initials || "C"}</span>
      </header>

      {/* Backdrop (mobile only) */}
      <div
        className={`cl-portal-backdrop${open ? " cl-portal-open" : ""}`}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />

      <div className="cl-portal">
        <aside className={`cl-psidebar${open ? " cl-portal-open" : ""}`}>
          <div className="cl-psidebar-logo">
            <div style={{ width: 36, height: 36, borderRadius: 12, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0, boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }}>
              <Image
                src="/images/Fixaro-Logo.png"
                alt="Fixaro"
                width={36}
                height={36}
                style={{ objectFit: "contain" }}
              />
            </div>
            <span style={{
              fontFamily: "var(--font-dm-sans, 'DM Sans', system-ui, sans-serif)",
              fontWeight: 600,
              fontSize: 17,
              letterSpacing: "-0.02em",
              color: "#fff",
              flex: 1,
            }}>Fixaro</span>
            <button
              className="cl-portal-drawer-close"
              onClick={() => setOpen(false)}
              aria-label="Close menu">
              <X size={18} />
            </button>
          </div>

          <nav>
            <ul className="cl-pnav" aria-label="Portal sections">
              <li>
                <Link
                  href="/portal"
                  onClick={() => setOpen(false)}
                  className={isActive("/portal", pathname) && pathname === "/portal" ? "active" : ""}>
                  <Home size={16} />
                  <span>Overview</span>
                </Link>
              </li>
              <li>
                <Link
                  href="/portal/bookings"
                  onClick={() => setOpen(false)}
                  className={pathname.startsWith("/portal/bookings") ? "active" : ""}>
                  <CalendarClock size={16} />
                  <span>Bookings</span>
                </Link>
              </li>
              <li>
                <Link
                  href="/portal/account"
                  onClick={() => setOpen(false)}
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
              onClick={() => setOpen(false)}
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

function isActive(href: string, pathname: string) {
  return href === "/portal" ? pathname === "/portal" : pathname.startsWith(href);
}
