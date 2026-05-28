import type { CalibrationReportFields, ReportFieldKey } from "./types";
import { REPORT_FIELD_KEYS } from "./types";

export const FIELD_LABELS: Record<ReportFieldKey, string> = {
  shape: "Shape",
  carat: "Carat weight",
  measurements: "Measurements (mm)",
  tablePercent: "Table %",
  depthPercent: "Depth %",
  crownAngle: "Crown angle (°)",
  pavilionAngle: "Pavilion angle (°)",
  lowerHalfPercent: "Lower girdle / lower half %",
  starLengthPercent: "Star length %",
  girdle: "Girdle (as on report)",
  culet: "Culet (as on report)",
  polish: "Polish (as on report)",
  symmetry: "Symmetry (as on report)",
  fluorescence: "Fluorescence (as on report)",
  cutGrade: "Cut grade (as on report)",
};

export const METADATA_LABELS = {
  lab: "Laboratory",
  reportNumber: "Report number",
  reportUrl: "Report URL (optional)",
  reportSource: "Report source",
  stoneType: "Stone type",
} as const;

export function emptyReportFields(
  overrides?: Partial<CalibrationReportFields>,
): CalibrationReportFields {
  const base = Object.fromEntries(
    REPORT_FIELD_KEYS.map((k) => [k, ""]),
  ) as CalibrationReportFields;
  return { ...base, ...overrides };
}

/** Ensure every review/scoring field is a string (never undefined) in API + client state. */
export function finalizeExtractionFields(
  fields: Partial<CalibrationReportFields> | CalibrationReportFields,
): CalibrationReportFields {
  const out = emptyReportFields();
  for (const key of REPORT_FIELD_KEYS) {
    const raw = fields[key];
    out[key] = typeof raw === "string" ? raw.trim() : "";
  }
  // Hard guard: fluorescence must be whitelisted/normalized; missing is better than wrong.
  out.fluorescence = normalizeFluorescenceValue(out.fluorescence);
  // Hard guard: finish/cut values must be whitelisted; missing is better than wrong.
  out.polish = normalizeFinishGrade(out.polish);
  out.symmetry = normalizeFinishGrade(out.symmetry);
  out.cutGrade = normalizeFinishGrade(out.cutGrade);
  return out;
}

export function isRoundBrilliantShape(shape: string): boolean {
  const n = shape.trim().toLowerCase();
  return n.includes("round") && (n.includes("brilliant") || n === "round");
}

const FLUORESCENCE_COLOR_QUALIFIERS = ["blue", "yellow", "white"] as const;

function titleCaseWords(words: string): string {
  return words
    .toLowerCase()
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function canonicalFluorescenceStrength(strength: string): string {
  return titleCaseWords(strength.trim());
}

function extractFluorescenceFromNoisyText(raw: string): string {
  const norm = raw.replace(/\s+/g, " ").replace(/[|]/g, "I").trim();
  const patterns: Array<{ re: RegExp; value: string }> = [
    { re: /\bvery\s+strong\s+blue\b/i, value: "Very Strong Blue" },
    { re: /\bmedium\s+blue\b/i, value: "Medium Blue" },
    { re: /\bstrong\s+blue\b/i, value: "Strong Blue" },
    { re: /\bfaint\s+blue\b/i, value: "Faint Blue" },
    { re: /\bvery\s+strong\b/i, value: "Very Strong" },
    { re: /\bmedium\b/i, value: "Medium" },
    { re: /\bstrong\b/i, value: "Strong" },
    { re: /\bfaint\b/i, value: "Faint" },
    { re: /\bnone\b/i, value: "None" },
  ];
  for (const { re, value } of patterns) {
    if (re.test(norm)) return value;
  }
  return "";
}

function normalizeFluorescenceValue(raw: string): string {
  const s = raw.trim();
  if (!s) return "";

  const normalized = s
    .replace(/\s+/g, " ")
    .replace(/[|]/g, "I")
    .trim();

  const lower = normalized.toLowerCase();

  if (
    lower === "none" ||
    lower === "faint" ||
    lower === "medium" ||
    lower === "strong" ||
    lower === "very strong"
  ) {
    return canonicalFluorescenceStrength(normalized);
  }

  for (const color of FLUORESCENCE_COLOR_QUALIFIERS) {
    const colored = normalized.match(
      new RegExp(`^(none|faint|medium|strong|very strong)\\s+${color}\\b`, "i"),
    );
    if (colored) {
      return `${canonicalFluorescenceStrength(colored[1]!)} ${color.charAt(0).toUpperCase()}${color.slice(1)}`;
    }
  }

  const fromNoise = extractFluorescenceFromNoisyText(normalized);
  if (fromNoise) return fromNoise;

  const hasLetters = /[a-z]/i.test(normalized);
  const tooLong = normalized.length > 48;
  const tooManyWords = normalized.split(" ").length > 8;
  const symbolHeavy =
    normalized.replace(/[a-z0-9 ]/gi, "").length >= 4 ||
    /[/\\[\]{}<>]/.test(normalized);

  if (!hasLetters || tooLong || tooManyWords || symbolHeavy) return "";

  return "";
}

const FINISH_GRADE_CANONICAL: Record<string, string> = {
  ideal: "Ideal",
  excellent: "Excellent",
  "very good": "Very Good",
  good: "Good",
  fair: "Fair",
  poor: "Poor",
};

function isEducationalScaleFragment(text: string): boolean {
  const lower = text.toLowerCase();
  const scaleHits = ["poor", "fair", "good", "very good", "excellent"].filter(
    (g) => lower.includes(g),
  );
  if (scaleHits.length >= 3) return true;
  return /\bpoor\b[\s,/-]*\bfair\b[\s,/-]*\bgood\b/i.test(lower);
}

function normalizeFinishGrade(raw: string): string {
  const s = raw.trim().replace(/\s+/g, " ");
  if (!s) return "";
  if (isEducationalScaleFragment(s)) return "";

  const tokens = s.match(/\b(ideal|excellent|very\s+good|good|fair|poor)\b/gi);
  if (!tokens?.length) return "";

  const last = tokens[tokens.length - 1]!.toLowerCase().replace(/\s+/g, " ");
  return FINISH_GRADE_CANONICAL[last] ?? "";
}
