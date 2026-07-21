import { SITE_URL } from "@/lib/seo/site-metadata";

/**
 * Campaign parameters allowed on analytics page_path / page_location.
 * Intentionally excludes Google Ads click IDs (gclid, etc.) — current launch
 * attribution uses first-party UTMs + sessionStorage (`lib/attribution.ts`).
 */
export const ANALYTICS_QUERY_ALLOWLIST = [
  "utm_id",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const;

function normalizePathname(pathname: string): string {
  const trimmed = pathname.trim();
  if (!trimmed) return "/";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

/**
 * Build a GA-safe page_path: pathname + allowlisted query params only.
 * Never includes fragments. Never throws. Does not mutate the browser URL.
 * Does not log removed parameter values.
 */
export function sanitizeAnalyticsPagePath(
  pathnameOrUrl: string,
  search?: string,
): string {
  try {
    let pathname = "/";
    let query = "";

    const raw = typeof pathnameOrUrl === "string" ? pathnameOrUrl : "";
    if (!raw && search === undefined) return "/";

    if (/^https?:\/\//i.test(raw)) {
      try {
        const url = new URL(raw);
        pathname = normalizePathname(url.pathname);
        query = url.search.replace(/^\?/, "");
      } catch {
        return "/";
      }
    } else {
      const withoutHash = raw.split("#")[0] ?? "";
      const qIndex = withoutHash.indexOf("?");
      if (qIndex >= 0) {
        pathname = normalizePathname(withoutHash.slice(0, qIndex));
        query = withoutHash.slice(qIndex + 1);
      } else {
        pathname = normalizePathname(withoutHash || "/");
        query =
          typeof search === "string" ? search.replace(/^\?/, "") : "";
      }
    }

    if (!query) return pathname;

    const incoming = new URLSearchParams(query);
    const kept = new URLSearchParams();
    for (const key of ANALYTICS_QUERY_ALLOWLIST) {
      const values = incoming.getAll(key);
      for (const value of values) {
        if (value !== "") kept.append(key, value);
      }
    }

    const qs = kept.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  } catch {
    return "/";
  }
}

/**
 * Absolute page_location for GA4 — same sanitization as page_path.
 * Uses the canonical production origin by default so preview hostnames
 * do not leak into production property hits when intentionally testing.
 */
export function sanitizeAnalyticsPageLocation(
  pathnameOrUrl: string,
  search?: string,
  origin: string = SITE_URL,
): string {
  const path = sanitizeAnalyticsPagePath(pathnameOrUrl, search);
  try {
    const base = origin.replace(/\/$/, "") || SITE_URL.replace(/\/$/, "");
    return `${base}${path.startsWith("/") ? path : `/${path}`}`;
  } catch {
    return `${SITE_URL.replace(/\/$/, "")}/`;
  }
}

export function buildAnalyticsPageViewParams(
  pathname: string,
  search?: string,
  origin: string = SITE_URL,
): { page_path: string; page_location: string } {
  const page_path = sanitizeAnalyticsPagePath(pathname, search);
  const page_location = sanitizeAnalyticsPageLocation(pathname, search, origin);
  return { page_path, page_location };
}

/** Exported for tests — proves allowlist awareness of DI/Concierge keys. */
export const DI_CONCIERGE_SENSITIVE_QUERY_KEYS = [
  "source",
  "lab",
  "report",
  "carat",
  "shape",
  "color",
  "clarity",
  "cut",
  "polish",
  "symmetry",
  "fluorescence",
  "url",
  "vendor",
  "stype",
  "verdict",
  "sid",
  "tool",
  "content",
  "article",
  "slug",
] as const;
