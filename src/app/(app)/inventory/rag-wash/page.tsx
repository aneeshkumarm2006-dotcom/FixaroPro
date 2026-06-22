import { redirect } from "next/navigation";

// Rag Wash removed from Fixaro (SOP §9). Route retained only to redirect any
// bookmarked links; the feature no longer appears in the admin dashboard.
export default function RagWashRemovedPage() {
  redirect("/inventory");
}
