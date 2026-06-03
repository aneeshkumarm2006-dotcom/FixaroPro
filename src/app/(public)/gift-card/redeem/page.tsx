import GiftCardRedeemClient from "./GiftCardRedeemClient";

export const metadata = {
  title: "Redeem a Gift Card · Fixaro",
};

export default async function GiftCardRedeemPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const params = await searchParams;
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #f7faf9 0%, #ffffff 100%)",
        padding: "48px 16px",
      }}>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
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
              fontSize: "clamp(28px, 4.5vw, 40px)",
              lineHeight: 1.1,
              color: "#0a1f24",
              fontWeight: 700,
            }}>
            Redeem your code
          </h1>
          <p style={{ marginTop: 12, fontSize: 14, color: "#3a5a62", lineHeight: 1.5 }}>
            Sign in to your Fixaro customer account, paste the gift card code,
            and we'll add the credit to your account. It will auto-apply the
            next time you book.
          </p>
        </header>

        <GiftCardRedeemClient initialCode={params.code ?? ""} />
      </div>
    </div>
  );
}
