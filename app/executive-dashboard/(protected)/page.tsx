import { loadAuthenticatedExecutiveDashboardPayload } from "@/lib/executive-dashboard/load-dashboard";
import { ExecutiveDashboardView } from "../dashboard-view";
import { LogoutButton } from "../logout-button";

export default async function ExecutiveDashboardPage() {
  const payload = await loadAuthenticatedExecutiveDashboardPayload();

  return (
    <div className="relative">
      <LogoutButton />
      <ExecutiveDashboardView
        data={payload.display}
        isLive={payload.isLive}
        weekLabel={payload.weekLabel}
      />
    </div>
  );
}
