"use client";

import { useState, useEffect, FormEvent, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";

const inputStyle: React.CSSProperties = {
  width: "100%", height: 52, borderRadius: 12,
  border: "1px solid rgba(22,21,20,0.15)", background: "#fff",
  padding: "0 16px", fontSize: 15, color: "#161514",
  fontFamily: "inherit", outline: "none",
  transition: "border-color 0.15s, box-shadow 0.15s",
};

function CrewSignInInner() {
  const searchParams = useSearchParams();
  const session      = authClient.useSession();
  const roleError    = searchParams.get("error") === "wrong_account";

  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPw,   setShowPw]   = useState(false);
  const [remember, setRemember] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  /* ── PWA install ── */
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIOS,         setIsIOS]          = useState(false);
  const [isInstalled,   setIsInstalled]    = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(display-mode: standalone)").matches) { setIsInstalled(true); return; }
    const ua = navigator.userAgent;
    setIsIOS(/iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream);
    const handler = (e: Event) => { e.preventDefault(); setDeferredPrompt(e); };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function handleInstall() {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      setDeferredPrompt(null);
    } else if (isIOS) {
      alert("To install Fixaro Crew:\n\n1. Tap the Share button (□↑) in Safari\n2. Scroll down and tap \"Add to Home Screen\"");
    }
  }

  /* ── Redirect if already signed in ── */
  useEffect(() => {
    if (session.data?.session) window.location.href = "/api/post-signin";
  }, [session.data?.session]);

  /* ── Restore saved email ── */
  useEffect(() => {
    const saved = localStorage.getItem("crew_remember_email");
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
        rememberMe: remember,        // ← actually extends the session
        callbackURL: "/api/post-signin?from=crew",
      });
      if (res.error) {
        const code = res.error.status;
        if (code === 401) setError("Email or password is incorrect.");
        else if (code === 429) setError("Too many attempts. Please wait a few minutes.");
        else setError(res.error.message || "Couldn't sign in. Please try again.");
        setLoading(false);
        return;
      }
      if (remember) localStorage.setItem("crew_remember_email", email);
      else localStorage.removeItem("crew_remember_email");
      window.location.href = "/api/post-signin?from=crew";
    } catch {
      setError("Unexpected error. Please try again.");
      setLoading(false);
    }
  }

  const showInstallBtn = !isInstalled && (!!deferredPrompt || isIOS);

  return (
    <>
      {/* ── Responsive styles ── */}
      <style>{`
        .crew-layout {
          display: grid;
          grid-template-columns: 1fr 1fr;
          min-height: 100vh;
          font-family: var(--font-dm-sans, DM Sans, system-ui, sans-serif);
        }
        .crew-aside { display: flex; }
        .crew-form-top  { padding: 32px 48px; }
        .crew-form-body { padding: 16px 48px 48px; }
        .crew-footer    { padding: 20px 48px; }

        @media (max-width: 768px) {
          .crew-layout { grid-template-columns: 1fr; }
          .crew-aside  { display: none !important; }
          .crew-form-top  { padding: 20px 24px; }
          .crew-form-body { padding: 16px 24px 40px; }
          .crew-footer    { padding: 16px 24px; flex-wrap: wrap; gap: 8px; }
        }
      `}</style>

      <div className="crew-layout">

        {/* ── LEFT: Brand Panel ── */}
        <aside className="crew-aside" style={{
          position: "relative", overflow: "hidden",
          flexDirection: "column", padding: "40px 48px", color: "#fff", background: "#0c0b0a",
        }}>
          <div style={{ position:"absolute",inset:0,zIndex:0,backgroundImage:"url('/images/crew_login.png')",backgroundSize:"cover",backgroundPosition:"60% 40%" }} />
          <div style={{ position:"absolute",inset:0,zIndex:1,pointerEvents:"none",background:"linear-gradient(180deg,rgba(12,11,10,0.45) 0%,rgba(12,11,10,0.75) 60%,rgba(12,11,10,0.95) 100%)" }} />
          <div style={{ position:"absolute",left:0,top:0,bottom:0,width:3,zIndex:2,background:"linear-gradient(180deg,#cba35a,transparent)",opacity:0.6 }} />

          {/* Logo */}
          <div style={{ position:"relative",zIndex:3,display:"flex",alignItems:"center",justifyContent:"space-between" }}>
            <div style={{ display:"flex",alignItems:"center",gap:10 }}>
              <div style={{ width:36,height:36,borderRadius:12,background:"#fff",overflow:"hidden",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 2px 8px rgba(0,0,0,0.15)" }}>
                <img src="/images/Fixaro-Logo.png" alt="Fixaro" width={36} height={36} style={{ objectFit:"contain" }} />
              </div>
              <span style={{ fontWeight:700,fontSize:18,color:"#fff",letterSpacing:"-0.01em" }}>Fixaro</span>
            </div>
            <span style={{ fontSize:10,textTransform:"uppercase",letterSpacing:"0.14em",fontWeight:700,color:"#cba35a",background:"rgba(203,163,90,0.15)",padding:"5px 11px",borderRadius:999,border:"1px solid rgba(203,163,90,0.3)" }}>
              Crew Portal
            </span>
          </div>

          {/* Headline */}
          <div style={{ position:"relative",zIndex:3,flex:1,display:"flex",flexDirection:"column",justifyContent:"flex-end",paddingBottom:24 }}>
            <p style={{ fontSize:11,textTransform:"uppercase",letterSpacing:"0.14em",color:"#cba35a",fontWeight:600,marginBottom:16 }}>For technicians only</p>
            <p style={{ fontFamily:"var(--font-instrument-serif,'Instrument Serif',Georgia,serif)",fontWeight:400,fontSize:"clamp(32px,4.5vw,56px)",lineHeight:1.05,letterSpacing:"-0.02em",margin:"0 0 24px",color:"#fff" }}>
              Built for the<br /><em style={{ fontStyle:"italic",color:"#d4b978" }}>crew.</em>
            </p>
            <p style={{ fontSize:15,lineHeight:1.6,color:"rgba(255,255,255,0.7)",maxWidth:420,margin:0 }}>
              Manage your jobs, track your earnings, and stay on top of your schedule — all in one place.
            </p>
          </div>

          {/* Stats */}
          <div style={{ position:"relative",zIndex:3,display:"flex",gap:32,paddingTop:24,borderTop:"1px solid rgba(255,255,255,0.08)" }}>
            {[{ val:"186",label:"Crew members" },{ val:"4.9★",label:"Avg rating" },{ val:"24/7",label:"Support" }].map(s => (
              <div key={s.label}>
                <div style={{ fontFamily:"var(--font-instrument-serif,'Instrument Serif',Georgia,serif)",fontSize:22,color:"#fff",fontWeight:400,letterSpacing:"-0.01em",lineHeight:1 }}>{s.val}</div>
                <div style={{ fontSize:11,color:"rgba(255,255,255,0.45)",marginTop:4 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </aside>

        {/* ── RIGHT: Form Panel ── */}
        <div style={{ display:"flex",flexDirection:"column",background:"#fff" }}>
          {/* Top nav */}
          <div className="crew-form-top" style={{ display:"flex",justifyContent:"flex-end",alignItems:"center" }}>
            <Link href="/portal/login" style={{ fontSize:14,fontWeight:600,color:"#e85d04",textDecoration:"none" }}>Customer? Sign in here →</Link>
          </div>

          {/* Form */}
          <div className="crew-form-body" style={{ flex:1,display:"flex",flexDirection:"column",justifyContent:"center" }}>
            <div style={{ width:"100%",maxWidth:420,margin:"0 auto" }}>
              <header style={{ marginBottom:36 }}>
                <p style={{ fontSize:11,textTransform:"uppercase",letterSpacing:"0.12em",fontWeight:600,color:"#e85d04",marginBottom:12 }}>Crew sign in</p>
                <h1 style={{ fontFamily:"var(--font-instrument-serif,'Instrument Serif',Georgia,serif)",fontWeight:400,fontSize:"clamp(28px,3.5vw,44px)",lineHeight:1.05,letterSpacing:"-0.02em",color:"#161514",margin:0 }}>
                  Welcome back,<br /><em style={{ fontStyle:"italic",color:"#e85d04" }}>partner.</em>
                </h1>
                <p style={{ fontSize:15,color:"rgba(22,21,20,0.7)",lineHeight:1.6,marginTop:14 }}>
                  Clock in, check your jobs, and get paid faster.
                </p>
              </header>

              <form onSubmit={handleSubmit} style={{ display:"flex",flexDirection:"column",gap:20 }}>
                {/* Email */}
                <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
                  <label style={{ fontSize:13,fontWeight:500,color:"#161514" }}>Work email</label>
                  <input type="email" placeholder="you@fixaro.ca" value={email} onChange={e => { setEmail(e.target.value); setError(null); }} required style={inputStyle}
                    onFocus={e => { e.currentTarget.style.borderColor="#e85d04"; e.currentTarget.style.boxShadow="0 0 0 3px rgba(232,93,4,0.14)"; }}
                    onBlur={e => { e.currentTarget.style.borderColor="rgba(22,21,20,0.15)"; e.currentTarget.style.boxShadow="none"; }} />
                </div>

                {/* Password */}
                <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
                  <label style={{ fontSize:13,fontWeight:500,color:"#161514" }}>Password</label>
                  <div style={{ position:"relative" }}>
                    <input type={showPw?"text":"password"} placeholder="••••••••" value={password} onChange={e => { setPassword(e.target.value); setError(null); }} required style={{ ...inputStyle,paddingRight:56 }}
                      onFocus={e => { e.currentTarget.style.borderColor="#e85d04"; e.currentTarget.style.boxShadow="0 0 0 3px rgba(232,93,4,0.14)"; }}
                      onBlur={e => { e.currentTarget.style.borderColor="rgba(22,21,20,0.15)"; e.currentTarget.style.boxShadow="none"; }} />
                    <button type="button" onClick={() => setShowPw(!showPw)} style={{ position:"absolute",right:14,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",fontSize:12,fontWeight:600,color:"rgba(22,21,20,0.5)",fontFamily:"inherit" }}>
                      {showPw?"Hide":"Show"}
                    </button>
                  </div>
                </div>

                {/* Remember + Forgot */}
                <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",fontSize:13 }}>
                  <label style={{ display:"flex",alignItems:"center",gap:8,cursor:"pointer",color:"rgba(22,21,20,0.7)" }}>
                    <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} style={{ width:16,height:16,accentColor:"#e85d04",borderRadius:4 }} />
                    Keep me signed in · 30 days
                  </label>
                  <Link href="/crew-forgot-password" style={{ fontSize:13,color:"rgba(22,21,20,0.5)",textDecoration:"none" }}>Forgot password?</Link>
                </div>

                {/* Role error */}
                {roleError && (
                  <div style={{ background:"#fffbeb",border:"1px solid #fde68a",borderRadius:10,padding:"14px 16px",fontSize:13,lineHeight:1.5 }}>
                    <p style={{ fontWeight:600,color:"#92400e",margin:"0 0 4px" }}>Wrong sign-in page</p>
                    <p style={{ color:"#b45309",margin:0 }}>This page is for crew only. <Link href="/sign-in" style={{ color:"#e85d04",fontWeight:600,textDecoration:"underline" }}>Admin sign in →</Link></p>
                  </div>
                )}

                {/* Error */}
                {error && <div style={{ background:"#fef2f2",border:"1px solid #fecaca",borderRadius:10,padding:"12px 16px",fontSize:13,color:"#dc2626",lineHeight:1.5 }}>{error}</div>}

                {/* Submit */}
                <button type="submit" disabled={loading} style={{ width:"100%",height:52,borderRadius:12,border:"none",background:loading?"rgba(232,93,4,0.6)":"#e85d04",color:"#fff",fontSize:15,fontWeight:600,cursor:loading?"not-allowed":"pointer",fontFamily:"inherit",letterSpacing:"-0.01em",boxShadow:loading?"none":"0 4px 18px rgba(232,93,4,0.30)",transition:"all 0.15s" }}>
                  {loading?"Signing in…":"Sign in →"}
                </button>

                {/* Install app prompt — only shown when installable */}
                {showInstallBtn && (
                  <div style={{ background:"#faf8f4",border:"1px solid rgba(22,21,20,0.06)",borderRadius:14,padding:"14px 16px",display:"flex",alignItems:"center",gap:12 }}>
                    <div style={{ width:36,height:36,borderRadius:9,background:"rgba(232,93,4,0.08)",color:"#e85d04",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                      </svg>
                    </div>
                    <div style={{ flex:1,minWidth:0 }}>
                      <div style={{ fontSize:13.5,fontWeight:600,color:"#161514" }}>Install the Crew app</div>
                      <div style={{ fontSize:12,color:"rgba(22,21,20,0.6)",marginTop:1 }}>Faster check-ins, offline access, push alerts.</div>
                    </div>
                    <button type="button" onClick={handleInstall} style={{ background:"none",border:"none",cursor:"pointer",color:"#e85d04",fontSize:12,fontWeight:600,fontFamily:"inherit",whiteSpace:"nowrap" }}>
                      {isIOS?"How to →":"Install →"}
                    </button>
                  </div>
                )}

                {/* Helper note */}
                <p style={{ fontSize:12,color:"rgba(22,21,20,0.5)",textAlign:"center",lineHeight:1.6 }}>
                  New to Fixaro? Crew accounts are created by your manager.<br />
                  <a href="mailto:support@fixaro.ca" style={{ color:"#e85d04",textDecoration:"none",fontWeight:600 }}>Contact support →</a>
                </p>
              </form>
            </div>
          </div>

          {/* Footer */}
          <div className="crew-footer" style={{ borderTop:"1px solid rgba(22,21,20,0.06)",display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:12,color:"rgba(22,21,20,0.5)" }}>
            <span>© {new Date().getFullYear()} Fixaro Inc.</span>
            <div style={{ display:"flex",gap:20 }}>
              {["Privacy","Terms","Help"].map(l => <a key={l} href="#" style={{ color:"rgba(22,21,20,0.5)",textDecoration:"none" }}>{l}</a>)}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default function CrewSignInPage() {
  return (
    <Suspense fallback={null}>
      <CrewSignInInner />
    </Suspense>
  );
}
