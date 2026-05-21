import { event as gtagEvent } from "@/lib/gtag";

export const CONSULTATION_CTA_EVENT = "consultation_cta_clicked" as const;
export const CONSULTATION_DESTINATION = "/concierge" as const;

/** Canonical GA4 consultation CTA — call on click before navigation. */
export function trackConsultationCtaClicked(location: string): void {
  if (typeof window === "undefined") return;

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
