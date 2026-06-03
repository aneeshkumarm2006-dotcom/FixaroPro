"use client";

import { useState, useEffect, FormEvent, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";

/* ── Shared input style ── */
const inp: React.CSSProperties = {
  width: "100%", height: 52, borderRadius: 12,
  border: "1px solid rgba(22,21,20,0.15)", background: "#fff",
  padding: "0 16px", fontSize: 15, color: "#161514",
  fontFamily: "inherit", outline: "none",
  transition: "border-color 0.15s, box-shadow 0.15s",
};
const inpFocus = { borderColor: "#e85d04", boxShadow: "0 0 0 3px rgba(232,93,4,0.14)" };
const inpBlur  = { borderColor: "rgba(22,21,20,0.15)", boxShadow: "none" };

function SignInInner() {
  const searchParams  = useSearchParams();
  const session       = authClient.useSession();
  const roleError     = searchParams.get("error") === "crew_account";

  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPw,   setShowPw]   = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  /* Live clock */
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const timeStr = now.toLocaleTimeString("en-CA", { hour: "2-digit", minute: "2-digit", hour12: false });
  const dateStr = now.toLocaleDateString("en-CA", { weekday: "long", month: "long", day: "numeric" });

  /* Redirect if already signed in */
  useEffect(() => {
    if (session.data?.session) window.location.href = "/api/post-signin?from=admin";
  }, [session.data?.session]);

  /* Restore saved email */
  useEffect(() => {
    const saved = localStorage.getItem("admin_remember_email");
    if (saved) { setEmail(saved); setRemember(true); }
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.includes("@")) { setError("Enter a valid email address."); return; }
    if (password.length < 6)  { setError("Password must be at least 6 characters."); return; }
    setLoading(true);
    try {
      const res = await authClient.signIn.email({
        email: email.trim().toLowerCase(),
        password,
        callbackURL: "/api/post-signin?from=admin",
      });
      if (res.error) {
        const code = res.error.status;
        if (code === 401) setError("Email or password is incorrect.");
        else if (code === 429) setError("Too many attempts. Please wait a few minutes.");
        else setError(res.error.message || "Couldn't sign in. Please try again.");
        setLoading(false);
        return;
      }
      if (remember) localStorage.setItem("admin_remember_email", email);
      else localStorage.removeItem("admin_remember_email");
      window.location.href = "/api/post-signin?from=admin";
    } catch {
      setError("Unexpected error. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.05fr 0.95fr", minHeight: "100vh", fontFamily: "var(--font-dm-sans, DM Sans, system-ui, sans-serif)" }}>

      {/* ── LEFT: Command-center brand panel ── */}
      <aside style={{
        position: "relative", overflow: "hidden",
        background: "radial-gradient(ellipse at 20% 30%, rgba(232,93,4,0.12) 0%, transparent 60%), linear-gradient(135deg, #0c0b0a 0%, #161514 50%, #1c1a18 100%)",
        color: "#fff", padding: "40px 56px",
        display: "flex", flexDirection: "column",
      }}>
        {/* Animated grid */}
        <style>{`
          @keyframes gridFloat {
            0%,100% { transform: translate(0,0); }
            50% { transform: translate(8px,-8px); }
          }
          @keyframes liveDot {
            0%,100% { opacity:0.3; transform:scale(0.8); }
            50% { opacity:1; transform:scale(1); }
          }
          .admin-grid {
            position:absolute;inset:0;
            background-image:linear-gradient(rgba(255,255,255,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.025) 1px,transparent 1px);
            background-size:40px 40px;
            mask-image:radial-gradient(ellipse at 30% 50%,black 0%,transparent 70%);
            -webkit-mask-image:radial-gradient(ellipse at 30% 50%,black 0%,transparent 70%);
            animation:gridFloat 20s ease-in-out infinite;
          }
          .live-dot {
            width:7px;height:7px;border-radius:50%;
            background:#10b981;box-shadow:0 0 8px rgba(16,185,129,0.6);
            animation:liveDot 2s ease-in-out infinite;
          }
          @media(max-width:768px){.admin-left-panel{display:none!important}}
        `}</style>
        <div className="admin-grid" />

        {/* Gold corner glow */}
        <div style={{ position:"absolute",top:0,right:0,width:280,height:280, background:"radial-gradient(circle at top right,rgba(203,163,90,0.08),transparent 70%)", pointerEvents:"none" }} />

        {/* Logo row */}
        <div style={{ position:"relative",zIndex:2,display:"flex",alignItems:"center",justifyContent:"space-between" }}>
          <div style={{ display:"flex",alignItems:"center",gap:12 }}>
            <div style={{ width:38,height:38,borderRadius:12,background:"#fff",overflow:"hidden",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 2px 8px rgba(0,0,0,0.15)" }}>
              <img src="/images/Fixaro-Logo.png" alt="Fixaro" width={38} height={38} style={{ objectFit:"contain" }} />
            </div>
            <div>
              <div style={{ fontWeight:700,fontSize:18,color:"#fff",lineHeight:1,letterSpacing:"-0.01em" }}>Fixaro</div>
              <div style={{ fontSize:11,color:"rgba(255,255,255,0.45)",marginTop:3,letterSpacing:"0.04em" }}>Command Center</div>
            </div>
          </div>
          <span style={{ fontSize:10,textTransform:"uppercase",letterSpacing:"0.16em",fontWeight:700,color:"#cba35a",background:"rgba(203,163,90,0.15)",padding:"6px 12px",borderRadius:999,border:"1px solid rgba(203,163,90,0.3)" }}>
            Admin Access
          </span>
        </div>

        {/* Body */}
        <div style={{ position:"relative",zIndex:2,flex:1,display:"flex",flexDirection:"column",justifyContent:"center",gap:36,marginTop:48 }}>
          <div>
            <p style={{ fontSize:11,textTransform:"uppercase",letterSpacing:"0.14em",color:"#cba35a",fontWeight:600,marginBottom:18,opacity:0.9 }}>
              {dateStr} · {timeStr} EDT
            </p>
            <h1 style={{ fontFamily:"var(--font-instrument-serif,'Instrument Serif',Georgia,serif)",fontWeight:400,fontSize:"clamp(40px,5vw,64px)",lineHeight:1.02,letterSpacing:"-0.02em",margin:"0 0 24px",color:"#fff" }}>
              Run the<br />
              <em style={{ fontStyle:"italic",color:"#d4b978" }}>whole operation.</em>
            </h1>
            <p style={{ fontSize:16,lineHeight:1.6,color:"rgba(255,255,255,0.65)",maxWidth:460,margin:0 }}>
              Crew, clients, calendar, cash — one console. Sign in to see what&apos;s moving today.
            </p>
          </div>

          {/* Live ops snapshot */}
          <div style={{ background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:16,padding:"20px 24px",backdropFilter:"blur(8px)",maxWidth:460 }}>
            <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16 }}>
              <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                <div className="live-dot" />
                <span style={{ fontSize:11,textTransform:"uppercase",letterSpacing:"0.12em",fontWeight:700,color:"rgba(255,255,255,0.6)" }}>Live · Operations</span>
              </div>
              <span style={{ fontSize:11,color:"rgba(255,255,255,0.4)",fontFamily:"monospace" }}>Live</span>
            </div>
            <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:18 }}>
              {[
                { val:"12", label:"Jobs today",   sub:"8 in progress" },
                { val:"$4.2k", label:"Revenue",   sub:"last 24h" },
                { val:"4.8★", label:"Satisfaction",sub:"47 reviews" },
              ].map(s => (
                <div key={s.label}>
                  <div style={{ fontFamily:"var(--font-instrument-serif,'Instrument Serif',Georgia,serif)",fontSize:26,color:"#fff",fontWeight:400,letterSpacing:"-0.01em",lineHeight:1 }}>{s.val}</div>
                  <div style={{ fontSize:11,color:"rgba(255,255,255,0.55)",marginTop:5,fontWeight:600 }}>{s.label}</div>
                  <div style={{ fontSize:10,color:"rgba(255,255,255,0.35)",marginTop:2 }}>{s.sub}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Security footer */}
        <div style={{ position:"relative",zIndex:2,display:"flex",alignItems:"center",justifyContent:"space-between",paddingTop:24,borderTop:"1px solid rgba(255,255,255,0.08)" }}>
          <div style={{ display:"flex",alignItems:"center",gap:8,fontSize:12,color:"rgba(255,255,255,0.5)" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            Protected · SOC 2 Type II
          </div>
          <div style={{ fontSize:12,color:"rgba(255,255,255,0.35)",fontFamily:"monospace" }}>Fixaro Admin</div>
        </div>
      </aside>

      {/* ── RIGHT: Form panel ── */}
      <div style={{ display:"flex",flexDirection:"column",background:"#fff" }}>
        {/* Top bar */}
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"28px 48px" }}>
          <Link href="/" style={{ fontSize:13,color:"rgba(22,21,20,0.5)",fontWeight:500,textDecoration:"none" }}>← Back</Link>
          <div style={{ fontSize:13,color:"rgba(22,21,20,0.6)",display:"flex",alignItems:"center",gap:6 }}>
            Need help?{" "}
            <a href="mailto:support@fixaro.ca" style={{ color:"#e85d04",textDecoration:"none",fontWeight:600 }}>Contact ops</a>
          </div>
        </div>

        <div style={{ flex:1,display:"flex",flexDirection:"column",justifyContent:"center",padding:"16px 48px 32px" }}>
          <div style={{ width:"100%",maxWidth:420,margin:"0 auto" }}>
            <header style={{ marginBottom:36 }}>
              <p style={{ fontSize:11,textTransform:"uppercase",letterSpacing:"0.12em",fontWeight:600,color:"#e85d04",marginBottom:12 }}>Admin sign in</p>
              <h2 style={{ fontFamily:"var(--font-instrument-serif,'Instrument Serif',Georgia,serif)",fontWeight:400,fontSize:"clamp(28px,3.5vw,42px)",lineHeight:1.05,letterSpacing:"-0.02em",color:"#161514",margin:0 }}>
                Welcome back,<br /><em style={{ fontStyle:"italic",color:"#e85d04" }}>operator.</em>
              </h2>
              <p style={{ fontSize:15,color:"rgba(22,21,20,0.7)",lineHeight:1.6,marginTop:14 }}>Sign in to your Fixaro admin account.</p>
            </header>

            <form onSubmit={handleSubmit} style={{ display:"flex",flexDirection:"column",gap:18 }}>
              {/* Email */}
              <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
                <label style={{ fontSize:13,fontWeight:500,color:"#161514" }}>Admin email</label>
                <input type="email" placeholder="admin@fixaro.ca" value={email}
                  onChange={e => { setEmail(e.target.value); setError(null); }} required style={inp}
                  onFocus={e => Object.assign(e.currentTarget.style, inpFocus)}
                  onBlur={e => Object.assign(e.currentTarget.style, inpBlur)} />
              </div>

              {/* Password */}
              <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
                <label style={{ fontSize:13,fontWeight:500,color:"#161514" }}>Password</label>
                <div style={{ position:"relative" }}>
                  <input type={showPw ? "text" : "password"} placeholder="••••••••" value={password}
                    onChange={e => { setPassword(e.target.value); setError(null); }} required
                    style={{ ...inp, paddingRight:56 }}
                    onFocus={e => Object.assign(e.currentTarget.style, inpFocus)}
                    onBlur={e => Object.assign(e.currentTarget.style, inpBlur)} />
                  <button type="button" onClick={() => setShowPw(!showPw)} style={{ position:"absolute",right:14,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",fontSize:12,fontWeight:600,color:"rgba(22,21,20,0.5)",fontFamily:"inherit" }}>
                    {showPw ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              {/* Remember + Forgot */}
              <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",fontSize:13 }}>
                <label style={{ display:"flex",alignItems:"center",gap:8,cursor:"pointer",color:"rgba(22,21,20,0.7)" }}>
                  <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} style={{ width:16,height:16,accentColor:"#e85d04",borderRadius:4 }} />
                  Trust this device · 30 days
                </label>
                <Link href="/forgot-password" style={{ fontSize:13,color:"rgba(22,21,20,0.5)",textDecoration:"none" }}>Forgot?</Link>
              </div>

              {/* Role error */}
              {roleError && (
                <div style={{ background:"#fffbeb",border:"1px solid #fde68a",borderRadius:10,padding:"14px 16px",fontSize:13,lineHeight:1.5 }}>
                  <p style={{ fontWeight:600,color:"#92400e",margin:"0 0 4px" }}>Wrong sign-in page</p>
                  <p style={{ color:"#b45309",margin:0 }}>
                    Crew members should use the{" "}
                    <Link href="/crew-sign-in" style={{ color:"#e85d04",fontWeight:600,textDecoration:"underline" }}>Crew sign-in page</Link>.
                  </p>
                </div>
              )}

              {/* Error */}
              {error && (
                <div style={{ background:"#fef2f2",border:"1px solid #fecaca",borderRadius:10,padding:"12px 16px",fontSize:13,color:"#dc2626",lineHeight:1.5 }}>
                  {error}
                </div>
              )}

              {/* Submit */}
              <button type="submit" disabled={loading} style={{ width:"100%",height:52,borderRadius:12,border:"none",background:loading?"rgba(232,93,4,0.6)":"#e85d04",color:"#fff",fontSize:15,fontWeight:600,cursor:loading?"not-allowed":"pointer",fontFamily:"inherit",letterSpacing:"-0.01em",boxShadow:loading?"none":"0 4px 18px rgba(232,93,4,0.30)",transition:"all 0.15s",marginTop:4 }}>
                {loading ? "Signing in…" : "Sign in to dashboard →"}
              </button>

              {/* Crew link */}
              <p style={{ fontSize:12,color:"rgba(22,21,20,0.5)",textAlign:"center",lineHeight:1.6,marginTop:8 }}>
                Admin access is by invitation only.<br />
                Looking for{" "}
                <Link href="/crew-sign-in" style={{ color:"#e85d04",fontWeight:600,textDecoration:"none" }}>Crew sign-in</Link>
                {" "}or{" "}
                <Link href="/portal/login" style={{ color:"#e85d04",fontWeight:600,textDecoration:"none" }}>Customer portal</Link>?
              </p>
            </form>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding:"20px 48px",borderTop:"1px solid rgba(22,21,20,0.06)",display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:12,color:"rgba(22,21,20,0.5)" }}>
          <span>© {new Date().getFullYear()} Fixaro Inc.</span>
          <div style={{ display:"flex",gap:20 }}>
            {["Privacy","Terms","Security"].map(l => (
              <a key={l} href="#" style={{ color:"rgba(22,21,20,0.5)",textDecoration:"none" }}>{l}</a>
            ))}
          </div>
        </div>
      </div>

      {/* Mobile: hide left panel */}
      <style>{`@media(max-width:768px){aside{display:none!important}}`}</style>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInInner />
    </Suspense>
  );
}
