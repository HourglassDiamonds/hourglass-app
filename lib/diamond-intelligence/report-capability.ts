import type { FinalizedCalibrationExtraction } from "@/lib/calibration-library/finalize-calibration-extraction";
import type {
  CalibrationReportFields,
  FieldConfidence,
  ReportFieldKey,
} from "@/lib/calibration-library/types";
import { REPORT_FIELD_KEYS } from "@/lib/calibration-library/types";
import { CLIENT_FIELD_LABELS } from "./client-field-labels";
import type {
  ClientInterpretationLevel,
  ClientInterpretationNextStep,
} from "./types";

/** Level 1 — basic report read. */
export const BASIC_READ_KEYS: ReportFieldKey[] = [
  "shape",
  "carat",
  "measurements",
  "polish",
  "symmetry",
  "fluorescence",
];

/** Level 2 — proportion review (includes basic). */
export const PROPORTION_REVIEW_KEYS: ReportFieldKey[] = [
  ...BASIC_READ_KEYS,
  "tablePercent",
  "depthPercent",
  "crownAngle",
  "pavilionAngle",
  "girdle",
  "culet",
];

/** Level 3 — deeper light performance estimate. */
export const DEEP_LIGHT_KEYS: ReportFieldKey[] = [
  ...PROPORTION_REVIEW_KEYS,
  "lowerHalfPercent",
  "starLengthPercent",
];

/** Admin / full pipeline — includes diagram fields reviewers may enter. */
export const GUIDED_COMPLETION_KEYS: ReportFieldKey[] = [
  "tablePercent",
  "depthPercent",
  "crownAngle",
  "pavilionAngle",
  "lowerHalfPercent",
  "starLengthPercent",
  "girdle",
  "culet",
];

/**
 * Public client UI — excludes lower-half and star length (diagram-only;
 * clients should not enter these manually).
 */
export const CLIENT_GUIDED_COMPLETION_KEYS: ReportFieldKey[] = [
  "tablePercent",
  "depthPercent",
  "crownAngle",
  "pavilionAngle",
  "girdle",
  "culet",
];

/** Deep-level diagram fields — expert verification only on the client surface. */
export const EXPERT_DIAGRAM_FIELD_KEYS: ReportFieldKey[] = [
  "lowerHalfPercent",
  "starLengthPercent",
];

export type ReportCapabilityInput = {
  fields: CalibrationReportFields;
  confidence?: Record<ReportFieldKey, FieldConfidence>;
  /** Admin-only — never render in client UI. */
  internalCalibrationEligible?: boolean;
  excludedFromCalibrationStats?: boolean;
};

export type ReportCapability = {
  interpretationLevel: ClientInterpretationLevel;
  clientSummaryTitle: string;
  clientSummaryBody: string;
  missingForNextLevel: ReportFieldKey[];
  guidedCompletionFields: ReportFieldKey[];
  suggestedNextStep: ClientInterpretationNextStep;
  canRunClientInterpretation: boolean;
  needsGuidedCompletion: boolean;
  /** True when only lower-half / star length block a deeper read — no client inputs. */
  needsExpertDiagramReview: boolean;
  manualValuesAllowedForInterpretationOnly: true;
  /** Admin / calibration library only — do not show to clients. */
  internalCalibrationEligible: boolean;
  confidentlyReadKeys: ReportFieldKey[];
  supportsLevel: ClientInterpretationLevel | "insufficient";
};

function fieldPresent(fields: CalibrationReportFields, key: ReportFieldKey): boolean {
  return Boolean(fields[key]?.trim());
}

function keysPresent(
  fields: CalibrationReportFields,
  keys: ReportFieldKey[],
): ReportFieldKey[] {
  return keys.filter((k) => fieldPresent(fields, k));
}

function keysMissing(
  fields: CalibrationReportFields,
  keys: ReportFieldKey[],
): ReportFieldKey[] {
  return keys.filter((k) => !fieldPresent(fields, k));
}

function highestSupportedLevel(
  fields: CalibrationReportFields,
): ClientInterpretationLevel | "insufficient" {
  if (keysMissing(fields, DEEP_LIGHT_KEYS).length === 0) return "deep";
  if (keysMissing(fields, PROPORTION_REVIEW_KEYS).length === 0) {
    return "proportion";
  }
  if (keysMissing(fields, BASIC_READ_KEYS).length === 0) return "basic";
  return "insufficient";
}

function nextLevelKeys(level: ClientInterpretationLevel | "insufficient"): ReportFieldKey[] {
  switch (level) {
    case "insufficient":
      return BASIC_READ_KEYS;
    case "basic":
      return PROPORTION_REVIEW_KEYS.filter((k) => !BASIC_READ_KEYS.includes(k));
    case "proportion":
      return ["lowerHalfPercent", "starLengthPercent"];
    case "deep":
      return [];
  }
}

function levelSummaryCopy(level: ClientInterpretationLevel): {
  title: string;
  body: string;
} {
  switch (level) {
    case "basic":
      return {
        title: "Basic report read",
        body: "This report gives us enough for a basic read, but not enough for a full cut interpretation.",
      };
    case "proportion":
      return {
        title: "Proportion-based interpretation",
        body: "This report gives us enough for a proportion-based interpretation.",
      };
    case "deep":
      return {
        title: "Deeper light performance estimate",
        body: "This report gives us enough for a deeper light performance estimate.",
      };
  }
}

function formatMissingList(keys: ReportFieldKey[]): string {
  if (keys.length === 0) return "";
  return keys.map((k) => CLIENT_FIELD_LABELS[k]).join(", ");
}

function isConfidentlyRead(
  key: ReportFieldKey,
  fields: CalibrationReportFields,
  confidence?: Record<ReportFieldKey, FieldConfidence>,
): boolean {
  if (!fieldPresent(fields, key)) return false;
  const c = confidence?.[key];
  if (!c || c === "missing") return false;
  if (c === "low") return false;
  return true;
}

export function assessReportCapability(
  input: ReportCapabilityInput,
): ReportCapability {
  const supportsLevel = highestSupportedLevel(input.fields);
  const interpretationLevel: ClientInterpretationLevel =
    supportsLevel === "insufficient" ? "basic" : supportsLevel;

  const missingForNextLevel =
    supportsLevel === "deep"
      ? []
      : keysMissing(input.fields, nextLevelKeys(supportsLevel));

  const guidedCompletionFields = missingForNextLevel.filter((k) =>
    CLIENT_GUIDED_COMPLETION_KEYS.includes(k),
  );

  const expertDiagramFieldsMissing = missingForNextLevel.filter((k) =>
    EXPERT_DIAGRAM_FIELD_KEYS.includes(k),
  );

  const confidentlyReadKeys = REPORT_FIELD_KEYS.filter((k) =>
    isConfidentlyRead(k, input.fields, input.confidence),
  );

  const needsGuidedCompletion = guidedCompletionFields.length > 0;
  const needsExpertDiagramReview =
    expertDiagramFieldsMissing.length > 0 && guidedCompletionFields.length === 0;

  let suggestedNextStep: ClientInterpretationNextStep = "view_interpretation";
  if (needsGuidedCompletion) {
    suggestedNextStep = "guided_completion";
  } else if (needsExpertDiagramReview || supportsLevel === "insufficient") {
    suggestedNextStep = "justin_review";
  }

  const summary = levelSummaryCopy(interpretationLevel);
  let clientSummaryBody = summary.body;

  if (guidedCompletionFields.length > 0) {
    const count = guidedCompletionFields.length;
    const noun =
      count === 1 ? "1 additional value" : `${count} additional values`;
    clientSummaryBody = `${summary.body} A few details from your report would strengthen this read (${noun}: ${formatMissingList(
      guidedCompletionFields,
    )}). You can add them below, or have Justin review the report for you.`;
  } else if (needsExpertDiagramReview) {
    clientSummaryBody =
      "This report supports a proportion-based interpretation. A deeper optical review would require diagram details that are best verified by an expert.";
  }

  const canRunClientInterpretation =
    supportsLevel !== "insufficient" ||
    keysPresent(input.fields, ["shape", "carat", "measurements"]).length >= 1;

  return {
    interpretationLevel,
    clientSummaryTitle: summary.title,
    clientSummaryBody,
    missingForNextLevel,
    guidedCompletionFields,
    suggestedNextStep,
    canRunClientInterpretation,
    needsGuidedCompletion,
    needsExpertDiagramReview,
    manualValuesAllowedForInterpretationOnly: true,
    internalCalibrationEligible: input.internalCalibrationEligible ?? false,
    confidentlyReadKeys,
    supportsLevel,
  };
}

/** Convenience wrapper for finalized calibration pipeline output (admin path). */
export function assessReportCapabilityFromFinalized(
  finalized: FinalizedCalibrationExtraction,
  clientCompleted?: Partial<CalibrationReportFields>,
): ReportCapability {
  const merged = { ...finalized.fields };
  if (clientCompleted) {
    for (const [k, v] of Object.entries(clientCompleted)) {
      const key = k as ReportFieldKey;
      if (v?.trim()) merged[key] = v.trim();
    }
  }
  return assessReportCapability({
    fields: merged,
    confidence: finalized.confidence,
    internalCalibrationEligible: finalized.calibrationEligible,
    excludedFromCalibrationStats: finalized.excludedFromCalibrationStats,
  });
}
