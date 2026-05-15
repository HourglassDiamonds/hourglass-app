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

function canSend(): boolean {
  return Boolean(GA_MEASUREMENT_ID && typeof window !== "undefined");
}

/** GA4 page_view via config (App Router client navigations). */
export function pageview(url: string): void {
  if (!canSend()) return;
  try {
    window.gtag?.("config", GA_MEASUREMENT_ID!, {
      page_path: url,
      anonymize_ip: true,
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
