/**
 * Presentation-only color grade analysis — preference context, not penalties.
 */

const LETTER_TO_INDEX: Record<string, number> = {};
for (let i = 0; i < 23; i++) {
  LETTER_TO_INDEX[String.fromCharCode(68 + i)] = i;
}

/** D = 0 … L = 8 … Z = 22 */
export const COLOR_INDEX_L = 8;

export type ColorPreferenceImpact = "None" | "Slight" | "Moderate" | "Significant";

export function worstColorLetterIndex(color?: string | null): number | null {
  const raw = color?.trim();
  if (!raw) return null;

  const upper = raw.toUpperCase();
  if (/FANCY|COLORED|COLOUR|PINK|BLUE|YELLOW|BROWN|CHAMPAGNE/.test(upper)) {
    return null;
  }

  const rangeMatch = upper.match(/\b([D-Z])\s*(?:TO|[-–/])\s*([D-Z])\b/);
  if (rangeMatch) {
    const a = LETTER_TO_INDEX[rangeMatch[1]!];
    const b = LETTER_TO_INDEX[rangeMatch[2]!];
    if (a !== undefined && b !== undefined) return Math.max(a, b);
  }

  const singles = [...upper.matchAll(/\b([D-Z])\b/g)];
  if (singles.length === 0) return null;

  let worst = -1;
  for (const match of singles) {
    const idx = LETTER_TO_INDEX[match[1]!];
    if (idx !== undefined && idx > worst) worst = idx;
  }
  return worst >= 0 ? worst : null;
}

/** D–I = None, J–L = Slight (includes K), M–N = Moderate, O–P+ = Significant */
export function colorPreferenceImpact(
  color?: string | null,
): ColorPreferenceImpact {
  const worst = worstColorLetterIndex(color);
  if (worst === null || worst <= 5) return "None";
  if (worst <= 8) return "Slight";
  if (worst <= 10) return "Moderate";
  return "Significant";
}

export function colorPreferenceImpactLabel(
  impact: ColorPreferenceImpact,
): string {
  return impact;
}

export function colorPreferenceProfileLabel(
  impact: ColorPreferenceImpact,
): string | null {
  switch (impact) {
    case "None":
      return null;
    case "Slight":
      return "Color Profile";
    case "Moderate":
      return "Warm Color Profile";
    case "Significant":
      return "Distinctly Warm Color Profile";
  }
}

/** L+ — suppress broad “of diamonds we typically evaluate” percentile wording. */
export function suppressesBroadPercentileForColor(color?: string | null): boolean {
  const worst = worstColorLetterIndex(color);
  return worst !== null && worst >= COLOR_INDEX_L;
}

/** @deprecated Use suppressesBroadPercentileForColor — not a rejection signal. */
export function isLowColorGrade(color?: string | null): boolean {
  return suppressesBroadPercentileForColor(color);
}

/** Moderate or distinctly warm market color ranges (M–N and warmer). */
export function isWarmMarketColor(color?: string | null): boolean {
  const impact = colorPreferenceImpact(color);
  return impact === "Moderate" || impact === "Significant";
}

export const WARM_COLOR_PREFERENCE_CONTEXT_COPY =
  "This diamond has a warmer color profile that may be desirable for clients seeking vintage character or intentional warmth. Clients seeking a bright white appearance may prefer a higher color grade.";

export function warmColorPreferenceContextCopy(
  color?: string | null,
): string | null {
  const impact = colorPreferenceImpact(color);
  if (impact === "Moderate" || impact === "Significant") {
    return WARM_COLOR_PREFERENCE_CONTEXT_COPY;
  }
  return null;
}

export function formatColorForSummary(color?: string | null): string | null {
  const raw = color?.trim();
  if (!raw) return null;
  if (/range/i.test(raw)) return raw.replace(/\s+range$/i, "").trim();
  return raw;
}
