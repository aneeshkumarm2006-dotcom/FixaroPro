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

export default function AdminForgotPasswordPage() {
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
    <div style={{ display: "grid", gridTemplateColumns: "1.05fr 0.95fr", minHeight: "100vh", fontFamily: "var(--font-dm-sans, DM Sans, system-ui, sans-serif)" }}>

      {/* ── LEFT panel (same as admin sign-in) ── */}
      <aside style={{
        position: "relative", overflow: "hidden",
        background: "radial-gradient(ellipse at 20% 30%, rgba(232,93,4,0.12) 0%, transparent 60%), linear-gradient(135deg, #0c0b0a 0%, #161514 50%, #1c1a18 100%)",
        color: "#fff", padding: "40px 56px", display: "flex", flexDirection: "column",
      }}>
        <style>{`.fp-grid{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.025) 1px,transparent 1px);background-size:40px 40px;mask-image:radial-gradient(ellipse at 30% 50%,black 0%,transparent 70%);-webkit-mask-image:radial-gradient(ellipse at 30% 50%,black 0%,transparent 70%);}@media(max-width:768px){aside{display:none!important}}`}</style>
        <div className="fp-grid" />
        <div style={{ position:"absolute",top:0,right:0,width:280,height:280,background:"radial-gradient(circle at top right,rgba(203,163,90,0.08),transparent 70%)",pointerEvents:"none" }} />

        <div style={{ position:"relative",zIndex:2,display:"flex",alignItems:"center",gap:12 }}>
          <div style={{ width:38,height:38,borderRadius:12,background:"#fff",overflow:"hidden",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 2px 8px rgba(0,0,0,0.15)" }}>
            <img src="/images/Fixaro-Logo.png" alt="Fixaro" width={38} height={38} style={{ objectFit:"contain" }} />
          </div>
          <div>
            <div style={{ fontWeight:700,fontSize:18,color:"#fff",letterSpacing:"-0.01em" }}>Fixaro</div>
            <div style={{ fontSize:11,color:"rgba(255,255,255,0.45)",marginTop:3,letterSpacing:"0.04em" }}>Command Center</div>
          </div>
        </div>

        <div style={{ position:"relative",zIndex:2,flex:1,display:"flex",flexDirection:"column",justifyContent:"center",gap:24 }}>
          <h1 style={{ fontFamily:"var(--font-instrument-serif,'Instrument Serif',Georgia,serif)",fontWeight:400,fontSize:"clamp(36px,4.5vw,56px)",lineHeight:1.05,letterSpacing:"-0.02em",color:"#fff",margin:0 }}>
            Happens to<br />
            <em style={{ fontStyle:"italic",color:"#d4b978" }}>everyone.</em>
          </h1>
          <p style={{ fontSize:15,lineHeight:1.6,color:"rgba(255,255,255,0.65)",maxWidth:420,margin:0 }}>
            Enter your admin email and we&apos;ll send a secure reset link. It expires in 1 hour.
          </p>
          <div style={{ display:"flex",gap:28,paddingTop:8 }}>
            {[{ val:"1h", label:"Link expiry" }, { val:"TLS", label:"Encrypted" }, { val:"One-time", label:"Single use" }].map(s => (
              <div key={s.label}>
                <div style={{ fontFamily:"var(--font-instrument-serif,'Instrument Serif',Georgia,serif)",fontSize:22,color:"#fff",fontWeight:400,lineHeight:1 }}>{s.val}</div>
                <div style={{ fontSize:11,color:"rgba(255,255,255,0.45)",marginTop:4 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ position:"relative",zIndex:2,paddingTop:24,borderTop:"1px solid rgba(255,255,255,0.08)",display:"flex",alignItems:"center",gap:8,fontSize:12,color:"rgba(255,255,255,0.5)" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
          Secure password reset · Protected by Better Auth
        </div>
      </aside>

      {/* ── RIGHT: Form panel ── */}
      <div style={{ display:"flex",flexDirection:"column",background:"#fff" }}>
        <div style={{ padding:"28px 48px" }}>
          <Link href="/sign-in" style={{ fontSize:13,color:"rgba(22,21,20,0.5)",fontWeight:500,textDecoration:"none" }}>← Back to sign in</Link>
        </div>

        <div style={{ flex:1,display:"flex",flexDirection:"column",justifyContent:"center",padding:"16px 48px 48px" }}>
          <div style={{ width:"100%",maxWidth:420,margin:"0 auto" }}>

            {sent ? (
              /* ── Success state ── */
              <div style={{ textAlign:"center" }}>
                <div style={{ width:64,height:64,borderRadius:"50%",background:"rgba(16,185,129,0.1)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 24px" }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </div>
                <h2 style={{ fontFamily:"var(--font-instrument-serif,'Instrument Serif',Georgia,serif)",fontWeight:400,fontSize:32,color:"#161514",letterSpacing:"-0.02em",margin:"0 0 12px" }}>Check your email</h2>
                <p style={{ fontSize:15,color:"rgba(22,21,20,0.7)",lineHeight:1.6,margin:"0 0 8px" }}>
                  We sent a reset link to <strong style={{ color:"#161514" }}>{email}</strong>.
                </p>
                <p style={{ fontSize:13,color:"rgba(22,21,20,0.5)",lineHeight:1.6,margin:"0 0 32px" }}>
                  The link expires in 1 hour. Check your spam folder if you don&apos;t see it.
                </p>
                <Link href="/sign-in" style={{ display:"inline-flex",alignItems:"center",justifyContent:"center",height:52,padding:"0 32px",borderRadius:12,background:"#e85d04",color:"#fff",fontWeight:600,fontSize:15,textDecoration:"none",boxShadow:"0 4px 18px rgba(232,93,4,0.30)" }}>
                  Back to sign in →
                </Link>
              </div>
            ) : (
              /* ── Request form ── */
              <>
                <header style={{ marginBottom:36 }}>
                  <p style={{ fontSize:11,textTransform:"uppercase",letterSpacing:"0.12em",fontWeight:600,color:"#e85d04",marginBottom:12 }}>Password reset</p>
                  <h2 style={{ fontFamily:"var(--font-instrument-serif,'Instrument Serif',Georgia,serif)",fontWeight:400,fontSize:"clamp(28px,3.5vw,40px)",lineHeight:1.05,letterSpacing:"-0.02em",color:"#161514",margin:0 }}>
                    Forgot your<br /><em style={{ fontStyle:"italic",color:"#e85d04" }}>password?</em>
                  </h2>
                  <p style={{ fontSize:15,color:"rgba(22,21,20,0.7)",lineHeight:1.6,marginTop:14 }}>
                    Enter your admin email and we&apos;ll send a reset link.
                  </p>
                </header>

                <form onSubmit={handleSubmit} style={{ display:"flex",flexDirection:"column",gap:20 }}>
                  <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
                    <label style={{ fontSize:13,fontWeight:500,color:"#161514" }}>Admin email</label>
                    <input type="email" placeholder="admin@fixaro.ca" value={email}
                      onChange={e => { setEmail(e.target.value); setError(null); }} required style={inp}
                      onFocus={e => Object.assign(e.currentTarget.style, { borderColor:"#e85d04", boxShadow:"0 0 0 3px rgba(232,93,4,0.14)" })}
                      onBlur={e => Object.assign(e.currentTarget.style, { borderColor:"rgba(22,21,20,0.15)", boxShadow:"none" })} />
                  </div>

                  {error && (
                    <div style={{ background:"#fef2f2",border:"1px solid #fecaca",borderRadius:10,padding:"12px 16px",fontSize:13,color:"#dc2626" }}>{error}</div>
                  )}

                  <button type="submit" disabled={loading} style={{ width:"100%",height:52,borderRadius:12,border:"none",background:loading?"rgba(232,93,4,0.6)":"#e85d04",color:"#fff",fontSize:15,fontWeight:600,cursor:loading?"not-allowed":"pointer",fontFamily:"inherit",boxShadow:loading?"none":"0 4px 18px rgba(232,93,4,0.30)",transition:"all 0.15s" }}>
                    {loading ? "Sending…" : "Send reset link →"}
                  </button>

                  <p style={{ fontSize:13,textAlign:"center",color:"rgba(22,21,20,0.5)" }}>
                    Remembered it?{" "}
                    <Link href="/sign-in" style={{ color:"#e85d04",fontWeight:600,textDecoration:"none" }}>Back to sign in</Link>
                  </p>
                </form>
              </>
            )}
          </div>
        </div>

        <div style={{ padding:"20px 48px",borderTop:"1px solid rgba(22,21,20,0.06)",display:"flex",justifyContent:"space-between",fontSize:12,color:"rgba(22,21,20,0.5)" }}>
          <span>© {new Date().getFullYear()} Fixaro Inc.</span>
          <div style={{ display:"flex",gap:20 }}>
            {["Privacy","Terms","Security"].map(l => <a key={l} href="#" style={{ color:"rgba(22,21,20,0.5)",textDecoration:"none" }}>{l}</a>)}
          </div>
        </div>
      </div>
    </div>
  );
}
