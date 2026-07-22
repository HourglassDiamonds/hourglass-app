import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { buildExecutiveDashboardPayload } from "@/lib/intelligence/map-report-to-dashboard";
import { formatWeekLabel } from "@/lib/intelligence/week-ranges";
import { getLatestWeeklyReport } from "@/lib/supabase/intelligence";
import type { ExecutiveDashboardPayload } from "@/lib/intelligence/dashboard-data";
import {
  EXECUTIVE_DASHBOARD_LOGIN_PATH,
  getExecutiveDashboardAccessDecision,
} from "./access";
import { EXECUTIVE_DASHBOARD_SESSION_COOKIE } from "./session";

/**
 * Loads dashboard display data only after an authenticated session is proven.
 * Callers must not invoke getLatestWeeklyReport from the dashboard route tree.
 */
export async function loadAuthenticatedExecutiveDashboardPayload(): Promise<ExecutiveDashboardPayload> {
  const jar = await cookies();
  const decision = getExecutiveDashboardAccessDecision({
    cookieValue: jar.get(EXECUTIVE_DASHBOARD_SESSION_COOKIE)?.value,
  });

  if (decision.status === "hidden") {
    notFound();
  }
  if (decision.status === "unauthenticated") {
    redirect(EXECUTIVE_DASHBOARD_LOGIN_PATH);
  }

  const report = await getLatestWeeklyReport();
  const weekLabel = report
    ? formatWeekLabel({ start: report.week_start, end: report.week_end })
    : undefined;
  return buildExecutiveDashboardPayload(report, weekLabel);
}
