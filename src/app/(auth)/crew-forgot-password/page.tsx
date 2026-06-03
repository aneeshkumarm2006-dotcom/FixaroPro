"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";

const inp: React.CSSProperties = {
  width: "100%", height: 52, borderRadius: 12,
  border: "1px solid rgba(22,21,20,0.15)", background: "#fff",
  padding: "0 16px", fontSize: 15, color: "#161514",
  fontFamily: "inherit", outline: "none",
  transition: "border-color 0.15s, box-shadow 0.15s",
};

export default function CrewForgotPasswordPage() {
  const [email,   setEmail]   = useState("");
  const [loading, setLoading] = useState(false);
  const [sent,    setSent]    = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.includes("@")) { setError("Enter a valid email address."); return; }
    setLoading(true);
    try {
      const res = await authClient.requestPasswordReset({
        email: email.trim().toLowerCase(),
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (res.error) { setError(res.error.message || "Couldn't send reset email."); setLoading(false); return; }
      setSent(true);
    } catch {
      setError("Unexpected error. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", minHeight: "100vh", fontFamily: "var(--font-dm-sans, DM Sans, system-ui, sans-serif)" }}>

      {/* ── LEFT: Crew brand panel ── */}
      <aside style={{
        position: "relative", overflow: "hidden",
        display: "flex", flexDirection: "column",
        padding: "40px 48px", color: "#fff", background: "#0c0b0a",
      }}>
        <style>{`@media(max-width:768px){aside{display:none!important}}`}</style>
        <div style={{ position:"absolute",inset:0,zIndex:0,backgroundImage:"url('/images/crew_login.png')",backgroundSize:"cover",backgroundPosition:"60% 40%" }} />
        <div style={{ position:"absolute",inset:0,zIndex:1,pointerEvents:"none",background:"linear-gradient(180deg,rgba(12,11,10,0.45) 0%,rgba(12,11,10,0.75) 60%,rgba(12,11,10,0.95) 100%)" }} />
        <div style={{ position:"absolute",left:0,top:0,bottom:0,width:3,zIndex:2,background:"linear-gradient(180deg,#cba35a,transparent)",opacity:0.6 }} />

        <div style={{ position:"relative",zIndex:3,display:"flex",alignItems:"center",justifyContent:"space-between" }}>
          <div style={{ display:"flex",alignItems:"center",gap:10 }}>
            <div style={{ width:36,height:36,borderRadius:12,background:"#fff",overflow:"hidden",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 2px 8px rgba(0,0,0,0.15)" }}>
              <img src="/images/Fixaro-Logo.png" alt="Fixaro" width={36} height={36} style={{ objectFit:"contain" }} />
            </div>
            <span style={{ fontWeight:700,fontSize:18,color:"#fff",letterSpacing:"-0.01em" }}>Fixaro</span>
          </div>
          <span style={{ fontSize:10,textTransform:"uppercase",letterSpacing:"0.14em",fontWeight:700,color:"#cba35a",background:"rgba(203,163,90,0.15)",padding:"5px 11px",borderRadius:999,border:"1px solid rgba(203,163,90,0.3)" }}>Crew Portal</span>
        </div>

        <div style={{ position:"relative",zIndex:3,flex:1,display:"flex",flexDirection:"column",justifyContent:"flex-end",paddingBottom:24 }}>
          <p style={{ fontSize:11,textTransform:"uppercase",letterSpacing:"0.14em",color:"#cba35a",fontWeight:600,marginBottom:16 }}>For technicians</p>
          <h1 style={{ fontFamily:"var(--font-instrument-serif,'Instrument Serif',Georgia,serif)",fontWeight:400,fontSize:"clamp(32px,4.5vw,52px)",lineHeight:1.05,letterSpacing:"-0.02em",margin:"0 0 20px",color:"#fff" }}>
            No worries,<br /><em style={{ fontStyle:"italic",color:"#d4b978" }}>crew.</em>
          </h1>
          <p style={{ fontSize:15,lineHeight:1.6,color:"rgba(255,255,255,0.7)",maxWidth:420,margin:0 }}>
            Enter your work email and we&apos;ll send you a link to reset your password.
          </p>
        </div>

        <div style={{ position:"relative",zIndex:3,display:"flex",gap:28,paddingTop:24,borderTop:"1px solid rgba(255,255,255,0.08)" }}>
          {[{ val:"1h", label:"Link expiry" }, { val:"Secure", label:"Encrypted" }, { val:"One-time", label:"Single use" }].map(s => (
            <div key={s.label}>
              <div style={{ fontFamily:"var(--font-instrument-serif,'Instrument Serif',Georgia,serif)",fontSize:20,color:"#fff",fontWeight:400,lineHeight:1 }}>{s.val}</div>
              <div style={{ fontSize:11,color:"rgba(255,255,255,0.45)",marginTop:4 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </aside>

      {/* ── RIGHT: Form panel ── */}
      <div style={{ display:"flex",flexDirection:"column",background:"#fff" }}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"32px 48px" }}>
          <Link href="/crew-sign-in" style={{ fontSize:13,color:"rgba(22,21,20,0.5)",fontWeight:500,textDecoration:"none" }}>← Back to sign in</Link>
          <Link href="/portal/login" style={{ fontSize:14,fontWeight:600,color:"#e85d04",textDecoration:"none" }}>Customer? Sign in here →</Link>
        </div>

        <div style={{ flex:1,display:"flex",flexDirection:"column",justifyContent:"center",padding:"16px 48px 48px" }}>
          <div style={{ width:"100%",maxWidth:420,margin:"0 auto" }}>
            {sent ? (
              <div style={{ textAlign:"center" }}>
                <div style={{ width:64,height:64,borderRadius:"50%",background:"rgba(16,185,129,0.1)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 24px" }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <h2 style={{ fontFamily:"var(--font-instrument-serif,'Instrument Serif',Georgia,serif)",fontWeight:400,fontSize:32,color:"#161514",letterSpacing:"-0.02em",margin:"0 0 12px" }}>Check your email</h2>
                <p style={{ fontSize:15,color:"rgba(22,21,20,0.7)",lineHeight:1.6,margin:"0 0 8px" }}>
                  We sent a reset link to <strong style={{ color:"#161514" }}>{email}</strong>.
                </p>
                <p style={{ fontSize:13,color:"rgba(22,21,20,0.5)",lineHeight:1.6,margin:"0 0 32px" }}>The link expires in 1 hour. Check your spam folder if you don&apos;t see it.</p>
                <Link href="/crew-sign-in" style={{ display:"inline-flex",alignItems:"center",justifyContent:"center",height:52,padding:"0 32px",borderRadius:12,background:"#e85d04",color:"#fff",fontWeight:600,fontSize:15,textDecoration:"none",boxShadow:"0 4px 18px rgba(232,93,4,0.30)" }}>
                  Back to sign in →
                </Link>
              </div>
            ) : (
              <>
                <header style={{ marginBottom:36 }}>
                  <p style={{ fontSize:11,textTransform:"uppercase",letterSpacing:"0.12em",fontWeight:600,color:"#e85d04",marginBottom:12 }}>Crew · Password reset</p>
                  <h2 style={{ fontFamily:"var(--font-instrument-serif,'Instrument Serif',Georgia,serif)",fontWeight:400,fontSize:"clamp(28px,3.5vw,40px)",lineHeight:1.05,letterSpacing:"-0.02em",color:"#161514",margin:0 }}>
                    Reset your<br /><em style={{ fontStyle:"italic",color:"#e85d04" }}>password.</em>
                  </h2>
                  <p style={{ fontSize:15,color:"rgba(22,21,20,0.7)",lineHeight:1.6,marginTop:14 }}>Enter your work email and we&apos;ll send a reset link.</p>
                </header>
                <form onSubmit={handleSubmit} style={{ display:"flex",flexDirection:"column",gap:20 }}>
                  <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
                    <label style={{ fontSize:13,fontWeight:500,color:"#161514" }}>Work email</label>
                    <input type="email" placeholder="you@fixaro.ca" value={email}
                      onChange={e => { setEmail(e.target.value); setError(null); }} required style={inp}
                      onFocus={e => Object.assign(e.currentTarget.style, { borderColor:"#e85d04",boxShadow:"0 0 0 3px rgba(232,93,4,0.14)" })}
                      onBlur={e => Object.assign(e.currentTarget.style, { borderColor:"rgba(22,21,20,0.15)",boxShadow:"none" })} />
                  </div>
                  {error && <div style={{ background:"#fef2f2",border:"1px solid #fecaca",borderRadius:10,padding:"12px 16px",fontSize:13,color:"#dc2626" }}>{error}</div>}
                  <button type="submit" disabled={loading} style={{ width:"100%",height:52,borderRadius:12,border:"none",background:loading?"rgba(232,93,4,0.6)":"#e85d04",color:"#fff",fontSize:15,fontWeight:600,cursor:loading?"not-allowed":"pointer",fontFamily:"inherit",boxShadow:loading?"none":"0 4px 18px rgba(232,93,4,0.30)",transition:"all 0.15s" }}>
                    {loading ? "Sending…" : "Send reset link →"}
                  </button>
                  <p style={{ fontSize:13,textAlign:"center",color:"rgba(22,21,20,0.5)" }}>
                    Remembered it?{" "}<Link href="/crew-sign-in" style={{ color:"#e85d04",fontWeight:600,textDecoration:"none" }}>Back to sign in</Link>
                  </p>
                </form>
              </>
            )}
          </div>
        </div>
        <div style={{ padding:"20px 48px",borderTop:"1px solid rgba(22,21,20,0.06)",display:"flex",justifyContent:"space-between",fontSize:12,color:"rgba(22,21,20,0.5)" }}>
          <span>© {new Date().getFullYear()} Fixaro Inc.</span>
          <div style={{ display:"flex",gap:20 }}>
            {["Privacy","Terms","Help"].map(l => <a key={l} href="#" style={{ color:"rgba(22,21,20,0.5)",textDecoration:"none" }}>{l}</a>)}
          </div>
        </div>
      </div>
    </div>
  );
}
