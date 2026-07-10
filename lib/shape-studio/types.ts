export type ShapeId =
  | "round"
  | "oval"
  | "cushion"
  | "princess"
  | "marquise"
  | "pear"
  | "emerald"
  | "radiant"
  | "asscher";

export type StudioMode = "single" | "compare";

export type CompareSlotId = "a" | "b";

/** Phone QR capture path — guides mobile copy; does not change upload API. */
export type CaptureMode = "known-size" | "card-scale";

/**
 * Calibration context for the current hand photo.
 * Drives trust copy and scale path — not automatic card measurement or sizing.
 * Maps from CaptureMode / desktop upload; independent of hardware.
 */
export type PhotoScaleSource = "upload" | "known-size" | "card-reference";

export function photoScaleSourceFromCaptureMode(
  mode: CaptureMode,
): PhotoScaleSource {
  return mode === "card-scale" ? "card-reference" : "known-size";
}

export const CAPTURE_MODES: readonly CaptureMode[] = [
  "known-size",
  "card-scale",
] as const;

export function parseCaptureMode(value: string | null | undefined): CaptureMode {
  if (value === "card-scale") return "card-scale";
  return "known-size";
}

export function withCaptureMode(captureUrl: string, mode: CaptureMode): string {
  try {
    const url = new URL(captureUrl);
    url.searchParams.set("mode", mode);
    return url.toString();
  } catch {
    const join = captureUrl.includes("?") ? "&" : "?";
    return `${captureUrl}${join}mode=${mode}`;
  }
}

/** Overlay center as percentage of stage width/height (0–100). */
export type OverlayPosition = {
  xPct: number;
  yPct: number;
};

/**
 * Point in displayed image-content space (object-fit: contain), not letterbox.
 * Survives responsive layout changes when recomputed against the content rect.
 */
export type ContentPoint = {
  u: number;
  v: number;
};

/** Phase 2A guided card/finger marking — no ring-size estimate. */
export type GuidedCalibrationStep =
  | "photo-ready"
  | "mark-card"
  | "confirm-card"
  | "mark-finger"
  | "calibrated-preview";

/**
 * Authoritative card-reference calibration inputs only.
 * Derive pixelsPerMm and finger midpoint; do not store estimates.
 */
export type CardCalibrationState = {
  step: GuidedCalibrationStep;
  cardA: ContentPoint | null;
  cardB: ContentPoint | null;
  fingerL: ContentPoint | null;
  fingerR: ContentPoint | null;
};

export type DiamondSlotState = {
  shape: ShapeId;
  carat: number;
  /** Stage % — used for known-size / upload previews. */
  position: OverlayPosition;
  /**
   * Content-normalized center when card-calibrated.
   * Takes precedence over `position` while calibrated.
   */
  contentPosition?: ContentPoint;
};

export const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const ACCEPTED_IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];
