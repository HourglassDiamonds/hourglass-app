import type { Metadata } from "next";
import { notFound } from "next/navigation";
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

/**
 * Access policy:
 * - Production (public domain): always unavailable (`notFound()`).
 *   `robots: noindex` is SEO only — not access control.
 * - Non-production (local / protected preview builds): available for internal use.
 * There is no environment flag that opens this route on public production.
 * Genuine auth or Vercel Deployment Protection is required before any
 * production exposure — neither is implemented in this page.
 */
function isExecutiveDashboardAllowed(): boolean {
  return process.env.NODE_ENV !== "production";
}

export default async function ExecutiveDashboardPage() {
  if (!isExecutiveDashboardAllowed()) {
    notFound();
  }

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
