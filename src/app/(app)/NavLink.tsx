"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BarChart3,
  Users,
  Package,
  Briefcase,
  ClipboardList,
  CalendarDays,
  Contact,
  Wallet,
  Receipt,
  FileText,
  MapPin,
  Banknote,
  GraduationCap,
  FileSignature,
  MessageCircle,
  Flame,
  Clock,
  Inbox,
  Globe,
  LucideIcon,
} from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  analytics: BarChart3,
  employees: Users,
  inventory: Package,
  jobs: Briefcase,
  "my-jobs": ClipboardList,
  calendar: CalendarDays,
  clients: Contact,
  payouts: Wallet,
  finances: Receipt,
  invoices: FileText,
  sales: MapPin,
  "my-pay": Banknote,
  "my-inventory": Package,
  training: GraduationCap,
  documents: FileSignature,
  chat: MessageCircle,
  leads: Flame,
  waitlist: Clock,
  requests: Inbox,
  "web-bookings": Globe,
};

export default function NavLink({
  href,
  children,
  icon,
  expanded = false,
  exclude = [],
  badge = 0,
}: {
  href: string;
  children: React.ReactNode;
  icon: string;
  expanded?: boolean;
  exclude?: string[];
  badge?: number;
}) {
  const pathname = usePathname();
  const matchesExclude = exclude.some(
    (p) => pathname === p || pathname?.startsWith(p + "/"),
  );
  const isActive =
    !matchesExclude &&
    (pathname === href ||
      (href !== "/dashboard" && pathname?.startsWith(href + "/")));

  const Icon = iconMap[icon];

  const badgeEl = badge > 0 ? (
    <span className="min-w-[18px] h-[18px] bg-[#e85d04] text-white text-[10px] font-[600] rounded-full flex items-center justify-center px-1 leading-none flex-shrink-0">
      {badge > 99 ? "99+" : badge}
    </span>
  ) : null;

  if (expanded) {
    return (
      <Link
        href={href}
        className={`relative flex items-center gap-3 h-10 px-3 rounded-xl text-sm font-[400] transition-colors duration-150 ${
          isActive
            ? "bg-[rgba(232,93,4,0.35)] text-white"
            : "text-white/60 hover:bg-white/[0.06] hover:text-white"
        }`}>
        {isActive && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-[3px] bg-[#e85d04]" />
        )}
        {Icon && (
          <Icon
            strokeWidth={1.6}
            className={`w-4 h-4 shrink-0 ${isActive ? "text-white" : "text-white/60"}`}
          />
        )}
        <span className="truncate flex-1">{children}</span>
        {badgeEl}
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className={`relative flex items-center justify-center w-10 h-10 rounded-xl transition-colors duration-150 ${
        isActive
          ? "bg-[rgba(232,93,4,0.35)] text-white"
          : "text-white/50 hover:bg-white/[0.06] hover:text-white"
      }`}>
      {isActive && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-[3px] bg-[#e85d04]" />
      )}
      {Icon && (
        <Icon
          strokeWidth={1.6}
          className={`w-4 h-4 ${isActive ? "text-white" : "text-white/50"}`}
        />
      )}
      {badge > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-[#e85d04] text-white text-[9px] font-[700] rounded-full flex items-center justify-center px-1 leading-none">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </Link>
  );
}
