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
