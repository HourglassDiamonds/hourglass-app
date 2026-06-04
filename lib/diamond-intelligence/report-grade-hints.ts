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

const CLARITY_GRADE_PATTERNS: RegExp[] = [
  /\bclarity(?:\s+grade|\s+characteristics)?\s*[:\s]+(FL|IF|VVS\s*[-\s]?1|VVS\s*[-\s]?2|VS\s*[-\s]?1|VS\s*[-\s]?2|SI\s*[-\s]?1|SI\s*[-\s]?2|I\s*[-\s]?1|I\s*[-\s]?2|I\s*[-\s]?3)\b/i,
  /\bclarity\s*[:\s]*\n\s*(FL|IF|VVS\s*[-\s]?1|VVS\s*[-\s]?2|VS\s*[-\s]?1|VS\s*[-\s]?2|SI\s*[-\s]?1|SI\s*[-\s]?2|I\s*[-\s]?1|I\s*[-\s]?2|I\s*[-\s]?3)\b/i,
  /\b(?:clarity|clarity grade)\b[^A-Z0-9\n]{0,24}(FL|IF|VVS1|VVS2|VS1|VS2|SI1|SI2|I1|I2|I3)\b/i,
];

const CLARITY_TOKEN =
  /\b(FL|IF|VVS\s*1|VVS\s*2|VVS1|VVS2|VS\s*1|VS\s*2|VS1|VS2|SI\s*1|SI\s*2|SI1|SI2|I\s*1|I\s*2|I\s*3|I1|I2|I3)\b/i;

const COLOR_GRADE_RE =
  /\b(?:color|colour)\s+grade\s+([D-Z](?:\s*[-]?\s*\d+)?)\b/i;

export function normalizeClarityGrade(raw: string): string {
  const c = raw.replace(/\s+/g, "").toUpperCase().replace(/-/g, "");
  if (/^I[123]$/.test(c)) return c;
  if (/^VVS[12]$/.test(c)) return c;
  if (/^VS[12]$/.test(c)) return c;
  if (/^SI[12]$/.test(c)) return c;
  if (c === "FL" || c === "IF") return c;
  return c;
}

function normalizeColor(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

function parseClarityFromText(text: string): string | undefined {
  for (const re of CLARITY_GRADE_PATTERNS) {
    const m = text.match(re);
    if (m?.[1]) return normalizeClarityGrade(m[1]);
  }

  const clarityIdx = text.search(/\bclarity\b/i);
  if (clarityIdx >= 0) {
    const window = text.slice(clarityIdx, clarityIdx + 80);
    const near = window.match(CLARITY_TOKEN);
    if (near?.[1]) return normalizeClarityGrade(near[1]);
  }

  const fourCs = text.match(
    /\bcolor\s+grade\s+[D-Z]\b[\s\S]{0,120}?\bclarity[\s\S]{0,40}?\b(I\s*[123]|SI\s*[12]|VS\s*[12]|VVS\s*[12]|FL|IF)\b/i,
  );
  if (fourCs?.[1]) return normalizeClarityGrade(fourCs[1]);

  return undefined;
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

  const clarity = parseClarityFromText(t);
  if (clarity) hints.clarity = clarity;

  const colorMatch = t.match(COLOR_GRADE_RE)?.[1];
  if (colorMatch) {
    const c = normalizeColor(colorMatch);
    if (c.length >= 1 && c.length <= 8) hints.color = c;
  }

  return hints;
}

export type ClaritySeverity = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

/** Higher = more buyer-relevant clarity concern. */
export function claritySeverity(clarity?: string): ClaritySeverity {
  const c = normalizeClarityGrade(clarity ?? "");
  if (!c) return 0;
  if (c === "FL" || c === "IF") return 0;
  if (c.startsWith("VVS")) return 1;
  if (c.startsWith("VS")) return 2;
  if (c === "SI1") return 3;
  if (c === "SI2") return 4;
  if (c === "I1") return 7;
  if (c === "I2") return 9;
  if (c === "I3") return 10;
  return 2;
}

export function fluorescenceConcern(fluorescence: string): number {
  const f = fluorescence.trim().toLowerCase();
  if (!f || f === "none") return 0;
  if (f.includes("very strong")) return 4;
  if (f.includes("strong")) return 3;
  if (f.includes("medium")) return 2;
  if (f.includes("faint") || f.includes("slight")) return 1;
  return 1;
}

export type ClarityRiskFloor = "Moderate" | "Elevated" | "High";

/** Minimum risk band when clarity is known — consumer risk dominates optics. */
export function clarityRiskFloor(clarity?: string): ClarityRiskFloor | null {
  const c = normalizeClarityGrade(clarity ?? "");
  if (c === "I3" || c === "I2") return "High";
  if (c === "I1") return "Elevated";
  if (c === "SI2") return "Moderate";
  return null;
}

export type RecommendationCeiling =
  | "Strong Candidate"
  | "Worth Reviewing"
  | "Compare Carefully"
  | "Not Recommended";

/** Maximum (best) overall recommendation allowed for a clarity grade. Null = no cap. */
export function clarityRecommendationCeiling(
  clarity?: string,
): RecommendationCeiling | null {
  const c = normalizeClarityGrade(clarity ?? "");
  if (!c) return null;
  if (c === "I3") return "Not Recommended";
  if (c === "I2") return "Compare Carefully";
  if (c === "I1") return "Worth Reviewing";
  return null;
}
