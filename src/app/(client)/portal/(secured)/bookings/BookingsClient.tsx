"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, X, ChevronRight } from "lucide-react";
import { Banner, Button } from "@/components/customer/Field";
import { StatusBadge, DateBadge } from "@/components/customer/atoms";
import { requestCancellation } from "../../actions/requestCancellation";
import { requestReschedule } from "../../actions/requestReschedule";

interface Booking {
  id: string;
  jobNumber: number;
  startTime: string;
  status: string;
  isFlexible: boolean;
  location: string | null;
  jobType: string | null;
  price: number | null;
  paidAt: string | null;
  paymentReceived: boolean;
  refundedAmount: number;
  cancellationRequestedAt: string | null;
  rescheduleRequestedAt: string | null;
  cleaners: { id: string; name: string }[];
  addOns: { name: string; price: number }[];
  parentJobId: string | null;
  seriesSize: number;
}

function formatPrice(n: number | null | undefined) {
  return `$${(n ?? 0).toFixed(2)}`;
}
function formatTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function BookingsClient({ bookings }: { bookings: Booking[] }) {
  const router = useRouter();
  const [flash, setFlash] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  function openBooking(id: string) {
    router.push(`/portal/bookings/${id}`);
  }

  async function handleCancel(jobId: string) {
    if (!confirm("Submit a cancellation request? Our team will reach out to confirm.")) return;
    setBusyId(jobId);
    const res = await requestCancellation(jobId);
    setBusyId(null);
    setFlash(
      res.success
        ? { kind: "success", text: "Cancellation requested — awaiting confirmation." }
        : { kind: "error", text: res.error || "Failed" }
    );
  }

  async function handleReschedule(jobId: string) {
    const note = prompt("When would you like to reschedule? Give us your preferred date and any notes.");
    if (!note) return;
    setBusyId(jobId);
    const res = await requestReschedule({ jobId, notes: note });
    setBusyId(null);
    setFlash(
      res.success
        ? { kind: "success", text: "Reschedule requested — we'll be in touch." }
        : { kind: "error", text: res.error || "Failed" }
    );
  }

  const now = new Date();
  const upcoming = bookings.filter(
    (b) => new Date(b.startTime) >= now && b.status !== "CANCELLED"
  );
  const past = bookings.filter(
    (b) => new Date(b.startTime) < now || b.status === "CANCELLED"
  );

  return (
    <>
      <header className="cl-row-between" style={{ marginBottom: 36, alignItems: "flex-end" }}>
        <div className="cl-stack-8">
          <p className="cl-eyebrow">Your bookings</p>
          <h1 className="cl-display" style={{ fontSize: "clamp(34px, 4.2vw, 48px)" }}>All cleanings.</h1>
        </div>
        <Link href="/book" className="cl-btn cl-btn-primary">+ New booking</Link>
      </header>

      {flash ? (
        <div style={{ marginBottom: 24 }}>
          <Banner kind={flash.kind}>
            <div className="cl-row-between">
              <span>{flash.text}</span>
              <button
                className="cl-icon-btn"
                style={{ width: 24, height: 24 }}
                aria-label="Dismiss"
                onClick={() => setFlash(null)}>
                <X size={14} />
              </button>
            </div>
          </Banner>
        </div>
      ) : null}

      <section className="cl-stack-12" style={{ marginBottom: 36 }}>
        <h2 className="cl-label" style={{ marginBottom: 6, fontSize: 12 }}>Upcoming · {upcoming.length}</h2>
        {upcoming.length === 0 ? (
          <div className="cl-tile cl-tile-pad-sm" style={{ color: "var(--primary-60)", fontSize: 14, textAlign: "center", padding: 24 }}>
            No upcoming bookings.
          </div>
        ) : (
          upcoming.map((b) => (
            <BookingCard
              key={b.id}
              b={b}
              busy={busyId === b.id}
              onReschedule={() => handleReschedule(b.id)}
              onCancel={() => handleCancel(b.id)}
              onOpen={() => openBooking(b.id)}
            />
          ))
        )}
      </section>

      <section className="cl-stack-12">
        <h2 className="cl-label" style={{ marginBottom: 6, fontSize: 12 }}>Past · {past.length}</h2>
        {past.length === 0 ? (
          <div className="cl-tile cl-tile-pad-sm" style={{ color: "var(--primary-60)", fontSize: 14, textAlign: "center", padding: 24 }}>
            No past bookings yet.
          </div>
        ) : (
          past.map((b) => (
            <BookingCard
              key={b.id}
              b={b}
              past
              onOpen={() => openBooking(b.id)}
            />
          ))
        )}
      </section>
    </>
  );
}

function BookingCard({
  b,
  past,
  busy,
  onReschedule,
  onCancel,
  onOpen,
}: {
  b: Booking;
  past?: boolean;
  busy?: boolean;
  onReschedule?: () => void;
  onCancel?: () => void;
  onOpen?: () => void;
}) {
  const hasRequest = b.cancellationRequestedAt || b.rescheduleRequestedAt;
  const isCompletedOrPaid = b.status === "COMPLETED" || b.status === "PAID";

  function stopProp(e: React.MouseEvent) {
    e.stopPropagation();
  }

  return (
    <article
      className="cl-bcard"
      onClick={onOpen}
      style={{ cursor: onOpen ? "pointer" : "default" }}
      role={onOpen ? "button" : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onKeyDown={(e) => {
        if (onOpen && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onOpen();
        }
      }}>
      <div className="cl-bcard-top">
        <div style={{ display: "flex", alignItems: "flex-start", gap: 18, minWidth: 0 }}>
          <DateBadge iso={b.startTime} />
          <div className="cl-stack-4">
            <span className="cl-bcard-id">Job #{b.jobNumber}</span>
            <h3 className="cl-bcard-date">
              {formatTime(b.startTime)}
              {b.isFlexible ? (
                <span style={{ fontSize: 13, fontWeight: 400, color: "var(--primary-50)", marginLeft: 8 }}>(flexible)</span>
              ) : null}
            </h3>
            {b.location ? <div style={{ fontSize: 13, color: "var(--primary-60)" }}>{b.location}</div> : null}
          </div>
        </div>
        <StatusBadge status={b.status} />
      </div>

      <div className="cl-bcard-meta">
        {b.jobType ? <span style={{ fontWeight: 500, color: "var(--ink)" }}>{b.jobType}</span> : null}
        {b.cleaners.length ? <span>· with {b.cleaners.map((c) => c.name).join(", ")}</span> : null}
        {b.seriesSize > 1 ? (
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              padding: "3px 8px",
              borderRadius: 999,
              background: "var(--primary-5)",
              color: "var(--primary)",
              letterSpacing: "0.04em",
            }}
            title="Part of a recurring booking">
            ⟳ {b.parentJobId ? `Part of ${b.seriesSize}-visit series` : `Recurring · ${b.seriesSize} visits`}
          </span>
        ) : null}
        <span className="cl-bcard-price">{formatPrice(b.price)}</span>
      </div>

      {b.addOns.length ? (
        <div style={{ fontSize: 12, color: "var(--primary-50)" }}>
          Add-ons: {b.addOns.map((a) => a.name).join(", ")}
        </div>
      ) : null}

      {hasRequest ? (
        <Banner kind="amber">
          {b.cancellationRequestedAt
            ? "Cancellation requested — awaiting confirmation."
            : "Reschedule requested — we'll be in touch."}
        </Banner>
      ) : null}

      {past && isCompletedOrPaid ? (
        <div className="cl-bcard-foot" onClick={stopProp}>
          <a
            className="cl-link"
            style={{ fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6 }}
            href={`/api/receipts/${b.id}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={stopProp}>
            <Download size={14} /> Download receipt
          </a>
          {b.refundedAmount > 0 ? (
            <span style={{ fontSize: 12, color: "var(--amber-700)", fontWeight: 600, marginLeft: "auto" }}>
              Refund: {formatPrice(b.refundedAmount)}
            </span>
          ) : null}
        </div>
      ) : null}

      {!past && !hasRequest ? (
        <div className="cl-bcard-foot" onClick={stopProp}>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onReschedule?.();
            }}
            disabled={busy}>
            Request reschedule
          </Button>
          <Button
            variant="dangerGhost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onCancel?.();
            }}
            disabled={busy}>
            Request cancellation
          </Button>
        </div>
      ) : null}
    </article>
  );
}
