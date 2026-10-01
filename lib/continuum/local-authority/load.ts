import "server-only";

import { cookies } from "next/headers";
import { requireInternalClientMemorySession } from "@/lib/continuum/client-memory/read/access";
import { EXECUTIVE_DASHBOARD_SESSION_COOKIE } from "@/lib/executive-dashboard/session";
import { buildExecutiveDashboardPayload } from "@/lib/intelligence/map-report-to-dashboard";
import { getLatestWeeklyReport } from "@/lib/supabase/intelligence";
import { composeLocalAuthorityWorkspace } from "./compose";
import { readLocalAuthorityEvidence } from "./server";
import type { LocalAuthorityWorkspace, SearchSignalInput } from "./types";

function usable(value: string): boolean {
  return value !== "—" && !/pending|not connected|not loaded/i.test(value);
}

async function loadSearchSignals(): Promise<SearchSignalInput[]> {
  try {
    const report = await getLatestWeeklyReport();
    if (!report) return [];
    const display = buildExecutiveDashboardPayload(report).display;
    const signals: SearchSignalInput[] = [];
    if (usable(display.brandDemand.brandedClicks.value)) {
      signals.push({
        label: "Branded clicks",
        value: display.brandDemand.brandedClicks.value,
        trend: display.brandDemand.brandedClicks.trendLine ?? null,
        source: display.brandDemand.brandedClicks.sourceLabel ?? "Search Console",
      });
    }
    if (usable(display.brandDemand.nonBrandVsBrand.value)) {
      signals.push({
        label: "Branded vs non-branded trend",
        value: display.brandDemand.nonBrandVsBrand.value,
        trend: display.brandDemand.nonBrandVsBrand.trendLine ?? null,
        source: display.brandDemand.nonBrandVsBrand.sourceLabel ?? "Search Console",
      });
    }
    return signals;
  } catch {
    return [];
  }
}

export async function loadAuthenticatedLocalAuthorityWorkspace(
  now = new Date(),
): Promise<LocalAuthorityWorkspace | null> {
  const jar = await cookies();
  const session = await requireInternalClientMemorySession(
    jar.get(EXECUTIVE_DASHBOARD_SESSION_COOKIE)?.value,
    now.getTime(),
  );
  if (!session.ok) return null;

  const [evidence, searchSignals] = await Promise.all([
    readLocalAuthorityEvidence(undefined, now),
    loadSearchSignals(),
  ]);
  return composeLocalAuthorityWorkspace({ ...evidence, searchSignals });
}
