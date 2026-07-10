import { db } from "@/db";

// Reviews + settings change at runtime, so render per request.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Reviews · Fixaro",
  description: "See what Fixaro customers say about our handyman services.",
};

/** "John Smith" → "John S." — protects customer privacy on the public wall. */
function shortName(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "A Fixaro customer";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

// Admin toggles via AppSetting; safe Fixaro defaults: enabled, 4★ threshold.
async function getReviewConfig(): Promise<{ enabled: boolean; threshold: number }> {
  try {
    const rows = await db.appSetting.findMany({
      where: { key: { in: ["customer.liveReviewsEnabled", "customer.liveReviewThreshold"] } },
    });
    const byKey = new Map(rows.map((r) => [r.key, r.value]));
    const enabled = byKey.has("customer.liveReviewsEnabled")
      ? byKey.get("customer.liveReviewsEnabled") !== false
      : true;
    const t = byKey.get("customer.liveReviewThreshold");
    const threshold = typeof t === "number" && t >= 1 && t <= 5 ? t : 4;
    return { enabled, threshold };
  } catch {
    return { enabled: true, threshold: 4 };
  }
}

export default async function ReviewsPage() {
  const { enabled, threshold } = await getReviewConfig();

  const ratings = enabled
    ? await db.employeeRating.findMany({
        where: { rating: { gte: threshold }, notes: { not: null } },
        orderBy: { createdAt: "desc" },
        take: 30,
        include: { job: { include: { client: { select: { name: true } } } } },
      })
    : [];

  const reviews = ratings.filter((r) => (r.notes ?? "").trim().length > 0);

  return (
    <div style={{ minHeight: "100vh", background: "#faf7f2", padding: "48px 16px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <header style={{ marginBottom: 28, textAlign: "center" }}>
          <div style={{ fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: "#e85d04", fontWeight: 700 }}>
            Fixaro
          </div>
          <h1 style={{ marginTop: 8, fontSize: "clamp(28px, 5vw, 44px)", lineHeight: 1.1, color: "#1c1917", fontWeight: 700 }}>
            What our customers say
          </h1>
        </header>

        {reviews.length === 0 ? (
          <p style={{ textAlign: "center", color: "#57534e", fontSize: 15 }}>
            No reviews to show yet — check back soon.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {reviews.map((r) => (
              <div key={r.id} style={{ background: "#fff", border: "1px solid #e7e5e4", borderRadius: 14, padding: "16px 20px" }}>
                <div style={{ color: "#f59e0b", fontSize: 15, letterSpacing: 1, marginBottom: 6 }}>
                  {"★".repeat(Math.round(r.rating))}
                  <span style={{ color: "#d6d3d1" }}>{"★".repeat(Math.max(0, 5 - Math.round(r.rating)))}</span>
                </div>
                <p style={{ fontSize: 14, lineHeight: 1.6, color: "#1c1917", marginBottom: 8, whiteSpace: "pre-wrap" }}>
                  {r.notes}
                </p>
                <p style={{ fontSize: 13, color: "#78716c", fontWeight: 600 }}>
                  — {shortName(r.job?.client?.name)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
