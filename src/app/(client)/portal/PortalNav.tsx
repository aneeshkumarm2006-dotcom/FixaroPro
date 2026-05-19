"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/portal", label: "Overview" },
  { href: "/portal/bookings", label: "Bookings" },
  { href: "/portal/account", label: "Account" },
];

export default function PortalNav() {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-1">
      {LINKS.map((l) => {
        const active =
          l.href === "/portal" ? pathname === "/portal" : pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`px-3 py-1.5 rounded-full text-xs transition-colors ${
              active
                ? "bg-[#005F6A] text-white"
                : "text-[#005F6A]/70 hover:bg-[#005F6A]/5"
            }`}>
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
