import type { FinalizedCalibrationExtraction } from "@/lib/calibration-library/finalize-calibration-extraction";
import type { PdfRenderAuditRecord } from "@/lib/calibration-library/pdf-render-audit";
import type {
  CalibrationReportFields,
  CalibrationReportMetadata,
  ReportFieldKey,
} from "@/lib/calibration-library/types";
import {
  assessReportCapability,
  type ReportCapability,
} from "./report-capability";
import {
  assessExtractionCompleteness,
  toExtractionCompletenessSummary,
  type ExtractionCompletenessSummary,
} from "./extraction-completeness";
import { buildClientDiamondDecisionProfile } from "./client-decision-profile";
import type { DiamondDecisionProfile } from "./diamond-decision-profile";
import { parseReportGradeHints, buildReportGradeHintSource, type ReportGradeHints } from "./report-grade-hints";
import { presentClientInterpretationScore } from "./client-score-present";
import { resolveClientReportFormat } from "./gcal-8x-display";

/** Fields shown in the client “What we could read” card. */
export const CLIENT_DISPLAY_FIELD_KEYS: ReportFieldKey[] = [
  "shape",
  "carat",
  "measurements",
  "tablePercent",
  "depthPercent",
  "crownAngle",
  "pavilionAngle",
  "polish",
  "symmetry",
  "fluorescence",
];

export type ClientSafeReportCapability = Omit<
  ReportCapability,
  "internalCalibrationEligible"
>;

/** Display-only report family — mirrors server parser classification; not used in scoring. */
export type ClientReportFormat = "gcal-8x" | "gcal-sarine-4cs";

export type ClientSafeMetadata = Pick<
  CalibrationReportMetadata,
  "lab" | "reportNumber" | "stoneType"
> & {
  reportFormat?: ClientReportFormat;
  /** Display-only extraction family label (mirrors server parserType). */
  parserFamily?: string;
  /** Truncated report text for display framework detection only. */
  reportTextHint?: string;
};

/** API + UI payload — no parser, provenance, or calibration admin fields. */
export type ClientSafeInterpretationPayload = {
  metadata: ClientSafeMetadata;
  extractedFields: CalibrationReportFields;
  interpretationFields: CalibrationReportFields;
  capability: ClientSafeReportCapability;
  /** Calm client copy when read is preliminary or timed out mid-OCR. */
  clientStatusNote?: string;
  partial?: boolean;
  /** Development only — extraction state / eligibility diagnostics. */
  extractionCompleteness?: ExtractionCompletenessSummary;
  /** Multi-dimensional consumer decision read (interpretation layer). */
  decisionProfile?: DiamondDecisionProfile;
  /** Parsed clarity/color hints for client-side recomputation after guided completion. */
  gradeHints?: ReportGradeHints;
};

export function toClientSafeInterpretationPayload(
  finalized: FinalizedCalibrationExtraction & {
    timedOut?: boolean;
    pipelineError?: string;
    renderAudit?: PdfRenderAuditRecord;
  },
  interpretationFields?: CalibrationReportFields,
  opts?: {
    clientStatusNote?: string;
    partial?: boolean;
    includeDevDiagnostics?: boolean;
  },
): ClientSafeInterpretationPayload {
  const interpretation = interpretationFields ?? finalized.fields;
  const capability = assessReportCapability({
    fields: interpretation,
    confidence: finalized.confidence,
    internalCalibrationEligible: finalized.calibrationEligible,
    excludedFromCalibrationStats: finalized.excludedFromCalibrationStats,
  });

  const {
    internalCalibrationEligible: _adminOnly,
    ...clientCapability
  } = capability;

  const parserType = finalized.parserType;
  const parserFamily = parserType;

  const reportTextHint = finalized.rawTextSnippet?.trim() || undefined;

  const gradeHintSource = buildReportGradeHintSource({
    reportGradeHintText: finalized.reportGradeHintText,
    rawTextSnippet: reportTextHint,
    warnings: finalized.warnings,
  });

  const reportTextHintForDisplay =
    gradeHintSource ||
    [reportTextHint, ...finalized.warnings].filter(Boolean).join("\n").slice(0, 16000);

  const reportFormat = resolveClientReportFormat({
    lab: finalized.metadata.lab,
    reportFormat:
      parserType === "gcal-8x"
        ? "gcal-8x"
        : parserType === "gcal-sarine-4cs"
          ? "gcal-sarine-4cs"
          : undefined,
    parserFamily,
    reportTextHint: reportTextHintForDisplay,
    warnings: finalized.warnings,
    fields: interpretation,
  });

  const payload: ClientSafeInterpretationPayload = {
    metadata: {
      lab: finalized.metadata.lab,
      reportNumber: finalized.metadata.reportNumber,
      stoneType: finalized.metadata.stoneType,
      reportFormat,
      parserFamily,
      reportTextHint: reportTextHintForDisplay || undefined,
    },
    extractedFields: { ...finalized.fields },
    interpretationFields: { ...interpretation },
    capability: clientCapability,
    clientStatusNote: opts?.clientStatusNote,
    partial: opts?.partial,
  };

  if (opts?.includeDevDiagnostics) {
    payload.extractionCompleteness = toExtractionCompletenessSummary(
      assessExtractionCompleteness({
        fields: interpretation,
        pipelineError: finalized.pipelineError,
        timedOut: finalized.timedOut,
        renderAudit: finalized.renderAudit,
      }),
    );
  }

  const hintTextForParse = (reportTextHintForDisplay || gradeHintSource).trim();
  if (hintTextForParse) {
    payload.gradeHints = parseReportGradeHints(hintTextForParse);
  }

  const rawScore = presentClientInterpretationScore(
    interpretation,
    capability.interpretationLevel,
  );
  const rawOverall =
    rawScore.eligible && rawScore.overall !== null ? rawScore.overall : null;

  payload.decisionProfile = buildClientDiamondDecisionProfile({
    fields: interpretation,
    metadata: payload.metadata,
    capability: clientCapability,
    rawScore: rawOverall,
    reportTextHint: hintTextForParse || gradeHintSource || reportTextHint,
    gradeHints: payload.gradeHints,
  });

  return payload;
}

export function reassessClientCapability(
  interpretationFields: CalibrationReportFields,
): ClientSafeReportCapability {
  const { internalCalibrationEligible: _adminOnly, ...capability } =
    assessReportCapability({ fields: interpretationFields });
  return capability;
}
