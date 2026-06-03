"use client";

import Link from "next/link";
import Image from "next/image";

export default function CustomerLogo({
  onDark,
  href = "/book",
}: {
  onDark?: boolean;
  href?: string;
}) {
  return (
    <Link
      href={href}
      className={`cl-logo ${onDark ? "cl-logo-on-dark" : ""}`}
      style={{ display: "inline-flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
      <Image
        src="/images/Fixaro-Logo.png"
        alt="Fixaro"
        width={36}
        height={36}
        style={{ objectFit: "contain" }}
      />
      <span style={{
        fontFamily: "var(--font-dm-sans, 'DM Sans', system-ui, sans-serif)",
        fontWeight: 600,
        fontSize: 18,
        letterSpacing: "-0.02em",
        color: onDark ? "#fff" : "var(--ink)",
      }}>
        Fixaro
      </span>
    </Link>
  );
}
