import type {
  CalibrationReportFields,
  ExtractionResult,
  FieldConfidence,
  ReportFieldKey,
} from "@/lib/calibration-library/types";
import { REPORT_FIELD_KEYS } from "@/lib/calibration-library/types";
import {
  buildFieldProvenanceFromExtraction,
  type ExtractionConfidenceClass,
  type ValueProvenanceSource,
} from "@/lib/calibration-library/extraction-provenance";

/**
 * Extraction Diagnostic Harness (developer-only, visibility-first).
 *
 * Purpose: make Round Brilliant extraction failures visible field-by-field —
 * BEFORE changing any parser behavior. This module is read-only: it derives a
 * diagnostic view from an already-produced extraction result + the raw report
 * text. It never mutates parser output, scoring, confidence, or copy.
 *
 * It reuses the existing provenance layer
 * (`buildFieldProvenanceFromExtraction`) so we do not duplicate or fork the
 * confidence/source classification that the real pipeline already computes.
 *
 * FUTURE (not built yet): per-field crop image support. Each diagnostic field
 * has a `rawEvidence` slot today; a later pass can attach the actual OCR crop
 * region (bbox + image) that produced the value. Hook points are marked with
 * `// CROP-HOOK` below.
 */

export type ExtractionDiagnosticDecision = "accepted" | "rejected" | "missing";

export type ExtractionDiagnosticSource = {
  /** pdf-text | ocr | diagram-ocr | diagram | hydration | parser | manual | unavailable */
  method: string;
  /** Coarse text channel that fed the parser: pdf-text | ocr | manual | none. */
  textMethod: string;
  /** Provenance class: EXACT_TEXT, DIRECT_DIAGRAM, OCR_VERIFIED, etc. */
  extractionClass: ExtractionConfidenceClass;
  /** Value origin: extracted | ocr | diagram | manual-* | migrated | synthetic-fixture. */
  valueSource: ValueProvenanceSource;
};

export type ExtractionDiagnosticField = {
  field: ReportFieldKey;
  label: string;
  /** True for the nine sprint target fields. */
  target: boolean;
  decision: ExtractionDiagnosticDecision;
  source: ExtractionDiagnosticSource;
  /** Parsed value as the parser produced it (may include % / °). */
  parsedValue: string | null;
  /** Normalized/repaired value when it differs from the parsed value. */
  repairedValue: string | null;
  /** Legacy confidence band, if available. */
  confidence: FieldConfidence;
  /** Whether the field label keyword appears anywhere in the raw text. */
  labelPresentInRawText: boolean;
  /** Whether the accepted value appears recoverable from the raw text. */
  valuePresentInRawText: boolean;
  /** Best-effort raw text snippet around the value or its label keyword. */
  rawEvidence: string | null;
  /** Why a field was rejected/missing (when not accepted). */
  rejectionReason: string | null;
  // CROP-HOOK: add `crop?: { page: number; bbox: [number,number,number,number]; imageDataUrl?: string }`
};

export type ExtractionDiagnosticReport = {
  reportNumber: string;
  lab: string;
  /** Detected parser route (e.g. igi-standard, gcal-sarine-4cs, gia-modern) or "generic". */
  reportFamily: string;
  /** Fallback stage the parser landed on (text-layer, ocr, diagram, etc.). */
  fallbackStage?: string;
  /** Coarse text channel: pdf-text | ocr | manual | none. */
  textMethod: string;
  usedImageOCR: boolean;
  pdfTextLayerLength: number;
  gcalImageOnlyPdf: boolean;
  rawTextLength: number;
  rawTextSnippet: string;
  warnings: string[];
  /** All report fields, in canonical order. */
  fields: ExtractionDiagnosticField[];
  /** Convenience subset: only the nine sprint target fields. */
  targetFields: ExtractionDiagnosticField[];
  /** Pass-through of any candidate/crop assessment metadata the parser exposed. */
  candidateMeta?: Record<string, unknown>;
  /** Quick rollups for scanning a run. */
  summary: {
    accepted: number;
    rejected: number;
    missing: number;
    targetAccepted: number;
    targetTotal: number;
  };
};

/** The nine fields this sprint focuses on. */
export const DIAGNOSTIC_TARGET_FIELDS: ReportFieldKey[] = [
  "tablePercent",
  "depthPercent",
  "crownAngle",
  "pavilionAngle",
  "lowerHalfPercent",
  "starLengthPercent",
  "girdle",
  "culet",
  "measurements",
];

const FIELD_LABELS: Record<ReportFieldKey, string> = {
  shape: "Shape",
  carat: "Carat",
  measurements: "Measurements",
  tablePercent: "Table %",
  depthPercent: "Depth %",
  crownAngle: "Crown angle",
  pavilionAngle: "Pavilion angle",
  lowerHalfPercent: "Lower half %",
  starLengthPercent: "Star length %",
  girdle: "Girdle",
  culet: "Culet",
  polish: "Polish",
  symmetry: "Symmetry",
  fluorescence: "Fluorescence",
  cutGrade: "Cut grade",
};

/** Keyword probes used only to tell "rejected" (label seen, no value) from "missing". */
const FIELD_LABEL_KEYWORDS: Partial<Record<ReportFieldKey, string[]>> = {
  measurements: ["measurement"],
  tablePercent: ["table"],
  depthPercent: ["depth"],
  crownAngle: ["crown angle", "crown"],
  pavilionAngle: ["pavilion angle", "pavilion"],
  lowerHalfPercent: ["lower half", "lower-half", "lower girdle", "lower"],
  starLengthPercent: ["star length", "star"],
  girdle: ["girdle"],
  culet: ["culet"],
  polish: ["polish"],
  symmetry: ["symmetry"],
  fluorescence: ["fluorescence", "fluor"],
  cutGrade: ["cut grade", "cut:"],
};

function normalizeProbe(s: string): string {
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}

function keywordPresent(rawTextLower: string, key: ReportFieldKey): boolean {
  const kws = FIELD_LABEL_KEYWORDS[key];
  if (!kws?.length) return false;
  return kws.some((kw) => rawTextLower.includes(kw));
}

/**
 * Best-effort raw snippet around the value (when accepted) or around the first
 * matching label keyword (when empty). Visibility-only; not used for parsing.
 */
function findRawEvidence(
  rawText: string,
  value: string,
  key: ReportFieldKey,
): string | null {
  if (!rawText.trim()) return null;
  const probe = rawText.replace(/\s+/g, " ");
  const probeLower = probe.toLowerCase();

  const needles: string[] = [];
  const v = value.trim();
  if (v) {
    const nums = v.match(/\d+(?:\.\d+)?/g);
    if (nums?.length) needles.push(...nums);
    else needles.push(v);
  }
  for (const kw of FIELD_LABEL_KEYWORDS[key] ?? []) needles.push(kw);

  for (const needle of needles) {
    const idx = probeLower.indexOf(needle.toLowerCase());
    if (idx === -1) continue;
    const start = Math.max(0, idx - 32);
    const end = Math.min(probe.length, idx + needle.length + 32);
    const snippet = probe.slice(start, end).trim();
    return `${start > 0 ? "…" : ""}${snippet}${end < probe.length ? "…" : ""}`;
  }
  return null;
}

export type BuildExtractionDiagnosticInput = {
  /** Works with ExtractionResult or FinalizedCalibrationExtraction. */
  extraction: ExtractionResult;
  rawText: string;
  /** Normalized fields (e.g. finalized.fieldsNormalized) for repaired-value diff. */
  normalizedFields?: CalibrationReportFields;
  usedImageOCR?: boolean;
  hydrationFieldKeys?: ReportFieldKey[];
  reportNumber?: string;
  lab?: string;
  pdfTextLayerLength?: number;
  gcalImageOnlyPdf?: boolean;
};

export function buildExtractionDiagnosticReport(
  input: BuildExtractionDiagnosticInput,
): ExtractionDiagnosticReport {
  const { extraction, rawText } = input;
  const provenance = buildFieldProvenanceFromExtraction(extraction, rawText, {
    usedImageOCR: input.usedImageOCR,
    hydrationFieldKeys: input.hydrationFieldKeys,
  });
  const rawLower = normalizeProbe(rawText);
  const targetSet = new Set(DIAGNOSTIC_TARGET_FIELDS);

  const fields: ExtractionDiagnosticField[] = REPORT_FIELD_KEYS.map((key) => {
    const parsed = extraction.fields[key]?.trim() ?? "";
    const hasValue = Boolean(parsed);
    const prov = provenance[key];
    const confidence = extraction.confidence[key] ?? "missing";
    const labelSeen = keywordPresent(rawLower, key);

    let decision: ExtractionDiagnosticDecision;
    let rejectionReason: string | null;
    if (hasValue) {
      decision = "accepted";
      rejectionReason = null;
    } else if (labelSeen) {
      // Label appears in the text but no value made it through the parser.
      decision = "rejected";
      rejectionReason =
        prov?.missingReason ??
        "field label present in report text but no value parsed";
    } else {
      decision = "missing";
      rejectionReason =
        prov?.missingReason ?? "field label not found in report text";
    }

    const normalized = input.normalizedFields?.[key]?.trim() ?? "";
    const repairedValue =
      normalized && normalized !== parsed ? normalized : null;

    return {
      field: key,
      label: FIELD_LABELS[key],
      target: targetSet.has(key),
      decision,
      source: {
        method: prov?.extractionMethod ?? "unavailable",
        textMethod: extraction.textMethod ?? "none",
        extractionClass: prov?.extractionClass ?? "UNAVAILABLE",
        valueSource: prov?.valueSource ?? "extracted",
      },
      parsedValue: hasValue ? parsed : null,
      repairedValue,
      confidence,
      labelPresentInRawText: labelSeen,
      valuePresentInRawText: prov?.presentInRawText ?? false,
      rawEvidence: findRawEvidence(rawText, parsed, key),
      rejectionReason,
    };
  });

  const targetFields = fields.filter((f) => f.target);
  const candidateMeta =
    (extraction.extractionMeta?.numericCandidates as
      | Record<string, unknown>
      | undefined) ??
    (extraction.extractionMeta?.cropAssessments as
      | Record<string, unknown>
      | undefined);

  return {
    reportNumber:
      input.reportNumber?.trim() ||
      extraction.metadata?.reportNumber?.trim() ||
      "",
    lab: input.lab?.trim() || extraction.metadata?.lab?.trim() || "",
    reportFamily: extraction.parserType ?? "generic",
    fallbackStage: extraction.extractionMeta?.fallbackStage
      ? String(extraction.extractionMeta.fallbackStage)
      : undefined,
    textMethod: extraction.textMethod ?? "none",
    usedImageOCR: Boolean(input.usedImageOCR),
    pdfTextLayerLength:
      input.pdfTextLayerLength ??
      extraction.extractionMeta?.pdfTextLayerLength ??
      0,
    gcalImageOnlyPdf:
      input.gcalImageOnlyPdf ??
      Boolean(extraction.extractionMeta?.gcalImageOnlyPdf),
    rawTextLength: rawText.length,
    rawTextSnippet: rawText.slice(0, 600),
    warnings: extraction.warnings ?? [],
    fields,
    targetFields,
    candidateMeta,
    summary: {
      accepted: fields.filter((f) => f.decision === "accepted").length,
      rejected: fields.filter((f) => f.decision === "rejected").length,
      missing: fields.filter((f) => f.decision === "missing").length,
      targetAccepted: targetFields.filter((f) => f.decision === "accepted")
        .length,
      targetTotal: targetFields.length,
    },
  };
}
