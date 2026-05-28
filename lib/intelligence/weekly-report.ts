import { fetchGa4WeeklyBundle, isGa4Configured } from "@/lib/integrations/ga4";
import { fetchGscWeeklyBundle } from "@/lib/integrations/gsc";
import { buildDashboardSnapshot } from "./dashboard-snapshot";
import { sendWeeklyIntelligenceEmail } from "@/lib/email/send-weekly-intelligence-email";
import {
  getGa4PropertyId,
  getGoogleClientId,
  getGoogleClientSecret,
  getGoogleRefreshToken,
  getSupabaseServiceRoleKey,
  getSupabaseUrl,
  getWeeklyPipelineEnv,
  isLocalDevelopment,
  isProductionRuntime,
  isResendConfigured,
} from "./env";
import { Ga4OAuthError } from "./google-oauth";
import {
  buildContentOpportunities,
  buildRecommendationsAndSignals,
} from "./recommendations";
import type { IntelligenceRawPayload, WeeklyIntelligenceJobResult, WeeklyReportRecord } from "./types";
import {
  getComparisonWeekRange,
  getReportWeekRange,
  formatWeekLabel,
} from "./week-ranges";
import { saveWeeklyReport } from "@/lib/supabase/intelligence";
import { isSupabaseConfigured } from "@/lib/supabase/client";

function missingPipelineMessage(): string {
  const missing: string[] = [];
  if (!getGa4PropertyId()) missing.push("GA4_PROPERTY_ID");
  if (!getGoogleClientId()) missing.push("GOOGLE_CLIENT_ID");
  if (!getGoogleClientSecret()) missing.push("GOOGLE_CLIENT_SECRET");
  if (!getGoogleRefreshToken()) missing.push("GOOGLE_REFRESH_TOKEN");
  if (!getSupabaseUrl()) missing.push("SUPABASE_URL");
  if (!getSupabaseServiceRoleKey()) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  return missing.length
    ? `Missing: ${missing.join(", ")}`
    : "GA4 and Supabase are required";
}

async function trySendWeeklyEmail(
  sections: Parameters<typeof sendWeeklyIntelligenceEmail>[0]["sections"],
  week: { start: string; end: string; label: string },
): Promise<Pick<WeeklyIntelligenceJobResult, "emailSent" | "emailSkipped" | "warning">> {
  if (!isResendConfigured()) {
    if (isLocalDevelopment()) {
      console.log(
        "[hourglass:intelligence] Email skipped — Resend env vars missing in local development.",
      );
      return { emailSent: false, emailSkipped: true };
    }

    const warning =
      "Weekly report saved but email was not sent — Resend env vars missing in production.";
    console.warn(`[hourglass:intelligence] ${warning}`);
    return { emailSent: false, emailSkipped: true, warning };
  }

  try {
    await sendWeeklyIntelligenceEmail({
      weekLabel: week.label,
      weekStart: week.start,
      weekEnd: week.end,
      sections,
    });
    return { emailSent: true, emailSkipped: false };
  } catch (emailErr) {
    const message =
      emailErr instanceof Error ? emailErr.message : "Email send failed";
    console.error("[hourglass:intelligence] email failed:", emailErr);

    if (isProductionRuntime()) {
      return {
        emailSent: false,
        emailSkipped: false,
        warning: `Weekly report saved but email failed: ${message}`,
      };
    }

    return {
      emailSent: false,
      emailSkipped: true,
      warning: `Email failed in development (report still saved): ${message}`,
    };
  }
}

export async function runWeeklyIntelligenceJob(): Promise<WeeklyIntelligenceJobResult> {
  if (!getWeeklyPipelineEnv()) {
    return {
      ok: false,
      source: "ga4",
      weekStart: "",
      weekEnd: "",
      emailSent: false,
      skipped: missingPipelineMessage(),
    };
  }

  if (!isGa4Configured()) {
    return {
      ok: false,
      source: "ga4",
      weekStart: "",
      weekEnd: "",
      emailSent: false,
      skipped: "GA4 is not configured",
    };
  }

  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      source: "ga4",
      weekStart: "",
      weekEnd: "",
      emailSent: false,
      skipped: "Supabase is not configured",
    };
  }

  const currentWeek = getReportWeekRange();
  const previousWeek = getComparisonWeekRange(currentWeek);
  const reportDate = new Date().toISOString().slice(0, 10);

  try {
    const ga4 = await fetchGa4WeeklyBundle(currentWeek, previousWeek);
    console.log("[hourglass:intelligence] Analytics report generated");

    const gsc = await fetchGscWeeklyBundle(currentWeek, previousWeek);
    if (gsc.status === "unavailable" && gsc.unavailableReason) {
      console.warn(
        `[hourglass:intelligence] GSC unavailable: ${gsc.unavailableReason}`,
      );
    }

    const built = buildRecommendationsAndSignals(ga4);
    const contentOpportunities = buildContentOpportunities(
      ga4,
      built.opportunities,
    );

    const reportStub: WeeklyReportRecord = {
      id: "",
      report_date: reportDate,
      week_start: currentWeek.start,
      week_end: currentWeek.end,
      executive_summary: built.sections.executive_summary,
      traffic_summary: built.sections.traffic_summary,
      diamond_studio_summary: built.sections.diamond_studio_summary,
      landing_page_summary: built.sections.landing_page_summary,
      opportunities: built.sections.opportunities,
      problems: built.sections.problems,
      recommendations: built.sections.recommendations,
      raw_payload: ga4,
      created_at: new Date().toISOString(),
    };

    const dashboardSnapshot = buildDashboardSnapshot(reportStub, ga4, gsc);

    const rawPayload: IntelligenceRawPayload = {
      ...ga4,
      gsc,
      dashboardSnapshot,
    };

    const reportId = await saveWeeklyReport({
      reportDate,
      weekStart: currentWeek.start,
      weekEnd: currentWeek.end,
      sections: built.sections,
      rawPayload,
      snapshots: built.snapshots,
      recommendations: built.recommendations,
      contentOpportunities,
    });
    console.log("[hourglass:intelligence] Report saved to Supabase");

    const email = await trySendWeeklyEmail(built.sections, {
      start: currentWeek.start,
      end: currentWeek.end,
      label: formatWeekLabel(currentWeek),
    });

    return {
      ok: true,
      reportId,
      source: "ga4",
      weekStart: currentWeek.start,
      weekEnd: currentWeek.end,
      ...email,
    };
  } catch (err) {
    const message =
      err instanceof Ga4OAuthError
        ? err.message
        : err instanceof Error
          ? err.message
          : "Unknown error";
    console.error("[hourglass:intelligence] job failed:", message);
    return {
      ok: false,
      source: "ga4",
      weekStart: currentWeek.start,
      weekEnd: currentWeek.end,
      emailSent: false,
      error: message,
    };
  }
}
