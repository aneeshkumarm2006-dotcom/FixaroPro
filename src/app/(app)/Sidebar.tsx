"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import NavLink from "./NavLink";
import UserActions from "./UserActions";

interface User {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: "OWNER" | "ADMIN" | "EMPLOYEE";
}

interface SidebarProps {
  user: User;
  isAdmin: boolean;
  signOutAction: () => Promise<void>;
  children: React.ReactNode;
}

export default function Sidebar({
  user,
  isAdmin,
  signOutAction,
  children,
}: SidebarProps) {
  const [hovered, setHovered] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  // Close mobile drawer on navigation
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Close mobile drawer on Escape
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  // Lock body scroll while mobile drawer is open
  useEffect(() => {
    if (!mobileOpen) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [mobileOpen]);

  // Whether labels are visible. Drives NavLink/UserActions content.
  const expanded = hovered || mobileOpen;

  return (
    <div className="min-h-screen bg-white">
      {/* Mobile hamburger */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        aria-label="Open menu"
        aria-expanded={mobileOpen}
        className="md:hidden fixed top-4 left-4 z-30 p-2.5 rounded-xl bg-white/80 backdrop-blur-md shadow-md text-[#005F6A] hover:bg-white transition-colors print:hidden">
        <Menu className="w-6 h-6" />
      </button>

      {/* Mobile backdrop */}
      <div
        onClick={() => setMobileOpen(false)}
        aria-hidden="true"
        className={`md:hidden fixed inset-0 bg-black/40 z-40 transition-opacity duration-300 print:hidden ${
          mobileOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      />

      {/* Sidebar */}
      <aside
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={`fixed left-0 top-0 bottom-0 p-3 z-50 transition-all duration-300 ease-in-out w-64 print:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0 ${hovered ? "md:w-64" : "md:w-[5.5rem]"}`}>
        <div className="w-full h-full bg-white/70 backdrop-blur-md shadow-lg rounded-2xl flex flex-col overflow-hidden">
          {/* Logo + mobile close */}
          <div
            className={`h-16 flex items-center ${
              expanded ? "justify-between px-4" : "justify-center"
            }`}>
            <Link
              href="/dashboard"
              className={`flex items-center ${
                expanded ? "gap-3 min-w-0" : "justify-center w-12 h-12"
              }`}>
              <div className="w-10 h-10 rounded-xl bg-[#005F6A] flex items-center justify-center shrink-0">
                <span className="text-white text-lg">C</span>
              </div>
              <span
                className={`text-[#005F6A] font-medium whitespace-nowrap transition-all duration-300 ${
                  expanded
                    ? "opacity-100 translate-x-0"
                    : "opacity-0 -translate-x-2 pointer-events-none w-0"
                }`}>
                Cleano
              </span>
            </Link>
            {mobileOpen && (
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Close menu"
                className="md:hidden p-2 rounded-lg text-[#005F6A]/70 hover:bg-[#005F6A]/10 hover:text-[#005F6A] transition-colors">
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Navigation */}
          <nav
            className={`flex-1 py-2 space-y-1 overflow-y-auto overflow-x-hidden flex flex-col ${
              expanded ? "items-stretch px-3" : "items-center"
            }`}>
            <NavLink href="/dashboard" icon="dashboard" expanded={expanded}>
              Dashboard
            </NavLink>
            {isAdmin && (
              <>
                <NavLink href="/analytics" icon="analytics" expanded={expanded}>
                  Analytics
                </NavLink>
                <NavLink href="/employees" icon="employees" expanded={expanded}>
                  Employees
                </NavLink>
                <NavLink href="/clients" icon="clients" expanded={expanded}>
                  Clients
                </NavLink>
                <NavLink
                  href="/inventory"
                  icon="inventory"
                  expanded={expanded}
                  exclude={["/inventory/rag-wash"]}>
                  Inventory
                </NavLink>
                <NavLink
                  href="/inventory/rag-wash"
                  icon="rag-wash"
                  expanded={expanded}>
                  Rag Wash
                </NavLink>
                <NavLink href="/jobs" icon="jobs" expanded={expanded}>
                  Jobs
                </NavLink>
                <NavLink href="/payouts" icon="payouts" expanded={expanded}>
                  Payouts
                </NavLink>
                <NavLink href="/finances" icon="finances" expanded={expanded}>
                  Finances
                </NavLink>
                <NavLink href="/invoices" icon="invoices" expanded={expanded}>
                  Invoices
                </NavLink>
                <NavLink href="/sales" icon="sales" expanded={expanded}>
                  Sales
                </NavLink>
              </>
            )}
            <NavLink href="/my-jobs" icon="my-jobs" expanded={expanded}>
              My Jobs
            </NavLink>
            <NavLink href="/my-pay" icon="my-pay" expanded={expanded}>
              My Pay
            </NavLink>
            <NavLink
              href="/my-inventory"
              icon="my-inventory"
              expanded={expanded}>
              My Inventory
            </NavLink>
            <NavLink href="/calendar" icon="calendar" expanded={expanded}>
              Calendar
            </NavLink>
            <NavLink href="/training" icon="training" expanded={expanded}>
              Training
            </NavLink>
            <NavLink href="/documents" icon="documents" expanded={expanded}>
              Documents
            </NavLink>
            <NavLink href="/chat" icon="chat" expanded={expanded}>
              Chat
            </NavLink>
          </nav>

          {/* User Section */}
          <div
            className={`pb-4 ${
              expanded ? "px-3" : "flex justify-center"
            }`}>
            <UserActions
              user={user}
              signOutAction={signOutAction}
              expanded={expanded}
            />
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="ml-0 md:ml-[5.5rem] h-screen overflow-hidden overflow-y-auto print:!ml-0 print:!h-auto print:!overflow-visible">
        <main className="h-full bg-white print:!h-auto">{children}</main>
      </div>
    </div>
  );
}
