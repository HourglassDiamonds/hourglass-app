import { emptyReportFields } from "../fields";
import {
  logExtractPipeline,
  shouldLogExtractPipeline,
  snapshotProportionFields,
} from "../extract-debug";
import {
  applyLabFieldOverrides,
  extractCommonProportionFields,
} from "../lab-parsers";
import type {
  CalibrationReportFields,
  FieldConfidence,
  GcalInternalFields,
  GiaInternalFields,
  IgiInternalFields,
  ReportFieldKey,
  TextExtractionMethod,
} from "../types";
import { REPORT_FIELD_KEYS } from "../types";
import { extractGcal8xFields } from "./gcal/gcal-8x";
import {
  extractGcalSarine4csFields,
  hasSarineColumnListSignature,
} from "./gcal/gcal-sarine-4cs";
import { looksLikeGcal8xReportText } from "./gcal/gcal-layout-detector";
import { extractGiaProportionFields, getGiaOcrDiagramExtractionWarnings } from "../gia-proportions";
import { extractIgiProportionFields } from "../igi-proportions";
import { capConfidenceForOcr, coreFieldConfidence, lowConfidenceWarning } from "./shared/confidence";
import { normalizeDocumentText } from "./shared/normalization";
import { detectReportFamily } from "./router";
import type {
  ExtractionFallbackStage,
  ExtractionMeta,
  ParserConfidence,
  ParserParseResult,
  ParserType,
} from "./types";

export type ExecuteParserHints = {
  lab?: string;
  reportNumber?: string;
  textMethod?: TextExtractionMethod;
  pdfTextLayerLength?: number;
  usedImageOCR?: boolean;
  gcalImageOnlyPdf?: boolean;
  /** Image/screenshot upload — enables flat-OCR proportion window fallback. */
  screenshotUpload?: boolean;
};

function fallbackStageFromHints(hints?: ExecuteParserHints): ExtractionFallbackStage {
  if (hints?.gcalImageOnlyPdf && (hints.pdfTextLayerLength ?? 0) === 0) {
    return hints?.usedImageOCR ? "image-region-ocr" : "scoped-ocr";
  }
  if (hints?.usedImageOCR) return "image-region-ocr";
  if (hints?.textMethod === "ocr") return "scoped-ocr";
  if (hints?.textMethod === "pdf-text" && (hints.pdfTextLayerLength ?? 0) > 0) {
    return "text-layer";
  }
  if ((hints?.pdfTextLayerLength ?? 0) === 0 && hints?.textMethod !== "manual") {
    return "scoped-ocr";
  }
  return hints?.textMethod === "manual" ? "manual-review" : "text-layer";
}

/**
 * Route → scoped parser execution. Parsers never self-select family.
 */
export function executeParserForText(
  rawText: string,
  hints?: ExecuteParserHints,
): ParserParseResult {
  const text = normalizeDocumentText(rawText);
  const family = detectReportFamily(text, {
    lab: hints?.lab,
    gcalImageOnlyPdf: hints?.gcalImageOnlyPdf,
  });

  const fields = emptyReportFields();
  const confidence = Object.fromEntries(
    REPORT_FIELD_KEYS.map((k) => [k, "manual" as FieldConfidence]),
  ) as Record<ReportFieldKey, FieldConfidence>;

  const fromOcr = hints?.textMethod === "ocr";
  const igiInternal: IgiInternalFields = {};
  const giaInternal: GiaInternalFields = {};
  const gcalInternal: GcalInternalFields = {};
  const warnings: string[] = [];

  const extractionMeta: ExtractionMeta = {
    usedImageOCR: hints?.usedImageOCR ?? false,
    pdfTextLayerLength: hints?.pdfTextLayerLength ?? 0,
    gcalImageOnlyPdf: hints?.gcalImageOnlyPdf,
    fallbackStage: fallbackStageFromHints(hints),
  };

  const setField = (
    key: ReportFieldKey,
    value: string,
    level: FieldConfidence,
  ) => {
    if (!value.trim()) return;
    fields[key] = value.trim();
    confidence[key] = fromOcr ? capConfidenceForOcr(level) : level;
  };

  let parserType: ParserType = family.parserType;
  let parserConfidence: ParserConfidence = family.confidence;
  let fallbackParserUsed: ParserType | undefined;

  if (text.length > 0) {
    switch (family.parserType) {
      case "gcal-sarine-4cs": {
        if (
          !hasSarineColumnListSignature(text) &&
          looksLikeGcal8xReportText(text)
        ) {
          fallbackParserUsed = "gcal-8x";
          parserType = "gcal-8x";
          const meta = extractGcal8xFields(rawText, fields, setField, gcalInternal, {
            screenshotUpload: hints?.screenshotUpload,
          });
          parserConfidence = meta.parserConfidence;
          warnings.push(
            "Sarine router matched but column-list signature absent — used GCAL 8X parser fallback.",
          );
          break;
        }

        const diagramAnchor = text.search(
          /\b(?:57|58|61)\s*%|\b612\s*%|\b340\s*°|\bproportion\s+diagram/i,
        );
        const proportionOcrText =
          diagramAnchor >= 0 ? text.slice(diagramAnchor, diagramAnchor + 500) : "";
        const meta = extractGcalSarine4csFields(
          text,
          fields,
          setField,
          gcalInternal,
          proportionOcrText,
        );
        extractionMeta.numericCandidates = meta.proportionCandidates;
        extractionMeta.proportionWindowLength = proportionOcrText.length;
        parserConfidence = coreFieldConfidence(fields, [
          "shape",
          "carat",
          "measurements",
          "depthPercent",
          "crownAngle",
          "pavilionAngle",
          "tablePercent",
        ]);
        break;
      }
      case "gcal-8x": {
        const meta = extractGcal8xFields(rawText, fields, setField, gcalInternal, {
          screenshotUpload: hints?.screenshotUpload,
        });
        parserConfidence = meta.parserConfidence;
        break;
      }
      case "igi-standard":
      case "igi-inline": {
        extractIgiProportionFields(text, fields, setField, igiInternal);
        break;
      }
      case "gia-modern":
      case "gia-legacy": {
        extractGiaProportionFields(
          rawText,
          fields,
          setField,
          giaInternal,
          hints?.reportNumber,
          hints?.textMethod,
        );
        warnings.push(
          ...getGiaOcrDiagramExtractionWarnings(rawText, hints?.textMethod),
        );
        break;
      }
      default: {
        extractCommonProportionFields(text, setField);
        applyLabFieldOverrides(text, family.lab, setField);
        parserType = "generic";
        parserConfidence = "low";
        warnings.push(
          "No specialized report family matched — enter or verify fields manually.",
        );
        break;
      }
    }
  } else {
    extractionMeta.fallbackStage = "manual-review";
    warnings.push("No report text to parse — manual review required.");
  }

  const lowWarn = lowConfidenceWarning(parserConfidence, parserType);
  if (lowWarn) warnings.push(lowWarn);

  if (parserConfidence === "low" && extractionMeta.fallbackStage !== "manual-review") {
    extractionMeta.fallbackStage = "manual-review";
  }

  return {
    parserType,
    parserConfidence,
    fields,
    confidence,
    igiInternal: Object.keys(igiInternal).length ? igiInternal : undefined,
    giaInternal: Object.keys(giaInternal).length ? giaInternal : undefined,
    gcalInternal: Object.keys(gcalInternal).length ? gcalInternal : undefined,
    warnings,
    extractionMeta,
    fallbackParserUsed,
  };
}

export function logParserSelection(
  rawText: string,
  reportNumberHint: string | undefined,
  textMethod: TextExtractionMethod | undefined,
): void {
  if (!shouldLogExtractPipeline(rawText, reportNumberHint)) return;
  const text = normalizeDocumentText(rawText);
  const family = detectReportFamily(text);
  logExtractPipeline("3.parser-router", {
    ...family,
    textMethod: textMethod ?? "none",
    fieldsAfterCommon: snapshotProportionFields(emptyReportFields()),
  });
}
