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
  | "diamond_studio_editorial_contact"
  | "band_metal_changed"
  | "band_width_changed"
  | "studio_snapshot_created"
  | "studio_snapshot_shared"
  | "studio_share_card_created"
  | "studio_view_emailed";

export type DiamondStudioDeviceType = "mobile" | "desktop";

export type DiamondStudioEngagementTrigger = "time" | "interactions";

export type DiamondStudioEventProperties = {
  shape: string;
  carat: number;
  fingerSize: number;
  bandWidth: number;
  skinTone: string;
  metal: string;
  orientation: string;
  coveragePercent: number;
  coverageZone: string;
  deviceType: DiamondStudioDeviceType;
  /** consultation_cta_clicked */
  source?: string;
  placement?: string;
  /** studio_session_engaged */
  engagementTrigger?: DiamondStudioEngagementTrigger;
  /** band_metal_changed */
  previousMetal?: string;
  /** band_width_changed */
  previousBandWidth?: number;
  /** studio_snapshot_created / studio_snapshot_shared / studio_share_card_created / studio_view_emailed */
  snapshotVariant?: "clean" | "card";
  shareMethod?: "web_share" | "download" | "clipboard";
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

const GA_PII_KEYS = [
  "email",
  "name",
  "firstName",
  "lastName",
  "phone",
  "emailHash",
  "email_hash",
  "recipientEmail",
  "recipient_email",
] as const;

/** Analytics payload contract — never include recipient identity. */
export function studioViewEmailedHasPii(
  properties: Record<string, unknown>,
): boolean {
  for (const key of GA_PII_KEYS) {
    if (key in properties) return true;
  }
  for (const value of Object.values(properties)) {
    if (typeof value === "string" && /[^\s@]+@[^\s@]+\.[^\s@]+/.test(value)) {
      return true;
    }
  }
  return false;
}
