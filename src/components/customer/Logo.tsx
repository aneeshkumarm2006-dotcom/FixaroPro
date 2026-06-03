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
      <span style={{ width: 36, height: 36, borderRadius: 12, background: "#fff", overflow: "hidden", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }}>
        <Image
          src="/images/Fixaro-Logo.png"
          alt="Fixaro"
          width={36}
          height={36}
          style={{ objectFit: "contain" }}
        />
      </span>
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
