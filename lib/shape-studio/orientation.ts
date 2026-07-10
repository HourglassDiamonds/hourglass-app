import type { ShapeId } from "./types";

/**
 * Face-up stone orientation for elongated shapes.
 * Mirrors Diamond Size Studio's N/S | E/W control semantics.
 */
export type StoneOrientation = "ns" | "ew";

/** Shapes where orientation materially changes presentation. */
export const ORIENTABLE_SHAPES: readonly ShapeId[] = [
  "oval",
  "radiant",
  "emerald",
  "pear",
  "marquise",
] as const;

const ORIENTABLE = new Set<ShapeId>(ORIENTABLE_SHAPES);

export function shapeSupportsOrientation(shape: ShapeId): boolean {
  return ORIENTABLE.has(shape);
}

/**
 * Effective orientation for rendering. Non-orientable shapes always N/S
 * (no rotation), while the caller's preference may still be retained.
 */
export function effectiveOrientation(
  shape: ShapeId,
  preference: StoneOrientation,
): StoneOrientation {
  return shapeSupportsOrientation(shape) ? preference : "ns";
}
