import { redirect } from "next/navigation";

// Rag Wash removed from Fixaro (SOP §9). Redirects any bookmarked links.
export default function RagWashEmployeeRemovedPage() {
  redirect("/inventory");
}
