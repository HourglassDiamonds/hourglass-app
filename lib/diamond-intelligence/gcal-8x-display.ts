import type { CalibrationReportFields } from "@/lib/calibration-library/types";
import type { ClientReportFormat, ClientSafeMetadata } from "./client-api";

/** Normalize report-family tokens for display-only framework selection. */
function normalizeReportFormatToken(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

function isGcal8xFormatToken(value: string | undefined): boolean {
  if (!value?.trim()) return false;

  const token = normalizeReportFormatToken(value);
  if (token === "gcal8x") return true;

  if (token.includes("sarine")) return false;
  if (token.includes("gcal") && token.includes("8x")) return true;

  return false;
}

export type Gcal8xDisplayInput = {
  lab?: string;
  reportFormat?: ClientReportFormat;
  parserFamily?: string;
  reportTextHint?: string;
  warnings?: string[];
  fields?: CalibrationReportFields | null;
};

/**
 * Display-only — detect GCAL 8X verification copy in client-safe report text.
 * Used when extraction routes to gcal-sarine-4cs but the report is still 8X-class.
 */
export function looksLikeGcal8xDisplayText(text?: string | null): boolean {
  const t = text?.trim().slice(0, 16000) ?? "";
  if (!t || !/\bGCAL\b/i.test(t)) return false;

  if (/\bGCAL\s*8\s*X\b/i.test(t)) return true;
  if (/\b8\s*X\b/i.test(t) && /\bultimate\s+diamond\s+cut\s+grade\b/i.test(t)) {
    return true;
  }
  if (
    /\bultimate\s+diamond\s+cut\s+grade\b/i.test(t) &&
    /\b(?:eight|8)\s+aspects\b/i.test(t) &&
    /\bcut\s+quality\b/i.test(t)
  ) {
    return true;
  }

  const has8xCategoryBlock =
    /\b(?:optical\s+brilliance|optical\s+symmetry|hearts\s*&\s*arrows)\b/i.test(
      t,
    ) &&
    /\b(?:polish|external\s+symmetry|proportions|fire|scintillation)\b/i.test(t);

  if (/\b8\s*X\b/i.test(t) && has8xCategoryBlock) return true;

  if (/\bexternal\s+symmetry\b/i.test(t) && /\bproportions\b/i.test(t)) {
    return true;
  }

  return false;
}

/**
 * Display-only — GCAL hybrid certs often route as Sarine 4Cs but carry a full
 * 8X proportion diagram and Excellent finish table (incl. cut from Proportions row).
 */
export function looksLikeGcal8xFieldCluster(
  fields?: CalibrationReportFields | null,
): boolean {
  if (!fields) return false;

  const hasDeepDiagram =
    Boolean(fields.tablePercent?.trim()) &&
    Boolean(fields.depthPercent?.trim()) &&
    Boolean(fields.crownAngle?.trim()) &&
    Boolean(fields.pavilionAngle?.trim()) &&
    Boolean(fields.starLengthPercent?.trim()) &&
    Boolean(fields.lowerHalfPercent?.trim());

  const has8xFinishTable =
    /^excellent$/i.test(fields.polish?.trim() ?? "") &&
    /^excellent$/i.test(fields.symmetry?.trim() ?? "") &&
    /^excellent$/i.test(fields.cutGrade?.trim() ?? "");

  return hasDeepDiagram && has8xFinishTable;
}

export function buildGcal8xDisplayTextHint(input: Gcal8xDisplayInput): string {
  return [input.reportTextHint, ...(input.warnings ?? [])]
    .filter(Boolean)
    .join("\n")
    .slice(0, 16000);
}

/** Display-only GCAL 8X framework gate — does not affect scoring or extraction. */
export function isGcal8xDisplayFramework(input: Gcal8xDisplayInput): boolean {
  if (input.lab !== "GCAL") return false;

  if (isGcal8xFormatToken(input.reportFormat)) return true;
  if (input.parserFamily === "gcal-8x") return true;

  const textHint = buildGcal8xDisplayTextHint(input);
  if (looksLikeGcal8xDisplayText(textHint)) return true;

  if (looksLikeGcal8xFieldCluster(input.fields)) return true;

  return false;
}

export function resolveClientReportFormat(
  input: Gcal8xDisplayInput,
): ClientReportFormat | undefined {
  if (isGcal8xDisplayFramework(input)) return "gcal-8x";
  if (input.parserFamily === "gcal-sarine-4cs") return "gcal-sarine-4cs";
  if (input.reportFormat) return input.reportFormat;
  return undefined;
}

export type Gcal8xDisplayDebug = {
  lab?: string;
  reportFormat?: ClientReportFormat;
  parserFamily?: string;
  reportTextHintLength: number;
  reportTextHintPreview: string;
  warningsCount: number;
  fieldClusterMatch: boolean;
  textHintMatch: boolean;
  resolved: boolean;
};

export function debugGcal8xDisplay(
  metadata?: ClientSafeMetadata | null,
  fields?: CalibrationReportFields | null,
): Gcal8xDisplayDebug {
  const input: Gcal8xDisplayInput = {
    lab: metadata?.lab,
    reportFormat: metadata?.reportFormat,
    parserFamily: metadata?.parserFamily,
    reportTextHint: metadata?.reportTextHint,
    fields,
  };
  const textHint = buildGcal8xDisplayTextHint(input);

  return {
    lab: metadata?.lab,
    reportFormat: metadata?.reportFormat,
    parserFamily: metadata?.parserFamily,
    reportTextHintLength: textHint.length,
    reportTextHintPreview: textHint.slice(0, 240),
    warningsCount: 0,
    fieldClusterMatch: looksLikeGcal8xFieldCluster(fields),
    textHintMatch: looksLikeGcal8xDisplayText(textHint),
    resolved: isGcal8xDisplayFramework(input),
  };
}
