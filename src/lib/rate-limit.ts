// Minimal in-process fixed-window rate limiter.
//
// Purpose: bound denial-of-wallet abuse on the handful of endpoints that are
// unauthenticated BY DESIGN (they run before a booking/session exists) yet spend
// real money per request — Stripe PaymentIntent creation and Cloudinary uploads.
//
// ── CAVEAT 1: per-instance memory, not a shared store ────────────────────────
// State lives in this Node process's heap. On a serverless/multi-instance
// deployment each instance keeps its own counters, so the EFFECTIVE limit is
// roughly (limit × number of warm instances), and counters reset on cold start.
// This is a speed bump, not a control. The real fix is a shared store (Upstash
// Redis / Vercel KV) or edge rate limiting at the WAF/CDN. Treat this as
// defense-in-depth and keep the edge control on the roadmap.
//
// ── CAVEAT 2: must not break legitimate retries ──────────────────────────────
// Limits are deliberately generous relative to real human behaviour (a customer
// re-submitting a card after a decline, or re-uploading a photo that failed).
// Windows are short (60s) so a tripped limit self-heals quickly rather than
// locking a paying customer out. Callers should only consume a token on a
// genuinely new attempt, and should surface a generic "too many requests, try
// again shortly" message — never the limit, the window, or the remaining count,
// since that hands an attacker a free oracle for tuning their rate.
//
// Also note: IP is derived from proxy headers (x-forwarded-for), which are
// client-spoofable unless the platform overwrites them. Vercel/most CDNs do
// overwrite, but a self-hosted deployment behind an untrusted proxy would not —
// hence the secondary email key on the payment paths.

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

// Hard cap on distinct keys so a spoofed-IP flood can't grow the map without
// bound (memory exhaustion would be a worse outcome than the abuse we're
// limiting). When exceeded we drop the oldest-expiring entries.
const MAX_KEYS = 10_000;

function sweep(now: number) {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
  if (buckets.size > MAX_KEYS) {
    const sorted = [...buckets.entries()].sort(
      (a, b) => a[1].resetAt - b[1].resetAt
    );
    const drop = buckets.size - MAX_KEYS;
    for (let i = 0; i < drop; i++) buckets.delete(sorted[i][0]);
  }
}

export interface RateLimitOptions {
  /** Logical endpoint name, namespaces the key (e.g. "charge-deposit"). */
  name: string;
  /** Max requests allowed per key per window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

export interface RateLimitResult {
  /** True when the request is within budget and may proceed. */
  ok: boolean;
  /** Seconds until the window resets. For Retry-After; safe to expose. */
  retryAfterSeconds: number;
}

/**
 * Consume one token for `identifier` under `options`. Fixed window: the first
 * request starts a window, subsequent requests in that window increment, and the
 * counter resets wholesale at `resetAt`.
 */
export function rateLimit(
  identifier: string,
  options: RateLimitOptions
): RateLimitResult {
  const now = Date.now();
  // Cheap probabilistic sweep — avoids a timer and keeps the map bounded.
  if (Math.random() < 0.01) sweep(now);

  const key = `${options.name}:${identifier}`;
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + options.windowMs });
    return { ok: true, retryAfterSeconds: 0 };
  }

  existing.count += 1;
  if (existing.count > options.limit) {
    return {
      ok: false,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }
  return { ok: true, retryAfterSeconds: 0 };
}

/**
 * Check every key (e.g. IP and email) and fail if ANY is over budget. Each key
 * is consumed, so an attacker can't dodge the IP budget by rotating emails or
 * the email budget by rotating IPs.
 */
export function rateLimitAny(
  identifiers: string[],
  options: RateLimitOptions
): RateLimitResult {
  let worst: RateLimitResult = { ok: true, retryAfterSeconds: 0 };
  for (const id of identifiers) {
    const result = rateLimit(id, options);
    if (!result.ok && result.retryAfterSeconds > worst.retryAfterSeconds) {
      worst = result;
    }
  }
  return worst;
}

/**
 * Best-effort client IP from proxy headers. Returns "unknown" when nothing
 * usable is present — which FAILS CLOSED in the sense that all such callers
 * share a single bucket rather than each getting their own free budget.
 *
 * Accepts either a Request/NextRequest's headers or the Headers object returned
 * by `headers()` from next/headers (server actions).
 */
export function clientIpFromHeaders(h: Headers): string {
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) {
    // Left-most entry is the original client; the rest are proxy hops.
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first.slice(0, 64);
  }
  const real = h.get("x-real-ip") ?? h.get("cf-connecting-ip");
  if (real) return real.trim().slice(0, 64);
  return "unknown";
}

/** Shared budgets. Payment intents are the expensive ones; uploads are cheaper. */
export const RATE_LIMITS = {
  /** Stripe PaymentIntent creation — real money object per call. */
  paymentIntent: { limit: 8, windowMs: 60_000 },
  /** Cloudinary image upload — bandwidth/storage per call. */
  upload: { limit: 20, windowMs: 60_000 },
} as const;

/** Generic, non-leaky message for a tripped limit. */
export const RATE_LIMIT_MESSAGE =
  "Too many requests. Please wait a moment and try again.";
