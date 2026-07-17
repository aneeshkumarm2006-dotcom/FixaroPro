"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { UserRound, KeyRound } from "lucide-react";
import { updateUserSettings } from "../actions/updateUserSettings";

interface Initial {
  name: string;
  email: string;
  phone: string;
  role: string;
}

type Flash = { kind: "success" | "error"; text: string } | null;

/**
 * Self-service profile form. Reuses the existing `updateUserSettings` server
 * action (same one the settings ProfileTab uses), which authorizes against the
 * session user server-side and validates email uniqueness.
 */
export default function AccountClient({ initial }: { initial: Initial }) {
  const [name, setName] = useState(initial.name);
  const [email, setEmail] = useState(initial.email);
  const [phone, setPhone] = useState(initial.phone);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<Flash>(null);

  const dirty =
    name.trim() !== initial.name ||
    email.trim() !== initial.email ||
    phone.trim() !== initial.phone;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!dirty || saving) return;

    // Client-side allow-list checks; the server action re-validates.
    if (!name.trim()) {
      setFlash({ kind: "error", text: "Name can't be empty." });
      return;
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      setFlash({ kind: "error", text: "Enter a valid email address." });
      return;
    }

    setSaving(true);
    setFlash(null);
    try {
      const res = await updateUserSettings({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || null,
      });
      setFlash(
        res.success
          ? { kind: "success", text: "Saved. Your account is up to date." }
          : { kind: "error", text: res.error || "Couldn't save your changes." }
      );
    } catch {
      setFlash({ kind: "error", text: "Something went wrong. Try again." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="cl-page-wrap">
      <div className="cl-page-head">
        <div>
          <h1 className="cl-page-title">
            <span className="cl-page-title-icon">
              <UserRound size={22} />
            </span>
            Account
          </h1>
          <p className="cl-page-sub">
            Keep your contact details current so we can reach you about jobs.
          </p>
        </div>
      </div>

      <div className="fx-account-grid">
        <div className="fx-card">
          <h2 className="fx-card-title">Profile</h2>
          <form onSubmit={onSubmit} noValidate>
            <div className="cl-form-row">
              <label className="cl-form-label" htmlFor="acct-name">
                Full name
              </label>
              <input
                id="acct-name"
                className="cl-form-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your full name"
                autoComplete="name"
                required
              />
            </div>

            <div className="cl-form-row">
              <label className="cl-form-label" htmlFor="acct-email">
                Email address
              </label>
              <input
                id="acct-email"
                className="cl-form-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                autoComplete="email"
                required
              />
              <div className="cl-form-hint">This is also your sign-in email.</div>
            </div>

            <div className="cl-form-row">
              <label className="cl-form-label" htmlFor="acct-phone">
                Phone number
              </label>
              <input
                id="acct-phone"
                className="cl-form-input"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Enter your phone number"
                autoComplete="tel"
              />
            </div>

            <div className="cl-form-row">
              <label className="cl-form-label" htmlFor="acct-role">
                Role
              </label>
              <input
                id="acct-role"
                className="cl-form-input"
                value={initial.role}
                readOnly
              />
              <div className="cl-form-hint">
                Contact an administrator to change your role.
              </div>
            </div>

            {flash ? (
              <div className={`fx-flash ${flash.kind}`}>{flash.text}</div>
            ) : null}

            <div className="cl-form-actions">
              <button
                type="submit"
                className="cl-form-save"
                disabled={!dirty || saving}>
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </form>
        </div>

        <div className="fx-card fx-side">
          <div className="fx-side-icon">
            <KeyRound size={18} />
          </div>
          <h3 className="fx-side-title">Password &amp; security</h3>
          <p className="fx-side-text">
            Use a strong password you don&apos;t reuse anywhere else. You&apos;ll
            need your current password to change it.
          </p>
          <Link href="/change-password" className="fx-side-btn">
            Change password
          </Link>
        </div>
      </div>

      <style jsx>{`
        .fx-account-grid {
          display: grid;
          grid-template-columns: 1fr 320px;
          gap: 20px;
          align-items: flex-start;
        }
        .fx-card {
          background: #fff;
          border: 1px solid var(--primary-10);
          border-radius: 16px;
          padding: 24px 26px;
        }
        .fx-card-title {
          font-size: 15px;
          font-weight: 600;
          color: var(--ink);
          margin: 0 0 20px;
          letter-spacing: -0.005em;
        }
        .fx-side {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
        }
        .fx-side-icon {
          width: 40px;
          height: 40px;
          border-radius: 12px;
          background: rgba(232, 93, 4, 0.1);
          color: var(--accent);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 14px;
        }
        .fx-side-title {
          font-size: 15px;
          font-weight: 600;
          color: var(--ink);
          margin: 0 0 6px;
        }
        .fx-side-text {
          font-size: 13px;
          color: var(--primary-60);
          margin: 0 0 16px;
          line-height: 1.55;
        }
        .fx-side-btn {
          display: inline-flex;
          align-items: center;
          background: var(--primary);
          color: #fff;
          border-radius: 999px;
          padding: 10px 20px;
          font-size: 13.5px;
          font-weight: 600;
          text-decoration: none;
          transition: background 0.15s;
        }
        .fx-side-btn:hover {
          background: var(--primary-hover);
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
        @media (max-width: 860px) {
          .fx-account-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
