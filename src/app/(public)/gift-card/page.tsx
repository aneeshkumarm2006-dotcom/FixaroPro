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
          <div
            style={{
              fontSize: 12,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "#e85d04",
              fontWeight: 700,
            }}>
            Fixaro gift cards
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
