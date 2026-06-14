"use client";

// Careers — Cleano "Apply to work with us" public application form, re-skinned
// to the Fixaro charcoal/orange palette (A). Keeps the real fields +
// submitJobApplication / uploadResume actions.

import { useRef, useState } from "react";
import Image from "next/image";
import { Check, Paperclip, AlertCircle } from "lucide-react";
import { submitJobApplication } from "./actions/submitJobApplication";
import { uploadResume } from "./actions/uploadResume";

const POSITIONS = ["Cleaner / Technician", "Field Lead", "Operations", "Customer Support", "Other"];

export default function CareersFormClient() {
  const [form, setForm] = useState({ name: "", email: "", phone: "", position: "", experience: "", coverLetter: "" });
  const [resumeUrl, setResumeUrl] = useState<string | null>(null);
  const [resumeName, setResumeName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function set<K extends keyof typeof form>(key: K, val: string) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    const fd = new FormData();
    fd.append("file", file);
    const res = await uploadResume(fd);
    setUploading(false);
    if (res.success && res.url) { setResumeUrl(res.url); setResumeName(file.name); }
    else { setError(res.error ?? "Upload failed"); if (fileRef.current) fileRef.current.value = ""; }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.name.trim()) { setError("Please enter your full name."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) { setError("Please enter a valid email address."); return; }
    setSubmitting(true);
    const res = await submitJobApplication({ ...form, resumeUrl: resumeUrl ?? undefined });
    setSubmitting(false);
    if (res.success) setDone(true);
    else setError(res.error ?? "Something went wrong");
  }

  function reset() {
    setForm({ name: "", email: "", phone: "", position: "", experience: "", coverLetter: "" });
    setResumeUrl(null); setResumeName(null); setError(null); setDone(false);
  }

  const firstName = form.name.trim().split(/\s+/)[0] || "there";

  return (
    <div className="cr-stage">
      <div className="cr-col">
        <header className="cr-header">
          <div className="cr-brand">
            <span className="cr-logo"><Image src="/images/Fixaro-Logo.png" alt="Fixaro" width={26} height={26} /></span>
            <span className="cr-eyebrow">Fixaro Careers</span>
          </div>
          <h1 className="display cr-title">{done ? <>Application <em>received.</em></> : <>Apply to work <em>with us.</em></>}</h1>
          <p className="subtitle cr-sub">
            {done
              ? "Thanks for applying — our team will review your details and reach out soon."
              : "Join a team that takes pride in great work and treats its people right. Tell us a little about yourself."}
          </p>
        </header>

        {done ? (
          <div className="cr-card cr-success">
            <span className="cr-success-mark"><Check size={30} /></span>
            <h2 className="cr-success-title">You&rsquo;re all set, {firstName}.</h2>
            <p className="cr-success-body">
              We&rsquo;ve received your application{resumeName ? <> and your résumé (<strong>{resumeName}</strong>)</> : null}. Expect to hear from us at <strong>{form.email}</strong> within a few business days.
            </p>
            <div className="cr-success-meta">
              <div><span>Name</span>{form.name}</div>
              <div><span>Email</span>{form.email}</div>
              {form.phone && <div><span>Phone</span>{form.phone}</div>}
              {form.position && <div><span>Position</span>{form.position}</div>}
            </div>
            <button className="btn btn-secondary btn-block" onClick={reset}>Submit another application</button>
          </div>
        ) : (
          <form className="cr-card" onSubmit={submit} noValidate>
            <div className="cr-grid">
              <div className="cr-field"><label className="cr-label">Full name <span className="cr-req">*</span></label><input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Jordan Lévesque" /></div>
              <div className="cr-field"><label className="cr-label">Phone</label><input type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="(514) 555-0123" /></div>
            </div>
            <div className="cr-grid">
              <div className="cr-field"><label className="cr-label">Email <span className="cr-req">*</span></label><input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="you@email.com" /></div>
              <div className="cr-field"><label className="cr-label">Position</label>
                <select value={form.position} onChange={(e) => set("position", e.target.value)}>
                  <option value="">Select…</option>
                  {POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
            <div className="cr-field"><label className="cr-label">Relevant experience</label><textarea rows={3} value={form.experience} onChange={(e) => set("experience", e.target.value)} placeholder="Tell us about any relevant experience — residential, commercial, trades…" /></div>
            <div className="cr-field"><label className="cr-label">Why do you want to work with us?</label><textarea rows={3} value={form.coverLetter} onChange={(e) => set("coverLetter", e.target.value)} placeholder="A few words about what draws you to Fixaro." /></div>

            <div className="cr-field">
              <label className="cr-label">Résumé</label>
              <input ref={fileRef} type="file" accept=".pdf,.doc,.docx" hidden onChange={onFile} />
              <button type="button" className={`cr-upload ${resumeName ? "done" : ""}`} onClick={() => fileRef.current?.click()}>
                {uploading ? (
                  <><span className="cr-spinner" /> Uploading…</>
                ) : resumeName ? (
                  <><span className="cr-upload-ic done"><Check size={16} /></span><span>Attached: <strong>{resumeName}</strong></span><span className="cr-upload-replace">Replace</span></>
                ) : (
                  <><span className="cr-upload-ic"><Paperclip size={16} /></span><span>Upload your résumé <span className="cr-upload-hint">(PDF or Word)</span></span></>
                )}
              </button>
            </div>

            {error && <div className="cr-error"><AlertCircle size={16} /> {error}</div>}

            <button className="btn btn-primary btn-lg btn-block" type="submit" disabled={submitting || uploading}>
              {submitting ? "Submitting…" : "Submit application"}
            </button>
            <p className="cr-fineprint">By applying you agree to be contacted about employment opportunities at Fixaro.</p>
          </form>
        )}

        <footer className="cr-footer">© 2026 Fixaro · Montréal, QC</footer>
      </div>
    </div>
  );
}
