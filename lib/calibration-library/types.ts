/** Supported labs — stored as context only; scoring does not weight by lab (v1). */
export const CALIBRATION_LABS = ["GIA", "GCAL", "AGS", "IGI", "OTHER"] as const;

export type CalibrationLab = (typeof CALIBRATION_LABS)[number];

export const REPORT_SOURCES = [
  "manual",
  "pdf-upload",
  "screenshot-upload",
  "vendor-feed",
] as const;

export type ReportSource = (typeof REPORT_SOURCES)[number];

export const STONE_TYPES = ["natural", "lab-grown", "unknown"] as const;

export type StoneType = (typeof STONE_TYPES)[number];

/** Proportion & finish fields parsed from the report (not lab identity). */
export const REPORT_FIELD_KEYS = [
  "shape",
  "carat",
  "measurements",
  "tablePercent",
  "depthPercent",
  "crownAngle",
  "pavilionAngle",
  "lowerHalfPercent",
  "starLengthPercent",
  "girdle",
  "culet",
  "polish",
  "symmetry",
  "fluorescence",
  "cutGrade",
] as const;

export type TextExtractionMethod = "pdf-text" | "ocr" | "manual" | "none";

export type ReportFieldKey = (typeof REPORT_FIELD_KEYS)[number];

export type CalibrationReportFields = Record<ReportFieldKey, string>;

/** Parsed from IGI diagram; not shown on review UI (reserved for future use). */
export type IgiInternalFields = {
  pavilionDepthPercent?: string;
};

/** Parsed from GIA diagram; not shown on review UI (reserved for future use). */
export type GiaInternalFields = {
  crownHeightPercent?: string;
  pavilionDepthPercent?: string;
  girdleThicknessPercent?: string;
};

/** Parsed from GCAL 8X diagram; not shown on review UI (reserved for future use). */
export type GcalInternalFields = {
  crownHeightPercent?: string;
  pavilionDepthPercent?: string;
  girdleThicknessPercent?: string;
  culetSizeMm?: string;
};

export type Gcal8xParserConfidence = "high" | "medium" | "low";

/** @deprecated Use ParserConfidence from parsers/types — alias for compatibility. */
export type ParserConfidence = Gcal8xParserConfidence;

export type { ExtractionMeta, ParserType } from "./parsers/types";

export type CalibrationReportMetadata = {
  lab: CalibrationLab;
  reportNumber: string;
  reportUrl?: string;
  reportSource: ReportSource;
  stoneType: StoneType;
};

export type FieldConfidence =
  | "high"
  | "medium"
  | "low"
  | "manual"
  | "missing";

export type ExtractionResult = {
  metadata: CalibrationReportMetadata;
  fields: CalibrationReportFields;
  confidence: Record<ReportFieldKey, FieldConfidence>;
  /** IGI-only values not mapped to review/scoring fields (e.g. pavilion depth %). */
  igiInternal?: IgiInternalFields;
  /** GIA-only values not mapped to review/scoring fields (e.g. crown height %). */
  giaInternal?: GiaInternalFields;
  /** GCAL 8X-only diagram values (e.g. crown height %, girdle thickness %). */
  gcalInternal?: GcalInternalFields;
  parserType?:
    | "gcal-8x"
    | "gcal-sarine-4cs"
    | "gia-modern"
    | "gia-legacy"
    | "igi-standard"
    | "igi-inline"
    | "generic";
  parserConfidence?: Gcal8xParserConfidence;
  /** Internal extraction diagnostics — not shown in public UI. */
  extractionMeta?: import("./parsers/types").ExtractionMeta;
  rawTextSnippet: string;
  warnings: string[];
  textMethod?: TextExtractionMethod;
  /** Per-field extraction provenance (metadata only). */
  fieldProvenance?: import("./extraction-provenance").FieldProvenanceMap;
};

export type CalibrationWorkbookEntry = {
  id: string;
  savedAt: string;
  updatedAt?: string;
  sourceFilename?: string;
  metadata: CalibrationReportMetadata;
  fields: CalibrationReportFields;
  fieldsNormalized: CalibrationReportFields;
  confidence: Record<ReportFieldKey, FieldConfidence>;
  /** Immutable first-pass extraction — never overwritten on update. */
  extractedFieldsRaw: CalibrationReportFields;
  extractedConfidence: Record<ReportFieldKey, FieldConfidence>;
  parserType?: ExtractionResult["parserType"];
  parserConfidence?: Gcal8xParserConfidence;
  textMethod?: TextExtractionMethod;
  warnings: string[];
  missingFields: ReportFieldKey[];
  parserMetadata?: CalibrationParserMetadata;
  roundBrilliantScore: RoundBrilliantScoreResult | null;
  reviewerNote?: string;
  recordVersion: number;
  schemaVersion: number;
  seeded?: boolean;
  /** Internal-only: score calibration fixture without parser extraction. */
  syntheticCalibration?: boolean;
  /** Internal tier label for distribution calibration (e.g. tradeoff-heavy). */
  calibrationTier?: string;
  /** First-pass extraction provenance per field. */
  fieldProvenance?: import("./extraction-provenance").FieldProvenanceMap;
  /** Approved value provenance (extracted vs manual override). */
  valueProvenance?: import("./extraction-provenance").ValueProvenanceMap;
  /** Structural gate — not used for scoring. */
  calibrationEligible?: boolean;
  /** Excluded from LP reference stats / distribution calibration (quarantine, incomplete core, manual core override). */
  excludedFromCalibrationStats?: boolean;
  corpusStatus?: "active" | "quarantined";
  quarantineReason?: string;
  /** Internal review flags (e.g. manual_core_override) — metadata only. */
  corpusReviewFlags?: string[];
};

/** Parser + extraction context persisted with each record. */
export type CalibrationParserMetadata = {
  parserType?: ExtractionResult["parserType"];
  parserConfidence?: Gcal8xParserConfidence;
  textMethod?: TextExtractionMethod;
  extractionMeta?: import("./parsers/types").ExtractionMeta;
  igiInternal?: IgiInternalFields;
  giaInternal?: GiaInternalFields;
  gcalInternal?: GcalInternalFields;
  fallbackParserUsed?: import("./parsers/types").ParserType;
  /** Internal-only: controlled fields for distribution calibration (no parser). */
  syntheticCalibration?: boolean;
  calibrationTier?: string;
  fieldProvenance?: import("./extraction-provenance").FieldProvenanceMap;
  valueProvenance?: import("./extraction-provenance").ValueProvenanceMap;
  igiDiagramLowerGirdleCandidate?: string;
  excludedFromCalibrationStats?: boolean;
  corpusStatus?: "active" | "quarantined";
  quarantineReason?: string;
  corpusReviewFlags?: string[];
};

/** Snapshot captured at extraction time (before reviewer edits). */
export type CalibrationExtractionSnapshot = {
  fields: CalibrationReportFields;
  confidence: Record<ReportFieldKey, FieldConfidence>;
  parserType?: ExtractionResult["parserType"];
  parserConfidence?: Gcal8xParserConfidence;
  textMethod?: TextExtractionMethod;
  warnings: string[];
  parserMetadata?: CalibrationParserMetadata;
};

export type CalibrationSaveMode = "create" | "update";

export type CalibrationSaveInput = {
  metadata: CalibrationReportMetadata;
  fields: CalibrationReportFields;
  confidence: Record<ReportFieldKey, FieldConfidence>;
  extractionSnapshot: CalibrationExtractionSnapshot;
  sourceFilename?: string;
  reviewerNote?: string;
  roundBrilliantScore?: RoundBrilliantScoreResult | null;
  saveMode?: CalibrationSaveMode;
  seeded?: boolean;
  syntheticCalibration?: boolean;
  calibrationTier?: string;
  fieldProvenance?: import("./extraction-provenance").FieldProvenanceMap;
  valueProvenance?: import("./extraction-provenance").ValueProvenanceMap;
  /** Seed/admin only — replace immutable extraction snapshot (default: preserve on update). */
  replaceExtractionSnapshot?: boolean;
};

export type CalibrationSaveResult =
  | { ok: true; entry: CalibrationWorkbookEntry; created: boolean }
  | {
      ok: false;
      code: "duplicate";
      message: string;
      existing: Pick<
        CalibrationWorkbookEntry,
        "id" | "savedAt" | "metadata" | "recordVersion"
      >;
    };

export type RoundBrilliantScoreDimension = {
  key: string;
  label: string;
  value: number | string | null;
  targetLabel: string;
  score: number;
  note: string;
  group: "proportion" | "reported-finish";
};

export type RoundBrilliantScoreResult = {
  overall: number;
  band: "strong" | "balanced" | "watch" | "outlier";
  dimensions: RoundBrilliantScoreDimension[];
  summary: string;
  disclaimers: string[];
  eligible: boolean;
  ineligibleReason?: string;
  /** Lab-neutral v1 — proportions weighted higher than finish lines. */
  weightingNote: string;
};
