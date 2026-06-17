import type { CalibrationReportFields } from "@/lib/calibration-library/types";
import type { ClientSafeMetadata } from "./client-api";
import type { DiamondInterpretationContext } from "./client-interpretation-context";
import type { ReportGradeHints } from "./report-grade-hints";
import { normalizeClarityGrade } from "./report-grade-hints";
import type { PurchaseRecommendationLabel } from "./purchase-recommendation-presentation";

export type NaturalGiaFluorescenceIntensity =
  | "none"
  | "faint"
  | "medium"
  | "strong"
  | "very strong";

export type NaturalGiaFluorescenceHue =
  | "green"
  | "blue"
  | "yellow"
  | "white"
  | "unknown";

export type NaturalGiaFluorescenceTier =
  | "none"
  | "green-caution"
  | "strong-blue"
  | "medium-blue";

export type NaturalGiaFluorescenceDetail = {
  raw: string;
  intensity: NaturalGiaFluorescenceIntensity;
  hue: NaturalGiaFluorescenceHue;
  tier: NaturalGiaFluorescenceTier;
  requiresJustinDisclosure: boolean;
};

export type NaturalGiaSoftPercentilePresentation = {
  topLine: string;
  topSubline: string;
  scope: "optical";
};

const PLACEHOLDER_FINISH =
  /^(?:unknown|not\s*available|unverified|select|n\/a|na|none|null|undefined|—|-+|\.+)$/i;

function normalizeFinishGrade(raw?: string | null): string {
  return raw?.trim().toLowerCase().replace(/\s+/g, " ") ?? "";
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

function isTripleExcellentFinish(fields: Partial<CalibrationReportFields>): boolean {
  const grades = [fields.cutGrade, fields.polish, fields.symmetry];
  const present = grades.filter((g) => g?.trim() && !PLACEHOLDER_FINISH.test(g.trim()));
  if (present.length === 0) return true;
  return present.every((g) => isExcellentFinishGrade(g));
}

function isFinishBelowTripleExcellent(
  fields: Partial<CalibrationReportFields>,
): boolean {
  const grades = [fields.cutGrade, fields.polish, fields.symmetry];
  for (const grade of grades) {
    const value = grade?.trim();
    if (!value || PLACEHOLDER_FINISH.test(value)) continue;
    if (!isExcellentFinishGrade(value)) return true;
  }
  return false;
}

/** Natural round GIA consumer presentation — excludes LGDR, lab-grown, GCAL 8X, non-GIA. */
export function isNaturalGiaPresentationContext(
  metadata?: Pick<
    ClientSafeMetadata,
    "lab" | "stoneType" | "parserFamily" | "reportFormat"
  > | null,
  reportTextHint?: string,
): boolean {
  if (!metadata || metadata.lab !== "GIA") return false;
  if (metadata.reportFormat === "gcal-8x") return false;
  if (metadata.stoneType === "lab-grown") return false;

  const hint = reportTextHint?.trim() ?? "";
  if (/\bLGDR\b/i.test(hint)) return false;
  if (/laboratory[-\s]?grown/i.test(hint)) return false;
  if (metadata.parserFamily?.toLowerCase().includes("lgdr")) return false;

  if (metadata.stoneType === "natural") return true;

  // Unknown stone type on a non-LGDR GIA report — treat as natural facsimile/dossier guard.
  return metadata.stoneType !== "lab-grown";
}

/** Recover hue when finalizeExtractionFields kept strength only (e.g. Medium Green → Medium). */
export function resolveNaturalGiaFluorescenceForPresentation(
  fluorescence: string,
  reportTextHint?: string,
): string {
  const raw = fluorescence.trim();
  if (!raw) return raw;

  const parsed = parseNaturalGiaFluorescencePresentation(raw);
  if (parsed.hue !== "unknown" || parsed.intensity === "none") return raw;

  const hint = reportTextHint?.replace(/\s+/g, " ").trim() ?? "";
  if (!hint) return raw;

  const strengthPattern =
    parsed.intensity === "very strong"
      ? "very\\s+strong"
      : parsed.intensity === "faint"
        ? "(?:faint|slight|very\\s+slight)"
        : parsed.intensity;

  for (const hue of ["green", "blue", "yellow", "white"] as const) {
    const re = new RegExp(`\\b${strengthPattern}\\s+${hue}\\b`, "i");
    if (!re.test(hint)) continue;
    const cap = (word: string) =>
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    if (parsed.intensity === "very strong") {
      return `Very Strong ${cap(hue)}`;
    }
    if (parsed.intensity === "faint") {
      const faintMatch = hint.match(
        new RegExp(`\\b(faint|slight|very\\s+slight)\\s+${hue}\\b`, "i"),
      );
      const faintWord = faintMatch?.[1] ?? "faint";
      return `${cap(faintWord.replace(/\s+/g, " "))} ${cap(hue)}`;
    }
    return `${cap(parsed.intensity)} ${cap(hue)}`;
  }

  return raw;
}

export function parseNaturalGiaFluorescencePresentation(
  fluorescence: string,
): NaturalGiaFluorescenceDetail {
  const raw = fluorescence.trim();
  const f = raw.toLowerCase();
  if (!f || f === "none") {
    return {
      raw,
      intensity: "none",
      hue: "unknown",
      tier: "none",
      requiresJustinDisclosure: false,
    };
  }

  const hue: NaturalGiaFluorescenceHue = f.includes("green")
    ? "green"
    : f.includes("blue")
      ? "blue"
      : f.includes("yellow")
        ? "yellow"
        : f.includes("white")
          ? "white"
          : "unknown";

  let intensity: NaturalGiaFluorescenceIntensity = "faint";
  if (f.includes("very strong")) intensity = "very strong";
  else if (f.includes("strong")) intensity = "strong";
  else if (f.includes("medium")) intensity = "medium";
  else if (f.includes("faint") || f.includes("slight")) intensity = "faint";

  let tier: NaturalGiaFluorescenceTier = "none";
  if (
    hue === "green" &&
    (intensity === "medium" ||
      intensity === "strong" ||
      intensity === "very strong")
  ) {
    tier = "green-caution";
  } else if (
    hue === "blue" &&
    (intensity === "strong" || intensity === "very strong")
  ) {
    tier = "strong-blue";
  } else if (hue === "blue" && intensity === "medium") {
    tier = "medium-blue";
  }

  return {
    raw,
    intensity,
    hue,
    tier,
    requiresJustinDisclosure: tier !== "none",
  };
}

export function buildNaturalGiaFluorescenceJustinParagraphs(
  detail: NaturalGiaFluorescenceDetail,
): string[] | null {
  switch (detail.tier) {
    case "green-caution":
      return [
        "One caution I would want to review in person is the green fluorescence.",
        "Green fluorescence is less commonly preferred than blue fluorescence and can affect how I would evaluate this stone in real life.",
      ];
    case "strong-blue":
      return [
        "Strong blue fluorescence is worth confirming in person.",
        "It can be benign in many diamonds, but I would want to make sure it does not create haze or an over-blue appearance in natural daylight.",
      ];
    case "medium-blue":
      return [
        "Medium blue fluorescence is noted on the report.",
        "I would confirm it in person, but it is not automatically a concern.",
      ];
    default:
      return null;
  }
}

export function naturalGiaPercentileCautionActive(input: {
  fields: Partial<CalibrationReportFields>;
  reportTextHint?: string;
  gradeHints?: ReportGradeHints;
  interpretationContext?: Pick<
    DiamondInterpretationContext,
    "extractionState" | "readState" | "confidenceLevel"
  >;
  purchaseLabel?: PurchaseRecommendationLabel;
}): boolean {
  const fluo = parseNaturalGiaFluorescencePresentation(
    resolveNaturalGiaFluorescenceForPresentation(
      input.fields.fluorescence ?? "",
      input.reportTextHint,
    ),
  );
  if (fluo.tier === "green-caution" || fluo.tier === "strong-blue") {
    return true;
  }
  if (fluo.intensity === "strong" || fluo.intensity === "very strong") {
    return true;
  }

  if (isFinishBelowTripleExcellent(input.fields)) return true;

  const clarity = normalizeClarityGrade(input.gradeHints?.clarity ?? "");
  if (clarity === "I1" || clarity === "I2" || clarity === "I3") return true;

  const ctx = input.interpretationContext;
  if (ctx) {
    if (ctx.readState === "partial" || ctx.readState === "orientation") {
      return true;
    }
    if (ctx.confidenceLevel !== "high") return true;
    if (
      ctx.extractionState === "PARTIAL_EXTRACTION" ||
      ctx.extractionState === "REPORT_ONLY"
    ) {
      return true;
    }
  }

  if (
    input.purchaseLabel === "Worth Reviewing After Additional Information" ||
    input.purchaseLabel === "Justin Inspection Required" ||
    input.purchaseLabel === "Outside Hourglass Standards" ||
    input.purchaseLabel === "Not Recommended"
  ) {
    return true;
  }

  if (!isTripleExcellentFinish(input.fields)) return true;

  return false;
}

export function buildNaturalGiaSoftPercentilePresentation(
  displayScore: number | null,
): NaturalGiaSoftPercentilePresentation | null {
  if (displayScore === null || !Number.isFinite(displayScore)) return null;

  if (displayScore >= 94) {
    return {
      topLine: "Strong optical profile",
      topSubline: "High-performing on paper for reported proportions",
      scope: "optical",
    };
  }
  if (displayScore >= 88) {
    return {
      topLine: "Promising proportions",
      topSubline: "Worth reviewing in person before treating the paper read as final",
      scope: "optical",
    };
  }
  return {
    topLine: "Worth reviewing in person",
    topSubline: "Useful starting context — confirm face-up performance directly",
    scope: "optical",
  };
}

export function resolveNaturalGiaPresentationFlags(input: {
  metadata?: Pick<
    ClientSafeMetadata,
    "lab" | "stoneType" | "parserFamily" | "reportFormat"
  > | null;
  reportTextHint?: string;
  fields: Partial<CalibrationReportFields>;
  gradeHints?: ReportGradeHints;
  interpretationContext?: Pick<
    DiamondInterpretationContext,
    "extractionState" | "readState" | "confidenceLevel"
  >;
  purchaseLabel?: PurchaseRecommendationLabel;
}): { active: boolean; percentileCaution: boolean } {
  const active = isNaturalGiaPresentationContext(
    input.metadata,
    input.reportTextHint,
  );
  if (!active) {
    return { active: false, percentileCaution: false };
  }
  return {
    active: true,
    percentileCaution: naturalGiaPercentileCautionActive({
      fields: input.fields,
      reportTextHint: input.reportTextHint,
      gradeHints: input.gradeHints,
      interpretationContext: input.interpretationContext,
      purchaseLabel: input.purchaseLabel,
    }),
  };
}
