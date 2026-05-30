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

export type ClientSafeMetadata = Pick<
  CalibrationReportMetadata,
  "lab" | "reportNumber" | "stoneType"
>;

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

  const payload: ClientSafeInterpretationPayload = {
    metadata: {
      lab: finalized.metadata.lab,
      reportNumber: finalized.metadata.reportNumber,
      stoneType: finalized.metadata.stoneType,
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

  return payload;
}

export function reassessClientCapability(
  interpretationFields: CalibrationReportFields,
): ClientSafeReportCapability {
  const { internalCalibrationEligible: _adminOnly, ...capability } =
    assessReportCapability({ fields: interpretationFields });
  return capability;
}
