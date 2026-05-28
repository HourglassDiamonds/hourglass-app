import type { FinalizedCalibrationExtraction } from "@/lib/calibration-library/finalize-calibration-extraction";
import type {
  CalibrationReportFields,
  CalibrationReportMetadata,
  ReportFieldKey,
} from "@/lib/calibration-library/types";
import {
  assessReportCapability,
  type ReportCapability,
} from "./report-capability";

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
};

export function toClientSafeInterpretationPayload(
  finalized: FinalizedCalibrationExtraction,
  interpretationFields?: CalibrationReportFields,
  opts?: { clientStatusNote?: string; partial?: boolean },
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

  return {
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
}

export function reassessClientCapability(
  interpretationFields: CalibrationReportFields,
): ClientSafeReportCapability {
  const { internalCalibrationEligible: _adminOnly, ...capability } =
    assessReportCapability({ fields: interpretationFields });
  return capability;
}
