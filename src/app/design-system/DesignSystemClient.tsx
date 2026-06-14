"use client";

// Fixaro Design System — living style guide.
// Recreated from the Claude Design handoff (Fixaro Design System.html):
// charcoal + safety-orange "refined operational" kit, light default + dark,
// DM Sans + JetBrains Mono. Scoped under .fxds (see fixaro-ds.css).

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  LayoutGrid, BarChart3, Layers, Zap, Flag, Users, SquarePen, Package, Bell,
  LineChart, RefreshCw, Plus, Download, CalendarDays, ArrowRight, Search,
  DollarSign, Briefcase, CreditCard, TrendingUp, TrendingDown, Check, X,
  AlertTriangle, CheckCircle2, Sun, Moon, MessageCircle, Phone, MoreVertical,
  type LucideIcon,
} from "lucide-react";

/* ---------- helpers ---------- */
const AV_PALETTE = ["var(--accent)", "var(--info)", "var(--ok)", "var(--grape)", "var(--warn)", "#3f7d8c", "#9a5b3f", "#5f6bd6"];
function av(s: string) {
  let n = 0;
  for (const c of s) n = (n * 31 + c.charCodeAt(0)) % AV_PALETTE.length;
  return AV_PALETTE[n];
}
const initials = (n: string) => n.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

function Spark({ data, color = "var(--accent)", w = 82, h = 30, inline = false }: { data: number[]; color?: string; w?: number; h?: number; inline?: boolean }) {
  const max = Math.max(...data), min = Math.min(...data), range = max - min || 1;
  const pts = data.map((v, i) => [(i / (data.length - 1)) * w, h - ((v - min) / range) * (h - 4) - 2]);
  const d = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  return (
    <svg className={inline ? undefined : "spark"} viewBox={`0 0 ${w} ${h}`} style={inline ? { width: w, height: h } : undefined}>
      <path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r={2.4} fill={color} />
    </svg>
  );
}

const Sub = ({ children }: { children: React.ReactNode }) => <div className="ds-sub">{children}</div>;
const SecHead = ({ title, ix }: { title: string; ix: string }) => (
  <div className="ds-sec-h"><h2>{title}</h2><span className="ix">{ix}</span></div>
);

/* ---------- navigation ---------- */
type NavGroup = [string, [string, string, LucideIcon][]];
const NAV: NavGroup[] = [
  ["Foundations", [["color", "Color", LayoutGrid], ["type", "Typography", BarChart3], ["elevation", "Elevation", Layers]]],
  ["Components", [["buttons", "Buttons", Zap], ["badges", "Badges & status", Flag], ["avatars", "Avatars", Users], ["forms", "Form controls", SquarePen], ["cards", "Cards & stats", Package], ["feedback", "Feedback", Bell]]],
  ["Visual", [["dataviz", "Data viz", LineChart], ["loaders", "Loaders", RefreshCw]]],
];
const FLAT = NAV.flatMap((g) => g[1].map((i) => i[0]));

export default function DesignSystemClient() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [active, setActive] = useState("color");
  const [splash, setSplash] = useState(false);

  useEffect(() => {
    const saved = (localStorage.getItem("fixaro-ds-theme") as "light" | "dark") || "light";
    setTheme(saved);
  }, []);
  useEffect(() => { localStorage.setItem("fixaro-ds-theme", theme); }, [theme]);

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) setActive(e.target.id); }),
      { rootMargin: "-20% 0px -70% 0px" }
    );
    FLAT.forEach((id) => { const el = document.getElementById(id); if (el) obs.observe(el); });
    return () => obs.disconnect();
  }, []);

  return (
    <div className="fxds" data-theme={theme}>
      {splash && <BrandSplash onDone={() => setSplash(false)} />}
      <div className="ds">
        <aside className="ds-rail">
          <div className="ds-rail-brand">
            <Image className="brand-mark" src="/images/Fixaro-Logo.png" alt="Fixaro" width={30} height={30} />
            <div className="col">
              <span className="nm">Fix<b>aro</b></span>
              <span className="sub">Design System</span>
            </div>
          </div>
          <nav className="ds-rail-nav">
            {NAV.map((g) => (
              <div key={g[0]}>
                <div className="nav-label">{g[0]}</div>
                {g[1].map(([id, label, Ic]) => (
                  <a key={id} href={`#${id}`} className={active === id ? "on" : ""}><Ic /> {label}</a>
                ))}
              </div>
            ))}
          </nav>
          <div className="ds-rail-foot">
            <button className="btn btn-sm" style={{ width: "100%", justifyContent: "center" }}
              onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}>
              {theme === "dark" ? <Sun /> : <Moon />} {theme === "dark" ? "Light theme" : "Dark theme"}
            </button>
          </div>
        </aside>

        <main className="ds-main">
          <div className="ds-content">
            <header className="ds-hero">
              <div className="eyebrow">Fixaro · Field Ops</div>
              <h1>Design System</h1>
              <p>The redesigned component language for the Fixaro admin app — a clean, data-dense operational kit in charcoal and safety orange. Every legacy <code style={{ fontFamily: "var(--mono)", fontSize: 13, color: "var(--accent-ink)" }}>cleano_* / tdo / dentitek</code> variant consolidated into one deliberate set.</p>
              <div className="meta">
                <span className="chip line">DM Sans + JetBrains Mono</span>
                <span className="chip line">11 sections</span>
                <span className="chip acc">Light + dark</span>
              </div>
            </header>

            <SecColor />
            <SecType />
            <SecElevation />
            <SecButtons />
            <SecBadges />
            <SecAvatars />
            <SecForms />
            <SecCards />
            <SecFeedback />
            <SecDataViz />
            <SecLoaders onReplay={() => setSplash(true)} />
          </div>
        </main>
      </div>
    </div>
  );
}

/* ======================= 01 · COLOR ======================= */
function SecColor() {
  const BRAND: [string, string, string, string?][] = [
    ["Ink / Charcoal", "#1c1917", "var(--ink)", "#fff"],
    ["Accent · Orange", "#e85d04", "var(--accent)", "#fff"],
    ["Accent · Ink", "#c44c03", "var(--accent-ink)", "#fff"],
    ["Accent · Soft", "rgba(232,93,4,.10)", "var(--accent-soft)", "var(--accent-ink)"],
  ];
  const SEM: [string, string, string][] = [
    ["Success", "#1d7a4d", "var(--ok)"], ["Warning", "#b4690e", "var(--warn)"],
    ["Danger", "#c4362f", "var(--bad)"], ["Info", "#2b6fb3", "var(--info)"], ["Grape", "#7a4ec0", "var(--grape)"],
  ];
  const NEUTRAL = ["--bg", "--surface", "--surface-2", "--surface-3", "--ink-4", "--ink-3", "--ink-2", "--ink"];
  const Sw = (n: string, v: string, cssvar: string, fg?: string) => (
    <div className="sw" key={n}>
      <div className="sw-chip" style={{ background: cssvar, color: fg || "#fff" }} />
      <div className="sw-meta"><div className="sw-name">{n}</div><div className="sw-val">{v}</div></div>
    </div>
  );
  return (
    <section id="color" className="ds-sec">
      <SecHead title="Color" ix="01" />
      <p className="desc">A warm-neutral foundation with a single decisive accent. Charcoal ink and safety-orange carry the brand; everything else is a quiet warm grey so data and status read first. Values shown for the light theme — every token re-maps automatically in dark.</p>
      <Sub>Brand</Sub>
      <div className="sw-grid">{BRAND.map((b) => Sw(b[0], b[1], b[2], b[3]))}</div>
      <Sub>Neutral ramp</Sub>
      <div className="ramp">{NEUTRAL.map((t, i) => <div key={t} style={{ background: `var(${t})`, color: i < 4 ? "var(--ink-2)" : "var(--surface)" }}>{t.replace("--", "")}</div>)}</div>
      <Sub>Semantic</Sub>
      <div className="sw-grid">{SEM.map((s) => Sw(s[0], s[1], s[2]))}</div>
      <div style={{ marginTop: 18 }}>
        <div className="demo">
          <table className="spec">
            <thead><tr><th>Token</th><th>Role</th></tr></thead>
            <tbody>
              <tr><td><code>--accent</code></td><td>Primary actions, active nav, focus, key data</td></tr>
              <tr><td><code>--ink / --ink-2 / --ink-3</code></td><td>Text: primary · secondary · muted</td></tr>
              <tr><td><code>--surface / --surface-2</code></td><td>Cards · insets, inputs, table stripes</td></tr>
              <tr><td><code>--line / --line-2</code></td><td>Hairline borders · stronger dividers</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

/* ======================= 02 · TYPOGRAPHY ======================= */
function TypeRow({ name, spec, children }: { name: string; spec: string; children: React.ReactNode }) {
  return (
    <div className="demo-row" style={{ justifyContent: "space-between", borderBottom: "1px solid var(--line)", paddingBottom: 16, gap: 20 }}>
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600 }}>{name}</div>
        <div className="mono" style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 2 }}>{spec}</div>
      </div>
    </div>
  );
}
function SecType() {
  return (
    <section id="type" className="ds-sec">
      <SecHead title="Typography" ix="02" />
      <p className="desc">Two families do all the work. DM Sans for everything human; JetBrains Mono for anything countable — money, counts, IDs, timestamps. The decorative Gontserrat / TT Fors / Hikasami / Diagraph faces from the old build are dropped.</p>
      <div className="demo">
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <TypeRow name="Display" spec="46 / 700 / -0.04em"><div style={{ fontSize: 46, fontWeight: 700, letterSpacing: "-0.04em", lineHeight: 1 }}>Run the whole shop</div></TypeRow>
          <TypeRow name="Page title" spec="24 / 700 / -0.03em"><div style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.03em" }}>Today&rsquo;s schedule</div></TypeRow>
          <TypeRow name="Section" spec="17 / 700"><div style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.02em" }}>Upcoming jobs</div></TypeRow>
          <TypeRow name="Body" spec="14 / 400"><div style={{ fontSize: 14, color: "var(--ink-2)" }}>Marcus is en route to Greenfield Apartments, ETA 12 minutes.</div></TypeRow>
          <TypeRow name="Eyebrow" spec="11 / 700 / .16em / caps"><div className="eyebrow">Field operations</div></TypeRow>
          <TypeRow name="Label" spec="11 / 700 / caps"><div className="tag">Assigned crew</div></TypeRow>
          <TypeRow name="Mono / data" spec="700 / tabular"><div className="mono" style={{ fontSize: 20, fontWeight: 700 }}>$54,700.00</div></TypeRow>
        </div>
      </div>
    </section>
  );
}

/* ======================= 03 · ELEVATION ======================= */
function SecElevation() {
  return (
    <section id="elevation" className="ds-sec">
      <SecHead title="Elevation & radius" ix="03" />
      <p className="desc">Soft, warm-tinted shadows and a tight radius scale. Controls sit at 7px, cards at 14px, modals at 20px — never the blanket rounded-2xl of the old kit.</p>
      <Sub>Radius</Sub>
      <div className="demo"><div className="box-demo">
        {[["--r-sm", "7px"], ["--r", "10px"], ["--r-lg", "14px"], ["--r-xl", "20px"]].map((r) => (
          <div key={r[0]} className="b" style={{ borderRadius: `var(${r[0]})` }}>{r[1]}</div>
        ))}
      </div></div>
      <Sub>Shadow</Sub>
      <div className="demo"><div className="box-demo">
        {[["--shadow-sm", "cards"], ["--shadow", "popovers"], ["--shadow-lg", "modals"]].map((s) => (
          <div key={s[0]} className="b" style={{ boxShadow: `var(${s[0]})`, border: "none", borderRadius: "var(--r)" }}>{s[1]}</div>
        ))}
      </div></div>
    </section>
  );
}

/* ======================= 04 · BUTTONS ======================= */
function SecButtons() {
  return (
    <section id="buttons" className="ds-sec">
      <SecHead title="Buttons" ix="04" />
      <p className="desc">The old Button shipped 15 variants (cleano, tdo, dentitek, recorder, pro…). Trimmed to six with clear intent. Everything else was a tint of these.</p>
      <Sub>Variants</Sub>
      <div className="demo">
        <div className="demo-row">
          <button className="btn btn-primary">Primary</button>
          <button className="btn btn-dark">Dark</button>
          <button className="btn">Default</button>
          <button className="btn btn-ghost">Ghost</button>
          <button className="btn" style={{ color: "var(--bad)", borderColor: "var(--bad-soft)" }}>Destructive</button>
        </div>
        <div className="demo-note"><b>maps from →</b> primary = action/cleano · dark = dentitek · default = light/simple/outline · ghost = none/ghost · destructive</div>
      </div>
      <Sub>Sizes</Sub>
      <div className="demo"><div className="demo-row" style={{ alignItems: "baseline" }}>
        <button className="btn btn-primary btn-sm">Small</button>
        <button className="btn btn-primary">Medium</button>
        <button className="btn btn-primary" style={{ padding: "11px 18px", fontSize: 14 }}>Large</button>
      </div></div>
      <Sub>With icon · states</Sub>
      <div className="demo"><div className="demo-row">
        <button className="btn btn-primary"><Plus /> New job</button>
        <button className="btn"><Download /> Export</button>
        <button className="btn btn-primary"><span className="spinner" style={{ borderColor: "rgba(255,255,255,.4)", borderTopColor: "#fff", width: 14, height: 14 }} /> Charging…</button>
        <button className="btn" disabled style={{ opacity: 0.5 }}>Disabled</button>
      </div></div>
      <Sub>Icon buttons</Sub>
      <div className="demo"><div className="demo-row">
        {[Bell, MessageCircle, SquarePen, MoreVertical, Phone, RefreshCw].map((Ic, i) => (
          <button key={i} className="icon-btn"><Ic /></button>
        ))}
        <button className="icon-btn" style={{ background: "var(--accent)", borderColor: "var(--accent)", color: "#fff" }}><Plus /></button>
      </div></div>
    </section>
  );
}

/* ======================= 05 · BADGES ======================= */
function Chip({ tone, label, dot }: { tone: string; label: string; dot?: boolean }) {
  return <span className={`chip ${tone}`}>{dot && <span className="dt" />}{label}</span>;
}
function DotLabel({ color, label, pulse }: { color: string; label: string; pulse?: boolean }) {
  return (
    <span className="row" style={{ gap: 8, fontSize: 13 }}>
      <span style={{ width: 9, height: 9, borderRadius: "50%", background: color, animation: pulse ? "fxds-pulse-soft 1s ease-in-out infinite" : "none" }} />{label}
    </span>
  );
}
function SecBadges() {
  return (
    <section id="badges" className="ds-sec">
      <SecHead title="Badges & status" ix="05" />
      <p className="desc">One pill primitive, tinted by semantic token. Covers job lifecycle, payment, crew and request states in a single consistent shape.</p>
      <Sub>Job &amp; crew status</Sub>
      <div className="demo"><div className="demo-row">
        <Chip tone="acc" label="In progress" dot /><Chip tone="info" label="Scheduled" dot /><Chip tone="warn" label="Unassigned" dot />
        <Chip tone="ok" label="Completed" dot /><Chip tone="bad" label="Cancelled" dot /><Chip tone="grape" label="Lead" dot /><Chip tone="line" label="Off shift" dot />
      </div></div>
      <Sub>Payment &amp; requests</Sub>
      <div className="demo"><div className="demo-row">
        <Chip tone="ok" label="Paid" /><Chip tone="warn" label="Due" /><Chip tone="bad" label="Declined" /><Chip tone="warn" label="Pending" /><Chip tone="ok" label="Approved" /><Chip tone="line" label="Draft" />
      </div></div>
      <Sub>Counts &amp; tags</Sub>
      <div className="demo"><div className="demo-row">
        <span className="nav-badge">5</span>
        <span className="nav-badge muted">12</span>
        <span className="chip acc" style={{ fontSize: 10.5, padding: "1px 6px" }}>High</span>
        <span className="tag">Assigned crew</span>
        <span className="chip line" style={{ fontSize: 10.5 }}>Property Mgr</span>
      </div></div>
      <Sub>Live dots</Sub>
      <div className="demo"><div className="demo-row" style={{ gap: 24 }}>
        <DotLabel color="var(--ok)" label="Available" /><DotLabel color="var(--accent)" label="On a job" pulse /><DotLabel color="var(--ink-4)" label="Offline" />
      </div></div>
    </section>
  );
}

/* ======================= 06 · AVATARS ======================= */
function SecAvatars() {
  const names = ["Marcus Reed", "Diego Alvarez", "Sofia Nguyen", "Tariq Hassan", "Aisha Bello", "Brandon Cole"];
  const A = (name: string, size: number) => (
    <div key={name + size} className="av-sm" style={{ width: size, height: size, background: av(name), color: "#fff", fontSize: size * 0.4, borderRadius: size > 38 ? 10 : 7 }}>{initials(name)}</div>
  );
  return (
    <section id="avatars" className="ds-sec">
      <SecHead title="Avatars" ix="06" />
      <p className="desc">Rounded-square tiles with initials, colour hashed deterministically from the name — same person, same colour, everywhere. Photos drop in when available.</p>
      <Sub>Sizes</Sub>
      <div className="demo"><div className="demo-row" style={{ alignItems: "flex-end" }}>
        {A("Marcus Reed", 26)}{A("Marcus Reed", 34)}{A("Marcus Reed", 46)}
        <div className="avatar orange" style={{ width: 46, height: 46, borderRadius: 11, fontSize: 16 }}>RT</div>
      </div></div>
      <Sub>Stack &amp; hash palette</Sub>
      <div className="demo">
        <div className="avatars" style={{ marginBottom: 18 }}>
          {names.slice(0, 5).map((n, i) => (
            <div key={i} className="av-sm" style={{ width: 30, height: 30, background: av(n), color: "#fff", fontSize: 12, borderRadius: 8, marginLeft: i ? -8 : 0, border: "2px solid var(--surface)" }}>{initials(n)}</div>
          ))}
        </div>
        <div className="demo-row">{names.map((n) => A(n, 38))}</div>
      </div>
    </section>
  );
}

/* ======================= 07 · FORMS ======================= */
function Switch({ def = true }: { def?: boolean }) {
  const [on, set] = useState(def);
  return <button className={"fx-switch" + (on ? " on" : "")} onClick={() => set(!on)} aria-pressed={on} />;
}
function CheckBox({ def = false, radio }: { def?: boolean; radio?: boolean }) {
  const [on, set] = useState(def);
  return (
    <button className={(radio ? "fx-radio" : "fx-check") + (on ? " on" : "")} onClick={() => set(!on)}>
      {!radio && on && <Check size={13} strokeWidth={3} />}
    </button>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="fx-field"><label className="fx-label">{label}</label>{children}</div>;
}
function SecForms() {
  return (
    <section id="forms" className="ds-sec">
      <SecHead title="Form controls" ix="07" />
      <p className="desc">Inset fields on a soft surface, with a clear orange focus ring. One size that works for dense admin forms; the same treatment across input, select, textarea, checkbox, switch and search.</p>
      <div className="demo">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
          <Field label="Client name"><input className="fx-input" defaultValue="Greenfield Apartments" /></Field>
          <Field label="Service type">
            <select className="fx-select" defaultValue="p"><option value="p">Plumbing repair</option><option>Electrical</option><option>HVAC service</option></select>
          </Field>
          <Field label="Search"><div className="fx-iwrap"><Search /><input className="fx-input" placeholder="Search jobs, clients…" /></div></Field>
          <Field label="Price"><div className="fx-iwrap"><DollarSign /><input className="fx-input" defaultValue="480.00" /></div></Field>
          <div style={{ gridColumn: "1 / -1" }}><Field label="Internal note"><textarea className="fx-textarea" defaultValue={'Shutoff valve corroded — bring 1/2" copper.'} /></Field></div>
          <Field label="Invalid state"><div><input className="fx-input is-err" defaultValue="not-an-email" /><div className="fx-hint err" style={{ marginTop: 6 }}>Enter a valid email address</div></div></Field>
          <Field label="Disabled"><input className="fx-input" disabled defaultValue="Locked field" style={{ opacity: 0.55, cursor: "not-allowed" }} /></Field>
        </div>
      </div>
      <Sub>Toggles, checkbox &amp; radio</Sub>
      <div className="demo">
        <div style={{ display: "flex", gap: 36, flexWrap: "wrap" }}>
          <div className="col" style={{ gap: 14 }}>
            <div className="row" style={{ gap: 11 }}><Switch /><span style={{ fontSize: 13.5 }}>Notify customer on arrival</span></div>
            <div className="row" style={{ gap: 11 }}><Switch def={false} /><span style={{ fontSize: 13.5 }}>Auto-charge card on completion</span></div>
          </div>
          <div className="col" style={{ gap: 14 }}>
            <div className="fx-checkrow"><CheckBox def /> Photo before &amp; after</div>
            <div className="fx-checkrow"><CheckBox /> Require signature</div>
          </div>
          <div className="col" style={{ gap: 14 }}>
            <div className="fx-checkrow"><CheckBox radio def /> One combined charge</div>
            <div className="fx-checkrow"><CheckBox radio /> Charge per technician</div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ======================= 08 · CARDS & STATS ======================= */
function Kpi({ Ic, label, val, delta, up, note, spark, sc }: { Ic: LucideIcon; label: string; val: string; delta: string; up: boolean; note: string; spark: number[]; sc?: string }) {
  return (
    <div className="kpi">
      <div className="kpi-top"><div className="kpi-ic"><Ic /></div></div>
      <div className="kpi-label" style={{ marginTop: 13 }}>{label}</div>
      <div className="kpi-val">{val}</div>
      <div className={"kpi-delta " + (up ? "up" : "down")}>{up ? <TrendingUp /> : <TrendingDown />}{delta}<span className="nrm">{note}</span></div>
      <Spark data={spark} color={sc || "var(--accent)"} />
    </div>
  );
}
function Meter({ label, val, pct, tone }: { label: string; val: string; pct: number; tone?: string }) {
  return (
    <div className="col" style={{ gap: 6 }}>
      <div className="between" style={{ fontSize: 12.5 }}><span className="tag">{label}</span><span className="mono t-strong" style={{ color: tone ? `var(--${tone})` : "var(--ink)" }}>{val}</span></div>
      <div className={"bar " + (tone || "")}><i style={{ width: pct + "%" }} /></div>
    </div>
  );
}
function SecCards() {
  return (
    <section id="cards" className="ds-sec">
      <SecHead title="Cards & stats" ix="08" />
      <p className="desc">The old Card had a dozen cleano_* / glassy variants. Now: one surface card, plus a KPI stat block with icon, value, trend and sparkline.</p>
      <Sub>KPI stat</Sub>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
        <Kpi Ic={DollarSign} label="Revenue · June" val="$54,700" delta="12.4%" up note="vs May" spark={[46, 52, 47, 58, 62, 54]} />
        <Kpi Ic={Briefcase} label="Jobs this week" val="48" delta="8.1%" up note="vs last wk" spark={[12, 18, 15, 22, 19, 8, 4]} sc="var(--info)" />
        <Kpi Ic={CreditCard} label="Outstanding" val="$3,330" delta="3 jobs" up={false} note="unpaid" spark={[8, 6, 9, 7, 11, 9]} sc="var(--warn)" />
      </div>
      <Sub>Surface card &amp; list row</Sub>
      <div className="demo">
        <div className="card" style={{ boxShadow: "none" }}>
          <div className="card-head"><h3><CalendarDays /> Upcoming jobs</h3><button className="btn btn-sm btn-ghost">View all <ArrowRight /></button></div>
          <div style={{ padding: 8 }}>
            {[["Greenfield Apartments", "Plumbing · 8:00 AM", "$480"], ["Harborview Dental", "HVAC · 9:30 AM", "$920"]].map((r, i) => (
              <div key={i} className="row" style={{ gap: 12, padding: "10px 10px", borderRadius: 8 }}>
                <div className="av-sm" style={{ width: 30, height: 30, background: "var(--surface-3)", color: "var(--ink-2)", fontSize: 11, borderRadius: 7 }}>{r[0].slice(0, 2).toUpperCase()}</div>
                <div className="col grow" style={{ gap: 1 }}><span className="t-strong" style={{ fontSize: 13 }}>{r[0]}</span><span className="muted" style={{ fontSize: 11.5 }}>{r[1]}</span></div>
                <span className="mono t-strong">{r[2]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <Sub>Progress meters</Sub>
      <div className="demo"><div className="col" style={{ gap: 14 }}>
        <Meter label="Crew utilization" val="78%" pct={78} />
        <Meter label="Copper pipe stock" val="18 / 25 ft" pct={72} tone="warn" />
        <Meter label="Inspections passed" val="94%" pct={94} tone="ok" />
      </div></div>
    </section>
  );
}

/* ======================= 09 · FEEDBACK ======================= */
function Banner({ tone, Ic, title, desc }: { tone: string; Ic: LucideIcon; title: string; desc: string }) {
  return <div className={"banner " + tone}><Ic /><div><span className="bt">{title}&nbsp;&nbsp;</span><span className="bd">{desc}</span></div></div>;
}
function Toast({ tone, Ic, msg, sub }: { tone: string; Ic: LucideIcon; msg: string; sub: string }) {
  return (
    <div className="toast">
      <div className="tic" style={{ background: `var(--${tone}-soft)`, color: `var(--${tone})` }}><Ic strokeWidth={2.6} /></div>
      <div className="tmsg">{msg} <span className="ts">{sub}</span></div>
      <span className="tx"><X size={15} /></span>
    </div>
  );
}
function SecFeedback() {
  return (
    <section id="feedback" className="ds-sec">
      <SecHead title="Feedback" ix="09" />
      <p className="desc">Banners for inline context, toasts for transient confirmation, and a focused modal for decisions. Each leans on the semantic tones, never raw red/green.</p>
      <Sub>Banners</Sub>
      <div className="demo"><div className="col" style={{ gap: 10 }}>
        <Banner tone="info" Ic={Flag} title="Recurring booking" desc="6 jobs scheduled for Greenfield Apartments through August." />
        <Banner tone="warn" Ic={Package} title="Low stock" desc="R-410A refrigerant is below threshold (4 of 6 tanks)." />
        <Banner tone="bad" Ic={AlertTriangle} title="Card declined" desc="Harborview Dental's card on file was declined — retry or request a new one." />
        <Banner tone="ok" Ic={CheckCircle2} title="Payout sent" desc="Marcus Reed's weekly payout of $1,240 was issued." />
      </div></div>
      <Sub>Toasts</Sub>
      <div className="demo"><div className="col" style={{ gap: 10, alignItems: "flex-start" }}>
        <Toast tone="ok" Ic={Check} msg="Invoice sent" sub="to Greenfield Apartments" />
        <Toast tone="bad" Ic={X} msg="Charge failed" sub="card declined" />
        <Toast tone="info" Ic={RefreshCw} msg="Schedule synced" sub="12 jobs updated" />
      </div></div>
      <Sub>Modal</Sub>
      <div className="demo" style={{ background: "var(--surface-3)" }}>
        <div className="modal-card">
          <div className="modal-head">
            <div className="modal-ic" style={{ background: "var(--bad-soft)", color: "var(--bad)" }}><AlertTriangle size={20} /></div>
            <h3>Cancel this job?</h3>
          </div>
          <div className="modal-body">J-2048 for Greenfield Apartments will be cancelled and the assigned crew notified. This can&rsquo;t be undone.</div>
          <div className="modal-foot">
            <button className="btn btn-sm">Keep job</button>
            <button className="btn btn-sm" style={{ background: "var(--bad)", borderColor: "var(--bad)", color: "#fff" }}>Cancel job</button>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ======================= 10 · DATA VIZ ======================= */
function Area() {
  const data = [48, 52, 47, 58, 62, 55, 59, 64], W = 520, H = 170, pad = 6, max = 70;
  const pts = data.map((v, i) => [pad + (i / (data.length - 1)) * (W - pad * 2), H - (v / max) * (H - 20) - 6]);
  const line = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }}>
      <defs><linearGradient id="fxds-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--accent)" stopOpacity={0.22} /><stop offset="100%" stopColor="var(--accent)" stopOpacity={0} /></linearGradient></defs>
      {[0.33, 0.66, 1].map((g, i) => <line key={i} x1={0} x2={W} y1={H - g * (H - 20) - 6} y2={H - g * (H - 20) - 6} stroke="var(--line)" />)}
      <path d={line + ` L${W - pad} ${H} L${pad} ${H} Z`} fill="url(#fxds-area)" />
      <path d={line} fill="none" stroke="var(--accent)" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r={4} fill="var(--accent)" stroke="var(--surface)" strokeWidth={2} />
    </svg>
  );
}
function Bars() {
  const data = [12, 18, 15, 22, 19, 8, 4], labels = ["M", "T", "W", "T", "F", "S", "S"], max = 22, W = 460, H = 150, bw = W / 7;
  return (
    <svg viewBox={`0 0 ${W} ${H + 20}`} style={{ width: "100%", height: "auto" }}>
      {data.map((v, i) => {
        const ht = (v / max) * (H - 10), x = i * bw + bw * 0.25, w = bw * 0.5, peak = v === max;
        return (
          <g key={i}>
            <rect x={x} y={H - ht} width={w} height={ht} rx={5} fill={peak ? "var(--accent)" : "var(--ink)"} opacity={peak ? 1 : 0.78} />
            <text x={x + w / 2} y={H + 14} textAnchor="middle" fontSize={10.5} fill="var(--ink-4)" fontFamily="var(--ds-font)">{labels[i]}</text>
          </g>
        );
      })}
    </svg>
  );
}
function Donut() {
  const data: [string, number, string][] = [["Plumbing", 32, "var(--info)"], ["Electrical", 24, "var(--warn)"], ["HVAC", 19, "var(--grape)"], ["General", 15, "var(--accent)"], ["Carpentry", 10, "var(--ok)"]];
  const total = data.reduce((s, d) => s + d[1], 0); let acc = 0; const R = 46, C = 2 * Math.PI * R;
  return (
    <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
      <svg width={120} height={120} viewBox="0 0 120 120">
        <circle cx={60} cy={60} r={R} fill="none" stroke="var(--surface-3)" strokeWidth={15} />
        {data.map((d, i) => { const frac = d[1] / total, dash = frac * C, off = acc * C; acc += frac; return <circle key={i} cx={60} cy={60} r={R} fill="none" stroke={d[2]} strokeWidth={15} strokeDasharray={`${dash} ${C - dash}`} strokeDashoffset={-off} transform="rotate(-90 60 60)" />; })}
        <text x={60} y={57} textAnchor="middle" fontSize={21} fontWeight={700} fill="var(--ink)" fontFamily="var(--mono)">182</text>
        <text x={60} y={72} textAnchor="middle" fontSize={10} fill="var(--ink-3)" fontFamily="var(--ds-font)">jobs</text>
      </svg>
      <div className="col" style={{ gap: 7 }}>
        {data.map((d, i) => <span key={i} className="row" style={{ gap: 7, fontSize: 12 }}><span style={{ width: 9, height: 9, borderRadius: 3, background: d[2] }} /><span className="t-strong">{d[0]}</span><span className="mono muted">{d[1]}%</span></span>)}
      </div>
    </div>
  );
}
function Ring({ pct, label, color = "var(--accent)" }: { pct: number; label: string; color?: string }) {
  const R = 30, C = 2 * Math.PI * R;
  return (
    <div className="col" style={{ alignItems: "center", gap: 6 }}>
      <svg width={76} height={76} viewBox="0 0 76 76">
        <circle cx={38} cy={38} r={R} fill="none" stroke="var(--surface-3)" strokeWidth={7} />
        <circle cx={38} cy={38} r={R} fill="none" stroke={color} strokeWidth={7} strokeLinecap="round" strokeDasharray={`${C * pct / 100} ${C}`} transform="rotate(-90 38 38)" />
        <text x={38} y={42} textAnchor="middle" fontSize={16} fontWeight={700} fill="var(--ink)" fontFamily="var(--mono)">{pct}%</text>
      </svg>
      <span className="tag">{label}</span>
    </div>
  );
}
function SecDataViz() {
  return (
    <section id="dataviz" className="ds-sec">
      <SecHead title="Data visualization" ix="10" />
      <p className="desc">A restrained chart palette: ink + accent bars, a single-accent area trend, and semantic-tinted categories for mix and rings. Built to read at a glance on a busy dashboard.</p>
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 14 }}>
        <div className="card"><div className="card-head"><h3><LineChart /> Revenue trend</h3></div><div className="card-pad"><Area /></div></div>
        <div className="card"><div className="card-head"><h3><Briefcase /> Service mix</h3></div><div className="card-pad" style={{ display: "grid", placeItems: "center" }}><Donut /></div></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 14 }}>
        <div className="card"><div className="card-head"><h3><BarChart3 /> Jobs by weekday</h3></div><div className="card-pad"><Bars /></div></div>
        <div className="card"><div className="card-head"><h3><Zap /> Rings &amp; sparks</h3></div><div className="card-pad" style={{ display: "flex", gap: 22, alignItems: "center", justifyContent: "center" }}>
          <Ring pct={78} label="Util" /><Ring pct={94} label="Pass" color="var(--ok)" />
          <div className="col" style={{ gap: 10 }}><Spark data={[46, 52, 47, 58, 62, 54]} w={120} h={36} inline /><Spark data={[9, 7, 11, 6, 8, 12]} w={120} h={36} color="var(--info)" inline /></div>
        </div></div>
      </div>
    </section>
  );
}

/* ======================= 11 · LOADERS ======================= */

// Cold-start brand splash: dual counter-rotating rings, determinate progress,
// cycling status copy, easing fade-out. Faithful port of loaders.jsx.
const SPLASH_STATUS = [
  "Spinning up your shop…",
  "Loading today’s jobs…",
  "Syncing crew locations…",
  "Checking inventory levels…",
  "Almost there…",
];
function BrandSplash({ onDone, duration = 1900 }: { onDone: () => void; duration?: number }) {
  const [pct, setPct] = useState(0);
  const [si, setSi] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const R = 58, C = 2 * Math.PI * R;

  useEffect(() => {
    const start = performance.now();
    let raf = 0, finished = false;
    const finish = () => {
      if (finished) return; finished = true;
      setPct(100); setSi(SPLASH_STATUS.length - 1); setLeaving(true);
      setTimeout(onDone, 440);
    };
    const tick = () => {
      const t = Math.min(1, (performance.now() - start) / duration);
      const eased = 1 - Math.pow(1 - t, 2.2);
      setPct(Math.round(eased * 100));
      setSi(Math.min(SPLASH_STATUS.length - 1, Math.floor(t * SPLASH_STATUS.length)));
      if (t < 1) raf = requestAnimationFrame(tick); else finish();
    };
    raf = requestAnimationFrame(tick);
    const guard = setTimeout(finish, duration + 700);
    return () => { cancelAnimationFrame(raf); clearTimeout(guard); };
  }, [duration, onDone]);

  return (
    <div className={"splash" + (leaving ? " leaving" : "")}>
      <div className="splash-inner">
        <div className="splash-stage">
          <svg className="splash-ring b" viewBox="0 0 128 128"><circle cx={64} cy={64} r={R} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={3} /></svg>
          <svg className="splash-ring a" viewBox="0 0 128 128"><circle cx={64} cy={64} r={R} fill="none" stroke="var(--accent)" strokeWidth={3} strokeLinecap="round" strokeDasharray={`${C * 0.28} ${C}`} /></svg>
          <div className="logo-tile"><Image src="/images/Fixaro-Logo.png" alt="Fixaro" width={66} height={66} /></div>
        </div>
        <div className="splash-word">Fix<b>aro</b></div>
        <div className="splash-tag">Field Ops</div>
        <div className="splash-status" key={si}><span className="pip" /> {SPLASH_STATUS[si]}</div>
        <div className="splash-bar"><i style={{ width: pct + "%" }} /></div>
      </div>
    </div>
  );
}

/* ---- skeleton building blocks (deterministic, SSR-safe) ---- */
const SkLine = ({ w, h = 11, style }: { w: number | string; h?: number; style?: React.CSSProperties }) =>
  <div className="skel skel-line" style={{ width: w, height: h, ...style }} />;
const SkBox = (style: React.CSSProperties) => <div className="skel" style={style} />;

function KpiSkel({ n = 4 }: { n?: number }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${n},1fr)`, gap: 14 }}>
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="skel-card">
          {SkBox({ width: 32, height: 32, borderRadius: 9 })}
          <SkLine w="55%" h={10} style={{ marginTop: 16 }} />
          <SkLine w="72%" h={22} style={{ marginTop: 12, borderRadius: 7 }} />
        </div>
      ))}
    </div>
  );
}
function TableSkel({ rows = 7 }: { rows?: number }) {
  return (
    <div className="content-wide">
      <div className="between" style={{ marginBottom: 14 }}>
        <div className="row" style={{ gap: 8 }}>{Array.from({ length: 5 }).map((_, i) => <div key={i} className="skel" style={{ width: 70, height: 26, borderRadius: 20 }} />)}</div>
        {SkBox({ width: 110, height: 30, borderRadius: 8 })}
      </div>
      <div className="card" style={{ overflow: "hidden" }}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="skel-row">
            {SkBox({ width: 30, height: 30, borderRadius: 7 })}
            <div className="col grow" style={{ gap: 7 }}><SkLine w="40%" /><SkLine w="22%" h={9} /></div>
            <SkLine w={70} /><SkLine w={60} />{SkBox({ width: 64, height: 20, borderRadius: 20 })}
          </div>
        ))}
      </div>
    </div>
  );
}
function DashSkel() {
  return (
    <div className="content-wide">
      <KpiSkel n={4} />
      <div style={{ display: "grid", gridTemplateColumns: "1.55fr 1fr", gap: 14, marginTop: 14 }}>
        <div className="col" style={{ gap: 14 }}>
          <div className="skel-card" style={{ height: 240 }}><SkLine w="30%" h={13} />{SkBox({ width: "100%", height: 160, borderRadius: 10, marginTop: 20 })}</div>
          <div className="skel-card" style={{ height: 170 }}><SkLine w="25%" h={13} />{SkBox({ width: "100%", height: 110, borderRadius: 10, marginTop: 16 })}</div>
        </div>
        <div className="col" style={{ gap: 14 }}>
          <div className="skel-card" style={{ height: 240 }}>
            <SkLine w="40%" h={13} />
            <div className="col" style={{ gap: 14, marginTop: 18 }}>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="row" style={{ gap: 10 }}>{SkBox({ width: 30, height: 30, borderRadius: 8 })}<div className="col grow" style={{ gap: 6 }}><SkLine w="60%" /><SkLine w="40%" h={9} /></div></div>
              ))}
            </div>
          </div>
          <div className="skel-card" style={{ height: 170 }}><SkLine w="45%" h={13} />{SkBox({ width: "100%", height: 100, borderRadius: 10, marginTop: 16 })}</div>
        </div>
      </div>
    </div>
  );
}
function CardsSkel({ cols = 3, n = 6, h = 196 }: { cols?: number; n?: number; h?: number }) {
  return (
    <div className="content-wide">
      <KpiSkel n={4} />
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols},1fr)`, gap: 14, marginTop: 16 }}>
        {Array.from({ length: n }).map((_, i) => (
          <div key={i} className="skel-card" style={{ height: h }}>
            <div className="row" style={{ gap: 12 }}>{SkBox({ width: 46, height: 46, borderRadius: 10 })}<div className="col grow" style={{ gap: 7 }}><SkLine w="60%" h={13} /><SkLine w="40%" h={10} /></div></div>
            {SkBox({ width: "100%", height: 8, borderRadius: 20, marginTop: 22 })}
            {SkBox({ width: "100%", height: 34, borderRadius: 8, marginTop: 18 })}
          </div>
        ))}
      </div>
    </div>
  );
}
// deterministic cell heights so SSR and client render identically
const CAL_CELLS = [70, 0, 56, 92, 0, 64, 78, 50, 0, 88, 60, 0, 74, 52];
function CalSkel() {
  return (
    <div className="content-wide" style={{ maxWidth: 1400 }}>
      <div className="between" style={{ marginBottom: 14 }}>{SkBox({ width: 280, height: 32, borderRadius: 8 })}{SkBox({ width: 320, height: 18, borderRadius: 6 })}</div>
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "52px repeat(7,1fr)" }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} style={{ padding: 12, borderBottom: "1px solid var(--line)", borderRight: "1px solid var(--line)" }}>{i ? <SkLine w="60%" h={22} /> : null}</div>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "52px repeat(7,1fr)", height: 420 }}>
          {Array.from({ length: 8 }).map((_, c) => (
            <div key={c} style={{ borderRight: "1px solid var(--line)", padding: 6, display: "flex", flexDirection: "column", gap: 10 }}>
              {c ? [0, 1].map((r) => { const hgt = CAL_CELLS[(c * 2 + r) % CAL_CELLS.length]; return hgt ? <div key={r} className="skel" style={{ width: "92%", height: hgt, borderRadius: 7, marginTop: r === 0 ? 30 : 0 }} /> : null; }) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
function ChatSkel() {
  return (
    <div style={{ height: 440, maxWidth: 1320, margin: "0 auto" }}>
      <div className="card" style={{ height: "100%", display: "grid", gridTemplateColumns: "288px 1fr", overflow: "hidden" }}>
        <div style={{ borderRight: "1px solid var(--line)" }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skel-row">{SkBox({ width: 38, height: 38, borderRadius: 10 })}<div className="col grow" style={{ gap: 7 }}><SkLine w="50%" /><SkLine w="80%" h={9} /></div></div>
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: 22, background: "var(--surface-2)" }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} style={{ alignSelf: i % 2 ? "flex-end" : "flex-start" }}>{SkBox({ width: i % 2 ? 200 : 240, height: 40 + (i % 3) * 14, borderRadius: 13 })}</div>
          ))}
        </div>
      </div>
    </div>
  );
}
const SKELETONS: [string, () => React.ReactElement][] = [
  ["Dashboard", () => <DashSkel />],
  ["Table", () => <TableSkel />],
  ["Cards", () => <CardsSkel cols={3} n={6} />],
  ["Calendar", () => <CalSkel />],
  ["Chat", () => <ChatSkel />],
];

function SecLoaders({ onReplay }: { onReplay: () => void }) {
  const [skel, setSkel] = useState(0);
  const SkelComp = SKELETONS[skel][1];
  const R = 58, C = 2 * Math.PI * R;
  return (
    <section id="loaders" className="ds-sec">
      <SecHead title="Loaders" ix="11" />
      <p className="desc">A branded splash for cold starts, shimmer skeletons shaped like each screen for route changes, and inline spinners for actions — replacing the single generic loader.</p>

      <Sub>Brand splash</Sub>
      <div className="demo" style={{ background: "radial-gradient(120% 90% at 50% 42%, #2a2114, #181410 60%, #110e0a)", padding: 0, overflow: "hidden" }}>
        <div style={{ display: "grid", placeItems: "center", padding: "44px 0" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
            <div className="splash-stage" style={{ width: 110, height: 110, position: "relative", display: "grid", placeItems: "center" }}>
              <svg className="splash-ring b" viewBox="0 0 128 128"><circle cx={64} cy={64} r={R} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={3} /></svg>
              <svg className="splash-ring a" viewBox="0 0 128 128"><circle cx={64} cy={64} r={R} fill="none" stroke="var(--accent)" strokeWidth={3} strokeLinecap="round" strokeDasharray={`${C * 0.28} ${C}`} /></svg>
              <div className="logo-tile" style={{ width: 58, height: 58 }}><Image src="/images/Fixaro-Logo.png" alt="" width={40} height={40} /></div>
            </div>
            <div className="splash-word" style={{ marginTop: 0 }}>Fix<b>aro</b></div>
            <div className="splash-status" style={{ marginTop: 0 }}><span className="pip" /> Loading today&rsquo;s jobs…</div>
            <div className="splash-bar" style={{ marginTop: 0 }}><i style={{ width: "64%" }} /></div>
          </div>
        </div>
      </div>
      <div style={{ marginTop: 12 }}>
        <button className="btn btn-primary btn-sm" onClick={onReplay}><RefreshCw /> Play full splash</button>
        <span className="demo-note" style={{ display: "inline-block", marginTop: 0, marginLeft: 12 }}>determinate progress · cycling status · fades into the app</span>
      </div>

      <Sub>Spinners &amp; inline</Sub>
      <div className="demo"><div className="demo-row" style={{ gap: 28 }}>
        <span className="spinner" /><span className="spinner lg" />
        <span className="dots"><i /><i /><i /></span>
        <button className="btn btn-primary"><span className="spinner" style={{ borderColor: "rgba(255,255,255,.4)", borderTopColor: "#fff", width: 14, height: 14 }} /> Generating invoice…</button>
      </div></div>
      <div className="demo"><div className="loader-center"><span className="spinner lg" /><span className="lbl">Loading inventory…</span></div></div>

      <Sub>Per-screen skeletons</Sub>
      <div className="seg-tabs" style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
        {SKELETONS.map(([label], i) => (
          <button key={label} className={"btn btn-sm" + (i === skel ? " btn-primary" : "")} onClick={() => setSkel(i)}>{label}</button>
        ))}
      </div>
      <div className="skel-frame fade-in" key={skel}><SkelComp /></div>
    </section>
  );
}
