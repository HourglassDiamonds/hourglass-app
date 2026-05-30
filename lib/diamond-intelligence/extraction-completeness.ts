import type {
  CalibrationReportFields,
  ReportFieldKey,
} from "@/lib/calibration-library/types";
import type { PdfRenderAuditRecord } from "@/lib/calibration-library/pdf-render-audit";

/**
 * Extraction state / interpretation eligibility — data integrity layer.
 *
 * Classifies client-facing field completeness BEFORE consumer interpretation.
 * Does not change scoring math, parsers, or UI layout.
 */

export type ExtractionState =
  | "FULL_EXTRACTION"
  | "PARTIAL_EXTRACTION"
  | "REPORT_ONLY"
  | "EXTRACTION_ERROR";

/** Minimum core optical fields required for a calculated consumer score. */
export const SCORE_ELIGIBLE_CORE_KEYS = [
  "tablePercent",
  "depthPercent",
  "crownAngle",
  "pavilionAngle",
] as const satisfies readonly ReportFieldKey[];

export const DEEP_OPTICAL_KEYS = [
  "lowerHalfPercent",
  "starLengthPercent",
  "girdle",
  "culet",
] as const satisfies readonly ReportFieldKey[];

const CORE_LABELS: Record<(typeof SCORE_ELIGIBLE_CORE_KEYS)[number], string> = {
  tablePercent: "table",
  depthPercent: "depth",
  crownAngle: "crown angle",
  pavilionAngle: "pavilion angle",
};

const DEEP_LABELS: Record<(typeof DEEP_OPTICAL_KEYS)[number], string> = {
  lowerHalfPercent: "lower half",
  starLengthPercent: "star length",
  girdle: "girdle",
  culet: "culet",
};

const METADATA_KEYS: ReportFieldKey[] = [
  "shape",
  "carat",
  "measurements",
  "polish",
  "symmetry",
  "fluorescence",
  "cutGrade",
];

export type ExtractionCompletenessInput = {
  fields: Partial<CalibrationReportFields> | null | undefined;
  hasRendererError?: boolean;
  hasOcrError?: boolean;
  hasParserError?: boolean;
  pipelineError?: string | null;
  timedOut?: boolean;
  renderAudit?: PdfRenderAuditRecord | null;
};

export type ExtractionCompleteness = {
  extractionState: ExtractionState;
  coreFieldCount: number;
  missingCoreFields: ReportFieldKey[];
  presentCoreFields: ReportFieldKey[];
  missingDeepFields: ReportFieldKey[];
  presentDeepFields: ReportFieldKey[];
  hasOnlyReportMetadata: boolean;
  hasRendererError: boolean;
  hasOcrError: boolean;
  hasParserError: boolean;
  interpretationEligible: boolean;
  scoreEligible: boolean;
  graphEligible: boolean;
  traitEligible: boolean;
  guidedCompletionEligible: boolean;
  reason: string;
};

/** Dev / debug summary — safe subset for interpret API in development. */
export type ExtractionCompletenessSummary = Pick<
  ExtractionCompleteness,
  | "extractionState"
  | "coreFieldCount"
  | "presentCoreFields"
  | "missingCoreFields"
  | "scoreEligible"
  | "graphEligible"
  | "traitEligible"
  | "reason"
>;

function fieldPresent(
  fields: Partial<CalibrationReportFields> | null | undefined,
  key: ReportFieldKey,
): boolean {
  return Boolean((fields?.[key] ?? "").trim());
}

function deriveErrorFlags(input: ExtractionCompletenessInput): {
  hasRendererError: boolean;
  hasOcrError: boolean;
  hasParserError: boolean;
} {
  const audit = input.renderAudit;
  const hasRendererError =
    input.hasRendererError ??
    (audit != null && !audit.renderSuccess);
  const hasOcrError =
    input.hasOcrError ??
    (audit != null &&
      audit.renderSuccess &&
      (audit.ocrReadiness === "failed" || audit.ocrReadiness === "blank"));
  const hasParserError = input.hasParserError ?? Boolean(input.pipelineError?.trim());

  return { hasRendererError, hasOcrError, hasParserError };
}

export function assessExtractionCompleteness(
  input: ExtractionCompletenessInput,
): ExtractionCompleteness {
  const fields = input.fields;
  const errors = deriveErrorFlags(input);

  const presentCoreFields = SCORE_ELIGIBLE_CORE_KEYS.filter((k) =>
    fieldPresent(fields, k),
  );
  const missingCoreFields = SCORE_ELIGIBLE_CORE_KEYS.filter(
    (k) => !fieldPresent(fields, k),
  );
  const coreFieldCount = presentCoreFields.length;

  const presentDeepFields = DEEP_OPTICAL_KEYS.filter((k) =>
    fieldPresent(fields, k),
  );
  const missingDeepFields = DEEP_OPTICAL_KEYS.filter(
    (k) => !fieldPresent(fields, k),
  );

  const hasMetadata = METADATA_KEYS.some((k) => fieldPresent(fields, k));
  const hasIdentity =
    fieldPresent(fields, "shape") || fieldPresent(fields, "carat");
  const hasOnlyReportMetadata =
    coreFieldCount === 0 && (hasMetadata || hasIdentity);

  const catastrophicFailure =
    errors.hasRendererError ||
    errors.hasOcrError ||
    errors.hasParserError ||
    Boolean(input.timedOut && coreFieldCount === 0 && !hasMetadata);

  if (catastrophicFailure) {
    return {
      extractionState: "EXTRACTION_ERROR",
      coreFieldCount,
      missingCoreFields: [...missingCoreFields],
      presentCoreFields: [...presentCoreFields],
      missingDeepFields: [...missingDeepFields],
      presentDeepFields: [...presentDeepFields],
      hasOnlyReportMetadata,
      ...errors,
      interpretationEligible: false,
      scoreEligible: false,
      graphEligible: false,
      traitEligible: false,
      guidedCompletionEligible: hasIdentity || hasMetadata,
      reason:
        "The report could not be interpreted automatically from the available data.",
    };
  }

  const scoreEligible = coreFieldCount === SCORE_ELIGIBLE_CORE_KEYS.length;

  let extractionState: ExtractionState;
  if (scoreEligible) {
    extractionState = "FULL_EXTRACTION";
  } else if (coreFieldCount > 0) {
    extractionState = "PARTIAL_EXTRACTION";
  } else if (hasOnlyReportMetadata) {
    extractionState = "REPORT_ONLY";
  } else {
    extractionState = "REPORT_ONLY";
  }

  const graphEligible =
    extractionState === "FULL_EXTRACTION" ||
    extractionState === "PARTIAL_EXTRACTION";

  const traitEligible =
    extractionState === "FULL_EXTRACTION" ||
    extractionState === "PARTIAL_EXTRACTION";

  const interpretationEligible =
    extractionState === "FULL_EXTRACTION" ||
    extractionState === "PARTIAL_EXTRACTION" ||
    extractionState === "REPORT_ONLY";

  const guidedCompletionEligible = missingCoreFields.length > 0;

  let reason: string;
  if (extractionState === "FULL_EXTRACTION") {
    reason =
      missingDeepFields.length > 0
        ? "Core proportions are present; deeper diagram fields would sharpen trait detail."
        : "Full proportion set visible — calculated optical interpretation is supported.";
  } else if (extractionState === "PARTIAL_EXTRACTION") {
    const missingNames = missingCoreFields.map(
      (k) => CORE_LABELS[k as keyof typeof CORE_LABELS] ?? k,
    );
    reason =
      missingNames.length > 0
        ? `Partial proportion detail only (${presentCoreFields.length}/4 core fields). Missing ${missingNames.join(", ")} — no calculated performance score.`
        : "Partial proportion detail — not enough for a calculated performance score.";
  } else {
    reason =
      "Report identity and finish details only — no core proportions for a calculated optical read.";
  }

  return {
    extractionState,
    coreFieldCount,
    missingCoreFields: [...missingCoreFields],
    presentCoreFields: [...presentCoreFields],
    missingDeepFields: [...missingDeepFields],
    presentDeepFields: [...presentDeepFields],
    hasOnlyReportMetadata,
    ...errors,
    interpretationEligible,
    scoreEligible,
    graphEligible,
    traitEligible,
    guidedCompletionEligible,
    reason,
  };
}

export function toExtractionCompletenessSummary(
  c: ExtractionCompleteness,
): ExtractionCompletenessSummary {
  return {
    extractionState: c.extractionState,
    coreFieldCount: c.coreFieldCount,
    presentCoreFields: c.presentCoreFields,
    missingCoreFields: c.missingCoreFields,
    scoreEligible: c.scoreEligible,
    graphEligible: c.graphEligible,
    traitEligible: c.traitEligible,
    reason: c.reason,
  };
}
