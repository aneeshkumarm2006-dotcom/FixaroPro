import CareersFormClient from "./CareersFormClient";

export const metadata = {
  title: "Careers — Fixaro",
  description: "Join the Fixaro team. Apply to work with us.",
};

export default function CareersPage() {
  return (
    <div className="min-h-screen bg-[#f5f2ed] py-12 px-4">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-[#1c1917]">Join the Fixaro team</h1>
          <p className="mt-2 text-[#1c1917]/60">
            We're always looking for reliable, detail-oriented people. Tell us a
            bit about yourself and we'll be in touch.
          </p>
        </div>
        <CareersFormClient />
      </div>
    </div>
  );
}
