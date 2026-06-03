"use client";

import { useState, FormEvent, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";

const inp: React.CSSProperties = {
  width: "100%", height: 52, borderRadius: 12,
  border: "1px solid rgba(22,21,20,0.15)", background: "#fff",
  padding: "0 16px", fontSize: 15, color: "#161514",
  fontFamily: "inherit", outline: "none",
  transition: "border-color 0.15s, box-shadow 0.15s",
};

function ResetPasswordInner() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password,  setPassword]  = useState("");
  const [confirm,   setConfirm]   = useState("");
  const [showPw,    setShowPw]    = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [done,      setDone]      = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8)        { setError("Password must be at least 8 characters."); return; }
    if (password !== confirm)        { setError("Passwords don't match."); return; }
    if (!token)                      { setError("Invalid or expired reset link. Please request a new one."); return; }
    setLoading(true);
    try {
      const res = await authClient.resetPassword({ newPassword: password, token });
      if (res.error) {
        const msg = res.error.message?.toLowerCase() || "";
        if (msg.includes("expired") || msg.includes("invalid")) {
          setError("This reset link has expired or already been used. Please request a new one.");
        } else {
          setError(res.error.message || "Couldn't reset password. Please try again.");
        }
        setLoading(false);
        return;
      }
      setDone(true);
    } catch {
      setError("Unexpected error. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.05fr 0.95fr", minHeight: "100vh", fontFamily: "var(--font-dm-sans, DM Sans, system-ui, sans-serif)" }}>

      {/* ── LEFT panel ── */}
      <aside style={{
        position: "relative", overflow: "hidden",
        background: "radial-gradient(ellipse at 20% 30%, rgba(232,93,4,0.12) 0%, transparent 60%), linear-gradient(135deg, #0c0b0a 0%, #161514 50%, #1c1a18 100%)",
        color: "#fff", padding: "40px 56px", display: "flex", flexDirection: "column",
      }}>
        <style>{`.rp-grid{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.025) 1px,transparent 1px);background-size:40px 40px;mask-image:radial-gradient(ellipse at 30% 50%,black 0%,transparent 70%);-webkit-mask-image:radial-gradient(ellipse at 30% 50%,black 0%,transparent 70%);}@media(max-width:768px){aside{display:none!important}}`}</style>
        <div className="rp-grid" />
        <div style={{ position:"absolute",top:0,right:0,width:280,height:280,background:"radial-gradient(circle at top right,rgba(203,163,90,0.08),transparent 70%)",pointerEvents:"none" }} />

        <div style={{ position:"relative",zIndex:2,display:"flex",alignItems:"center",gap:12 }}>
          <div style={{ width:38,height:38,borderRadius:12,background:"#fff",overflow:"hidden",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 2px 8px rgba(0,0,0,0.15)" }}>
            <img src="/images/Fixaro-Logo.png" alt="Fixaro" width={38} height={38} style={{ objectFit:"contain" }} />
          </div>
          <div>
            <div style={{ fontWeight:700,fontSize:18,color:"#fff",letterSpacing:"-0.01em" }}>Fixaro</div>
            <div style={{ fontSize:11,color:"rgba(255,255,255,0.45)",marginTop:3,letterSpacing:"0.04em" }}>Account Security</div>
          </div>
        </div>

        <div style={{ position:"relative",zIndex:2,flex:1,display:"flex",flexDirection:"column",justifyContent:"center",gap:24 }}>
          <h1 style={{ fontFamily:"var(--font-instrument-serif,'Instrument Serif',Georgia,serif)",fontWeight:400,fontSize:"clamp(36px,4.5vw,56px)",lineHeight:1.05,letterSpacing:"-0.02em",color:"#fff",margin:0 }}>
            {done ? (
              <>You&apos;re back<br /><em style={{ fontStyle:"italic",color:"#d4b978" }}>in business.</em></>
            ) : (
              <>Choose a<br /><em style={{ fontStyle:"italic",color:"#d4b978" }}>new password.</em></>
            )}
          </h1>
          <p style={{ fontSize:15,lineHeight:1.6,color:"rgba(255,255,255,0.65)",maxWidth:420,margin:0 }}>
            {done
              ? "Your password has been updated. You can now sign in with your new credentials."
              : "Pick something strong — at least 8 characters. You won't need to remember it if you use a password manager."}
          </p>
          <div style={{ display:"flex",gap:28,paddingTop:8 }}>
            {[{ val:"8+", label:"Min. characters" }, { val:"TLS", label:"Encrypted" }, { val:"Instant", label:"Takes effect" }].map(s => (
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
          Secure password reset · One-time link
        </div>
      </aside>

      {/* ── RIGHT: Form panel ── */}
      <div style={{ display:"flex",flexDirection:"column",background:"#fff" }}>
        <div style={{ padding:"28px 48px" }}>
          <Link href="/sign-in" style={{ fontSize:13,color:"rgba(22,21,20,0.5)",fontWeight:500,textDecoration:"none" }}>← Back to sign in</Link>
        </div>

        <div style={{ flex:1,display:"flex",flexDirection:"column",justifyContent:"center",padding:"16px 48px 48px" }}>
          <div style={{ width:"100%",maxWidth:420,margin:"0 auto" }}>

            {!token && (
              <div style={{ textAlign:"center" }}>
                <div style={{ width:64,height:64,borderRadius:"50%",background:"rgba(220,38,38,0.1)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 24px" }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </div>
                <h2 style={{ fontFamily:"var(--font-instrument-serif,'Instrument Serif',Georgia,serif)",fontWeight:400,fontSize:32,color:"#161514",letterSpacing:"-0.02em",margin:"0 0 12px" }}>Invalid link</h2>
                <p style={{ fontSize:15,color:"rgba(22,21,20,0.7)",lineHeight:1.6,margin:"0 0 32px" }}>This reset link is invalid or has expired. Please request a new one.</p>
                <Link href="/forgot-password" style={{ display:"inline-flex",alignItems:"center",justifyContent:"center",height:52,padding:"0 32px",borderRadius:12,background:"#e85d04",color:"#fff",fontWeight:600,fontSize:15,textDecoration:"none",boxShadow:"0 4px 18px rgba(232,93,4,0.30)" }}>
                  Request new link →
                </Link>
              </div>
            )}

            {token && done && (
              <div style={{ textAlign:"center" }}>
                <div style={{ width:64,height:64,borderRadius:"50%",background:"rgba(16,185,129,0.1)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 24px" }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <h2 style={{ fontFamily:"var(--font-instrument-serif,'Instrument Serif',Georgia,serif)",fontWeight:400,fontSize:32,color:"#161514",letterSpacing:"-0.02em",margin:"0 0 12px" }}>Password updated!</h2>
                <p style={{ fontSize:15,color:"rgba(22,21,20,0.7)",lineHeight:1.6,margin:"0 0 32px" }}>Your password has been reset. Sign in with your new credentials.</p>
                <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
                  <Link href="/sign-in" style={{ display:"flex",alignItems:"center",justifyContent:"center",height:52,borderRadius:12,background:"#e85d04",color:"#fff",fontWeight:600,fontSize:15,textDecoration:"none",boxShadow:"0 4px 18px rgba(232,93,4,0.30)" }}>
                    Admin sign in →
                  </Link>
                  <Link href="/crew-sign-in" style={{ display:"flex",alignItems:"center",justifyContent:"center",height:52,borderRadius:12,background:"#faf8f4",color:"#161514",fontWeight:500,fontSize:15,textDecoration:"none",border:"1px solid rgba(22,21,20,0.1)" }}>
                    Crew sign in →
                  </Link>
                  <Link href="/portal/login" style={{ display:"flex",alignItems:"center",justifyContent:"center",height:52,borderRadius:12,background:"#faf8f4",color:"#161514",fontWeight:500,fontSize:15,textDecoration:"none",border:"1px solid rgba(22,21,20,0.1)" }}>
                    Customer portal →
                  </Link>
                </div>
              </div>
            )}

            {token && !done && (
              <>
                <header style={{ marginBottom:36 }}>
                  <p style={{ fontSize:11,textTransform:"uppercase",letterSpacing:"0.12em",fontWeight:600,color:"#e85d04",marginBottom:12 }}>New password</p>
                  <h2 style={{ fontFamily:"var(--font-instrument-serif,'Instrument Serif',Georgia,serif)",fontWeight:400,fontSize:"clamp(28px,3.5vw,40px)",lineHeight:1.05,letterSpacing:"-0.02em",color:"#161514",margin:0 }}>
                    Set a new<br /><em style={{ fontStyle:"italic",color:"#e85d04" }}>password.</em>
                  </h2>
                  <p style={{ fontSize:15,color:"rgba(22,21,20,0.7)",lineHeight:1.6,marginTop:14 }}>Choose a strong password — at least 8 characters.</p>
                </header>

                <form onSubmit={handleSubmit} style={{ display:"flex",flexDirection:"column",gap:20 }}>
                  <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
                    <label style={{ fontSize:13,fontWeight:500,color:"#161514" }}>New password</label>
                    <div style={{ position:"relative" }}>
                      <input type={showPw ? "text" : "password"} placeholder="8+ characters" value={password}
                        onChange={e => { setPassword(e.target.value); setError(null); }} required minLength={8}
                        style={{ ...inp, paddingRight:56 }}
                        onFocus={e => Object.assign(e.currentTarget.style, { borderColor:"#e85d04",boxShadow:"0 0 0 3px rgba(232,93,4,0.14)" })}
                        onBlur={e => Object.assign(e.currentTarget.style, { borderColor:"rgba(22,21,20,0.15)",boxShadow:"none" })} />
                      <button type="button" onClick={() => setShowPw(!showPw)} style={{ position:"absolute",right:14,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",fontSize:12,fontWeight:600,color:"rgba(22,21,20,0.5)",fontFamily:"inherit" }}>
                        {showPw ? "Hide" : "Show"}
                      </button>
                    </div>
                  </div>

                  <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
                    <label style={{ fontSize:13,fontWeight:500,color:"#161514" }}>Confirm password</label>
                    <input type={showPw ? "text" : "password"} placeholder="Repeat your password" value={confirm}
                      onChange={e => { setConfirm(e.target.value); setError(null); }} required
                      style={inp}
                      onFocus={e => Object.assign(e.currentTarget.style, { borderColor:"#e85d04",boxShadow:"0 0 0 3px rgba(232,93,4,0.14)" })}
                      onBlur={e => Object.assign(e.currentTarget.style, { borderColor:"rgba(22,21,20,0.15)",boxShadow:"none" })} />
                  </div>

                  {/* Password strength hint */}
                  {password.length > 0 && (
                    <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                      {[1,2,3,4].map(i => (
                        <div key={i} style={{ flex:1,height:3,borderRadius:2,background: i <= Math.min(4, Math.floor(password.length / 3)) ? (password.length < 6 ? "#ef4444" : password.length < 10 ? "#f59e0b" : "#10b981") : "rgba(22,21,20,0.1)",transition:"background 0.2s" }} />
                      ))}
                      <span style={{ fontSize:11,color:"rgba(22,21,20,0.5)",whiteSpace:"nowrap" }}>
                        {password.length < 6 ? "Weak" : password.length < 10 ? "Fair" : "Strong"}
                      </span>
                    </div>
                  )}

                  {error && (
                    <div style={{ background:"#fef2f2",border:"1px solid #fecaca",borderRadius:10,padding:"12px 16px",fontSize:13,color:"#dc2626",lineHeight:1.5 }}>{error}</div>
                  )}

                  <button type="submit" disabled={loading} style={{ width:"100%",height:52,borderRadius:12,border:"none",background:loading?"rgba(232,93,4,0.6)":"#e85d04",color:"#fff",fontSize:15,fontWeight:600,cursor:loading?"not-allowed":"pointer",fontFamily:"inherit",boxShadow:loading?"none":"0 4px 18px rgba(232,93,4,0.30)",transition:"all 0.15s" }}>
                    {loading ? "Updating…" : "Set new password →"}
                  </button>
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

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordInner />
    </Suspense>
  );
}
