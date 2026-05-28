import type {
  CalibrationLab,
  CalibrationReportFields,
  FieldConfidence,
  GcalInternalFields,
  GiaInternalFields,
  IgiInternalFields,
  ReportFieldKey,
} from "../types";

/** Deterministic report-family identifiers (router-owned). */
export type ParserType =
  | "gcal-8x"
  | "gcal-sarine-4cs"
  | "gia-modern"
  | "gia-legacy"
  | "igi-standard"
  | "igi-inline"
  | "generic";

export type ParserConfidence = "high" | "medium" | "low";

export type ExtractionFallbackStage =
  | "text-layer"
  | "scoped-ocr"
  | "image-region-ocr"
  | "manual-review";

/** OCR fragments when GIA facsimile girdle thickness phrase is unreadable (metadata only). */
export type GiaFacsimileGirdleEvidence = {
  faceted: boolean;
  percent: string | null;
  phraseRecovered: boolean;
};

/** Internal debug payload — not surfaced in public UI. */
export type ExtractionMeta = {
  usedImageOCR: boolean;
  pdfTextLayerLength: number;
  gcalImageOnlyPdf?: boolean;
  fallbackStage: ExtractionFallbackStage;
  gradingWindowLength?: number;
  proportionWindowLength?: number;
  cropAssessments?: Record<string, unknown>;
  numericCandidates?: Record<string, unknown>;
  /** IGI diagram OCR: lower-girdle facet % — not mapped to lowerHalfPercent without confirmation. */
  igiDiagramLowerGirdleCandidate?: string;
  /** GIA facsimile: faceted / girdle % seen in OCR without recoverable thickness phrase. */
  giaFacsimileGirdleEvidence?: GiaFacsimileGirdleEvidence;
};

export type ReportFamilyMatch = {
  lab: CalibrationLab;
  parserType: ParserType;
  confidence: ParserConfidence;
  /** Human-readable routing reason for logs. */
  reason: string;
};

export type ParserFieldSetter = (
  key: ReportFieldKey,
  value: string,
  level: FieldConfidence,
) => void;

/** Normalized output from a single report-family parser. */
export type ParserParseResult = {
  parserType: ParserType;
  parserConfidence: ParserConfidence;
  fields: CalibrationReportFields;
  confidence: Record<ReportFieldKey, FieldConfidence>;
  igiInternal?: IgiInternalFields;
  giaInternal?: GiaInternalFields;
  gcalInternal?: GcalInternalFields;
  warnings: string[];
  extractionMeta: ExtractionMeta;
  /** Set when execute-parser falls back from Sarine to GCAL 8X. */
  fallbackParserUsed?: ParserType;
};
