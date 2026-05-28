import type { Metadata } from "next";
import { buildExecutiveDashboardPayload } from "@/lib/intelligence/map-report-to-dashboard";
import { formatWeekLabel } from "@/lib/intelligence/week-ranges";
import { getLatestWeeklyReport } from "@/lib/supabase/intelligence";
import { ExecutiveDashboardView } from "./dashboard-view";

export const metadata: Metadata = {
  title: "Executive Dashboard",
  description:
    "Internal overview of business momentum, consumer behavior, and authority signals.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ExecutiveDashboardPage() {
  const report = await getLatestWeeklyReport();
  const weekLabel = report
    ? formatWeekLabel({ start: report.week_start, end: report.week_end })
    : undefined;
  const payload = buildExecutiveDashboardPayload(report, weekLabel);

  return (
    <ExecutiveDashboardView
      data={payload.display}
      isLive={payload.isLive}
      weekLabel={payload.weekLabel}
    />
  );
}
