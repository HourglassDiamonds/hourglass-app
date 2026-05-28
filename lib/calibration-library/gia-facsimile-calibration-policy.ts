import type { GiaFacsimileGirdleEvidence } from "./parsers/types";
import {
  extractGiaGirdleFromFacsimileGradingResultsFragment,
  needsGiaProportionOcrSupplement,
  normalizeGiaProportionBlockText,
} from "./gia-proportions";
import type { ExtractionResult } from "./types";
import type { FieldProvenanceMap } from "./extraction-provenance";
import type { CalibrationReportFields, CalibrationWorkbookEntry, ReportFieldKey } from "./types";

/** LP calibration drivers — mirrors light-performance-test-rows LP_TEST_REQUIRED_KEYS. */
const LP_CORE_PROPORTION_DRIVER_KEYS: ReportFieldKey[] = [
  "shape",
  "tablePercent",
  "depthPercent",
  "crownAngle",
  "pavilionAngle",
];

function isPlausibleGirdleThicknessPercent(n: number): boolean {
  return n >= 2 && n <= 6;
}

function findFacsimileGirdlePercentToken(text: string): string | null {
  const norm = normalizeGiaProportionBlockText(text);
  const anchor = norm.search(/\bgrading\s+results\b|\(faceted\)|\bfactted\)|\bfaceted\)/i);
  const window =
    anchor >= 0 ? norm.slice(Math.max(0, anchor - 40), anchor + 420) : norm.slice(0, 520);
  for (const m of window.matchAll(/(?<![\d.])(\d{1,2}(?:\.\d+)?)\s*%/gi)) {
    const v = parseFloat(m[1]!);
    if (Number.isFinite(v) && isPlausibleGirdleThicknessPercent(v)) {
      return `${v}%`;
    }
  }
  return null;
}

/** True when OCR/text contains a recoverable girdle thickness phrase (not faceted+% alone). */
export function giaFacsimileGirdleThicknessPhraseInText(text: string): boolean {
  const norm = normalizeGiaProportionBlockText(text);
  if (extractGiaGirdleFromFacsimileGradingResultsFragment(text)) return true;
  return (
    /\bmedium\b[\s\-–—]{0,24}\bsligh\w*\s+thick\b/i.test(norm) ||
    /\bsligh\w*\s+thick\b[\s\-–—]{0,24}\bmedium\b/i.test(norm) ||
    (/\bgirdle\b/i.test(norm) &&
      /\bmedium\b/i.test(norm) &&
      /\b(?:sligh\w*\s+)?thick\b/i.test(norm))
  );
}

/** Probe facsimile OCR for girdle evidence without fabricating a girdle field value. */
export function probeGiaFacsimileGirdleEvidence(
  text: string,
): GiaFacsimileGirdleEvidence | null {
  const norm = normalizeGiaProportionBlockText(text);
  const faceted = /(?:\(faceted\)|\bfactted\)|\bfaceted\))/i.test(norm);
  const percent = findFacsimileGirdlePercentToken(text);
  const phraseRecovered = giaFacsimileGirdleThicknessPhraseInText(text);
  if (!faceted && !percent && !phraseRecovered) return null;
  return { faceted, percent, phraseRecovered };
}

export function isGiaFacsimileParserType(
  parserType: string | undefined,
): boolean {
  return parserType === "gia-modern" || parserType === "gia-legacy";
}

export function hasLpCoreProportionDrivers(
  fields: CalibrationReportFields,
): boolean {
  return LP_CORE_PROPORTION_DRIVER_KEYS.every((k) =>
    Boolean(fields[k]?.trim()),
  );
}

export function getGiaFacsimileGirdleEvidence(
  entry: CalibrationWorkbookEntry,
): GiaFacsimileGirdleEvidence | undefined {
  return entry.parserMetadata?.extractionMeta?.giaFacsimileGirdleEvidence;
}

/** Facsimile OCR saw faceted / % but thickness phrase was not recovered into girdle. */
export function isGiaFacsimileGirdlePhraseUnreadable(
  entry: CalibrationWorkbookEntry,
): boolean {
  const fields = entry.fieldsNormalized ?? entry.fields;
  if (fields.girdle?.trim()) return false;
  if (!isGiaFacsimileParserType(entry.parserType)) return false;
  const evidence = getGiaFacsimileGirdleEvidence(entry);
  if (!evidence || evidence.phraseRecovered) return false;
  return evidence.faceted || Boolean(evidence.percent);
}

export function applyGirdleProvenanceForFacsimileEvidence(
  map: FieldProvenanceMap,
  evidence: GiaFacsimileGirdleEvidence,
): void {
  map.girdle = {
    extractionClass: "UNAVAILABLE",
    valueSource: "extracted",
    extractionMethod: "ocr",
    legacyConfidence: "missing",
    presentInRawText: false,
    missingReason:
      "GIA facsimile: girdle thickness phrase not recovered from OCR (faceted/percent fragments only)",
  };
}

/** Attach facsimile girdle evidence + review warning when OCR lacks thickness phrase. */
export function enrichGiaFacsimileExtractionPolicy(
  result: ExtractionResult,
  rawText: string,
): void {
  if (result.metadata.lab !== "GIA") return;
  if (result.fields.girdle?.trim()) return;
  const facsimile =
    result.textMethod === "ocr" || needsGiaProportionOcrSupplement(rawText);
  if (!facsimile) return;

  const evidence = probeGiaFacsimileGirdleEvidence(rawText);
  if (!evidence || evidence.phraseRecovered) return;
  if (!evidence.faceted && !evidence.percent) return;

  const base = result.extractionMeta ?? {
    usedImageOCR: false,
    pdfTextLayerLength: 0,
    fallbackStage: "scoped-ocr" as const,
  };
  result.extractionMeta = {
    ...base,
    giaFacsimileGirdleEvidence: evidence,
  };

  const warning =
    "GIA facsimile: girdle thickness phrase not readable from OCR — review recommended.";
  if (!result.warnings.includes(warning)) {
    result.warnings.push(warning);
  }

  if (result.fieldProvenance) {
    applyGirdleProvenanceForFacsimileEvidence(
      result.fieldProvenance,
      evidence,
    );
  }
}

export const GIA_FACSIMILE_GIRDLE_UNREADABLE_FLAG =
  "gia_girdle_phrase_unreadable" as const;
