import { redirect } from "next/navigation";

export default function KitsRedirect() {
  redirect("/inventory?tab=kits");
}
