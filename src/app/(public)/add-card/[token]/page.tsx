import { db } from "@/db";
import AddCardForm from "./AddCardForm";

export const metadata = {
  title: "Add a Card · Fixaro",
};

export default async function AddCardPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const row = await db.clientCardSetupToken.findUnique({
    where: { token },
    select: { token: true, usedAt: true, expiresAt: true },
  });

  let invalidReason: string | null = null;
  if (!row) invalidReason = "This link is not valid.";
  else if (row.usedAt)
    invalidReason = "This link has already been used. Reach out if you need a new one.";
  else if (row.expiresAt < new Date())
    invalidReason = "This link has expired. Reach out and we'll send you a new one.";

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
            Add a card
          </h1>
          <p style={{ marginTop: 12, fontSize: 14, color: "#3a5a62", lineHeight: 1.5 }}>
            Add a card to your Fixaro account. We'll save it securely with Stripe and use it for service payments.
          </p>
        </header>

        {invalidReason ? (
          <div
            style={{
              padding: 24,
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: 14,
              color: "#991b1b",
              fontSize: 14,
              fontWeight: 600,
              textAlign: "center",
            }}>
            {invalidReason}
          </div>
        ) : (
          <AddCardForm token={token} />
        )}
      </div>
    </div>
  );
}
