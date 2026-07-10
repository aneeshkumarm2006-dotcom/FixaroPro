import { db } from "@/db";

// Content is admin-editable (AppSetting "content.faqs"), so render per request.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "FAQ · Fixaro",
  description: "Frequently asked questions about Fixaro handyman services.",
};

interface Faq {
  question: string;
  answer: string;
}

const DEFAULT_FAQS: Faq[] = [
  { question: "What areas do you serve?", answer: "Enter your postal code on the booking page to check coverage instantly." },
  { question: "Do I need to provide materials?", answer: "You choose at booking: have Fixaro provide all materials and equipment, or provide them yourself before the visit." },
  { question: "How is painting priced?", answer: "You get an instant estimate range online. Our painters then bid the job and we send you a final price to accept before any work begins." },
  { question: "When am I charged?", answer: "A deposit secures the booking; the balance is charged after the visit, based on hours worked and any materials used." },
];

async function getFaqs(): Promise<Faq[]> {
  try {
    const row = await db.appSetting.findUnique({ where: { key: "content.faqs" } });
    const v = row?.value;
    if (Array.isArray(v) && v.length > 0) return v as unknown as Faq[];
  } catch {
    /* fall through to defaults */
  }
  return DEFAULT_FAQS;
}

export default async function FaqPage() {
  const faqs = await getFaqs();

  return (
    <div style={{ minHeight: "100vh", background: "#faf7f2", padding: "48px 16px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <header style={{ marginBottom: 28, textAlign: "center" }}>
          <div style={{ fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: "#e85d04", fontWeight: 700 }}>
            Fixaro
          </div>
          <h1 style={{ marginTop: 8, fontSize: "clamp(28px, 5vw, 44px)", lineHeight: 1.1, color: "#1c1917", fontWeight: 700 }}>
            Frequently asked questions
          </h1>
        </header>

        {faqs.length === 0 ? (
          <p style={{ textAlign: "center", color: "#57534e", fontSize: 15 }}>
            No FAQs are available right now. Please contact our office for help.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {faqs.map((f, i) => (
              <details key={i} style={{ background: "#fff", border: "1px solid #e7e5e4", borderRadius: 14, padding: "16px 20px" }}>
                <summary style={{ fontSize: 15, fontWeight: 600, color: "#1c1917", cursor: "pointer", listStyle: "none" }}>
                  {f.question}
                </summary>
                <p style={{ marginTop: 10, fontSize: 14, lineHeight: 1.6, color: "#57534e", whiteSpace: "pre-wrap" }}>
                  {f.answer}
                </p>
              </details>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
