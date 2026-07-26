/**
 * Precise measurement source-health codes for GA4 / GSC.
 * Founder-facing labels preserve specificity without exposing secrets or stack noise.
 */

export type MeasurementSourceKind = "ga4" | "gsc";

export type MeasurementHealthCode =
  | "ok"
  | "empty"
  | "not-configured"
  | "oauth-auth-failed"
  | "property-access-denied"
  | "site-access-denied"
  | "upstream-request-failed"
  | "timeout"
  | "stale-within-normal-delay"
  | "stale-unusual"
  | "fixture";

export const MEASUREMENT_HEALTH_CODES: readonly MeasurementHealthCode[] = [
  "ok",
  "empty",
  "not-configured",
  "oauth-auth-failed",
  "property-access-denied",
  "site-access-denied",
  "upstream-request-failed",
  "timeout",
  "stale-within-normal-delay",
  "stale-unusual",
  "fixture",
] as const;

/** Compact founder-facing labels used in the daily Morning Brief. */
export function founderLabelForHealthCode(
  source: MeasurementSourceKind,
  code: MeasurementHealthCode,
  opts?: { newestAvailableDate?: string | null; ageDays?: number | null },
): string {
  const date = opts?.newestAvailableDate ?? null;
  const age = opts?.ageDays ?? null;

  if (source === "ga4") {
    switch (code) {
      case "ok":
        return "GA4 healthy";
      case "empty":
        return "GA4 returned no usable rows";
      case "not-configured":
        return "GA4 not configured";
      case "oauth-auth-failed":
        return "GA4 OAuth authentication failed";
      case "property-access-denied":
        return "GA4 property access denied";
      case "upstream-request-failed":
        return "GA4 request failed";
      case "timeout":
        return "GA4 request timed out";
      case "fixture":
        return "GA4 fixture data";
      case "stale-within-normal-delay":
      case "stale-unusual":
      case "site-access-denied":
        return "GA4 request failed";
      default:
        return "GA4 unavailable";
    }
  }

  switch (code) {
    case "ok":
      return "Search Console healthy";
    case "empty":
      return "Search Console returned no usable rows";
    case "not-configured":
      return "Search Console not configured";
    case "oauth-auth-failed":
      return "Search Console OAuth authentication failed";
    case "site-access-denied":
      return "Search Console site access denied";
    case "property-access-denied":
      return "Search Console site access denied";
    case "upstream-request-failed":
      return "Search Console request failed";
    case "timeout":
      return "Search Console request timed out";
    case "stale-within-normal-delay": {
      if (date && age != null) {
        return `Search Console newest finalized data is ${formatFriendlyDate(date)} (${age}d processing delay; expected)`;
      }
      if (date) {
        return `Search Console data finalized through ${formatFriendlyDate(date)}; normal processing delay`;
      }
      return "Search Console processing delay within expected range";
    }
    case "stale-unusual": {
      if (date && age != null) {
        return `Search Console newest finalized data is ${age} days old (${formatFriendlyDate(date)})`;
      }
      return "Search Console finalized data unusually stale";
    }
    case "fixture":
      return "Search Console fixture data";
    default:
      return "Search Console unavailable";
  }
}

function formatFriendlyDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) return isoDate;
  const utc = new Date(Date.UTC(y, m - 1, d, 12));
  return utc.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Classify adapter errors into measurement health codes.
 * Prefer structured error codes when present; otherwise parse sanitized messages.
 */
export function classifyMeasurementFailure(
  source: MeasurementSourceKind,
  err: unknown,
): MeasurementHealthCode {
  const code =
    err && typeof err === "object" && "code" in err
      ? String((err as { code: unknown }).code)
      : "";
  const message =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : err &&
            typeof err === "object" &&
            "message" in err &&
            typeof (err as { message: unknown }).message === "string"
          ? (err as { message: string }).message
          : "";
  const lower = `${code} ${message}`.toLowerCase();

  if (lower.includes("timed out") || lower.includes("timeout")) {
    return "timeout";
  }
  if (
    lower.includes("missing_env") ||
    lower.includes("not configured") ||
    lower.includes("missing google") ||
    lower.includes("gsc_site_url")
  ) {
    return "not-configured";
  }
  if (
    lower.includes("invalid_refresh_token") ||
    lower.includes("token_refresh_failed") ||
    lower.includes("token_failed") ||
    lower.includes("invalid_grant") ||
    lower.includes("refresh token") ||
    lower.includes("oauth authentication failed") ||
    lower.includes("access token unavailable")
  ) {
    return "oauth-auth-failed";
  }
  if (
    source === "ga4" &&
    (lower.includes("property_access") ||
      lower.includes("permission_denied") ||
      lower.includes("permission denied") ||
      (lower.includes("403") && lower.includes("ga4")))
  ) {
    return "property-access-denied";
  }
  if (
    source === "gsc" &&
    (lower.includes("api_forbidden") ||
      lower.includes("permission denied") ||
      lower.includes("site access") ||
      (lower.includes("403") && lower.includes("search")))
  ) {
    return "site-access-denied";
  }
  if (
    lower.includes("permission_denied") ||
    lower.includes("permission denied") ||
    lower.includes("403")
  ) {
    return source === "ga4" ? "property-access-denied" : "site-access-denied";
  }

  return "upstream-request-failed";
}

/**
 * Map a free-form gap description (or health code token) to a precise daily label.
 * Preserves quality controls: HubSpot/Buffer/GBP stay compact; GA4/GSC stay specific.
 */
export function shortenMeasurementGapLabel(gap: string): string {
  const s = gap.trim();
  if (!s) return s;

  if (/hubspot/i.test(s)) return "HubSpot unavailable";
  if (/buffer|social/i.test(s)) return "Buffer/social unavailable";
  if (/gbp|google business/i.test(s)) return "GBP unavailable";
  if (/weekly intelligence/i.test(s)) return "Weekly intelligence partial";

  if (/ga4|google analytics/i.test(s)) {
    if (/not configured/i.test(s)) return "GA4 not configured";
    if (/oauth|auth|refresh token|invalid_grant/i.test(s)) {
      return "GA4 OAuth authentication failed";
    }
    if (/permission|access denied|403/i.test(s)) {
      return "GA4 property access denied";
    }
    if (/empty|no usable|zero session/i.test(s)) {
      return "GA4 returned no usable rows";
    }
    if (/timed? ?out/i.test(s)) return "GA4 request timed out";
    if (/retrieval failed|request failed|api failed|api error/i.test(s)) {
      return "GA4 request failed";
    }
    // Already-precise founder labels
    if (
      /^GA4 (not configured|OAuth|property access|request failed|request timed out|returned no usable|healthy)/i.test(
        s,
      )
    ) {
      return s.length > 110 ? `${s.slice(0, 109)}…` : s;
    }
    return "GA4 unavailable";
  }

  if (/gsc|search console/i.test(s)) {
    if (/not configured/i.test(s)) return "Search Console not configured";
    if (/oauth|auth|refresh token|invalid_grant/i.test(s)) {
      return "Search Console OAuth authentication failed";
    }
    if (/permission|access denied|forbidden|403/i.test(s)) {
      return "Search Console site access denied";
    }
    if (/empty|no usable/i.test(s)) {
      return "Search Console returned no usable rows";
    }
    if (/normal|expected|reporting delay|lag/i.test(s)) {
      if (s.length <= 110) {
        return s.replace(/^Google Search Console/i, "Search Console");
      }
      return "Search Console reporting delay within expected range";
    }
    if (/stale|unusually/i.test(s)) {
      return s.length <= 110 ? s : "Search Console data unusually stale";
    }
    if (/timed? ?out/i.test(s)) return "Search Console request timed out";
    if (/retrieval failed|request failed|api/i.test(s)) {
      return "Search Console request failed";
    }
    if (/^Search Console /i.test(s)) {
      return s.length > 110 ? `${s.slice(0, 109)}…` : s;
    }
    return "Search Console unavailable";
  }

  if (/retrieval failed|aggregates unavailable|not configured/i.test(s)) {
    return "A measurement source is unavailable";
  }

  return s.length > 72 ? `${s.slice(0, 71)}…` : s;
}

export function isConfigOrAuthFailure(code: MeasurementHealthCode): boolean {
  return (
    code === "not-configured" ||
    code === "oauth-auth-failed" ||
    code === "property-access-denied" ||
    code === "site-access-denied" ||
    code === "upstream-request-failed" ||
    code === "timeout"
  );
}

export function isHealthyOrEmpty(code: MeasurementHealthCode): boolean {
  return code === "ok" || code === "empty" || code === "fixture";
}
