/**
 * Safe GA4 / GSC configuration preflight — never prints secrets or tokens.
 * SERVER ONLY.
 */

import {
  getGa4PropertyId,
  getGoogleClientId,
  getGoogleClientSecret,
  getGoogleOAuthRedirectUri,
  getGoogleRefreshToken,
} from "@/lib/intelligence/env";
import {
  refreshGoogleAccessTokenDetailed,
  sanitizeGa4PropertyIdForDisplay,
} from "@/lib/intelligence/google-oauth";
import {
  getGscSiteUrl,
  isGscConfigured,
  sanitizeGscSiteUrlForDisplay,
} from "@/lib/integrations/gsc";
import { isGa4Configured } from "@/lib/integrations/ga4";
import {
  classifyMeasurementFailure,
  founderLabelForHealthCode,
  type MeasurementHealthCode,
} from "./health-codes";
import { getAgentOsMeasurementWindows } from "./date-windows";

export type EnvPresence = {
  GOOGLE_CLIENT_ID: boolean;
  GOOGLE_CLIENT_SECRET: boolean;
  GOOGLE_REFRESH_TOKEN: boolean;
  GOOGLE_OAUTH_REDIRECT_URI: boolean;
  GA4_PROPERTY_ID: boolean;
  GSC_SITE_URL: boolean;
};

export type MeasurementPreflightResult = {
  env: EnvPresence;
  oauth: {
    configured: boolean;
    tokenExchange: "ok" | "failed" | "skipped";
    healthCode: MeasurementHealthCode | null;
    message: string | null;
  };
  ga4: {
    configured: boolean;
    propertyIdDisplay: string | null;
    accessible: boolean | null;
    healthCode: MeasurementHealthCode;
    founderLabel: string;
    sessions?: number;
    rowCount?: number;
    window?: { start: string; end: string } | null;
    message?: string | null;
  };
  gsc: {
    configured: boolean;
    siteUrlDisplay: string | null;
    accessible: boolean | null;
    healthCode: MeasurementHealthCode;
    founderLabel: string;
    newestFinalizedDate?: string | null;
    firstIncompleteDate?: string | null;
    newestObservedActivityDate?: string | null;
    /** @deprecated alias of newestFinalizedDate */
    newestAvailableDate?: string | null;
    ageDays?: number | null;
    clicks?: number;
    impressions?: number;
    queryRows?: number;
    window?: { start: string; end: string } | null;
    message?: string | null;
  };
  asOfUtc: string;
  /** True when either source has a config/auth/access failure. */
  hasBlockingFailure: boolean;
};

export function detectMeasurementEnvPresence(): EnvPresence {
  return {
    GOOGLE_CLIENT_ID: Boolean(getGoogleClientId()),
    GOOGLE_CLIENT_SECRET: Boolean(getGoogleClientSecret()),
    GOOGLE_REFRESH_TOKEN: Boolean(getGoogleRefreshToken()),
    GOOGLE_OAUTH_REDIRECT_URI: Boolean(getGoogleOAuthRedirectUri()),
    GA4_PROPERTY_ID: Boolean(getGa4PropertyId()),
    GSC_SITE_URL: Boolean(getGscSiteUrl()),
  };
}

/**
 * Read-only preflight. Optionally probes live APIs when `probeLive` is true.
 * Never sends email. Never logs token contents.
 */
export async function runMeasurementPreflight(options?: {
  probeLive?: boolean;
  asOf?: Date;
}): Promise<MeasurementPreflightResult> {
  const probeLive = options?.probeLive ?? true;
  const asOf = options?.asOf ?? new Date();
  const env = detectMeasurementEnvPresence();
  const windows = getAgentOsMeasurementWindows(asOf);

  const oauthConfigured = Boolean(
    env.GOOGLE_CLIENT_ID &&
      env.GOOGLE_CLIENT_SECRET &&
      env.GOOGLE_REFRESH_TOKEN,
  );

  let oauth: MeasurementPreflightResult["oauth"] = {
    configured: oauthConfigured,
    tokenExchange: oauthConfigured ? "skipped" : "skipped",
    healthCode: oauthConfigured ? null : "not-configured",
    message: oauthConfigured
      ? null
      : "Shared Google OAuth vars incomplete",
  };

  if (probeLive && oauthConfigured) {
    const token = await refreshGoogleAccessTokenDetailed();
    if (token.ok) {
      oauth = {
        configured: true,
        tokenExchange: "ok",
        healthCode: "ok",
        message: null,
      };
    } else {
      const healthCode = classifyMeasurementFailure("ga4", {
        code: token.code,
        message: token.message,
      });
      oauth = {
        configured: true,
        tokenExchange: "failed",
        healthCode,
        message: token.message,
      };
    }
  }

  const ga4Configured = isGa4Configured();
  let ga4: MeasurementPreflightResult["ga4"] = {
    configured: ga4Configured,
    propertyIdDisplay: sanitizeGa4PropertyIdForDisplay(getGa4PropertyId()),
    accessible: null,
    healthCode: ga4Configured ? "ok" : "not-configured",
    founderLabel: founderLabelForHealthCode(
      "ga4",
      ga4Configured ? "ok" : "not-configured",
    ),
    window: windows.rolling7d,
    message: ga4Configured ? null : "GA4 not configured",
  };

  const gscConfigured = isGscConfigured();
  let gsc: MeasurementPreflightResult["gsc"] = {
    configured: gscConfigured,
    siteUrlDisplay: sanitizeGscSiteUrlForDisplay(getGscSiteUrl()),
    accessible: null,
    healthCode: gscConfigured ? "ok" : "not-configured",
    founderLabel: founderLabelForHealthCode(
      "gsc",
      gscConfigured ? "ok" : "not-configured",
    ),
    window: windows.rolling7d,
    message: gscConfigured ? null : "Search Console not configured",
  };

  if (probeLive && oauth.tokenExchange === "ok" && ga4Configured) {
    try {
      const { fetchGa4AgentOsBundle, summarizeGa4Bundle } = await import(
        "@/lib/integrations/ga4"
      );
      const bundle = await fetchGa4AgentOsBundle(asOf);
      const summary = summarizeGa4Bundle(bundle);
      const empty = summary.sessionsCurrent === 0;
      const healthCode = empty ? "empty" : "ok";
      ga4 = {
        configured: true,
        propertyIdDisplay: sanitizeGa4PropertyIdForDisplay(getGa4PropertyId()),
        accessible: true,
        healthCode,
        founderLabel: founderLabelForHealthCode("ga4", healthCode),
        sessions: summary.sessionsCurrent,
        rowCount:
          summary.channelRows +
          summary.landingPageRows +
          summary.sourceMediumRows +
          summary.eventNamesWithVolume,
        window: summary.currentRange,
        message: null,
      };
    } catch (err) {
      const healthCode = classifyMeasurementFailure("ga4", err);
      ga4 = {
        configured: true,
        propertyIdDisplay: sanitizeGa4PropertyIdForDisplay(getGa4PropertyId()),
        accessible: false,
        healthCode,
        founderLabel: founderLabelForHealthCode("ga4", healthCode),
        window: windows.rolling7d,
        message:
          err instanceof Error ? err.message.slice(0, 200) : "GA4 probe failed",
      };
    }
  } else if (probeLive && ga4Configured && oauth.tokenExchange === "failed") {
    ga4 = {
      ...ga4,
      accessible: false,
      healthCode: oauth.healthCode ?? "oauth-auth-failed",
      founderLabel: founderLabelForHealthCode(
        "ga4",
        oauth.healthCode ?? "oauth-auth-failed",
      ),
      message: oauth.message,
    };
  }

  if (probeLive && oauth.tokenExchange === "ok" && gscConfigured) {
    try {
      const { fetchGscAgentOsBundle, summarizeGscBundle } = await import(
        "@/lib/integrations/gsc"
      );
      const bundle = await fetchGscAgentOsBundle(asOf);
      const summary = summarizeGscBundle(bundle);
      if (bundle.status === "unavailable") {
        const healthCode = classifyMeasurementFailure("gsc", {
          code: bundle.failureCode,
          message: bundle.unavailableReason,
        });
        gsc = {
          configured: true,
          siteUrlDisplay: summary.siteUrl,
          accessible: false,
          healthCode,
          founderLabel: founderLabelForHealthCode("gsc", healthCode, {
            newestAvailableDate: summary.newestFinalizedDate,
            ageDays: summary.ageDays,
          }),
          newestFinalizedDate: summary.newestFinalizedDate,
          firstIncompleteDate: summary.firstIncompleteDate,
          newestObservedActivityDate: summary.newestObservedActivityDate,
          newestAvailableDate: summary.newestFinalizedDate,
          ageDays: summary.ageDays,
          window: summary.currentRange,
          message: bundle.unavailableReason ?? null,
        };
      } else {
        const empty =
          summary.clicksCurrent === 0 && summary.impressionsCurrent === 0;
        let healthCode: MeasurementHealthCode = "ok";
        if (summary.lagClassification === "unusual-stale") {
          healthCode = "stale-unusual";
        } else if (empty) {
          healthCode = "empty";
        } else if (
          summary.lagClassification === "normal-delay" ||
          summary.lagClassification === "elevated-delay"
        ) {
          healthCode = "stale-within-normal-delay";
        }
        gsc = {
          configured: true,
          siteUrlDisplay: summary.siteUrl,
          accessible: true,
          healthCode,
          founderLabel: founderLabelForHealthCode("gsc", healthCode, {
            newestAvailableDate: summary.newestFinalizedDate,
            ageDays: summary.ageDays,
          }),
          newestFinalizedDate: summary.newestFinalizedDate,
          firstIncompleteDate: summary.firstIncompleteDate,
          newestObservedActivityDate: summary.newestObservedActivityDate,
          newestAvailableDate: summary.newestFinalizedDate,
          ageDays: summary.ageDays,
          clicks: summary.clicksCurrent,
          impressions: summary.impressionsCurrent,
          queryRows: summary.queryRows,
          window: summary.currentRange,
          message: null,
        };
      }
    } catch (err) {
      const healthCode = classifyMeasurementFailure("gsc", err);
      gsc = {
        configured: true,
        siteUrlDisplay: sanitizeGscSiteUrlForDisplay(getGscSiteUrl()),
        accessible: false,
        healthCode,
        founderLabel: founderLabelForHealthCode("gsc", healthCode),
        window: windows.rolling7d,
        message:
          err instanceof Error ? err.message.slice(0, 200) : "GSC probe failed",
      };
    }
  } else if (probeLive && gscConfigured && oauth.tokenExchange === "failed") {
    gsc = {
      ...gsc,
      accessible: false,
      healthCode: oauth.healthCode ?? "oauth-auth-failed",
      founderLabel: founderLabelForHealthCode(
        "gsc",
        oauth.healthCode ?? "oauth-auth-failed",
      ),
      message: oauth.message,
    };
  }

  const hasBlockingFailure =
    ga4.healthCode === "not-configured" ||
    ga4.healthCode === "oauth-auth-failed" ||
    ga4.healthCode === "property-access-denied" ||
    ga4.healthCode === "upstream-request-failed" ||
    ga4.healthCode === "timeout" ||
    gsc.healthCode === "not-configured" ||
    gsc.healthCode === "oauth-auth-failed" ||
    gsc.healthCode === "site-access-denied" ||
    gsc.healthCode === "upstream-request-failed" ||
    gsc.healthCode === "timeout";

  // Empty / normal lag are not blocking failures for exit codes when at least
  // one source is healthy-or-empty. Blocking only when configured sources fail auth/access.
  const configuredFailures =
    (ga4Configured &&
      (ga4.healthCode === "oauth-auth-failed" ||
        ga4.healthCode === "property-access-denied" ||
        ga4.healthCode === "upstream-request-failed" ||
        ga4.healthCode === "timeout")) ||
    (gscConfigured &&
      (gsc.healthCode === "oauth-auth-failed" ||
        gsc.healthCode === "site-access-denied" ||
        gsc.healthCode === "upstream-request-failed" ||
        gsc.healthCode === "timeout")) ||
    (oauthConfigured && oauth.tokenExchange === "failed");

  return {
    env,
    oauth,
    ga4,
    gsc,
    asOfUtc: asOf.toISOString(),
    hasBlockingFailure: configuredFailures || hasBlockingFailure,
  };
}

/** Exit nonzero only for genuine config/auth/access failures — not empty or lag. */
export function preflightShouldExitNonzero(
  result: MeasurementPreflightResult,
): boolean {
  if (result.oauth.tokenExchange === "failed") return true;
  const bad = new Set<MeasurementHealthCode>([
    "oauth-auth-failed",
    "property-access-denied",
    "site-access-denied",
    "upstream-request-failed",
    "timeout",
  ]);
  if (result.ga4.configured && bad.has(result.ga4.healthCode)) return true;
  if (result.gsc.configured && bad.has(result.gsc.healthCode)) return true;
  // Both completely unconfigured is a soft failure for smoke (exit 1) so Justin notices.
  if (!result.ga4.configured && !result.gsc.configured) return true;
  return false;
}
