import { event as gtagEvent } from "@/lib/gtag";
import {
  ATTRIBUTION_MAX,
  recordConsultationCtaLocation,
  sanitizeAttributionValue,
} from "@/lib/attribution";

export const CONSULTATION_CTA_EVENT = "consultation_cta_clicked" as const;
export const CONSULTATION_DESTINATION = "/concierge" as const;

export type BuildConciergeHrefInput = {
  tool?: string | null;
  content?: string | null;
  /** Extra query params preserved as-is after sanitization (never PII). */
  params?: Record<string, string | null | undefined>;
};

/** True when href is bare /concierge (optionally with empty query). */
export function isBareConciergeHref(href: unknown): boolean {
  if (typeof href !== "string") return false;
  const trimmed = href.trim();
  if (!trimmed) return true;
  try {
    const url = new URL(trimmed, "https://hourglass.local");
    if (url.pathname !== CONSULTATION_DESTINATION) return false;
    return [...url.searchParams.keys()].length === 0;
  } catch {
    return trimmed === CONSULTATION_DESTINATION || trimmed === `${CONSULTATION_DESTINATION}?`;
  }
}

function setSanitizedParam(
  params: URLSearchParams,
  key: string,
  value: string | null | undefined,
  maxLength: number,
): void {
  const sanitized = sanitizeAttributionValue(value, maxLength);
  if (sanitized) params.set(key, sanitized);
}

/**
 * Shared Concierge URL builder — real attributed href before click.
 * Safe for SSR (no window). Falls back to /concierge.
 */
export function buildConciergeHref(input: BuildConciergeHrefInput = {}): string {
  const params = new URLSearchParams();

  if (input.params) {
    for (const [key, raw] of Object.entries(input.params)) {
      if (!key || raw == null) continue;
      const max =
        key.startsWith("utm_")
          ? ATTRIBUTION_MAX.utm
          : key === "content" || key === "article" || key === "slug"
            ? ATTRIBUTION_MAX.content
            : key === "tool" || key === "source"
              ? ATTRIBUTION_MAX.tool
              : ATTRIBUTION_MAX.cta;
      setSanitizedParam(params, key, raw, max);
    }
  }

  // Explicit tool/content win over params of the same name.
  setSanitizedParam(params, "tool", input.tool, ATTRIBUTION_MAX.tool);
  setSanitizedParam(params, "content", input.content, ATTRIBUTION_MAX.content);

  const qs = params.toString();
  return qs ? `${CONSULTATION_DESTINATION}?${qs}` : CONSULTATION_DESTINATION;
}

/** Canonical GA4 consultation CTA — call on click before navigation. */
export function trackConsultationCtaClicked(location: string): void {
  if (typeof window === "undefined") return;

  recordConsultationCtaLocation(location);

  const page_path =
    typeof window.location?.pathname === "string"
      ? window.location.pathname
      : "";

  try {
    gtagEvent(CONSULTATION_CTA_EVENT, {
      location,
      destination: CONSULTATION_DESTINATION,
      page_path,
    });
  } catch {
    /* provider missing or blocked */
  }
}
