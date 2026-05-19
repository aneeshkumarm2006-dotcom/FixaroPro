"use client";

import { useEffect, useState, FormEvent } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import SplitShell, { BRAND_IMAGES } from "@/components/customer/SplitShell";
import {
  Field,
  Input,
  PasswordInput,
  Button,
  Banner,
} from "@/components/customer/Field";

export default function PortalLoginPage() {
  const session = authClient.useSession();

  const rememberedKey = "cleano_remember_email";
  const initialEmail =
    typeof window !== "undefined"
      ? localStorage.getItem(rememberedKey) ?? ""
      : "";

  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(Boolean(initialEmail));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (session.data?.session) {
      window.location.href = "/api/post-signin";
    }
  }, [session.data?.session]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      const res = await authClient.signIn.email({
        email: email.trim().toLowerCase(),
        password,
        callbackURL: "/api/post-signin",
      });
      if (res.error) {
        const code = res.error.status;
        if (code === 401) setError("Email or password is incorrect.");
        else if (code === 429)
          setError("Too many attempts. Please wait a few minutes.");
        else setError(res.error.message || "Couldn't sign in.");
        setLoading(false);
        return;
      }
      if (remember) localStorage.setItem(rememberedKey, email);
      else localStorage.removeItem(rememberedKey);
      window.location.href = "/api/post-signin";
    } catch {
      setError("Unexpected error. Please try again.");
      setLoading(false);
    }
  }

  return (
    <SplitShell
      image={BRAND_IMAGES.login}
      quoteHtml={"Your home<br/>shouldn't <em>feel like<br/>work.</em>"}
      quoteSub="Trusted Montréal cleaners. Transparent pricing. Manage everything from one place."
      topRightLabel="Book a cleaning →"
      topRightHref="/book"
      badge="Customer portal">
      <header style={{ marginBottom: 36 }}>
        <p className="cl-eyebrow" style={{ marginBottom: 12 }}>
          Welcome back
        </p>
        <h1 className="cl-display">
          Sign in to
          <br />
          your <em>account.</em>
        </h1>
        <p className="cl-subtitle">
          Manage bookings, reschedule, and track your past cleanings.
        </p>
      </header>

      <form className="cl-stack-20" onSubmit={onSubmit} noValidate>
        <Field label="Email" htmlFor="login-email">
          <Input
            id="login-email"
            type="email"
            autoComplete="email"
            placeholder="you@email.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError(null);
            }}
          />
        </Field>

        <Field label="Password" htmlFor="login-password">
          <PasswordInput
            id="login-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError(null);
            }}
            placeholder="••••••••"
          />
        </Field>

        <div className="cl-row-between" style={{ fontSize: 13 }}>
          <label className="cl-check-row">
            <input
              type="checkbox"
              className="cl-check"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />
            <span>Remember me</span>
          </label>
          <a
            href="#"
            className="cl-link-muted"
            onClick={(e) => {
              e.preventDefault();
              alert("Forgot password flow — coming soon.");
            }}
            style={{ fontSize: 13 }}>
            Forgot password?
          </a>
        </div>

        {error ? <Banner kind="error">{error}</Banner> : null}

        <Button type="submit" size="lg" block loading={loading}>
          {loading ? "Signing in…" : "Sign in →"}
        </Button>

        <div className="cl-divider-or" style={{ marginTop: 8 }}>
          or
        </div>

        <div
          className="cl-stack-12"
          style={{
            textAlign: "center",
            fontSize: 14,
            color: "var(--primary-70)",
            lineHeight: 1.6,
          }}>
          <div>
            First time?{" "}
            <Link href="/book" className="cl-link">
              Book your first cleaning →
            </Link>
          </div>
          <div style={{ fontSize: 13 }}>
            Booked recently but no password yet?{" "}
            <Link href="/portal/setup" className="cl-link">
              Set up your account →
            </Link>
          </div>
        </div>
      </form>
    </SplitShell>
  );
}
