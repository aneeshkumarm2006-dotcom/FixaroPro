"use client";

import { useState, FormEvent } from "react";
import { authClient } from "@/lib/auth-client";
import SplitShell, { BRAND_IMAGES } from "@/components/customer/SplitShell";

export default function CustomerForgotPasswordPage() {
  const [email,   setEmail]   = useState("");
  const [loading, setLoading] = useState(false);
  const [sent,    setSent]    = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.includes("@")) { setError("Enter a valid email address."); return; }
    setLoading(true);
    try {
      const res = await authClient.requestPasswordReset({
        email: email.trim().toLowerCase(),
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (res.error) { setError(res.error.message || "Couldn't send reset email."); setLoading(false); return; }
      setSent(true);
    } catch {
      setError("Unexpected error. Please try again.");
      setLoading(false);
    }
  }

  return (
    <SplitShell
      image={BRAND_IMAGES.login}
      quoteHtml={"Fast.<br/>Reliable.<br/><em>Fixed.</em>"}
      quoteSub="Trusted Montréal handymen. Transparent pricing."
      topRightLabel="Sign in →"
      topRightHref="/portal/login"
      badge="Customer portal">

      {sent ? (
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(16,185,129,0.1)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px" }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <h2 className="cl-display" style={{ fontSize: "clamp(26px,3vw,36px)", marginBottom: 14 }}>
            Check your<br /><em>email.</em>
          </h2>
          <p className="cl-subtitle" style={{ marginBottom: 8 }}>
            We sent a reset link to <strong style={{ color: "var(--ink)" }}>{email}</strong>.
          </p>
          <p style={{ fontSize: 13, color: "var(--primary-50)", lineHeight: 1.6, marginBottom: 32 }}>
            The link expires in 1 hour. Check your spam folder if you don&apos;t see it.
          </p>
          <a href="/portal/login" className="cl-btn cl-btn-primary cl-btn-lg cl-btn-block">
            Back to sign in →
          </a>
        </div>
      ) : (
        <>
          <header style={{ marginBottom: 32 }}>
            <p className="cl-eyebrow" style={{ marginBottom: 12 }}>Password reset</p>
            <h1 className="cl-display">
              Forgot your<br /><em>password?</em>
            </h1>
            <p className="cl-subtitle" style={{ marginTop: 14 }}>
              Enter your email and we&apos;ll send a secure reset link.
            </p>
          </header>

          <form className="cl-stack-20" onSubmit={handleSubmit} noValidate>
            <div className="cl-field">
              <label className="cl-label" htmlFor="fp-email">Email address</label>
              <input
                id="fp-email"
                type="email"
                className="cl-input"
                placeholder="you@email.com"
                value={email}
                onChange={e => { setEmail(e.target.value); setError(null); }}
                required
              />
            </div>

            {error && (
              <div className="cl-banner cl-banner-error">{error}</div>
            )}

            <button type="submit" className="cl-btn cl-btn-primary cl-btn-lg cl-btn-block" disabled={loading}>
              {loading ? "Sending…" : "Send reset link →"}
            </button>

            <p style={{ fontSize: 13, textAlign: "center", color: "var(--primary-60)" }}>
              Remembered it?{" "}
              <a href="/portal/login" className="cl-link">Back to sign in</a>
            </p>
          </form>
        </>
      )}
    </SplitShell>
  );
}
