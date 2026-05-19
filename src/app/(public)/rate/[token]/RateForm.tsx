"use client";

import { useState } from "react";
import { Star, Check, AlertCircle } from "lucide-react";
import SplitShell, { BRAND_IMAGES } from "@/components/customer/SplitShell";
import { Field, Textarea, Button } from "@/components/customer/Field";
import { submitRating } from "../actions/submitRating";

type Fallback = "expired" | "already" | "notfound";

interface Props {
  token: string;
  jobNumber?: number;
  jobDate?: string | null;
  location?: string | null;
  cleaners?: { id: string; name: string }[];
  fallback?: Fallback;
}

const FALLBACK_COPY: Record<
  Fallback,
  { title: string; body: string }
> = {
  expired: {
    title: "Link expired",
    body:
      "This rating link is no longer active. If you'd still like to share feedback, please reach out to us directly.",
  },
  already: {
    title: "Already rated",
    body: "Thanks — we've already received your feedback for this booking.",
  },
  notfound: {
    title: "Link not found",
    body:
      "This rating link is invalid. If you recently received a receipt, double-check the URL.",
  },
};

export default function RateForm({
  token,
  jobNumber,
  jobDate,
  location,
  cleaners = [],
  fallback,
}: Props) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!rating) return;
    setSubmitting(true);
    if (fallback) {
      // Demo route — just animate.
      setTimeout(() => {
        setSubmitting(false);
        setSubmitted(true);
      }, 700);
      return;
    }
    const res = await submitRating({ token, stars: rating, comment });
    setSubmitting(false);
    if (res.success) setSubmitted(true);
  }

  const dateStr = jobDate
    ? new Date(jobDate).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      })
    : null;
  const cleanerLabel =
    cleaners.length === 0
      ? "your team"
      : cleaners.length === 1
      ? cleaners[0].name
      : cleaners.map((c) => c.name).join(" & ");

  return (
    <SplitShell
      image={BRAND_IMAGES.rate}
      quoteHtml={"Your feedback<br/>shapes <em>every visit.</em>"}
      quoteSub="It takes 30 seconds — and goes straight to your cleaner."
      badge="Rate your cleaning">
      {submitted ? (
        <SubmittedState />
      ) : fallback ? (
        <FallbackState
          title={FALLBACK_COPY[fallback].title}
          body={FALLBACK_COPY[fallback].body}
        />
      ) : (
        <form onSubmit={onSubmit}>
          <header style={{ marginBottom: 24 }}>
            <p className="cl-eyebrow" style={{ marginBottom: 12 }}>
              Job #{jobNumber}
            </p>
            <h1
              className="cl-display"
              style={{ fontSize: "clamp(32px, 4.4vw, 52px)" }}>
              How was your
              <br />
              <em>cleaning?</em>
            </h1>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "8px 18px",
                padding: "16px 0 0",
                fontSize: 13,
                color: "var(--primary-70)",
              }}>
              {dateStr ? (
                <span>
                  <strong style={{ color: "var(--ink)", fontWeight: 600 }}>
                    {dateStr}
                  </strong>
                </span>
              ) : null}
              {location ? <span>· {location}</span> : null}
            </div>
            <p className="cl-subtitle">
              Rate your experience with {cleanerLabel}.
            </p>
          </header>

          <div className="cl-star-row" aria-label="Rate from 1 to 5 stars">
            {[1, 2, 3, 4, 5].map((n) => {
              const active = (hover || rating) >= n;
              return (
                <button
                  key={n}
                  type="button"
                  className={`cl-star-btn ${active ? "filled" : ""} ${
                    hover === n ? "preview" : ""
                  }`}
                  aria-label={`${n} star${n > 1 ? "s" : ""}`}
                  onMouseEnter={() => setHover(n)}
                  onMouseLeave={() => setHover(0)}
                  onClick={() => setRating(n)}>
                  <Star
                    size={48}
                    strokeWidth={1.5}
                    fill={active ? "currentColor" : "transparent"}
                  />
                </button>
              );
            })}
          </div>

          <div className="cl-stack-20">
            <Field
              label="Want to add a comment? (optional)"
              htmlFor="rate-comment">
              <Textarea
                id="rate-comment"
                rows={4}
                maxLength={1000}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Anything that stood out, good or bad…"
              />
            </Field>

            <Button
              type="submit"
              size="lg"
              block
              loading={submitting}
              disabled={!rating}>
              {submitting ? "Submitting…" : "Submit rating →"}
            </Button>
          </div>
        </form>
      )}
    </SplitShell>
  );
}

function FallbackState({ title, body }: { title: string; body: string }) {
  return (
    <div style={{ textAlign: "center", padding: "24px 0" }}>
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: "50%",
          background: "var(--primary-5)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--primary)",
          marginBottom: 20,
        }}>
        <AlertCircle size={28} />
      </div>
      <h1 className="cl-title" style={{ marginBottom: 12 }}>
        {title}
      </h1>
      <p
        className="cl-subtitle"
        style={{ fontSize: 15, maxWidth: 380, margin: "0 auto" }}>
        {body}
      </p>
    </div>
  );
}

function SubmittedState() {
  return (
    <div style={{ textAlign: "center", padding: "32px 0" }}>
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: "50%",
          background: "var(--emerald-100)",
          color: "var(--emerald-600)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 24px",
        }}>
        <Check size={36} strokeWidth={2.5} />
      </div>
      <h1
        className="cl-display"
        style={{ fontSize: "clamp(28px, 3.6vw, 42px)", marginBottom: 14 }}>
        Thanks for the
        <br />
        <em>feedback!</em>
      </h1>
      <p
        className="cl-subtitle"
        style={{ maxWidth: 380, margin: "0 auto", fontSize: 15 }}>
        We'll make sure your cleaner sees it. We'd love to have you back soon.
      </p>
    </div>
  );
}
