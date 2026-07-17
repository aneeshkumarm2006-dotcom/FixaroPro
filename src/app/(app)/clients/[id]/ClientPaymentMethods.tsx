"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CreditCard,
  Star,
  Trash2,
  Plus,
  Mail,
  AlertTriangle,
  X,
} from "lucide-react";
import AddClientCard from "./AddClientCard";
import {
  listClientPaymentMethods,
  deleteClientPaymentMethod,
  sendClientAddCardLink,
  setDefaultPaymentMethod,
} from "./actions/clientPaymentMethods";
import type { ClientPaymentMethodDTO } from "./actions/clientPaymentMethods.types";

interface Props {
  clientId: string;
  clientName: string;
  clientEmail: string | null;
}

type Msg = { type: "success" | "error" | "warn"; text: string } | null;

const MSG_STYLE: Record<NonNullable<Msg>["type"], { bg: string; fg: string }> = {
  success: { bg: "rgba(5,150,105,0.10)", fg: "#065f46" },
  error: { bg: "#fee2e2", fg: "#991b1b" },
  warn: { bg: "#fffbeb", fg: "#92400e" },
};

function brandLabel(brand: string | null): string {
  if (!brand) return "Card";
  return brand
    .split(/[\s_-]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function expLabel(month: number | null, year: number | null): string {
  if (!month || !year) return "—";
  return `${String(month).padStart(2, "0")}/${String(year).slice(-2)}`;
}

/**
 * Payment-method management for a client profile: list saved cards, set the
 * default, remove one, and add a new one (Stripe Elements inline, or by emailing
 * the customer a one-time add-card link).
 *
 * Cards live in Stripe — this only ever handles `pm_…` ids plus the brand /
 * last4 / expiry Stripe returns. No raw card data touches the app.
 */
export default function ClientPaymentMethods({
  clientId,
  clientName,
  clientEmail,
}: Props) {
  const [methods, setMethods] = useState<ClientPaymentMethodDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [synced, setSynced] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await listClientPaymentMethods(clientId);
    if (res.success) {
      setMethods(res.methods);
      setSynced(res.synced);
    } else {
      setMsg({ type: "error", text: res.error });
    }
    setLoading(false);
  }, [clientId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSetDefault(pm: ClientPaymentMethodDTO) {
    setBusyId(pm.id);
    setMsg(null);
    const res = await setDefaultPaymentMethod({
      clientId,
      paymentMethodId: pm.stripePaymentMethodId,
    });
    if (res.success) {
      setMsg({
        type: "success",
        text: `${brandLabel(pm.brand)} •••• ${pm.last4 ?? "????"} is now the default card.`,
      });
      await load();
    } else {
      setMsg({ type: "error", text: res.error });
    }
    setBusyId(null);
  }

  async function handleRemove(pm: ClientPaymentMethodDTO) {
    const confirmed = window.confirm(
      `Remove ${brandLabel(pm.brand)} •••• ${pm.last4 ?? "????"} from ${clientName}?`
    );
    if (!confirmed) return;

    setBusyId(pm.id);
    setMsg(null);
    const res = await deleteClientPaymentMethod({
      clientId,
      paymentMethodId: pm.stripePaymentMethodId,
    });
    if (res.success) {
      setMsg(
        res.warning
          ? { type: "warn", text: res.warning }
          : { type: "success", text: "Card removed." }
      );
      await load();
    } else {
      setMsg({ type: "error", text: res.error });
    }
    setBusyId(null);
  }

  async function handleSendLink() {
    setSending(true);
    setMsg(null);
    const res = await sendClientAddCardLink(clientId);
    setMsg(
      res.success
        ? {
            type: "success",
            text: `Add-card link emailed to ${clientEmail}. It expires ${new Date(
              res.expiresAt
            ).toLocaleDateString("en-CA")}.`,
          }
        : { type: "error", text: res.error }
    );
    setSending(false);
  }

  return (
    <div className="dcard">
      <div className="dcard-head">
        <h3>Payment methods</h3>
        {!loading && !synced && (
          <span className="pill acc-unsynced" title="Stripe could not be reached — showing the last known cards.">
            <span className="pill-dot" style={{ background: "#d97706" }} />
            Not synced with Stripe
          </span>
        )}
      </div>

      {loading ? (
        <p className="acc-loading">Loading saved cards…</p>
      ) : (
        <>
          {methods.length === 0 ? (
            <p className="acc-empty">
              No cards saved. Add one below, or email {clientName.split(" ")[0]} a
              secure link to enter their own card.
            </p>
          ) : (
            <div className="acc-list">
              {methods.map((pm) => {
                const busy = busyId === pm.id;
                return (
                  <div
                    key={pm.id}
                    className={`acc-row ${pm.isDefault ? "is-default" : ""} ${busy ? "is-busy" : ""}`}>
                    <CreditCard size={16} className="acc-row-icon" />
                    <div className="acc-row-main">
                      <div className="acc-row-line">
                        <span className="acc-row-card">
                          {brandLabel(pm.brand)} •••• {pm.last4 ?? "????"}
                        </span>
                        {pm.isDefault && (
                          <span className="pill acc-badge-default">
                            <Star size={9} className="acc-badge-star" />
                            Default
                          </span>
                        )}
                        {pm.isExpired && (
                          <span className="pill acc-badge-expired">
                            <AlertTriangle size={9} />
                            Expired
                          </span>
                        )}
                      </div>
                      <div className="acc-row-exp">
                        Expires {expLabel(pm.expMonth, pm.expYear)}
                        {pm.label ? ` · ${pm.label}` : ""}
                      </div>
                    </div>

                    <div className="acc-row-actions">
                      {!pm.isDefault && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleSetDefault(pm)}
                          className="acc-btn-default">
                          <Star size={11} /> Set default
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleRemove(pm)}
                        aria-label={`Remove card ending ${pm.last4 ?? ""}`}
                        className="acc-btn-remove">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {msg && (
            <div
              className="acc-msg"
              style={{
                background: MSG_STYLE[msg.type].bg,
                color: MSG_STYLE[msg.type].fg,
              }}>
              {msg.text}
            </div>
          )}

          <div className="acc-actions">
            <button
              type="button"
              onClick={() => setShowAdd((v) => !v)}
              className="acc-add-toggle">
              {showAdd ? <X size={13} /> : <Plus size={13} />}
              {showAdd ? "Cancel" : "Add card"}
            </button>

            <button
              type="button"
              onClick={handleSendLink}
              disabled={sending || !clientEmail}
              title={
                clientEmail
                  ? "Email the customer a secure link to add their own card"
                  : "Client has no email on file"
              }
              className="acc-email-link">
              <Mail size={13} />
              {sending ? "Sending…" : "Email add-card link"}
            </button>
          </div>

          {/* Stripe Elements — the card never touches our server. On success the
              SetupIntent's payment method is attached to the client's Stripe
              customer and picked up by the sync on reload. */}
          {showAdd && (
            <AddClientCard
              clientId={clientId}
              clientName={clientName}
              clientEmail={clientEmail}
              onSaved={async () => {
                setShowAdd(false);
                setMsg({ type: "success", text: "Card saved to file." });
                await load();
              }}
            />
          )}
        </>
      )}

      <style jsx>{`
        .acc-unsynced {
          background: #fffbeb;
          color: #92400e;
        }
        .acc-loading {
          font-size: 13px;
          color: var(--primary-60);
          margin: 0;
        }
        .acc-empty {
          font-size: 13px;
          color: var(--primary-50);
          margin: 0 0 14px;
        }
        .acc-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-bottom: 14px;
        }
        .acc-row {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 14px;
          border-radius: 12px;
          background: rgba(28, 25, 23, 0.02);
          border: 1px solid var(--primary-10);
        }
        .acc-row.is-default {
          background: rgba(232, 93, 4, 0.06);
          border: 1px solid rgba(232, 93, 4, 0.22);
        }
        .acc-row.is-busy {
          opacity: 0.6;
        }
        .acc-row-icon {
          color: #e85d04;
          flex-shrink: 0;
        }
        .acc-row-main {
          flex: 1;
          min-width: 0;
        }
        .acc-row-line {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        .acc-row-card {
          font-size: 14px;
          font-weight: 600;
          color: var(--ink);
        }
        .acc-badge-default {
          background: rgba(232, 93, 4, 0.12);
          color: #e85d04;
        }
        .acc-badge-star {
          fill: #e85d04;
          color: #e85d04;
        }
        .acc-badge-expired {
          background: #fee2e2;
          color: #991b1b;
        }
        .acc-row-exp {
          font-size: 12px;
          color: var(--primary-60);
          margin-top: 2px;
        }
        .acc-row-actions {
          display: flex;
          gap: 6px;
          flex-shrink: 0;
        }
        .acc-btn-default {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 6px 11px;
          border-radius: 8px;
          background: transparent;
          border: 1px solid rgba(232, 93, 4, 0.28);
          color: #e85d04;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
        }
        .acc-btn-default:disabled {
          cursor: not-allowed;
        }
        .acc-btn-remove {
          padding: 6px 9px;
          border-radius: 8px;
          background: transparent;
          border: 1px solid rgba(220, 38, 38, 0.2);
          color: #dc2626;
          cursor: pointer;
        }
        .acc-btn-remove:disabled {
          cursor: not-allowed;
        }
        .acc-msg {
          padding: 10px 14px;
          border-radius: 10px;
          font-size: 13px;
          margin-bottom: 12px;
        }
        .acc-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .acc-add-toggle {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 7px 14px;
          border-radius: 8px;
          background: transparent;
          color: #e85d04;
          border: 1px dashed rgba(232, 93, 4, 0.35);
          cursor: pointer;
          font-size: 13px;
          font-weight: 500;
        }
        .acc-email-link {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 7px 14px;
          border-radius: 8px;
          background: transparent;
          color: var(--primary-60);
          border: 1px solid var(--primary-10);
          cursor: pointer;
          font-size: 13px;
        }
        .acc-email-link:disabled {
          color: var(--primary-40);
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
