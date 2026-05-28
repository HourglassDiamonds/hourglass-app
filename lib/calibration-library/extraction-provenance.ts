import type {
  ExtractionResult,
  FieldConfidence,
  ReportFieldKey,
  TextExtractionMethod,
} from "./types";
import { REPORT_FIELD_KEYS } from "./types";

/** Deterministic extraction confidence class (metadata only — does not affect scoring). */
export const EXTRACTION_CONFIDENCE_CLASSES = [
  "EXACT_TEXT",
  "DIRECT_DIAGRAM",
  "OCR_VERIFIED",
  "OCR_LOW_CONFIDENCE",
  "MANUAL_REQUIRED",
  "UNAVAILABLE",
] as const;

export type ExtractionConfidenceClass =
  (typeof EXTRACTION_CONFIDENCE_CLASSES)[number];

/** How a persisted value entered the calibration record. */
export const VALUE_PROVENANCE_SOURCES = [
  "extracted",
  "ocr",
  "diagram",
  "manual-user",
  "manual-admin",
  "migrated",
  "synthetic-fixture",
] as const;

export type ValueProvenanceSource = (typeof VALUE_PROVENANCE_SOURCES)[number];

export type FieldExtractionProvenance = {
  extractionClass: ExtractionConfidenceClass;
  valueSource: ValueProvenanceSource;
  /** pdf-text | ocr | diagram-island | hydration | parser | manual | synthetic | unavailable */
  extractionMethod: string;
  legacyConfidence: FieldConfidence;
  /** Whether normalized value appears recoverable from supplied raw text. */
  presentInRawText: boolean;
  missingReason?: string;
};

export type FieldProvenanceMap = Partial<
  Record<ReportFieldKey, FieldExtractionProvenance>
>;

export type ValueProvenanceMap = Partial<
  Record<ReportFieldKey, ValueProvenanceSource>
>;

const PROPORTION_KEYS: ReportFieldKey[] = [
  "tablePercent",
  "depthPercent",
  "crownAngle",
  "pavilionAngle",
  "lowerHalfPercent",
  "starLengthPercent",
];

const FINISH_KEYS: ReportFieldKey[] = [
  "girdle",
  "culet",
  "polish",
  "symmetry",
  "fluorescence",
  "cutGrade",
];

function normalizeProbe(s: string): string {
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}

export function valuePresentInRawText(
  rawText: string,
  value: string,
): boolean {
  const v = value.trim();
  if (!v || !rawText.trim()) return false;
  const probe = normalizeProbe(rawText);
  const needle = normalizeProbe(v);
  if (probe.includes(needle)) return true;
  const num = v.match(/\d+(?:\.\d+)?/g);
  if (!num?.length) return false;
  return num.every((n) => probe.includes(n.toLowerCase()));
}

function classifyLegacyConfidence(
  legacy: FieldConfidence,
  textMethod: TextExtractionMethod | undefined,
  hasValue: boolean,
): ExtractionConfidenceClass {
  if (!hasValue) {
    if (legacy === "missing") return "UNAVAILABLE";
    return "MANUAL_REQUIRED";
  }
  if (legacy === "manual") return "MANUAL_REQUIRED";
  if (textMethod === "ocr") {
    if (legacy === "high") return "OCR_VERIFIED";
    if (legacy === "medium") return "OCR_VERIFIED";
    return "OCR_LOW_CONFIDENCE";
  }
  if (textMethod === "pdf-text") {
    if (legacy === "high") return "EXACT_TEXT";
    if (legacy === "medium") return "DIRECT_DIAGRAM";
    return "OCR_LOW_CONFIDENCE";
  }
  if (legacy === "high") return "EXACT_TEXT";
  if (legacy === "medium") return "DIRECT_DIAGRAM";
  return "OCR_LOW_CONFIDENCE";
}

function inferValueSource(
  extractionClass: ExtractionConfidenceClass,
  key: ReportFieldKey,
  textMethod: TextExtractionMethod | undefined,
  usedImageOCR?: boolean,
): ValueProvenanceSource {
  if (extractionClass === "UNAVAILABLE" || extractionClass === "MANUAL_REQUIRED") {
    return "extracted";
  }
  if (usedImageOCR && PROPORTION_KEYS.includes(key)) return "diagram";
  if (textMethod === "ocr") return "ocr";
  if (PROPORTION_KEYS.includes(key) && extractionClass === "DIRECT_DIAGRAM") {
    return "diagram";
  }
  return "extracted";
}

function inferExtractionMethod(
  extractionClass: ExtractionConfidenceClass,
  key: ReportFieldKey,
  textMethod: TextExtractionMethod | undefined,
  usedImageOCR?: boolean,
  hydrationUsed?: boolean,
): string {
  if (extractionClass === "UNAVAILABLE") return "unavailable";
  if (extractionClass === "MANUAL_REQUIRED") return "manual";
  if (usedImageOCR && PROPORTION_KEYS.includes(key)) return "diagram-ocr";
  if (hydrationUsed && PROPORTION_KEYS.includes(key)) return "hydration";
  if (textMethod === "pdf-text" && extractionClass === "EXACT_TEXT") {
    return "pdf-text";
  }
  if (textMethod === "ocr") return "ocr";
  if (extractionClass === "DIRECT_DIAGRAM") return "diagram";
  return "parser";
}

function missingReasonFor(
  key: ReportFieldKey,
  hasValue: boolean,
  textMethod: TextExtractionMethod | undefined,
  rawTextLength: number,
): string | undefined {
  if (hasValue) return undefined;
  if (rawTextLength === 0) return "no report text supplied";
  if (PROPORTION_KEYS.includes(key)) {
    if (textMethod === "pdf-text") {
      return "proportion diagram not in PDF text layer — OCR or manual required";
    }
    return "proportion value not recovered from text/OCR";
  }
  if (FINISH_KEYS.includes(key)) {
    return "finish line not recovered from text/OCR region";
  }
  return "field not detected by parser";
}

export function buildFieldProvenanceFromExtraction(
  result: ExtractionResult,
  rawText: string,
  opts?: {
    usedImageOCR?: boolean;
    hydrationFieldKeys?: ReportFieldKey[];
    syntheticFixture?: boolean;
    migrated?: boolean;
  },
): FieldProvenanceMap {
  const map: FieldProvenanceMap = {};
  const textMethod = result.textMethod;
  const hydrationSet = new Set(opts?.hydrationFieldKeys ?? []);

  for (const key of REPORT_FIELD_KEYS) {
    const value = result.fields[key]?.trim() ?? "";
    const hasValue = Boolean(value);
    const legacy = result.confidence[key] ?? "missing";

    if (opts?.syntheticFixture) {
      map[key] = {
        extractionClass: hasValue ? "EXACT_TEXT" : "UNAVAILABLE",
        valueSource: "synthetic-fixture",
        extractionMethod: "synthetic",
        legacyConfidence: "manual",
        presentInRawText: false,
        missingReason: hasValue ? undefined : "synthetic fixture field empty",
      };
      continue;
    }

    const extractionClass = classifyLegacyConfidence(
      legacy,
      textMethod,
      hasValue,
    );
    const valueSource: ValueProvenanceSource = opts?.migrated
      ? "migrated"
      : inferValueSource(extractionClass, key, textMethod, opts?.usedImageOCR);

    map[key] = {
      extractionClass,
      valueSource,
      extractionMethod: inferExtractionMethod(
        extractionClass,
        key,
        textMethod,
        opts?.usedImageOCR,
        hydrationSet.has(key),
      ),
      legacyConfidence: legacy,
      presentInRawText: valuePresentInRawText(rawText, value),
      missingReason: missingReasonFor(
        key,
        hasValue,
        textMethod,
        rawText.length,
      ),
    };
  }

  return map;
}

export function mergeValueProvenanceOnSave(input: {
  approvedFields: Record<ReportFieldKey, string>;
  extractedFields: Record<ReportFieldKey, string>;
  prior?: ValueProvenanceMap;
  actor?: "manual-user" | "manual-admin";
}): ValueProvenanceMap {
  const out: ValueProvenanceMap = { ...input.prior };
  const actor = input.actor ?? "manual-user";

  for (const key of REPORT_FIELD_KEYS) {
    const approved = input.approvedFields[key]?.trim() ?? "";
    const extracted = input.extractedFields[key]?.trim() ?? "";
    if (!approved) {
      out[key] = out[key] ?? "extracted";
      continue;
    }
    if (approved !== extracted) {
      out[key] = actor;
      continue;
    }
    if (!out[key]) out[key] = "extracted";
  }

  return out;
}
