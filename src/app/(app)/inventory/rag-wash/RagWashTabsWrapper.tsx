"use client";

import { useState } from "react";
import RagWashClient from "./RagWashClient";
import WashPayoutsPageClient from "../../wash-payouts/WashPayoutsPageClient";

type RagWashTabsWrapperProps = {
  employees: React.ComponentProps<typeof RagWashClient>["employees"];
  cleaners: React.ComponentProps<typeof WashPayoutsPageClient>["cleaners"];
  payouts: React.ComponentProps<typeof WashPayoutsPageClient>["payouts"];
  flaggedJobs: React.ComponentProps<typeof WashPayoutsPageClient>["flaggedJobs"];
};

const TABS = [
  { id: "rag-wash", label: "Rag Wash" },
  { id: "payouts", label: "Wash Payouts" },
] as const;

export default function RagWashTabsWrapper({
  employees,
  cleaners,
  payouts,
  flaggedJobs,
}: RagWashTabsWrapperProps) {
  const [active, setActive] = useState<"rag-wash" | "payouts">("rag-wash");

  return (
    <div>
      {/* Tab bar */}
      <div style={{
        display: "flex",
        gap: 4,
        borderBottom: "1px solid rgba(28,25,23,0.08)",
        marginBottom: 28,
        paddingBottom: 0,
      }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActive(t.id)}
            style={{
              padding: "8px 18px",
              fontSize: 13.5,
              fontWeight: active === t.id ? 600 : 400,
              color: active === t.id ? "#e85d04" : "rgba(28,25,23,0.55)",
              background: "none",
              border: "none",
              borderBottom: active === t.id ? "2px solid #e85d04" : "2px solid transparent",
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

      {active === "rag-wash" && <RagWashClient employees={employees} />}
      {active === "payouts" && (
        <WashPayoutsPageClient
          cleaners={cleaners}
          payouts={payouts}
          flaggedJobs={flaggedJobs}
        />
      )}
    </div>
  );
}
