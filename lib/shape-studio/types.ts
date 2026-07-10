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
 * Point normalized over the full oriented source image (0–1).
 * Equivalent to content-normalized points over the full contained image —
 * do not rescale existing values when treating them as source coordinates.
 */
export type ContentPoint = {
  u: number; // 0–1 across oriented source width
  v: number; // 0–1 across oriented source height
};

/** Alias clarifying source-normalized semantics; same values as ContentPoint. */
export type SourcePoint = ContentPoint;

/**
 * Authoritative framing crop over the oriented source image.
 * Crop height is derived from source size + viewer aspect — not stored.
 */
export type FramingState = {
  centerU: number;
  centerV: number;
  /** Crop width as a fraction of oriented source width. */
  cropWidthU: number;
};

/**
 * Public Scaled Preview guided steps (Phase 3B2).
 * Legacy aliases `confirm-card` / `mark-finger` normalize to the live flow
 * and must not be rendered as separate public screens.
 */
export type GuidedCalibrationStep =
  | "photo-ready"
  | "mark-card"
  | "mark-seat"
  | "frame"
  | "calibrated-preview"
  /** @deprecated Never render — treat as mark-seat when encountered. */
  | "confirm-card"
  /** @deprecated Prefer mark-seat. */
  | "mark-finger";

/** Map legacy step names onto the public Scaled Preview flow. */
export function normalizeGuidedStep(
  step: GuidedCalibrationStep,
): Exclude<GuidedCalibrationStep, "confirm-card" | "mark-finger"> {
  if (step === "confirm-card" || step === "mark-finger") return "mark-seat";
  if (step === "photo-ready") return "mark-card";
  return step;
}

/**
 * Authoritative card-reference calibration inputs only.
 * Derive pixelsPerMm and finger midpoint; do not store estimates.
 * Point values are source-normalized over the oriented image.
 */
export type CardCalibrationState = {
  step: GuidedCalibrationStep;
  cardA: ContentPoint | null;
  cardB: ContentPoint | null;
  fingerL: ContentPoint | null;
  fingerR: ContentPoint | null;
  /** Set when entering the frame step; reset with a replacement photo. */
  framing: FramingState | null;
  /** Non-blocking hint when suggested crop cannot fully exclude the card. */
  cardStillInFrame?: boolean;
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
