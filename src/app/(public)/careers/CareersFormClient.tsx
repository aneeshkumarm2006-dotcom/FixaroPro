"use client";

import { useRef, useState } from "react";
import { submitJobApplication } from "./actions/submitJobApplication";
import { uploadResume } from "./actions/uploadResume";

const POSITIONS = [
  "Cleaner / Technician",
  "Field Lead",
  "Operations",
  "Customer Support",
  "Other",
];

export default function CareersFormClient() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    position: "",
    experience: "",
    coverLetter: "",
  });
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
    if (res.success && res.url) {
      setResumeUrl(res.url);
      setResumeName(file.name);
    } else {
      setError(res.error ?? "Upload failed");
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.name.trim() || !form.email.trim()) {
      setError("Name and email are required.");
      return;
    }
    setSubmitting(true);
    const res = await submitJobApplication({
      ...form,
      resumeUrl: resumeUrl ?? undefined,
    });
    setSubmitting(false);
    if (res.success) setDone(true);
    else setError(res.error ?? "Something went wrong");
  }

  if (done) {
    return (
      <div className="rounded-2xl bg-white border border-[#1c1917]/10 p-8 text-center">
        <h2 className="text-xl font-semibold text-[#1c1917]">Thanks for applying!</h2>
        <p className="mt-2 text-[#1c1917]/60">
          We&apos;ve received your application and will review it shortly. Keep an
          eye on your inbox.
        </p>
      </div>
    );
  }

  const input =
    "w-full rounded-lg border border-[#1c1917]/15 px-3 py-2 text-sm focus:outline-none focus:border-[#c44c03]";

  return (
    <form
      onSubmit={submit}
      className="rounded-2xl bg-white border border-[#1c1917]/10 p-6 space-y-4"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-[#1c1917] mb-1">
            Full name *
          </label>
          <input className={input} value={form.name} onChange={(e) => set("name", e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium text-[#1c1917] mb-1">Email *</label>
          <input type="email" className={input} value={form.email} onChange={(e) => set("email", e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium text-[#1c1917] mb-1">Phone</label>
          <input className={input} value={form.phone} onChange={(e) => set("phone", e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium text-[#1c1917] mb-1">Position</label>
          <select className={input} value={form.position} onChange={(e) => set("position", e.target.value)}>
            <option value="">Select…</option>
            {POSITIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-[#1c1917] mb-1">
          Relevant experience
        </label>
        <textarea rows={3} className={input} value={form.experience} onChange={(e) => set("experience", e.target.value)} />
      </div>

      <div>
        <label className="block text-sm font-medium text-[#1c1917] mb-1">
          Why do you want to work with us?
        </label>
        <textarea rows={3} className={input} value={form.coverLetter} onChange={(e) => set("coverLetter", e.target.value)} />
      </div>

      <div>
        <label className="block text-sm font-medium text-[#1c1917] mb-1">
          Résumé (PDF or Word)
        </label>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.doc,.docx"
          onChange={onFile}
          className="block w-full text-sm text-[#1c1917]/70"
        />
        {uploading && <p className="text-xs text-[#1c1917]/50 mt-1">Uploading…</p>}
        {resumeName && !uploading && (
          <p className="text-xs text-green-600 mt-1">Attached: {resumeName}</p>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={submitting || uploading}
        className="w-full rounded-lg bg-[#c44c03] text-white py-3 text-sm font-semibold disabled:opacity-50"
      >
        {submitting ? "Submitting…" : "Submit application"}
      </button>
    </form>
  );
}
