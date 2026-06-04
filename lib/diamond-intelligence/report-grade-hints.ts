/**
 * Interpretation-layer grade hints from report text — not part of core field extraction.
 */

export type ReportGradeHints = {
  color?: string;
  clarity?: string;
  /** Natural/fancy colored diamond context detected in text. */
  fancyColor?: boolean;
  coloredDiamondReport?: boolean;
};

const CLARITY_RE =
  /\b(?:clarity\s*(?:grade)?|clarity\s+characteristics?)\b[\s:.\-]*([A-Z][A-Z0-9\s]{0,12})/i;

const CLARITY_TOKEN =
  /\b(FL|IF|VVS\s*1|VVS\s*2|VVS1|VVS2|VS\s*1|VS\s*2|VS1|VS2|SI\s*1|SI\s*2|SI1|SI2|I\s*1|I\s*2|I\s*3|I1|I2|I3)\b/i;

const COLOR_GRADE_RE =
  /\b(?:color|colour)\s+grade\s+([D-Z](?:\s*[-]?\s*\d+)?)\b/i;

function normalizeClarity(raw: string): string {
  return raw.replace(/\s+/g, "").toUpperCase();
}

function normalizeColor(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

/** Parse color/clarity from PDF text snippet — best-effort, never throws. */
export function parseReportGradeHints(text: string): ReportGradeHints {
  const hints: ReportGradeHints = {};
  const t = text.trim();
  if (!t) return hints;

  if (
    /natural\s+colored\s+diamond|fancy\s+(?:vivid|intense|light)|color\s+origin/i.test(
      t,
    )
  ) {
    hints.fancyColor = true;
    hints.coloredDiamondReport = true;
  }

  const clarityBlock = t.match(CLARITY_RE)?.[1];
  const claritySource = clarityBlock ?? t.slice(0, 4000);
  const clarityMatch = claritySource.match(CLARITY_TOKEN);
  if (clarityMatch?.[1]) {
    hints.clarity = normalizeClarity(clarityMatch[1]);
  }

  const colorMatch = t.match(COLOR_GRADE_RE)?.[1];
  if (colorMatch) {
    const c = normalizeColor(colorMatch);
    if (c.length >= 1 && c.length <= 8) hints.color = c;
  }

  return hints;
}

export type ClaritySeverity = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

/** Higher = more buyer-relevant clarity concern. */
export function claritySeverity(clarity?: string): ClaritySeverity {
  const c = normalizeClarity(clarity ?? "");
  if (!c) return 0;
  if (c === "FL" || c === "IF") return 0;
  if (c.startsWith("VVS")) return 1;
  if (c.startsWith("VS")) return 2;
  if (c === "SI1") return 3;
  if (c === "SI2") return 4;
  if (c === "I1") return 6;
  if (c === "I2") return 7;
  if (c === "I3") return 8;
  return 2;
}

export function fluorescenceConcern(fluorescence: string): number {
  const f = fluorescence.trim().toLowerCase();
  if (!f || f === "none") return 0;
  if (f.includes("very strong")) return 3;
  if (f.includes("strong")) return 2;
  if (f.includes("medium")) return 1;
  return 0;
}
