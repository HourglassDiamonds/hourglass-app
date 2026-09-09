/**
 * Fail-closed metal / Cost Parts contract for Geller V5.0 R6.50 task SKUs.
 *
 * Inspected from RepairTaskSKUs.2026-08-26-17-29-10.xlsx:
 * - SKU 1000 Smaller sizing: Cost Parts empty. Labor only. No sourced dwt.
 * - SKU 1008 Larger sizing: Cost Parts $11 with Price Parts $33. No dwt column.
 *   That Cost Parts is the complete published metal/parts for the operation.
 * - SKUs whose Task Desc is "Metals, 14kt Gold, $X–$Y per ounce, Per Pennyweight"
 *   publish Cost Parts per dwt and may be replaced when gold + sourced dwt are given.
 * - Per-gram metal SKUs use a different unit. Do not overlay millidwt.
 *
 * Never add dynamic 14K metal on top of embedded Cost Parts.
 */

export const METAL_SEMANTICS = [
  "labor_only",
  "embedded_parts",
  "per_dwt_14k",
  "per_unit_metal",
] as const;

export type MetalSemanticsKind = (typeof METAL_SEMANTICS)[number];

export const METAL_UNITS = ["none", "per_pennyweight", "per_gram", "other"] as const;

export type MetalUnitKind = (typeof METAL_UNITS)[number];

export function isMetalSemanticsKind(value: unknown): value is MetalSemanticsKind {
  return typeof value === "string" && (METAL_SEMANTICS as readonly string[]).includes(value);
}

export function inferMetalUnit(taskDescription: string): MetalUnitKind {
  const d = taskDescription.toLowerCase();
  if (/per pennyweight/.test(d)) return "per_pennyweight";
  if (/per gram/.test(d)) return "per_gram";
  if (/^metals,/.test(d)) return "other";
  return "none";
}

export function inferMetalSemantics(input: {
  taskDescription: string;
  costPartsCents: number;
  inferredMetalFamily?: string;
}): MetalSemanticsKind {
  const unit = inferMetalUnit(input.taskDescription);
  const d = input.taskDescription.toLowerCase();
  if (unit === "per_pennyweight" && /\b14k|\b14kt/.test(d)) return "per_dwt_14k";
  if (unit === "per_pennyweight" || unit === "per_gram" || unit === "other") {
    return "per_unit_metal";
  }
  if (input.costPartsCents > 0) return "embedded_parts";
  return "labor_only";
}

export function allowsAdditional14kMetal(kind: MetalSemanticsKind): boolean {
  return kind === "labor_only";
}

export function replacesSourcePartsWith14kMetal(kind: MetalSemanticsKind): boolean {
  return kind === "per_dwt_14k";
}

export function blocksDynamicMetalOverlay(kind: MetalSemanticsKind): boolean {
  return kind === "embedded_parts" || kind === "per_unit_metal";
}
