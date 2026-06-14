// RouteSkeleton — screen-shaped shimmer loaders for route `loading.tsx` files.
// Reuses the Fixaro Design System loader language (scoped under .fxds in
// fixaro-ds.css), replacing the old water-drop FixaroLoader on app routes.

import "@/app/design-system/fixaro-ds.css";

type Variant = "dashboard" | "table" | "cards" | "calendar" | "chat";

const SkLine = ({ w, h = 11, style }: { w: number | string; h?: number; style?: React.CSSProperties }) => (
  <div className="skel skel-line" style={{ width: w, height: h, ...style }} />
);
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

function TableSkel({ rows = 8 }: { rows?: number }) {
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
    <div style={{ height: "calc(100vh - 120px)", maxWidth: 1320, margin: "0 auto" }}>
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

const VARIANTS: Record<Variant, () => React.ReactElement> = {
  dashboard: () => <DashSkel />,
  table: () => <TableSkel />,
  cards: () => <CardsSkel />,
  calendar: () => <CalSkel />,
  chat: () => <ChatSkel />,
};

export default function RouteSkeleton({ variant = "dashboard" }: { variant?: Variant }) {
  const Comp = VARIANTS[variant];
  return (
    <div className="fxds" style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 22 }}>
      <div className="fade-in" style={{ width: "100%", maxWidth: 1320 }}>
        <Comp />
      </div>
    </div>
  );
}
