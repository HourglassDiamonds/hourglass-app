import { fetchGa4WeeklyBundle, isGa4Configured } from "@/lib/integrations/ga4";
import { sendWeeklyIntelligenceEmail } from "@/lib/email/send-weekly-intelligence-email";
import {
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
import type { WeeklyIntelligenceJobResult } from "./types";
import {
  getComparisonWeekRange,
  getReportWeekRange,
  formatWeekLabel,
} from "./week-ranges";
import { saveWeeklyReport } from "@/lib/supabase/intelligence";
import { isSupabaseConfigured } from "@/lib/supabase/client";

function missingPipelineMessage(): string {
  const missing: string[] = [];
  if (!isGa4Configured()) {
    missing.push(
      "GA4_PROPERTY_ID",
      "GOOGLE_CLIENT_ID",
      "GOOGLE_CLIENT_SECRET",
      "GOOGLE_REFRESH_TOKEN",
    );
  }
  if (!isSupabaseConfigured()) {
    missing.push("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY");
  }
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

    const built = buildRecommendationsAndSignals(ga4);
    const contentOpportunities = buildContentOpportunities(
      ga4,
      built.opportunities,
    );

    const reportId = await saveWeeklyReport({
      reportDate,
      weekStart: currentWeek.start,
      weekEnd: currentWeek.end,
      sections: built.sections,
      rawPayload: ga4,
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
