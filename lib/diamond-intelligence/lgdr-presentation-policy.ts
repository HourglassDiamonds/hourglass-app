import type { CalibrationReportFields } from "@/lib/calibration-library/types";
import type { ClientSafeMetadata } from "./client-api";
import { buildNaturalGiaSoftPercentilePresentation } from "./natural-gia-presentation-policy";
import type { NaturalGiaSoftPercentilePresentation } from "./natural-gia-presentation-policy";

export type LgdrEffectiveFinish = {
  cutGrade?: string;
  polish?: string;
  symmetry?: string;
};

export type LgdrPresentationFlags = {
  active: boolean;
  percentileCaution: boolean;
  treatmentDisclosure: boolean;
  effectiveFinish: LgdrEffectiveFinish;
};

const PLACEHOLDER_FINISH =
  /^(?:unknown|not\s*available|unverified|select|n\/a|na|none|null|undefined|—|-+|\.+)$/i;

const FINISH_GRADE_CAPTURE =
  "(Excellent|Very\\s+Good|Good|Fair|Poor)";

function titleCaseFinish(raw: string): string {
  const normalized = raw.trim().replace(/\s+/g, " ");
  if (/^very\s+good$/i.test(normalized)) return "Very Good";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase();
}

function normalizeFinishGrade(raw?: string | null): string {
  return raw?.trim().toLowerCase().replace(/\s+/g, " ") ?? "";
}

function isUsableFinishValue(raw?: string | null): boolean {
  const value = raw?.trim();
  if (!value || PLACEHOLDER_FINISH.test(value)) return false;
  return new RegExp(`^${FINISH_GRADE_CAPTURE}$`, "i").test(
    value.replace(/\s+/g, " "),
  );
}

function isExcellentFinishGrade(raw?: string | null): boolean {
  const value = normalizeFinishGrade(raw);
  if (!value || PLACEHOLDER_FINISH.test(value)) return false;
  return (
    value === "excellent" ||
    value === "ex" ||
    value === "exc" ||
    value.startsWith("excellent")
  );
}

function isFinishGradeBelowExcellent(raw?: string | null): boolean {
  const value = raw?.trim();
  if (!value || PLACEHOLDER_FINISH.test(value)) return false;

  const normalized = normalizeFinishGrade(value);

  if (isExcellentFinishGrade(normalized)) return false;

  if (
    normalized.includes("very good") ||
    normalized === "vg" ||
    normalized === "good" ||
    normalized === "g" ||
    normalized === "fair" ||
    normalized === "f" ||
    normalized === "poor" ||
    normalized === "p"
  ) {
    return true;
  }

  return false;
}

function readFinishGradeFromHint(
  text: string,
  labelPattern: string,
): string | null {
  const patterns = [
    new RegExp(
      `${labelPattern}(?:\\s+grade)?[\\s\\n]*[\\.·…\\s\\-–—]{2,}[\\s\\n]*(${FINISH_GRADE_CAPTURE})\\b`,
      "i",
    ),
    new RegExp(
      `${labelPattern}(?:\\s+grade)?[\\s\\n]+(${FINISH_GRADE_CAPTURE})\\b`,
      "i",
    ),
    new RegExp(
      `${labelPattern}(?:\\s+grade)?[\\s\\n]*[:\\s]+(${FINISH_GRADE_CAPTURE})\\b`,
      "i",
    ),
  ];

  for (const re of patterns) {
    const match = text.match(re);
    if (match?.[1]) return titleCaseFinish(match[1]);
  }

  return null;
}

/** Presentation-only — supplements empty parser fields from report text hint. */
export function extractFinishGradesFromReportTextHint(
  reportTextHint: string,
): LgdrEffectiveFinish {
  const text = reportTextHint.trim();
  if (!text) return {};

  return {
    cutGrade: readFinishGradeFromHint(text, "\\bCut\\b") ?? undefined,
    polish: readFinishGradeFromHint(text, "\\bPolish\\b") ?? undefined,
    symmetry: readFinishGradeFromHint(text, "\\bSymmetry\\b") ?? undefined,
  };
}

export function resolveLgdrFinishGradesForPresentation(
  fields: Partial<CalibrationReportFields>,
  reportTextHint?: string,
): LgdrEffectiveFinish {
  const fromHint = reportTextHint?.trim()
    ? extractFinishGradesFromReportTextHint(reportTextHint)
    : {};

  const pick = (
    fieldValue: string | undefined,
    hintValue: string | undefined,
  ): string | undefined => {
    if (isUsableFinishValue(fieldValue)) return fieldValue!.trim();
    if (isUsableFinishValue(hintValue)) return hintValue!.trim();
    return undefined;
  };

  return {
    cutGrade: pick(fields.cutGrade, fromHint.cutGrade),
    polish: pick(fields.polish, fromHint.polish),
    symmetry: pick(fields.symmetry, fromHint.symmetry),
  };
}

export function isLgdrPresentationContext(
  metadata?: Pick<
    ClientSafeMetadata,
    "lab" | "stoneType" | "parserFamily" | "reportFormat"
  > | null,
  reportTextHint?: string,
): boolean {
  if (!metadata || metadata.lab !== "GIA") return false;
  if (metadata.reportFormat === "gcal-8x") return false;

  const hint = reportTextHint?.trim() ?? "";
  if (/\bLGDR\b/i.test(hint)) return true;
  if (/laboratory[-\s]?grown/i.test(hint)) return true;
  if (metadata.parserFamily?.toLowerCase().includes("lgdr")) return true;
  if (metadata.stoneType === "lab-grown") return true;

  return false;
}

export function isLgdrFinishBelowTripleExcellent(
  finish: LgdrEffectiveFinish,
): boolean {
  for (const grade of [finish.cutGrade, finish.polish, finish.symmetry]) {
    if (!grade?.trim() || PLACEHOLDER_FINISH.test(grade.trim())) continue;
    if (isFinishGradeBelowExcellent(grade)) return true;
  }
  return false;
}

export function detectLgdrPostGrowthTreatmentDisclosure(
  reportTextHint?: string,
): boolean {
  const text = reportTextHint?.replace(/\s+/g, " ").trim() ?? "";
  if (!text) return false;

  return (
    /post[-\s]?growth\s+treatments?\b/i.test(text) ||
    /evidence\s+of\s+post[-\s]?growth\s+treatments?\b/i.test(text) ||
    /indications?\s+of\s+post[-\s]?growth\s+treatment/i.test(text) ||
    /treatments?\s+to\s+change\s+the\s+color/i.test(text)
  );
}

export function lgdrPercentileCautionActive(input: {
  effectiveFinish: LgdrEffectiveFinish;
  reportTextHint?: string;
}): boolean {
  if (detectLgdrPostGrowthTreatmentDisclosure(input.reportTextHint)) {
    return true;
  }
  return isLgdrFinishBelowTripleExcellent(input.effectiveFinish);
}

export function buildLgdrSoftPercentilePresentation(
  displayScore: number | null,
): NaturalGiaSoftPercentilePresentation | null {
  return buildNaturalGiaSoftPercentilePresentation(displayScore);
}

export function buildLgdrFinishJustinParagraphs(
  effectiveFinish: LgdrEffectiveFinish,
): string[] | null {
  const below: string[] = [];
  if (isFinishGradeBelowExcellent(effectiveFinish.cutGrade)) {
    below.push("cut");
  }
  if (isFinishGradeBelowExcellent(effectiveFinish.polish)) {
    below.push("polish");
  }
  if (isFinishGradeBelowExcellent(effectiveFinish.symmetry)) {
    below.push("symmetry");
  }
  if (below.length === 0) return null;

  const list =
    below.length === 1
      ? below[0]!
      : below.length === 2
        ? `${below[0]} and ${below[1]}`
        : `${below.slice(0, -1).join(", ")}, and ${below.at(-1)}`;

  return [
    `For round brilliants, I normally begin with Triple Excellent finish — Excellent cut, polish, and symmetry. This report shows ${list} below Excellent, which I would want to confirm in person before getting too enthusiastic.`,
    "Very Good finish can still look attractive, but it is not the standard I use when sourcing for clients who want maximum light performance whenever possible.",
  ];
}

export function buildLgdrTreatmentJustinParagraphs(): string[] {
  return [
    "The report notes evidence of post-growth treatment to change the color. That is a material detail I would not gloss over.",
    "Treated color is not the same as as-grown color — I would want to confirm face-up appearance, stability, and how the stone compares to untreated alternatives before treating this as a finished recommendation.",
  ];
}

export function applyLgdrJustinPerspectiveAddenda(input: {
  baseParagraphs: string[];
  effectiveFinish: LgdrEffectiveFinish;
  reportTextHint?: string;
  primaryLimitingFactorKey: string;
  recommendationBand: string;
}): string[] {
  let result = input.baseParagraphs;

  if (detectLgdrPostGrowthTreatmentDisclosure(input.reportTextHint)) {
    result = [...buildLgdrTreatmentJustinParagraphs(), ...result];
  }

  const finishParas = buildLgdrFinishJustinParagraphs(input.effectiveFinish);
  if (finishParas?.length) {
    const enthusiasticNone =
      input.primaryLimitingFactorKey === "none" &&
      (input.recommendationBand === "Strong Candidate" ||
        input.recommendationBand === "Worth Reviewing");
    if (enthusiasticNone) {
      result = [
        ...finishParas,
        "I'd still want optical imagery and an in-person check before treating this as a final choice.",
      ];
    } else {
      result = [...finishParas, ...result];
    }
  }

  return result;
}

export function resolveLgdrPresentationFlags(input: {
  metadata?: Pick<
    ClientSafeMetadata,
    "lab" | "stoneType" | "parserFamily" | "reportFormat"
  > | null;
  reportTextHint?: string;
  fields: Partial<CalibrationReportFields>;
}): LgdrPresentationFlags {
  const active = isLgdrPresentationContext(
    input.metadata,
    input.reportTextHint,
  );
  if (!active) {
    return {
      active: false,
      percentileCaution: false,
      treatmentDisclosure: false,
      effectiveFinish: {},
    };
  }

  const effectiveFinish = resolveLgdrFinishGradesForPresentation(
    input.fields,
    input.reportTextHint,
  );
  const treatmentDisclosure = detectLgdrPostGrowthTreatmentDisclosure(
    input.reportTextHint,
  );

  return {
    active: true,
    percentileCaution: lgdrPercentileCautionActive({
      effectiveFinish,
      reportTextHint: input.reportTextHint,
    }),
    treatmentDisclosure,
    effectiveFinish,
  };
}
