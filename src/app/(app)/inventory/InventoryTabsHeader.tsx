"use client";

import { useRouter, useSearchParams } from "next/navigation";

const TABS = [
  { id: "inventory", label: "Inventory" },
  { id: "kits", label: "Pro Kits" },
] as const;

export default function InventoryTabsHeader({ activeTab }: { activeTab: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleTab = (id: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (id === "inventory") {
      params.delete("tab");
    } else {
      params.set("tab", id);
    }
    router.push(`/inventory?${params.toString()}`);
  };

  return (
    <div style={{
      display: "flex",
      gap: 4,
      borderBottom: "1px solid rgba(28,25,23,0.08)",
      marginBottom: 28,
    }}>
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => handleTab(t.id)}
          style={{
            padding: "8px 18px",
            fontSize: 13.5,
            fontWeight: activeTab === t.id ? 600 : 400,
            color: activeTab === t.id ? "#e85d04" : "rgba(28,25,23,0.55)",
            background: "none",
            border: "none",
            borderBottom: activeTab === t.id ? "2px solid #e85d04" : "2px solid transparent",
            cursor: "pointer",
            marginBottom: -1,
            transition: "color 0.15s, border-color 0.15s",
            fontFamily: "inherit",
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
