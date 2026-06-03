import GiftCardPurchaseClient from "./GiftCardPurchaseClient";
import { GIFT_CARD_COVERS, GIFT_CARD_TIERS, MIN_JOB_PRICE_USD } from "@/lib/gift-cards/covers";

export const metadata = {
  title: "Buy a Gift Card · Fixaro",
  description:
    "Send a Fixaro home services gift card to someone you appreciate.",
};

export default function GiftCardPurchasePage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #f7faf9 0%, #ffffff 100%)",
        padding: "48px 16px",
      }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <header style={{ marginBottom: 28, textAlign: "center" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 4 }}>
            <div style={{ width: 36, height: 36, borderRadius: 12, background: "#fff", overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.10)", border: "1px solid rgba(0,0,0,0.06)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <img src="/images/Fixaro-Logo.png" alt="Fixaro" width={36} height={36} style={{ objectFit: "contain" }} />
            </div>
            <span style={{ fontFamily: "var(--font-dm-sans, DM Sans, sans-serif)", fontSize: 18, fontWeight: 600, color: "#161514", letterSpacing: "-0.01em" }}>Fixaro</span>
          </div>
          <h1
            style={{
              marginTop: 8,
              fontSize: "clamp(32px, 5vw, 48px)",
              lineHeight: 1.1,
              color: "#0a1f24",
              fontWeight: 700,
            }}>
            Send the gift of a clean home
          </h1>
          <p
            style={{
              marginTop: 12,
              fontSize: 15,
              color: "#3a5a62",
              lineHeight: 1.5,
            }}>
            A Fixaro gift card adds credit to the recipient's account and
            auto-applies the next time they book a service. Our minimum
            job price is <strong>${MIN_JOB_PRICE_USD}</strong>, so pick a
            value that comfortably covers a service for them.
          </p>
        </header>

        <GiftCardPurchaseClient
          tiers={[...GIFT_CARD_TIERS]}
          covers={GIFT_CARD_COVERS}
          minJobPrice={MIN_JOB_PRICE_USD}
        />
      </div>
    </div>
  );
}
