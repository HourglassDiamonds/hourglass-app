import { event as gtagEvent } from "@/lib/gtag";

export type DiamondStudioEventName =
  | "diamond_studio_view"
  | "carat_changed"
  | "finger_size_changed"
  | "shape_selected"
  | "skin_tone_selected"
  | "orientation_changed"
  | "coverage_zone_changed"
  | "home_clicked";

export type DiamondStudioDeviceType = "mobile" | "desktop";

export type DiamondStudioEventProperties = {
  shape: string;
  carat: number;
  fingerSize: number;
  skinTone: string;
  orientation: string;
  coveragePercent: number;
  coverageZone: string;
  deviceType: DiamondStudioDeviceType;
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
