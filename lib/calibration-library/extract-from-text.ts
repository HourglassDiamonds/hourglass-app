import { emptyReportFields } from "./fields";
import { finalizeCalibrationExtractionResult } from "./finalize-calibration-extraction";
import {
  EXTRACT_PIPELINE_FIELD_KEYS,
  logExtractPipeline,
  logHydrationMergeBoundary,
  shouldLogExtractPipeline,
  shouldLogForensicHydration,
  snapshotProportionFields,
} from "./extract-debug";
import {
  applyGiaOcrFieldHydrationFallback,
  logGiaFieldsBeforeFinalize,
  logGiaProportionSlicesForDebug,
  looksLikeGiaReportText,
  probeGiaLiveFieldCandidates,
} from "./gia-proportions";
import {
  buildGiaExtractionCheck,
  logGiaExtractionCheck,
} from "./gia-extraction-check";
import {
  buildIgiExtractionCheck,
  logIgiExtractionCheck,
} from "./igi-proportions";
import {
  applyLabFieldOverrides,
  extractLabMetadataFromText,
  isIgiExtractionContext,
  normalizeCalibrationLab,
} from "./lab-parsers";
import {
  applyMissingFieldMarkers,
  applyMissingMetadataWarnings,
} from "./mark-missing";
import { executeParserForText } from "./parsers/execute-parser";
import { logGcalRoutingCheck, snapshotGcalRoutingFields } from "./parsers/gcal/gcal-routing-check";
import { looksLikeGcal8xReportText, looksLikeGcalSarine4csReportText } from "./parsers/gcal/gcal-layout-detector";
import { hasSarineColumnListSignature } from "./parsers/gcal/gcal-sarine-4cs";
import {
  buildGcalScreenshotOcrCheck,
  logGcalScreenshotOcrCheck,
  repairGcalScreenshotOcrText,
  shouldRepairGcalScreenshotOcrText,
} from "./parsers/gcal/gcal-screenshot-ocr";
import {
  detectReportFamily,
  mapParserTypeToLegacyExtraction,
} from "./parsers/router";
import type {
  CalibrationLab,
  CalibrationReportMetadata,
  ExtractionResult,
  FieldConfidence,
  ReportFieldKey,
  ReportSource,
  StoneType,
  TextExtractionMethod,
} from "./types";
import { REPORT_FIELD_KEYS } from "./types";

export type ExtractHints = {
  lab?: string;
  reportNumber?: string;
  reportUrl?: string;
  reportSource?: ReportSource;
  stoneType?: StoneType;
  textMethod?: TextExtractionMethod;
  pdfTextLayerLength?: number;
  usedImageOCR?: boolean;
  /** PDF has no text layer — GCAL 8X may need image-region OCR upstream. */
  gcalImageOnlyPdf?: boolean;
};

function resolveMetadataLab(
  rawText: string,
  routedLab: CalibrationLab,
  parserType?: string,
): CalibrationLab {
  if (
    isIgiExtractionContext({
      lab: routedLab,
      parserType,
      combinedText: rawText,
    })
  ) {
    return routedLab === "OTHER" ? "IGI" : routedLab;
  }
  if (parserType === "gcal-8x") {
    return "GCAL";
  }
  if (
    looksLikeGcal8xReportText(rawText) ||
    looksLikeGcalSarine4csReportText(rawText)
  ) {
    return "GCAL";
  }
  if (looksLikeGiaReportText(rawText)) return "GIA";
  return routedLab;
}

export function extractFieldsFromReportText(
  rawText: string,
  hints?: ExtractHints,
): ExtractionResult {
  const debug = shouldLogExtractPipeline(rawText, hints?.reportNumber);

  if (debug) {
    logExtractPipeline("1.raw-ocr", {
      rawTextLength: rawText.length,
      textMethod: hints?.textMethod ?? "none",
      reportNumberHint: hints?.reportNumber ?? "",
    });
  }

  const family = detectReportFamily(rawText, {
    lab: hints?.lab,
    gcalImageOnlyPdf: hints?.gcalImageOnlyPdf,
  });

  if (debug) {
    logExtractPipeline("2.lab-router", {
      detectedFamily: family,
      hintLab: hints?.lab ?? "",
    });
  }

  const screenshotUpload = hints?.reportSource === "screenshot-upload";
  let textForParser = rawText;
  if (
    shouldRepairGcalScreenshotOcrText(rawText, {
      reportSource: hints?.reportSource,
      textMethod: hints?.textMethod,
      reportNumber: hints?.reportNumber,
      lab: hints?.lab,
      pdfTextLayerLength: hints?.pdfTextLayerLength,
      gcalImageOnlyPdf: hints?.gcalImageOnlyPdf,
    })
  ) {
    const repaired = repairGcalScreenshotOcrText(rawText, {
      reportSource: hints?.reportSource,
      textMethod: hints?.textMethod,
      reportNumber: hints?.reportNumber,
      lab: hints?.lab,
    });
    textForParser = repaired.text;
    logGcalScreenshotOcrCheck(
      buildGcalScreenshotOcrCheck(
        rawText,
        repaired.text,
        repaired.repairsApplied,
        {
          reportSource: hints?.reportSource,
          reportNumber: hints?.reportNumber,
          lab: hints?.lab,
        },
      ),
    );
  }

  const parsed = executeParserForText(textForParser, {
    lab: hints?.lab,
    reportNumber: hints?.reportNumber,
    textMethod: hints?.textMethod,
    pdfTextLayerLength: hints?.pdfTextLayerLength,
    usedImageOCR: hints?.usedImageOCR,
    gcalImageOnlyPdf: hints?.gcalImageOnlyPdf,
    screenshotUpload,
  });

  if (
    family.lab === "IGI" ||
    hints?.lab === "IGI" ||
    parsed.parserType === "igi-standard" ||
    parsed.parserType === "igi-inline"
  ) {
    logIgiExtractionCheck(
      buildIgiExtractionCheck(textForParser, parsed.fields, {
        reportNumber: hints?.reportNumber,
        parserPathUsed: parsed.parserType,
      }),
    );
  }

  if (family.lab === "GCAL" || hints?.lab === "GCAL") {
    logGcalRoutingCheck({
      reportNumber: hints?.reportNumber?.trim() ?? "",
      detectedFormat: family.parserType,
      sarineColumnListSignature: hasSarineColumnListSignature(rawText),
      sarineMarkers: looksLikeGcalSarine4csReportText(rawText),
      gcal8xMarkers: looksLikeGcal8xReportText(rawText),
      parserPathUsed: parsed.parserType,
      fallbackParserUsed: parsed.fallbackParserUsed,
      fieldsRecoveredByPath: snapshotGcalRoutingFields(parsed.fields),
    });
  }

  const fields = parsed.fields;
  const confidence = parsed.confidence;
  const warnings = [...parsed.warnings];

  const isGia =
    parsed.parserType === "gia-modern" || parsed.parserType === "gia-legacy";

  const hydrationFieldKeys: ReportFieldKey[] = [];
  const fieldsBeforeGiaHydration = isGia
    ? snapshotProportionFields(fields)
    : null;

  if (
    isGia ||
    family.lab === "GIA" ||
    hints?.lab === "GIA" ||
    parsed.parserType === "gia-modern" ||
    parsed.parserType === "gia-legacy"
  ) {
    logGiaExtractionCheck(
      buildGiaExtractionCheck(textForParser, parsed.fields, {
        reportNumber: hints?.reportNumber,
        parserPathUsed: parsed.parserType,
        warnings: parsed.warnings,
      }),
    );
  }

  if (isGia && rawText.length > 0) {
    logGiaProportionSlicesForDebug(rawText);
    const fallbackGate =
      hints?.textMethod === "ocr" ||
      !fields.pavilionAngle.trim() ||
      !fields.girdle.trim();
    logHydrationMergeBoundary("[PRE GIA FALLBACK]", fields, {
      reportNumberHint: hints?.reportNumber ?? "",
      forensicProbe: rawText,
      textMethod: hints?.textMethod ?? "none",
      fallbackGate,
    });
    if (fallbackGate) {
      const setField = (
        key: ReportFieldKey,
        value: string,
        level: FieldConfidence,
      ) => {
        if (!value.trim()) return;
        fields[key] = value.trim();
        if (hints?.textMethod === "ocr") {
          // OCR-sourced values are capped one band down. Always write a
          // confidence — previously low/manual levels left the slot unwritten,
          // so a parsed value could keep a stale/"missing" marker (GIA bug).
          if (level === "high") confidence[key] = "medium";
          else if (level === "medium") confidence[key] = "low";
          else confidence[key] = level;
        } else {
          confidence[key] = level;
        }
      };
      applyGiaOcrFieldHydrationFallback(rawText, fields, setField);
      if (fieldsBeforeGiaHydration) {
        const after = snapshotProportionFields(fields);
        for (const key of EXTRACT_PIPELINE_FIELD_KEYS) {
          if (
            (fieldsBeforeGiaHydration as Record<string, string>)[key] !==
              (after as Record<string, string>)[key] &&
            fields[key]?.trim()
          ) {
            hydrationFieldKeys.push(key);
          }
        }
      }
    }
    logHydrationMergeBoundary("[POST GIA FALLBACK]", fields, {
      reportNumberHint: hints?.reportNumber ?? "",
      fallbackRan: fallbackGate,
    });
  }

  const labMeta = extractLabMetadataFromText(rawText, family.lab, {
    reportNumber: hints?.reportNumber,
    reportUrl: hints?.reportUrl,
  });

  const hintReportNo = hints?.reportNumber?.trim() ?? "";
  const detectedReportNo = labMeta.reportNumber ?? "";
  const reportNumber =
    hintReportNo && rawText.includes(hintReportNo)
      ? hintReportNo
      : detectedReportNo || hintReportNo;

  const metadata: CalibrationReportMetadata = {
    lab: resolveMetadataLab(rawText, family.lab, parsed.parserType),
    reportNumber,
    reportUrl: hints?.reportUrl?.trim() || labMeta.reportUrl,
    reportSource: hints?.reportSource ?? "manual",
    stoneType:
      hints?.stoneType && hints.stoneType !== "unknown"
        ? hints.stoneType
        : labMeta.stoneType ?? "unknown",
  };

  warnings.push(...applyMissingMetadataWarnings(metadata));
  applyMissingFieldMarkers(fields, confidence);

  if (rawText.length === 0) {
    warnings.unshift(
      "No report text to parse — enter values manually on review.",
    );
  } else if (metadata.lab === "IGI" && metadata.stoneType === "unknown") {
    warnings.push(
      "IGI: if the report states laboratory-grown, set stone type to lab-grown on review.",
    );
  }

  const detectedCount = REPORT_FIELD_KEYS.filter((k) => fields[k].trim()).length;
  if (rawText.length > 0 && detectedCount < 6) {
    warnings.push(
      "Few fields were detected — review every value against the report before saving.",
    );
  }

  if (debug && isGia) {
    logGiaFieldsBeforeFinalize(fields, "before-finalizeExtractionFields");
  }

  const result: ExtractionResult = {
    metadata,
    fields,
    confidence,
    igiInternal: parsed.igiInternal,
    giaInternal: parsed.giaInternal,
    gcalInternal: parsed.gcalInternal,
    parserType:
      parsed.parserType === "generic"
        ? undefined
        : mapParserTypeToLegacyExtraction(parsed.parserType) ?? parsed.parserType,
    parserConfidence: parsed.parserConfidence,
    extractionMeta: parsed.extractionMeta,
    rawTextSnippet: rawText.slice(0, 1200),
    warnings,
    textMethod: hints?.textMethod ?? (rawText.length > 0 ? "manual" : "none"),
  };

  const finalized = finalizeCalibrationExtractionResult({
    parsed: result,
    combinedText: rawText,
    usedImageOCR: hints?.usedImageOCR,
    auditSpec: reportNumber
      ? {
          reportNumber,
          lab: metadata.lab,
          scenarioId: "text-extract",
        }
      : undefined,
  });

  if (metadata.lab === "GIA" && reportNumber === "2527039693") {
    const { pavilionCandidate, girdleCandidate } = probeGiaLiveFieldCandidates(
      rawText,
      fields.crownAngle,
    );
    console.log("[GIA FINAL CHECK]", {
      textMethod: result.textMethod,
      foundPavilionCandidate: Boolean(pavilionCandidate?.trim()),
      foundGirdleCandidate: Boolean(girdleCandidate?.trim()),
      finalPavilionAnglePresent: Boolean(finalized.fields.pavilionAngle?.trim()),
      finalGirdlePresent: Boolean(finalized.fields.girdle?.trim()),
    });
  }

  if (debug) {
    logExtractPipeline("5.final-payload", {
      metadata: finalized.metadata,
      parserType: finalized.parserType,
      extractionMeta: finalized.extractionMeta,
      fields: snapshotProportionFields(finalized.fields),
      igiInternal: finalized.igiInternal,
      giaInternal: finalized.giaInternal,
      confidence: Object.fromEntries(
        EXTRACT_PIPELINE_FIELD_KEYS.map((k) => [k, finalized.confidence[k]]),
      ),
      warnings: finalized.warnings,
    });
  }

  return finalized;
}

export { normalizeCalibrationLab };
export type { CalibrationLab };
