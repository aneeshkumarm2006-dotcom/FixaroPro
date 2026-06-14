// FixaroSplash — fullscreen branded cold-start loader (Fixaro logo + counter-
// rotating rings + indeterminate progress). The new brand loader, replacing the
// old water-drop. Server-component friendly (no hooks) so it works directly in
// route loading.tsx files. Styles are scoped under .fxds (fixaro-ds.css).

import "@/app/design-system/fixaro-ds.css";
import Image from "next/image";

const R = 58, C = 2 * Math.PI * R;

export default function FixaroSplash({ message = "Loading…" }: { message?: string }) {
  return (
    <div className="fxds">
      <div className="splash">
        <div className="splash-inner">
          <div className="splash-stage">
            <svg className="splash-ring b" viewBox="0 0 128 128">
              <circle cx={64} cy={64} r={R} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={3} />
            </svg>
            <svg className="splash-ring a" viewBox="0 0 128 128">
              <circle cx={64} cy={64} r={R} fill="none" stroke="var(--accent)" strokeWidth={3} strokeLinecap="round" strokeDasharray={`${C * 0.28} ${C}`} />
            </svg>
            <div className="logo-tile">
              <Image src="/images/Fixaro-Logo.png" alt="Fixaro" width={66} height={66} />
            </div>
          </div>
          <div className="splash-word">Fix<b>aro</b></div>
          <div className="splash-tag">Field Ops</div>
          <div className="splash-status"><span className="pip" /> {message}</div>
          <div className="splash-bar indet"><i /></div>
        </div>
      </div>
    </div>
  );
}
