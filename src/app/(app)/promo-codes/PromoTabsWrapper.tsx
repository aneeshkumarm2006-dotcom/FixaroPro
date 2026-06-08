"use client";

import { useState } from "react";
import PromoCodesClient from "./PromoCodesClient";
import GiftCardsAdminClient from "../gift-cards/GiftCardsAdminClient";

type PromoTabsWrapperProps = {
  codes: React.ComponentProps<typeof PromoCodesClient>["codes"];
  cards: React.ComponentProps<typeof GiftCardsAdminClient>["cards"];
};

const TABS = [
  { id: "promo", label: "Promo Codes" },
  { id: "gift-cards", label: "Gift Cards" },
] as const;

export default function PromoTabsWrapper({ codes, cards }: PromoTabsWrapperProps) {
  const [active, setActive] = useState<"promo" | "gift-cards">("promo");

  return (
    <div>
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

      {active === "promo" && <PromoCodesClient codes={codes} />}
      {active === "gift-cards" && <GiftCardsAdminClient cards={cards} />}
    </div>
  );
}
