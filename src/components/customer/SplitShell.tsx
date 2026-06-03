import Link from "next/link";
import { Star } from "lucide-react";
import CustomerLogo from "./Logo";

export const BRAND_IMAGES = {
  login: "/images/Customer_Login.png",
  setup:
    "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=1400&q=80&auto=format&fit=crop",
  rate:
    "https://images.unsplash.com/photo-1590402494682-d57ca57c0878?w=1400&q=80&auto=format&fit=crop",
  home:
    "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=1600&q=80&auto=format&fit=crop",
} as const;

interface SplitShellProps {
  image?: string;
  // HTML string (may include <br/> and <em>...</em>) for the brand quote
  quoteHtml?: string;
  quoteSub?: string;
  topRightLabel?: string;
  topRightHref?: string;
  badge?: string;
  children: React.ReactNode;
}

export default function SplitShell({
  image,
  quoteHtml,
  quoteSub,
  topRightLabel,
  topRightHref,
  badge,
  children,
}: SplitShellProps) {
  return (
    <div className="cl-customer">
      <div
        className="cl-split cl-fade-up"
        style={
          { "--brand-image": image ? `url(${image})` : "none" } as React.CSSProperties
        }>
        <aside
          className="cl-split-brand"
          style={
            {
              "--brand-image": image ? `url(${image})` : "none",
            } as React.CSSProperties
          }>
          <div className="cl-split-brand-top">
            <CustomerLogo onDark />
            {badge ? (
              <span
                style={{
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: "0.12em",
                  opacity: 0.7,
                  fontWeight: 600,
                }}>
                {badge}
              </span>
            ) : null}
          </div>
          <div className="cl-split-brand-body">
            {quoteHtml ? (
              <p
                className="cl-split-brand-quote"
                dangerouslySetInnerHTML={{ __html: quoteHtml }}
              />
            ) : null}
            {quoteSub ? <p className="cl-split-brand-sub">{quoteSub}</p> : null}
          </div>
          <div className="cl-split-brand-foot">
            <span style={{ display: "inline-flex", gap: 4 }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Star
                  key={n}
                  size={11}
                  fill="#cba35a"
                  stroke="none"
                  style={{ color: "#cba35a" }}
                />
              ))}
            </span>
            <span>Trusted by Montréal homeowners</span>
          </div>
        </aside>

        <section className="cl-split-form">
          <div className="cl-split-form-top">
            {topRightLabel && topRightHref ? (
              <Link href={topRightHref} className="cl-link">
                {topRightLabel}
              </Link>
            ) : null}
          </div>
          <div className="cl-split-form-body">
            <div className="cl-split-form-inner cl-fade-up-2">{children}</div>
          </div>
        </section>
      </div>
    </div>
  );
}
