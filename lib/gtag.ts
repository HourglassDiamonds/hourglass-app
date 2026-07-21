import { buildAnalyticsPageViewParams } from "@/lib/analytics/sanitize-page-location";

export function resolveGaMeasurementId(): string | undefined {
  const id = process.env.NEXT_PUBLIC_GA_ID?.trim();
  return id || undefined;
}

/** Measurement ID when set at build time — may be present even when client GA is disabled. */
export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_ID;

type GtagCommand = "config" | "event" | "js" | "set";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (
      command: GtagCommand,
      targetId: string | Date,
      config?: Record<string, unknown>,
    ) => void;
  }
}

/** True only after the analytics loader arms client GA (production / explicit opt-in). */
let clientGaArmed = false;

/** Last dispatched page_path — prevents duplicate sends for the same effective URL. */
let lastPageViewPath: string | null = null;

/** Test helper — resets arm + page-view dedupe. */
export function resetClientAnalyticsForTests(): void {
  clientGaArmed = false;
  lastPageViewPath = null;
}

/**
 * Install dataLayer/gtag stub and mark client analytics as allowed to send.
 * Called from the GA loader when server-side enablement is true.
 */
export function armClientAnalytics(): void {
  clientGaArmed = true;
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer || [];
  if (typeof window.gtag !== "function") {
    window.gtag = function gtag() {
      // Standard gtag stub — real library drains Arguments objects from dataLayer.
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer!.push(arguments);
    } as Window["gtag"];
  }
}

/**
 * One-time gtag config with automatic page views disabled.
 * Manual page_view events are the sole application dispatcher.
 */
export function configureGaWithoutAutomaticPageViews(
  measurementId: string,
): void {
  armClientAnalytics();
  if (typeof window === "undefined" || typeof window.gtag !== "function") {
    return;
  }
  try {
    window.gtag("js", new Date());
    window.gtag("config", measurementId, {
      send_page_view: false,
      anonymize_ip: true,
    });
  } catch {
    /* blocked or unavailable */
  }
}

function canSend(): boolean {
  return Boolean(
    clientGaArmed &&
      resolveGaMeasurementId() &&
      typeof window !== "undefined" &&
      typeof window.gtag === "function",
  );
}

/**
 * Manual GA4 page_view (sole application dispatcher).
 * Call with App Router pathname + raw search string (unsanitized query OK).
 * Does not call gtag('config') for navigations.
 */
export function pageview(pathname: string, search?: string): void {
  if (!canSend()) return;
  try {
    const { page_path, page_location } = buildAnalyticsPageViewParams(
      pathname,
      search,
    );
    if (page_path === lastPageViewPath) return;
    lastPageViewPath = page_path;
    window.gtag?.("event", "page_view", {
      page_path,
      page_location,
    });
  } catch {
    /* blocked or unavailable */
  }
}

/** GA4 custom event. */
export function event(
  action: string,
  params?: Record<string, string | number | boolean>,
): void {
  if (!canSend()) return;
  try {
    window.gtag?.("event", action, params ?? {});
  } catch {
    /* blocked or unavailable */
  }
}
