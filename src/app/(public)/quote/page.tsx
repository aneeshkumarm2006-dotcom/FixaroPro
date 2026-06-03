import QuoteFormClient from "./QuoteFormClient";

export const metadata = {
  title: "Request a Quote · Fixaro",
  description:
    "Tell us about your space and we'll send you a tailored service quote.",
};

export default function QuotePage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #f7faf9 0%, #ffffff 100%)",
        padding: "48px 16px",
      }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <header style={{ marginBottom: 32, textAlign: "center" }}>
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
            Request a quote
          </h1>
          <p
            style={{
              marginTop: 12,
              fontSize: 16,
              color: "#3a5a62",
              lineHeight: 1.5,
            }}>
            Tell us a few details about your space and we'll get back to you
            within one business day with a tailored estimate.
          </p>
        </header>

        <QuoteFormClient />
      </div>
    </div>
  );
}
