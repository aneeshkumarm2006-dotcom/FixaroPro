"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, MessageCircle } from "lucide-react";
import NavLink from "./NavLink";
import UserActions from "./UserActions";
import { getUnreadChatCount } from "./chat/actions";
import { getPendingRequestCount } from "./actions/getPendingRequestCount";

interface User {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: string;
}

interface SidebarProps {
  user: User;
  isAdmin: boolean;
  signOutAction: () => Promise<void>;
  children: React.ReactNode;
}

function SectionLabel({ expanded, children }: { expanded: boolean; children: string }) {
  if (!expanded) return <div className="mx-2 my-1.5 h-px bg-white/10" />;
  return (
    <p className="px-3 pt-4 pb-1 text-[10px] font-[700] uppercase tracking-[0.12em] text-white/35 select-none">
      {children}
    </p>
  );
}

export default function Sidebar({
  user,
  isAdmin,
  signOutAction,
  children,
}: SidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const [chatUnread, setChatUnread] = useState(0);
  const [pendingRequests, setPendingRequests] = useState(0);
  const [chatToast, setChatToast] = useState<{ senderName: string; body: string } | null>(null);
  const prevLatestAtRef = useRef<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pathnameRef = useRef(pathname);

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

  // Keep pathname ref current; dismiss toast when user opens chat
  useEffect(() => {
    pathnameRef.current = pathname;
    if (pathname.startsWith("/chat")) {
      setChatToast(null);
    }
  }, [pathname]);

  // Poll for unread chat count and show toast on new messages
  useEffect(() => {
    let cancelled = false;

    async function poll() {
      if (cancelled) return;
      try {
        const { count, latest } = await getUnreadChatCount();
        if (cancelled) return;

        setChatUnread(count);

        const latestAt = latest?.at ?? "";
        const isInitialized = prevLatestAtRef.current !== null;
        const hasNew =
          isInitialized &&
          latestAt !== "" &&
          latestAt !== prevLatestAtRef.current;

        if (hasNew && !pathnameRef.current.startsWith("/chat")) {
          setChatToast({ senderName: latest!.senderName, body: latest!.body });
          if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
          toastTimerRef.current = setTimeout(() => setChatToast(null), 5000);
        }

        prevLatestAtRef.current = latestAt;
      } catch {
        // ignore transient errors
      }
    }

    poll();
    const id = setInterval(poll, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  // Poll pending portal requests (cancellation + reschedule) every 5s for
  // the Requests sidebar badge. resolveJobRequest clears the *RequestedAt
  // field on approve/deny, so the badge naturally drops when an admin acts.
  useEffect(() => {
    let cancelled = false;
    async function poll() {
      if (cancelled) return;
      try {
        const { count } = await getPendingRequestCount();
        if (!cancelled) setPendingRequests(count);
      } catch {
        // ignore transient errors
      }
    }
    poll();
    const id = setInterval(poll, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  // Always expanded on desktop; follows drawer on mobile.
  const expanded = true;

  return (
    <div className="min-h-screen bg-white">
      {/* Mobile hamburger */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        aria-label="Open menu"
        aria-expanded={mobileOpen}
        className="md:hidden fixed top-4 left-4 z-30 p-2.5 rounded-xl bg-white/80 backdrop-blur-md shadow-md text-[#1c1917] hover:bg-white transition-colors print:hidden">
        <Menu className="w-6 h-6" />
      </button>

      {/* Mobile backdrop */}
      <div
        onClick={() => setMobileOpen(false)}
        aria-hidden="true"
        className={`md:hidden fixed inset-0 bg-black/50 z-40 transition-opacity duration-300 print:hidden ${
          mobileOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      />

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 bottom-0 z-50 w-64 print:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0`}>
        <div className="w-full h-full flex flex-col overflow-hidden bg-[#0c0b0a]">
          {/* Logo + mobile close */}
          <div
            className={`h-16 flex items-center shrink-0 ${
              expanded ? "justify-between px-4" : "justify-center"
            }`}>
            <Link
              href="/dashboard"
              className={`flex items-center ${
                expanded ? "gap-3 min-w-0" : "justify-center w-12 h-12"
              }`}>
              <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center shrink-0 overflow-hidden shadow-sm">
                <Image src="/images/Fixaro-Logo.png" alt="Fixaro" width={36} height={36} className="object-contain" />
              </div>
              <span
                className={`text-white font-semibold whitespace-nowrap transition-all duration-300 ${
                  expanded
                    ? "opacity-100 translate-x-0"
                    : "opacity-0 -translate-x-2 pointer-events-none w-0"
                }`}>
                Fixaro
              </span>
              {isAdmin && expanded && (
                <span className="ml-0.5 text-[9px] font-[700] uppercase tracking-[0.12em] px-1.5 py-0.5 rounded-full shrink-0"
                  style={{ background: "rgba(203,163,90,0.18)", color: "#cba35a" }}>
                  Admin
                </span>
              )}
            </Link>
            {mobileOpen && (
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Close menu"
                className="md:hidden p-2 rounded-lg text-white/50 hover:bg-white/10 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Navigation */}
          <nav
            className={`flex-1 py-2 overflow-y-auto overflow-x-hidden flex flex-col ${
              expanded ? "items-stretch px-3" : "items-center"
            }`}>
            {isAdmin ? (
              <>
                <SectionLabel expanded={expanded}>Overview</SectionLabel>
                <NavLink href="/dashboard" icon="dashboard" expanded={expanded}>Dashboard</NavLink>
                <NavLink href="/analytics" icon="analytics" expanded={expanded}>Analytics</NavLink>

                <SectionLabel expanded={expanded}>Operations</SectionLabel>
                <NavLink href="/employees" icon="employees" expanded={expanded}>Employees</NavLink>
                <NavLink href="/clients" icon="clients" expanded={expanded}>Clients</NavLink>
                <NavLink href="/jobs" icon="jobs" expanded={expanded}>Jobs</NavLink>
                <NavLink href="/web-bookings" icon="web-bookings" expanded={expanded}>Web Bookings</NavLink>
                <NavLink href="/calendar" icon="calendar" expanded={expanded}>Calendar</NavLink>
                <NavLink href="/requests" icon="requests" expanded={expanded} badge={pendingRequests}>Requests</NavLink>
                <NavLink href="/inventory" icon="inventory" expanded={expanded} exclude={["/inventory/rag-wash"]}>Inventory</NavLink>
                <NavLink href="/inventory/rag-wash" icon="rag-wash" expanded={expanded}>Rag Wash</NavLink>
                <NavLink href="/inventory/kits" icon="my-inventory" expanded={expanded}>Cleaner Kits</NavLink>
                <NavLink href="/wash-payouts" icon="rag-wash" expanded={expanded}>Wash Payouts</NavLink>

                <SectionLabel expanded={expanded}>Finance</SectionLabel>
                <NavLink href="/payouts" icon="payouts" expanded={expanded}>Payouts</NavLink>
                <NavLink href="/finances" icon="finances" expanded={expanded}>Finances</NavLink>
                <NavLink href="/invoices" icon="invoices" expanded={expanded}>Invoices</NavLink>
                <NavLink href="/bulk-charge" icon="payouts" expanded={expanded}>Bulk Charge</NavLink>
                <NavLink href="/quotes" icon="leads" expanded={expanded}>Quotes</NavLink>
                <NavLink href="/gift-cards" icon="sales" expanded={expanded}>Gift Cards</NavLink>
                <NavLink href="/sales" icon="sales" expanded={expanded}>Sales</NavLink>
                <NavLink href="/promo-codes" icon="sales" expanded={expanded}>Promo Codes</NavLink>
                <NavLink href="/leads" icon="leads" expanded={expanded}>Leads</NavLink>
                <NavLink href="/waitlist" icon="waitlist" expanded={expanded}>Waitlist</NavLink>

                <SectionLabel expanded={expanded}>More</SectionLabel>
                <NavLink href="/training" icon="training" expanded={expanded}>Training</NavLink>
                <NavLink href="/documents" icon="documents" expanded={expanded}>Documents</NavLink>
                <NavLink href="/chat" icon="chat" expanded={expanded} badge={chatUnread}>Chat</NavLink>
              </>
            ) : (
              <>
                <NavLink href="/my-jobs" icon="my-jobs" expanded={expanded}>My Jobs</NavLink>
                <NavLink href="/available-jobs" icon="jobs" expanded={expanded}>Available Jobs</NavLink>
                <NavLink href="/my-pay" icon="my-pay" expanded={expanded}>My Pay</NavLink>
                <NavLink href="/my-inventory" icon="my-inventory" expanded={expanded}>My Inventory</NavLink>
                <NavLink href="/calendar" icon="calendar" expanded={expanded}>Calendar</NavLink>
                <NavLink href="/training" icon="training" expanded={expanded}>Training</NavLink>
                <NavLink href="/documents" icon="documents" expanded={expanded}>Documents</NavLink>
                <NavLink href="/chat" icon="chat" expanded={expanded} badge={chatUnread}>Chat</NavLink>
              </>
            )}
          </nav>

          {/* User Section */}
          <div
            className={`pb-4 shrink-0 ${
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
      <div className="ml-0 md:ml-64 h-screen overflow-hidden overflow-y-auto print:!ml-0 print:!h-auto print:!overflow-visible">
        <main className="h-full bg-white print:!h-auto">{children}</main>
      </div>

      {/* Chat notification toast */}
      {chatToast && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            zIndex: 300,
            maxWidth: 340,
            width: "calc(100vw - 48px)",
            animation: "chat-toast-in 0.25s ease-out",
          }}>
          <style>{`
            @keyframes chat-toast-in {
              from { opacity: 0; transform: translateY(12px) scale(0.97); }
              to   { opacity: 1; transform: translateY(0)    scale(1); }
            }
          `}</style>
          <div style={{
            background: "#e85d04",
            borderRadius: 16,
            boxShadow: "0 8px 32px rgba(232,93,4,0.35), 0 2px 8px rgba(0,0,0,0.12)",
            padding: "14px 16px",
            display: "flex",
            gap: 12,
            alignItems: "flex-start",
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: "rgba(255,255,255,0.15)",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}>
              <MessageCircle size={18} color="#fff" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "#fff", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {chatToast.senderName}
              </p>
              <p style={{
                fontSize: 12, color: "rgba(255,255,255,0.75)", margin: "3px 0 8px",
                display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}>
                {chatToast.body}
              </p>
              <a
                href="/chat"
                style={{
                  fontSize: 12, fontWeight: 600, color: "#fff",
                  textDecoration: "none", opacity: 0.9,
                }}
                onClick={() => setChatToast(null)}>
                Open Chat →
              </a>
            </div>
            <button
              type="button"
              onClick={() => setChatToast(null)}
              style={{
                background: "none", border: "none", cursor: "pointer",
                padding: 4, color: "rgba(255,255,255,0.6)", flexShrink: 0,
                display: "flex", alignItems: "center",
              }}>
              <X size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
