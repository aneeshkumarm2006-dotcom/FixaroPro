import { redirect } from "next/navigation";

// Rag Wash removed from the Fixaro handyman portal (SOP §9). Redirects any
// bookmarked links back to the provider's inventory.
export default function MyRagWashRemovedPage() {
  redirect("/my-inventory");
}
