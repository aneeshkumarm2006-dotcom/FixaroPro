import { redirect } from "next/navigation";

// Rag Wash / Wash Payouts removed from Fixaro (SOP §9).
export default function WashPayoutsRemovedPage() {
  redirect("/dashboard");
}
