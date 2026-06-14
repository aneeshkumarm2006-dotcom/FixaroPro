import { requireAdmin } from "@/lib/page-guards";
import ActivityLogClient from "./ActivityLogClient";

// Activity Log — design preview (mock data). Not yet wired to a live
// ActivityLog/EmailLog source; that comes later.
export default async function ActivityPage() {
  await requireAdmin();
  return (
    <div className="h-full overflow-hidden overflow-y-auto p-8">
      <ActivityLogClient />
    </div>
  );
}
