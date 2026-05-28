import type {
  CalibrationReportFields,
  ReportFieldKey,
} from "@/lib/calibration-library/types";

/** Client-facing interpretation depth — not exposed as parser/calibration jargon. */
export type ClientInterpretationLevel = "basic" | "proportion" | "deep";

export type ClientInterpretationNextStep =
  | "view_interpretation"
  | "guided_completion"
  | "justin_review";

/** How a value may be used in the product (never implies calibration corpus use). */
export type ClientFieldUsage = "interpretation-only";

export type ClientFieldAttribution = {
  source: "client-entered";
  usage: ClientFieldUsage;
  excludedFromCalibrationStats: true;
  requiresAdminApprovalForCalibration: true;
  enteredAt?: string;
};

export type ClientInterpretationSnapshot = {
  extractedFields: CalibrationReportFields;
  clientCompletedFields: Partial<CalibrationReportFields>;
  /** Merged view for client interpretation UI and preview scoring only. */
  interpretationFields: CalibrationReportFields;
  fieldAttribution: Partial<Record<ReportFieldKey, ClientFieldAttribution>>;
  interpretationLevel: ClientInterpretationLevel;
  excludedFromCalibrationStats: true;
  requiresAdminApprovalForCalibration: true;
};
