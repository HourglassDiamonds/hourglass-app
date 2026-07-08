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

export const ALL_SHAPE_IDS: readonly ShapeId[] = [
  "round",
  "oval",
  "cushion",
  "princess",
  "marquise",
  "pear",
  "emerald",
  "radiant",
  "asscher",
] as const;
