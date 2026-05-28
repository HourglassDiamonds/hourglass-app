import { FIELD_LABELS } from "./fields";
import type { CalibrationSafetyAssessment } from "./calibration-safety";
import type {
  FieldExtractionProvenance,
  FieldProvenanceMap,
} from "./extraction-provenance";
import type { FinalizedCalibrationExtraction } from "./finalize-calibration-extraction";
import type {
  CalibrationReportFields,
  FieldConfidence,
  ReportFieldKey,
  TextExtractionMethod,
} from "./types";
import { REPORT_FIELD_KEYS } from "./types";

const PROPORTION_CORE: ReportFieldKey[] = [
  "tablePercent",
  "depthPercent",
  "crownAngle",
  "pavilionAngle",
];

const IGI_OPTIONAL_PROPORTIONS: ReportFieldKey[] = [
  "lowerHalfPercent",
  "starLengthPercent",
];

/** Parser warnings replaced by structured reviewer guidance. */
const SUPERSEDED_WARNING_PATTERNS: RegExp[] = [
  /^Not detected from report text/i,
  /^Some values were read via OCR/i,
  /^Few fields were detected/i,
  /: low extraction confidence — verify all fields manually/i,
];

export function textMethodReviewLabel(
  method?: TextExtractionMethod,
): string {
  switch (method) {
    case "pdf-text":
      return "PDF text layer (selectable text)";
    case "ocr":
      return "OCR (scanned pages or diagram regions)";
    case "manual":
      return "Pasted or manual text";
    case "none":
      return "No text extracted";
    default:
      return method ?? "Unknown";
  }
}

export function ingestionStatusLine(input: {
  calibrationEligible: boolean;
  excludedFromCalibrationStats?: boolean;
  corpusReviewFlags?: string[];
  safety: CalibrationSafetyAssessment;
}): string {
  if (input.corpusReviewFlags?.includes("manual_core_override")) {
    return "Calibration status: saved for review — manual core edits exclude this record from calibration statistics.";
  }
  if (input.excludedFromCalibrationStats && !input.calibrationEligible) {
    return "Calibration status: review-only — verify fields on the report; not calibration-statistics eligible until core proportions are complete and trusted.";
  }
  if (input.calibrationEligible) {
    return "Calibration status: structurally eligible for calibration statistics after save (confirm each value on the report first).";
  }
  return "Calibration status: review-only — complete or verify flagged fields before corpus calibration use.";
}

function lowConfidenceReason(prov?: FieldExtractionProvenance): string {
  if (!prov) return "OCR or diagram extraction";
  if (
    prov.valueSource === "ocr" ||
    prov.extractionMethod.includes("ocr")
  ) {
    return "value from OCR";
  }
  if (
    prov.valueSource === "diagram" ||
    prov.extractionMethod.includes("diagram")
  ) {
    return "value from diagram extraction";
  }
  if (prov.extractionClass === "OCR_LOW_CONFIDENCE") {
    return "OCR low confidence";
  }
  if (!prov.presentInRawText) {
    return "not verified in PDF text layer";
  }
  return "parser low confidence";
}

function fieldUsedOcrOrDiagram(
  key: ReportFieldKey,
  map?: FieldProvenanceMap,
): boolean {
  const p = map?.[key];
  if (!p) return false;
  return (
    p.valueSource === "ocr" ||
    p.valueSource === "diagram" ||
    p.extractionMethod.includes("ocr") ||
    p.extractionMethod.includes("diagram")
  );
}

function extractionUsedOcr(finalized: FinalizedCalibrationExtraction): boolean {
  if (finalized.textMethod === "ocr") return true;
  return REPORT_FIELD_KEYS.some(
    (k) =>
      Boolean(finalized.fields[k]?.trim()) &&
      fieldUsedOcrOrDiagram(k, finalized.fieldProvenance),
  );
}

function missingFieldLabels(fields: CalibrationReportFields): string[] {
  return REPORT_FIELD_KEYS.filter((k) => !fields[k]?.trim()).map(
    (k) => FIELD_LABELS[k],
  );
}

function lowConfidenceFieldLines(
  fields: CalibrationReportFields,
  confidence: Record<ReportFieldKey, FieldConfidence>,
  provenance?: FieldProvenanceMap,
): string {
  const keys = REPORT_FIELD_KEYS.filter(
    (k) => fields[k]?.trim() && confidence[k] === "low",
  );
  if (keys.length === 0) return "";
  const parts = keys.map((k) => {
    const why = lowConfidenceReason(provenance?.[k]);
    return `${FIELD_LABELS[k]} (${why})`;
  });
  return `Low confidence — verify on report: ${parts.join("; ")}.`;
}

function labSpecificNotices(finalized: FinalizedCalibrationExtraction): string[] {
  const notices: string[] = [];
  const missing = REPORT_FIELD_KEYS.filter((k) => !finalized.fields[k]?.trim());

  if (
    finalized.metadata.lab === "IGI" &&
    IGI_OPTIONAL_PROPORTIONS.some((k) => missing.includes(k))
  ) {
    notices.push(
      "IGI: lower-half and star length are not on every report — leave blank when not printed.",
    );
  }

  if (
    finalized.parserType === "gcal-sarine-4cs" &&
    PROPORTION_CORE.some((k) => missing.includes(k))
  ) {
    notices.push(
      "GCAL Sarine: proportion fields are often diagram-only — compare the Sarine proportion panel before saving.",
    );
  }

  if (
    finalized.parserType === "gcal-sarine-4cs" &&
    finalized.parserConfidence === "low"
  ) {
    notices.push(
      "GCAL Sarine (4Cs): incomplete proportion read — confirm table, depth, and angles against the diagram.",
    );
  }

  return notices;
}

function filterParserWarnings(existing: string[]): string[] {
  return existing.filter(
    (w) =>
      w.trim().length > 0 &&
      !SUPERSEDED_WARNING_PATTERNS.some((re) => re.test(w)),
  );
}

function dedupeWarnings(lines: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of lines) {
    const key = line.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

/**
 * Ordered reviewer guidance + retained parser notices (does not affect scoring).
 */
export function buildReviewGuidanceWarnings(
  finalized: FinalizedCalibrationExtraction,
): string[] {
  const structured: string[] = [];
  const hasValues = REPORT_FIELD_KEYS.some((k) =>
    Boolean(finalized.fields[k]?.trim()),
  );

  structured.push(
    `Text source: ${textMethodReviewLabel(finalized.textMethod)}.`,
  );
  structured.push(
    ingestionStatusLine({
      calibrationEligible: finalized.calibrationEligible,
      excludedFromCalibrationStats: finalized.excludedFromCalibrationStats,
      corpusReviewFlags: finalized.corpusReviewFlags,
      safety: finalized.calibrationSafety,
    }),
  );

  if (extractionUsedOcr(finalized) && hasValues) {
    structured.push(
      "Some values were read via OCR — confirm each field against the report before saving.",
    );
  } else if (finalized.textMethod === "pdf-text" && hasValues) {
    structured.push(
      "Values from the PDF text layer — spot-check proportion diagram numbers if the layout is image-heavy.",
    );
  }

  const missingLabels = missingFieldLabels(finalized.fields);
  if (missingLabels.length > 0) {
    structured.push(
      `Not detected from report text — review manually: ${missingLabels.join(", ")}.`,
    );
  }

  const lowLine = lowConfidenceFieldLines(
    finalized.fields,
    finalized.confidence,
    finalized.fieldProvenance,
  );
  if (lowLine) structured.push(lowLine);

  structured.push(...labSpecificNotices(finalized));

  const parserNotices = filterParserWarnings(finalized.warnings);

  return dedupeWarnings([...structured, ...parserNotices]);
}

export function fieldInputPlaceholder(
  confidence: FieldConfidence,
  provenance?: FieldExtractionProvenance,
): string | undefined {
  if (confidence === "missing") {
    return provenance?.missingReason
      ? `Not detected — ${provenance.missingReason}`
      : "Not detected — enter from report";
  }
  if (confidence === "low") {
    const why = lowConfidenceReason(provenance);
    return `Low confidence (${why}) — verify on report`;
  }
  return undefined;
}

export function provenanceDetailLabel(
  provenance?: FieldExtractionProvenance,
): string {
  if (!provenance) return "extracted";
  switch (provenance.valueSource) {
    case "ocr":
      return "OCR";
    case "diagram":
      return "diagram OCR";
    case "manual-user":
      return "manual (user)";
    case "manual-admin":
      return "manual (admin)";
    case "synthetic-fixture":
      return "synthetic";
    case "migrated":
      return "migrated";
    default:
      if (provenance.extractionMethod === "pdf-text") return "PDF text";
      if (provenance.extractionMethod === "hydration") return "text hydration";
      return "extracted";
  }
}
