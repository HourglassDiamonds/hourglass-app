/** Hourglass advisory clarity floor — interpretation only; does not alter lab grades. */
export const HOURGLASS_CLARITY_STANDARDS = {
  /** Grades outside what Hourglass typically recommends for client sourcing. */
  excludedGrades: ["I1", "I2", "I3"] as const,
  advisory:
    "This recommendation reflects Hourglass clarity standards for client guidance — not a dispute of the laboratory grade on the report.",
} as const;

export function isBelowHourglassClarityStandard(clarity?: string): boolean {
  const c = (clarity ?? "").trim().toUpperCase();
  return c === "I1" || c === "I2" || c === "I3";
}

export function hourglassClarityStandardsNote(clarity?: string): string | null {
  if (!isBelowHourglassClarityStandard(clarity)) return null;
  return HOURGLASS_CLARITY_STANDARDS.advisory;
}
