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
 * Drives trust copy only — not automatic card measurement or sizing.
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

export type DiamondSlotState = {
  shape: ShapeId;
  carat: number;
  position: OverlayPosition;
};

export type CalibrationState = {
  ringSize: number;
};

export const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const ACCEPTED_IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];
