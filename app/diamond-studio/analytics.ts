import { event as gtagEvent } from "@/lib/gtag";

export type DiamondStudioEventName =
  | "diamond_studio_view"
  | "carat_changed"
  | "finger_size_changed"
  | "shape_selected"
  | "skin_tone_selected"
  | "orientation_changed"
  | "coverage_zone_changed"
  | "consultation_cta_clicked"
  | "studio_session_engaged"
  | "home_clicked"
  | "diamond_studio_share"
  | "diamond_studio_configuration_loaded"
  | "diamond_studio_editorial_contact";

export type DiamondStudioDeviceType = "mobile" | "desktop";

export type DiamondStudioEngagementTrigger = "time" | "interactions";

export type DiamondStudioEventProperties = {
  shape: string;
  carat: number;
  fingerSize: number;
  bandWidth: number;
  skinTone: string;
  orientation: string;
  coveragePercent: number;
  coverageZone: string;
  deviceType: DiamondStudioDeviceType;
  /** consultation_cta_clicked */
  source?: string;
  placement?: string;
  /** studio_session_engaged */
  engagementTrigger?: DiamondStudioEngagementTrigger;
};

export function trackDiamondStudioEvent(
  eventName: DiamondStudioEventName,
  properties: DiamondStudioEventProperties,
): void {
  if (typeof window === "undefined") return;

  try {
    gtagEvent(eventName, properties as Record<string, string | number>);
  } catch {
    /* provider missing or blocked — fail silently */
  }
}
