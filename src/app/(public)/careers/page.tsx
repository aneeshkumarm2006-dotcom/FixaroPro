import CareersFormClient from "./CareersFormClient";

export const metadata = {
  title: "Careers — Fixaro",
  description: "Join the Fixaro team. Apply to work with us.",
};

export default function CareersPage() {
  // The client renders its own full-bleed stage (header + card + footer).
  return <CareersFormClient />;
}
