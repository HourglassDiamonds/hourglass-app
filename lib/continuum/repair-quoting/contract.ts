/**
 * Locked Geller Blue Book / Hourglass repair-pricing contract.
 * Founder-confirmed 2026-09-09. Do not treat Geller bold retail as cost.
 */

export const GELLER_BLUE_BOOK = {
  family: "geller_blue_book",
  version: "5.0",
  release: "6.50",
  editionLabel: "Geller Blue Book Version 5.0 Release 6.50",
  exportFile: "RepairTaskSKUs.2026-08-26-17-29-10(1).xlsx",
} as const;

export const GELLER_RETAIL_MEANING = "bold_retail_selling_price" as const;
export const GELLER_COST_BASIS = "geller_cost_columns" as const;

/** Geller loaded-labor step: Cost Labor × 1.25 (employer taxes/benefits). */
export const LABOR_BURDEN_NUMERATOR = 5;
export const LABOR_BURDEN_DENOMINATOR = 4;

/** Hourglass founder policy: 2.5 × fully loaded direct cost, applied once. */
export const HOURGLASS_MARKUP_NUMERATOR = 5;
export const HOURGLASS_MARKUP_DENOMINATOR = 2;

export const LABOR_BURDEN_LABEL = "1.25";
export const HOURGLASS_MARKUP_LABEL = "2.5";

export const UNRESOLVED_FOUNDER_POLICY = {
  rounding: "unresolved",
  minimumRepairCharge: "unresolved",
  expressHourglassRule: "unresolved",
  platinumDynamicMaterial: "unresolved",
} as const;

export function gellerEditionLabel(): string {
  return GELLER_BLUE_BOOK.editionLabel;
}
