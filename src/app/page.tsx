import Link from "next/link";
import {
  Wrench,
  Hammer,
  Paintbrush,
  Trees,
  ShieldCheck,
  Clock,
  BadgeCheck,
  ArrowRight,
  Check,
} from "lucide-react";
import CustomerLogo from "@/components/customer/Logo";
import styles from "./home.module.css";

// Static marketing page — no per-request data. Kept out of the (public) group
// so it renders its own full-width header/footer chrome instead of inheriting
// the slim shared (public) layout bar.
export const metadata = {
  title: "Fixaro — Handyman services, done right",
  description:
    "Book a vetted local Pro for repairs, TV mounting, furniture assembly, painting, drywall, AC installation and more. Upfront pricing, satisfaction guaranteed.",
};

const CONTAINER: React.CSSProperties = {
  maxWidth: 1120,
  margin: "0 auto",
  padding: "0 24px",
  width: "100%",
};

// Curated marketing overview drawn from the real SERVICE_CATALOG service names
// (src/app/(book)/book/types.ts). This is intentionally a static summary — the
// live, admin-editable bookable catalog is served on /book and /quote.
const SERVICE_GROUPS: {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  title: string;
  examples: string[];
}[] = [
  {
    icon: Wrench,
    title: "Repairs",
    examples: [
      "Drywall repair",
      "Door & cabinet repair",
      "Faucet & toilet repair",
      "Caulking touch-ups",
      "Lock replacement",
    ],
  },
  {
    icon: Hammer,
    title: "Installation & Assembly",
    examples: [
      "TV mounting",
      "Furniture assembly",
      "Shelf & curtain rod install",
      "Light fixtures",
      "Blinds installation",
    ],
  },
  {
    icon: Paintbrush,
    title: "Home Improvement",
    examples: [
      "Painting",
      "Silicone sealing",
      "Accent walls",
      "Cabinet hardware",
      "Small carpentry",
    ],
  },
  {
    icon: Trees,
    title: "Outdoor & Seasonal",
    examples: [
      "Fence & gate repair",
      "Deck repairs",
      "Gutter cleaning",
      "Weatherproofing",
      "Dryer vent cleaning",
    ],
  },
];

const STEPS: { title: string; body: string }[] = [
  {
    title: "Tell us what you need",
    body: "Book online in a few minutes, or request a quote for larger projects. Add photos so your Pro arrives ready.",
  },
  {
    title: "We match you with a vetted Pro",
    body: "Every Fixaro Pro is background-checked and insured. We schedule the right person for the job near you.",
  },
  {
    title: "Job done right — pay after",
    body: "Approve the work when it's finished. A small deposit holds your slot; the balance is due only after your visit.",
  },
];

const TRUST: {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  label: string;
}[] = [
  { icon: ShieldCheck, label: "Vetted & insured Pros" },
  { icon: BadgeCheck, label: "Upfront, transparent pricing" },
  { icon: Clock, label: "Same-week availability" },
  { icon: Check, label: "Satisfaction guaranteed" },
];

export default function HomePage() {
  return (
    <div className="cl-customer">
      <a href="#main" className={styles.skipLink}>
        Skip to content
      </a>

      {/* ── Header / nav ── */}
      <header
        style={{
          borderBottom: "1px solid var(--primary-10)",
          background: "rgba(255,255,255,0.85)",
          backdropFilter: "saturate(180%) blur(10px)",
          position: "sticky",
          top: 0,
          zIndex: 20,
        }}>
        <div
          style={{
            ...CONTAINER,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            height: 72,
          }}>
          <CustomerLogo href="/" />
          <nav
            aria-label="Primary"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 26,
              flexWrap: "wrap",
              justifyContent: "flex-end",
            }}>
            <Link href="#services" className="cl-link-muted" style={{ fontSize: 14 }}>
              Services
            </Link>
            <Link href="#how-it-works" className="cl-link-muted" style={{ fontSize: 14 }}>
              How it works
            </Link>
            <Link href="/reviews" className="cl-link-muted" style={{ fontSize: 14 }}>
              Reviews
            </Link>
            <Link href="/faq" className="cl-link-muted" style={{ fontSize: 14 }}>
              FAQ
            </Link>
            <Link
              href="/portal/login"
              className="cl-link-muted"
              style={{ fontSize: 14 }}>
              Sign in
            </Link>
            <Link href="/book" className="cl-btn cl-btn-primary cl-btn-sm">
              Book now
            </Link>
          </nav>
        </div>
      </header>

      <main id="main">
        {/* ── Hero ── */}
        <section
          style={{
            background:
              "linear-gradient(180deg, var(--cream) 0%, #ffffff 100%)",
            borderBottom: "1px solid var(--primary-5)",
          }}>
          <div
            style={{
              ...CONTAINER,
              padding: "96px 24px 88px",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}>
            <p className="cl-eyebrow" style={{ marginBottom: 18 }}>
              Handyman services, on demand
            </p>
            <h1
              className="cl-display"
              style={{ maxWidth: 820, marginBottom: 22 }}>
              Get it <em>fixed</em> — by a Pro you can trust.
            </h1>
            <p
              className="cl-subtitle"
              style={{ maxWidth: 580, fontSize: 18, marginBottom: 36 }}>
              From TV mounting and furniture assembly to painting, drywall and AC
              installation — book a vetted local Pro in minutes, with upfront
              pricing and no surprises.
            </p>
            <div
              style={{
                display: "flex",
                gap: 14,
                flexWrap: "wrap",
                justifyContent: "center",
              }}>
              <Link href="/book" className="cl-btn cl-btn-primary cl-btn-lg">
                Book a service
                <ArrowRight size={18} strokeWidth={2.2} />
              </Link>
              <Link href="/quote" className="cl-btn cl-btn-secondary cl-btn-lg">
                Get a quote
              </Link>
            </div>

            {/* Trust strip */}
            <ul
              style={{
                listStyle: "none",
                margin: "48px 0 0",
                padding: 0,
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(200px, 1fr))",
                gap: 16,
                width: "100%",
                maxWidth: 900,
              }}>
              {TRUST.map(({ icon: Icon, label }) => (
                <li
                  key={label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 10,
                    fontSize: 14,
                    fontWeight: 500,
                    color: "var(--ink-soft)",
                  }}>
                  <span
                    style={{
                      color: "var(--accent)",
                      display: "inline-flex",
                    }}
                    aria-hidden="true">
                    <Icon size={18} strokeWidth={2} />
                  </span>
                  {label}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── Services overview ── */}
        <section
          id="services"
          aria-labelledby="services-heading"
          style={{ padding: "88px 0" }}>
          <div style={CONTAINER}>
            <div style={{ textAlign: "center", marginBottom: 48 }}>
              <p className="cl-eyebrow" style={{ marginBottom: 12 }}>
                What we do
              </p>
              <h2
                id="services-heading"
                className="cl-title"
                style={{ marginBottom: 12 }}>
                One Pro for the whole to-do list
              </h2>
              <p
                className="cl-subtitle"
                style={{ maxWidth: 560, margin: "0 auto" }}>
                Dozens of services across four categories. Hourly work starts at
                $79/hr with a 3-hour package at $209; bigger projects like
                painting get a tailored quote.
              </p>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(240px, 1fr))",
                gap: 20,
              }}>
              {SERVICE_GROUPS.map(({ icon: Icon, title, examples }) => (
                <article
                  key={title}
                  style={{
                    background: "#fff",
                    border: "1px solid var(--primary-10)",
                    borderRadius: "var(--radius)",
                    padding: 26,
                    boxShadow: "var(--shadow-soft)",
                  }}>
                  <span
                    style={{
                      width: 46,
                      height: 46,
                      borderRadius: 12,
                      background: "var(--gold-soft)",
                      color: "var(--accent)",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      marginBottom: 18,
                    }}
                    aria-hidden="true">
                    <Icon size={22} strokeWidth={2} />
                  </span>
                  <h3
                    style={{
                      fontFamily: "var(--font-cl)",
                      fontSize: 18,
                      fontWeight: 600,
                      color: "var(--ink)",
                      margin: "0 0 14px",
                    }}>
                    {title}
                  </h3>
                  <ul
                    style={{
                      listStyle: "none",
                      margin: 0,
                      padding: 0,
                      display: "flex",
                      flexDirection: "column",
                      gap: 9,
                    }}>
                    {examples.map((ex) => (
                      <li
                        key={ex}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 9,
                          fontSize: 14,
                          color: "var(--primary-70)",
                        }}>
                        <Check
                          size={15}
                          strokeWidth={2.4}
                          style={{ color: "var(--accent)", flexShrink: 0 }}
                          aria-hidden="true"
                        />
                        {ex}
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>

            <div style={{ textAlign: "center", marginTop: 40 }}>
              <Link href="/book" className="cl-link" style={{ fontSize: 15 }}>
                See all services & book →
              </Link>
            </div>
          </div>
        </section>

        {/* ── How it works ── */}
        <section
          id="how-it-works"
          aria-labelledby="how-heading"
          style={{
            padding: "88px 0",
            background: "var(--cream)",
            borderTop: "1px solid var(--primary-5)",
            borderBottom: "1px solid var(--primary-5)",
          }}>
          <div style={CONTAINER}>
            <div style={{ textAlign: "center", marginBottom: 48 }}>
              <p className="cl-eyebrow" style={{ marginBottom: 12 }}>
                How it works
              </p>
              <h2 id="how-heading" className="cl-title">
                Three steps to done
              </h2>
            </div>

            <ol
              style={{
                listStyle: "none",
                margin: 0,
                padding: 0,
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(260px, 1fr))",
                gap: 24,
                counterReset: "step",
              }}>
              {STEPS.map((s, i) => (
                <li
                  key={s.title}
                  style={{
                    background: "#fff",
                    border: "1px solid var(--primary-10)",
                    borderRadius: "var(--radius)",
                    padding: 28,
                  }}>
                  <span
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: "50%",
                      background: "var(--primary)",
                      color: "#fff",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontFamily: "var(--font-cl-serif)",
                      fontSize: 18,
                      marginBottom: 18,
                    }}
                    aria-hidden="true">
                    {i + 1}
                  </span>
                  <h3
                    style={{
                      fontFamily: "var(--font-cl)",
                      fontSize: 18,
                      fontWeight: 600,
                      color: "var(--ink)",
                      margin: "0 0 10px",
                    }}>
                    {s.title}
                  </h3>
                  <p
                    style={{
                      fontSize: 14.5,
                      lineHeight: 1.6,
                      color: "var(--primary-70)",
                      margin: 0,
                    }}>
                    {s.body}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ── CTA band ── */}
        <section aria-labelledby="cta-heading" style={{ padding: "88px 0" }}>
          <div style={CONTAINER}>
            <div
              style={{
                background: "var(--primary)",
                borderRadius: "var(--radius)",
                padding: "56px 32px",
                textAlign: "center",
                boxShadow: "var(--shadow-card)",
              }}>
              <h2
                id="cta-heading"
                style={{
                  fontFamily: "var(--font-cl-serif)",
                  fontWeight: 300,
                  fontSize: "clamp(28px, 4vw, 44px)",
                  letterSpacing: "-0.02em",
                  color: "#fff",
                  margin: "0 0 14px",
                }}>
                Ready to get it fixed?
              </h2>
              <p
                style={{
                  fontSize: 16,
                  color: "rgba(255,255,255,0.72)",
                  maxWidth: 520,
                  margin: "0 auto 32px",
                  lineHeight: 1.55,
                }}>
                Book a vetted Pro in minutes, or send us the details and we&apos;ll
                reply with a tailored quote within one business day.
              </p>
              <div
                style={{
                  display: "flex",
                  gap: 14,
                  flexWrap: "wrap",
                  justifyContent: "center",
                }}>
                <Link href="/book" className="cl-btn cl-btn-primary cl-btn-lg">
                  Book a service
                  <ArrowRight size={18} strokeWidth={2.2} />
                </Link>
                <Link
                  href="/quote"
                  className="cl-btn cl-btn-lg"
                  style={{
                    background: "rgba(255,255,255,0.1)",
                    color: "#fff",
                    border: "1px solid rgba(255,255,255,0.25)",
                  }}>
                  Get a quote
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer
        style={{
          background: "var(--primary)",
          color: "rgba(255,255,255,0.72)",
          paddingTop: 56,
          paddingBottom: 32,
        }}>
        <div style={CONTAINER}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 40,
              paddingBottom: 40,
              borderBottom: "1px solid rgba(255,255,255,0.12)",
            }}>
            <div style={{ maxWidth: 280 }}>
              <CustomerLogo href="/" onDark />
              <p
                style={{
                  fontSize: 14,
                  lineHeight: 1.6,
                  color: "rgba(255,255,255,0.6)",
                  marginTop: 16,
                }}>
                Vetted, insured local Pros for repairs, installations, painting
                and seasonal work — with upfront pricing.
              </p>
            </div>

            <FooterCol
              heading="Services"
              links={[
                { label: "Repairs", href: "#services" },
                { label: "Installation & Assembly", href: "#services" },
                { label: "Painting", href: "/quote" },
                { label: "Outdoor & Seasonal", href: "#services" },
              ]}
            />
            <FooterCol
              heading="Company"
              links={[
                { label: "Reviews", href: "/reviews" },
                { label: "FAQ", href: "/faq" },
                { label: "Careers", href: "/careers" },
              ]}
            />
            <FooterCol
              heading="Get started"
              links={[
                { label: "Book a service", href: "/book" },
                { label: "Request a quote", href: "/quote" },
                { label: "Customer sign in", href: "/portal/login" },
              ]}
            />
          </div>

          <p
            style={{
              fontSize: 13,
              color: "rgba(255,255,255,0.5)",
              marginTop: 24,
              textAlign: "center",
            }}>
            &copy; {new Date().getFullYear()} Fixaro. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}

function FooterCol({
  heading,
  links,
}: {
  heading: string;
  links: { label: string; href: string }[];
}) {
  return (
    <div>
      <h2
        style={{
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          fontWeight: 600,
          color: "rgba(255,255,255,0.45)",
          margin: "0 0 16px",
        }}>
        {heading}
      </h2>
      <ul
        style={{
          listStyle: "none",
          margin: 0,
          padding: 0,
          display: "flex",
          flexDirection: "column",
          gap: 11,
        }}>
        {links.map((l) => (
          <li key={l.label}>
            <Link
              href={l.href}
              style={{
                fontSize: 14,
                color: "rgba(255,255,255,0.72)",
                textDecoration: "none",
              }}>
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
