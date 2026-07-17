"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { KeyRound, Eye, EyeOff } from "lucide-react";
import { authClient } from "@/lib/auth-client";

type Flash = { kind: "success" | "error"; text: string } | null;

const MIN_LEN = 8;

/**
 * Password change form. Delegates the actual change to better-auth
 * (`authClient.changePassword`) — no password hashing is done here. Passing
 * `revokeOtherSessions: true` signs out every other device on success, so a
 * password change actually kicks out anyone who shouldn't be there.
 */
export default function ChangePasswordClient() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<Flash>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    setFlash(null);

    if (!current) {
      setFlash({ kind: "error", text: "Enter your current password." });
      return;
    }
    if (next.length < MIN_LEN) {
      setFlash({
        kind: "error",
        text: `New password must be at least ${MIN_LEN} characters.`,
      });
      return;
    }
    if (next !== confirm) {
      setFlash({ kind: "error", text: "New passwords don't match." });
      return;
    }
    if (next === current) {
      setFlash({
        kind: "error",
        text: "Choose a password different from your current one.",
      });
      return;
    }

    setSaving(true);
    const { error } = await authClient.changePassword({
      currentPassword: current,
      newPassword: next,
      revokeOtherSessions: true,
    });
    setSaving(false);

    if (error) {
      // better-auth returns a generic message for a bad current password; keep
      // it generic to avoid leaking whether the account uses a password login.
      setFlash({
        kind: "error",
        text:
          error.message ||
          "Couldn't change your password. Check your current password and try again.",
      });
      return;
    }

    setCurrent("");
    setNext("");
    setConfirm("");
    setFlash({
      kind: "success",
      text: "Password updated. Other devices have been signed out.",
    });
  }

  return (
    <div className="cl-page-wrap">
      <div className="cl-page-head">
        <div>
          <h1 className="cl-page-title">
            <span className="cl-page-title-icon">
              <KeyRound size={22} />
            </span>
            Change password
          </h1>
          <p className="cl-page-sub">
            Choose a strong password you don&apos;t reuse anywhere else.
          </p>
        </div>
      </div>

      <div className="fx-card">
        <form onSubmit={onSubmit} noValidate>
          <div className="cl-form-row">
            <label className="cl-form-label" htmlFor="cp-current">
              Current password
            </label>
            <div className="fx-pw">
              <input
                id="cp-current"
                className="cl-form-input"
                type={showCurrent ? "text" : "password"}
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                placeholder="Enter current password"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="fx-pw-toggle"
                onClick={() => setShowCurrent((v) => !v)}
                aria-label={showCurrent ? "Hide password" : "Show password"}>
                {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="cl-form-row">
            <label className="cl-form-label" htmlFor="cp-new">
              New password
            </label>
            <div className="fx-pw">
              <input
                id="cp-new"
                className="cl-form-input"
                type={showNext ? "text" : "password"}
                value={next}
                onChange={(e) => setNext(e.target.value)}
                placeholder="Enter new password"
                autoComplete="new-password"
                required
              />
              <button
                type="button"
                className="fx-pw-toggle"
                onClick={() => setShowNext((v) => !v)}
                aria-label={showNext ? "Hide password" : "Show password"}>
                {showNext ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <div className="cl-form-hint">
              Must be at least {MIN_LEN} characters.
            </div>
          </div>

          <div className="cl-form-row">
            <label className="cl-form-label" htmlFor="cp-confirm">
              Confirm new password
            </label>
            <div className="fx-pw">
              <input
                id="cp-confirm"
                className="cl-form-input"
                type={showConfirm ? "text" : "password"}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Confirm new password"
                autoComplete="new-password"
                required
              />
              <button
                type="button"
                className="fx-pw-toggle"
                onClick={() => setShowConfirm((v) => !v)}
                aria-label={showConfirm ? "Hide password" : "Show password"}>
                {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {flash ? (
            <div className={`fx-flash ${flash.kind}`}>{flash.text}</div>
          ) : null}

          <div className="cl-form-actions">
            <Link href="/account" className="fx-back">
              Back to account
            </Link>
            <button type="submit" className="cl-form-save" disabled={saving}>
              {saving ? "Saving…" : "Update password"}
            </button>
          </div>
        </form>
      </div>

      <style jsx>{`
        .fx-card {
          background: #fff;
          border: 1px solid var(--primary-10);
          border-radius: 16px;
          padding: 24px 26px;
          max-width: 520px;
        }
        .fx-pw {
          position: relative;
        }
        .fx-pw :global(.cl-form-input) {
          padding-right: 44px;
        }
        .fx-pw-toggle {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: 0;
          cursor: pointer;
          color: var(--primary-50);
          display: inline-flex;
          align-items: center;
        }
        .fx-pw-toggle:hover {
          color: var(--primary);
        }
        .fx-flash {
          padding: 12px 16px;
          border-radius: 12px;
          font-size: 13px;
          margin-bottom: 12px;
        }
        .fx-flash.success {
          background: rgba(232, 93, 4, 0.08);
          color: var(--primary);
        }
        .fx-flash.error {
          background: #fee2e2;
          color: var(--error-text);
        }
        .cl-form-actions {
          justify-content: space-between;
          align-items: center;
        }
        .fx-back {
          font-size: 13px;
          font-weight: 600;
          color: var(--primary-60);
          text-decoration: none;
        }
        .fx-back:hover {
          color: var(--accent);
        }
      `}</style>
    </div>
  );
}
