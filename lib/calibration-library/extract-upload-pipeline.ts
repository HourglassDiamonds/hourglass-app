import {
  extractTextFromDocument,
  isPdfMime,
  type DocumentTextExtraction,
} from "./document-extract";
import { extractFieldsFromReportText } from "./extract-from-text";
import {
  finalizeCalibrationExtractionResult,
  type FinalizedCalibrationExtraction,
} from "./finalize-calibration-extraction";
import {
  errorMessageFromUnknown,
} from "./gcal-api-error";
import { applyGcal8xImageRegionOcrFallback, shouldRunGcalImageRegionOcr } from "./gcal-image-ocr";
import {
  applyGcalSarineProportionImageOcr,
  needsGcalSarineFinishImageOcr,
  needsGcalSarineImageOcr,
  needsGcalSarineProportionImageOcr,
} from "./parsers/gcal/gcal-sarine-image-ocr";
import {
  hasSarineColumnListSignature,
  probeSarineFinishFromTextLayer,
} from "./parsers/gcal/gcal-sarine-4cs";
import { looksLikeGcal8xReportText } from "./parsers/gcal/gcal-layout-detector";
import {
  applyGiaFacsimileDiagramImageOcr,
  shouldRunGiaFacsimileDiagramImageOcr,
} from "./parsers/gia/gia-facsimile-image-ocr";
import {
  applyIgiDiagramImageOcr,
  shouldRunIgiDiagramImageOcr,
} from "./parsers/igi/igi-diagram-image-ocr";
import { inferReportSourceFromUpload } from "./infer-report-source";
import type { ExtractionPipelineMode } from "./extraction-mode";
import { isClientExtractionMode } from "./extraction-mode";
import {
  labFamilyLabel,
  logUploadPipelineTiming,
} from "./upload-pipeline-timing";
import { clientExtractionSufficient } from "@/lib/diamond-intelligence/client-extraction-sufficient";
import {
  CalibrationTimeoutError,
  logCalibrationRuntimeCheck,
  timeoutErrorMessage,
  withTimeout,
} from "./runtime-guard";
import {
  CLIENT_DOCUMENT_EXTRACT_TIMEOUT_MS,
  CLIENT_IMAGE_REGION_OCR_TIMEOUT_MS,
  CLIENT_UPLOAD_PIPELINE_TIMEOUT_MS,
  DOCUMENT_EXTRACT_TIMEOUT_MS,
  EXTRACT_FILE_PIPELINE_TIMEOUT_MS,
  IMAGE_REGION_OCR_TIMEOUT_MS,
} from "./runtime-limits";
import type {
  ExtractionResult,
  FieldConfidence,
  ReportFieldKey,
  ReportSource,
  TextExtractionMethod,
} from "./types";

export type UploadExtractionTimings = {
  documentExtractMs: number;
  pdfFullPageOcrMs: number;
  textParseMs: number;
  imageOcrMs: number;
  finalizerMs: number;
  clientPayloadMs: number;
  totalMs: number;
  labFamily?: string;
};

export type UploadExtractionOutput = FinalizedCalibrationExtraction & {
  pipelineNotices: string[];
  ocrAttempted: boolean;
  ocrAvailable: boolean;
  pdfTextLayerLength: number;
  gcalImageOnlyPdf: boolean;
  extractedCharCount: number;
  timings: UploadExtractionTimings;
  parserPathUsed?: string;
  timedOut?: boolean;
  pipelineError?: string;
  /** Client route returned fields gathered before timeout. */
  clientPartial?: boolean;
};

export type RunUploadExtractionInput = {
  bytes?: Buffer;
  mime?: string;
  pastedText?: string;
  lab?: string;
  reportNumber?: string;
  reportSource?: ReportSource;
  pipelineTimeoutMs?: number;
  /** `client` = diamond-intelligence interpret; default preserves calibration/admin behavior. */
  mode?: ExtractionPipelineMode;
  /** When set (e.g. extract-file route), skip a second document-extract pass. */
  preExtractedDocument?: DocumentTextExtraction;
  /** Notices collected before pipeline (upload save, document-extract, etc.). */
  initialPipelineNotices?: string[];
};

async function runImageOcrAugmentation(input: {
  uploadPdfBytes: Buffer;
  combined: string;
  parsed: ExtractionResult;
  effectiveMethod: TextExtractionMethod;
  reportNumberHint: string;
  gcalImageOnlyPdf?: boolean;
  clientMode?: boolean;
}): Promise<{ imageOcrMs: number; ocrCompleted: boolean }> {
  const {
    uploadPdfBytes,
    combined,
    parsed,
    effectiveMethod,
    reportNumberHint,
    gcalImageOnlyPdf,
  } = input;
  const started = Date.now();
  let ocrCompleted = false;
  const clientMode = input.clientMode ?? false;
  const labFamily = labFamilyLabel(parsed.metadata.lab, parsed.parserType);

  const regionOcrTimeoutMs = clientMode
    ? CLIENT_IMAGE_REGION_OCR_TIMEOUT_MS
    : IMAGE_REGION_OCR_TIMEOUT_MS;

  // Client mode short-circuits ONLY when proportion-capable (full read achievable).
  // Usefulness/partial classification is owned exclusively by the interpret route.
  const clientSatisfied = () =>
    clientMode &&
    clientExtractionSufficient({
      fields: parsed.fields,
      confidence: parsed.confidence,
    });

  const sarineColumnListSignature = hasSarineColumnListSignature(combined);
  const runSarine =
    sarineColumnListSignature &&
    (parsed.parserType === "gcal-sarine-4cs" ||
      needsGcalSarineImageOcr(parsed.fields));

  const diagramOcrCoreKeys: ReportFieldKey[] = [
    "tablePercent",
    "depthPercent",
    "crownAngle",
    "pavilionAngle",
  ];

  const capConfidence = (
    key: ReportFieldKey,
    level: FieldConfidence,
  ): FieldConfidence => {
    if (effectiveMethod !== "ocr") return level;
    if (diagramOcrCoreKeys.includes(key) && level === "medium") {
      return "medium";
    }
    if (level === "high") return "medium";
    if (level === "medium") return "low";
    return level;
  };

  const setField = (
    key: ReportFieldKey,
    value: string,
    level: FieldConfidence,
  ) => {
    if (!value.trim() || parsed.fields[key].trim()) return;
    parsed.fields[key] = value.trim();
    parsed.confidence[key] = capConfidence(key, level);
  };

  if (runSarine) {
    const proportionGatePassed = needsGcalSarineProportionImageOcr(parsed.fields);
    const finishGatePassed = needsGcalSarineFinishImageOcr(parsed.fields);
    if (proportionGatePassed || finishGatePassed) {
      const gcalInternal = parsed.gcalInternal ?? {};
      await withTimeout(
        applyGcalSarineProportionImageOcr(
          uploadPdfBytes,
          combined,
          parsed.fields,
          gcalInternal,
          setField,
          {
            reportNumber: reportNumberHint || undefined,
            parserPathUsed: parsed.parserType,
          },
        ),
        regionOcrTimeoutMs,
        "sarine-image-ocr",
      );
      if (Object.keys(gcalInternal).length > 0) {
        parsed.gcalInternal = gcalInternal;
      }
      ocrCompleted = true;
      probeSarineFinishFromTextLayer(combined);
      logUploadPipelineTiming({
        phase: "ocr-region-crops",
        durationMs: Date.now() - started,
        labFamily: "GCAL-Sarine",
        parserPath: parsed.parserType,
      });
      if (clientSatisfied()) {
        return { imageOcrMs: Date.now() - started, ocrCompleted };
      }
    }
  } else if (
    shouldRunGcalImageRegionOcr(parsed.fields, {
      parserType: parsed.parserType,
      lab: parsed.metadata.lab,
      gcalImageOnlyPdf,
      labHint: parsed.metadata.lab,
    }) ||
    (parsed.parserType === "gcal-sarine-4cs" &&
      !sarineColumnListSignature &&
      looksLikeGcal8xReportText(combined))
  ) {
    const gcalInternal = parsed.gcalInternal ?? {};
    await withTimeout(
      applyGcal8xImageRegionOcrFallback(
        uploadPdfBytes,
        parsed.fields,
        gcalInternal,
        setField,
        {
          reportNumber: reportNumberHint || undefined,
          combinedText: combined,
          lazySecondPage: clientMode,
          clientOnlyFirstPage: clientMode,
        },
      ),
      regionOcrTimeoutMs,
      "gcal-8x-image-ocr",
    );
    if (Object.keys(gcalInternal).length > 0) {
      parsed.gcalInternal = gcalInternal;
    }
    ocrCompleted = true;
    logUploadPipelineTiming({
      phase: "ocr-region-crops",
      durationMs: Date.now() - started,
      labFamily: "GCAL-8X",
      parserPath: parsed.parserType,
    });
    if (clientSatisfied()) {
      return { imageOcrMs: Date.now() - started, ocrCompleted };
    }
  }

  if (clientMode) {
    // Client budget: never run GIA/IGI full diagram OCR. Return whatever we have.
    logUploadPipelineTiming({
      phase: "ocr-region-crops",
      durationMs: Date.now() - started,
      labFamily,
      parserPath: parsed.parserType,
      detail: clientSatisfied()
        ? "client-sufficient"
        : "skipped-gia-igi-client-budget",
    });
    return { imageOcrMs: Date.now() - started, ocrCompleted };
  }

  const giaGate = shouldRunGiaFacsimileDiagramImageOcr(parsed.fields, combined, {
    parserType: parsed.parserType,
    lab: parsed.metadata.lab,
  });
  if (giaGate.run) {
    const giaInternal = parsed.giaInternal ?? {};
    await withTimeout(
      applyGiaFacsimileDiagramImageOcr(
        uploadPdfBytes,
        combined,
        parsed.fields,
        giaInternal,
        setField,
        {
          reportNumber: reportNumberHint || undefined,
          parserPathUsed: parsed.parserType,
        },
      ),
      IMAGE_REGION_OCR_TIMEOUT_MS,
      "gia-facsimile-diagram-ocr",
    );
    if (Object.keys(giaInternal).length > 0) {
      parsed.giaInternal = giaInternal;
    }
    ocrCompleted = true;
  }

  const igiGate = shouldRunIgiDiagramImageOcr(parsed.fields, combined, {
    parserType: parsed.parserType,
    lab: parsed.metadata.lab,
  });
  if (igiGate.run) {
    const igiInternal = parsed.igiInternal ?? {};
    await withTimeout(
      applyIgiDiagramImageOcr(
        uploadPdfBytes,
        combined,
        parsed.fields,
        igiInternal,
        setField,
        {
          reportNumber: reportNumberHint || undefined,
          parserPathUsed: parsed.parserType,
          onMetadata: (meta) => {
            parsed.extractionMeta = {
              ...parsed.extractionMeta,
              usedImageOCR: true,
              pdfTextLayerLength: parsed.extractionMeta?.pdfTextLayerLength ?? 0,
              fallbackStage:
                parsed.extractionMeta?.fallbackStage ?? "image-region-ocr",
              igiDiagramLowerGirdleCandidate:
                typeof meta.igiDiagramLowerGirdleCandidate === "string"
                  ? meta.igiDiagramLowerGirdleCandidate
                  : parsed.extractionMeta?.igiDiagramLowerGirdleCandidate,
            };
          },
        },
      ),
      IMAGE_REGION_OCR_TIMEOUT_MS,
      "igi-diagram-ocr",
    );
    if (Object.keys(igiInternal).length > 0) {
      parsed.igiInternal = igiInternal;
    }
    ocrCompleted = true;
  }

  return { imageOcrMs: Date.now() - started, ocrCompleted };
}

/** Same extraction path as `/api/calibration-library/extract-file` (bounded). */
export async function runCalibrationUploadExtraction(
  input: RunUploadExtractionInput,
): Promise<UploadExtractionOutput> {
  const pipelineStarted = Date.now();
  const t0 = pipelineStarted;
  const pipelineNotices: string[] = [];
  const timings: UploadExtractionTimings = {
    documentExtractMs: 0,
    pdfFullPageOcrMs: 0,
    textParseMs: 0,
    imageOcrMs: 0,
    finalizerMs: 0,
    clientPayloadMs: 0,
    totalMs: 0,
  };

  const clientMode = isClientExtractionMode(input.mode);
  const timeoutMs =
    input.pipelineTimeoutMs ??
    (clientMode
      ? CLIENT_UPLOAD_PIPELINE_TIMEOUT_MS
      : EXTRACT_FILE_PIPELINE_TIMEOUT_MS);
  const docExtractTimeoutMs = clientMode
    ? CLIENT_DOCUMENT_EXTRACT_TIMEOUT_MS
    : DOCUMENT_EXTRACT_TIMEOUT_MS;

  const snapshot: {
    parsed: ExtractionResult | null;
    combined: string;
    ocrAttempted: boolean;
    ocrAvailable: boolean;
    pdfTextLayerLength: number;
    gcalImageOnlyPdf: boolean;
  } = {
    parsed: null,
    combined: "",
    ocrAttempted: false,
    ocrAvailable: false,
    pdfTextLayerLength: 0,
    gcalImageOnlyPdf: false,
  };

  const assembleOutput = (
    finalized: FinalizedCalibrationExtraction,
    extra: {
      ocrAttempted: boolean;
      ocrAvailable: boolean;
      combined: string;
      clientPartial?: boolean;
      timedOut?: boolean;
      pipelineError?: string;
    },
  ): UploadExtractionOutput => {
    timings.totalMs = Date.now() - pipelineStarted;
    return {
      ...finalized,
      pipelineNotices,
      ocrAttempted: extra.ocrAttempted,
      ocrAvailable: extra.ocrAvailable,
      pdfTextLayerLength: snapshot.pdfTextLayerLength,
      gcalImageOnlyPdf: snapshot.gcalImageOnlyPdf,
      extractedCharCount: extra.combined.length,
      timings,
      parserPathUsed: finalized.parserType,
      calibrationEligible: finalized.calibrationEligible,
      excludedFromCalibrationStats: finalized.excludedFromCalibrationStats,
      corpusReviewFlags: finalized.corpusReviewFlags,
      clientPartial: extra.clientPartial,
      timedOut: extra.timedOut,
      pipelineError: extra.pipelineError,
    };
  };

  try {
    return await withTimeout(
      (async () => {
        if (input.initialPipelineNotices?.length) {
          pipelineNotices.push(...input.initialPipelineNotices);
        }

        let ocrAvailable = false;
        const pastedText = input.pastedText?.trim() ?? "";
        let docText = "";
        let textMethod: TextExtractionMethod = pastedText ? "manual" : "none";
        let ocrAttempted = false;
        let uploadPdfBytes: Buffer | undefined;
        let gcalImageOnlyPdf = false;
        let pdfTextLayerLength = 0;

        if (input.bytes && input.bytes.length > 0 && input.mime) {
          if (isPdfMime(input.mime)) {
            uploadPdfBytes = input.bytes;
          }

          if (input.preExtractedDocument) {
            const doc = input.preExtractedDocument;
            timings.documentExtractMs = 0;
            console.log("[upload-pipeline] document-extract:reused", {
              ms: Date.now() - t0,
              method: doc.method,
              textLen: doc.text.length,
            });
            docText = doc.text;
            textMethod = doc.method;
            ocrAttempted = doc.ocrAttempted;
            ocrAvailable = doc.ocrAvailable;
            pdfTextLayerLength = doc.pdfTextLayerLength;
            gcalImageOnlyPdf = doc.gcalImageOnlyPdf;
            snapshot.ocrAvailable = doc.ocrAvailable;
            if (!input.initialPipelineNotices?.length) {
              pipelineNotices.push(...doc.notices);
            }
          } else {
            const docStarted = Date.now();
            console.log("[upload-pipeline] document-extract:start", {
              ms: Date.now() - t0,
            });
            const doc = await withTimeout(
              extractTextFromDocument(input.bytes, input.mime, {
                mode: input.mode,
              }),
              docExtractTimeoutMs,
              "document-extract",
            );
            timings.documentExtractMs = Date.now() - docStarted;
            if (
              clientMode &&
              doc.notices.some((n) => n.includes("full-page OCR skipped"))
            ) {
              timings.pdfFullPageOcrMs = 0;
            }
            console.log("[upload-pipeline] document-extract:end", {
              ms: Date.now() - t0,
              method: doc.method,
              textLen: doc.text.length,
            });
            docText = doc.text;
            textMethod = doc.method;
            ocrAttempted = doc.ocrAttempted;
            ocrAvailable = doc.ocrAvailable;
            pdfTextLayerLength = doc.pdfTextLayerLength;
            gcalImageOnlyPdf = doc.gcalImageOnlyPdf;
            snapshot.ocrAvailable = doc.ocrAvailable;
            pipelineNotices.push(...doc.notices);
          }
        }

        const combined = [pastedText, docText].filter(Boolean).join("\n\n").trim();
        const effectiveMethod: TextExtractionMethod =
          pastedText && docText
            ? textMethod
            : pastedText
              ? "manual"
              : textMethod;

        const reportSource =
          input.reportSource ??
          inferReportSourceFromUpload(input.mime, Boolean(pastedText));

        const parseStarted = Date.now();
        console.log("[upload-pipeline] text-parse:start", { ms: Date.now() - t0 });
        const parsed = extractFieldsFromReportText(combined, {
          lab: input.lab,
          reportSource,
          textMethod: effectiveMethod,
          reportNumber: input.reportNumber,
          pdfTextLayerLength,
          gcalImageOnlyPdf,
          usedImageOCR: ocrAttempted && Boolean(docText),
        });
        timings.textParseMs = Date.now() - parseStarted;
        timings.labFamily = labFamilyLabel(parsed.metadata.lab, parsed.parserType);
        logUploadPipelineTiming({
          phase: "text-parse",
          durationMs: timings.textParseMs,
          labFamily: timings.labFamily,
          parserPath: parsed.parserType,
        });
        console.log("[upload-pipeline] text-parse:end", {
          ms: Date.now() - t0,
          parser: parsed.parserType,
        });

        const reportNumberHint =
          input.reportNumber?.trim() ||
          parsed.metadata.reportNumber.trim() ||
          "";

        snapshot.parsed = parsed;
        snapshot.combined = combined;
        snapshot.ocrAttempted = ocrAttempted;
        snapshot.pdfTextLayerLength = pdfTextLayerLength;
        snapshot.gcalImageOnlyPdf = gcalImageOnlyPdf;

        if (
          clientMode &&
          clientExtractionSufficient({
            fields: parsed.fields,
            confidence: parsed.confidence,
          })
        ) {
          // Text layer alone already supports a full read — skip OCR entirely.
          logUploadPipelineTiming({
            phase: "ocr-region-crops",
            durationMs: 0,
            labFamily: timings.labFamily,
            parserPath: parsed.parserType,
            detail: "skipped-client-text-parse-sufficient",
          });
        } else if (uploadPdfBytes) {
          try {
            console.log("[upload-pipeline] image-ocr:start", { ms: Date.now() - t0 });
            const ocr = await runImageOcrAugmentation({
              uploadPdfBytes,
              combined,
              parsed,
              effectiveMethod,
              reportNumberHint,
              gcalImageOnlyPdf,
              clientMode,
            });
            timings.imageOcrMs = ocr.imageOcrMs;
            if (ocr.ocrCompleted) ocrAttempted = true;
            console.log("[upload-pipeline] image-ocr:end", {
              ms: Date.now() - t0,
              imageOcrMs: timings.imageOcrMs,
              ocrCompleted: ocr.ocrCompleted,
            });
          } catch (ocrErr) {
            pipelineNotices.push(
              `Image region OCR failed: ${errorMessageFromUnknown(ocrErr)}`,
            );
          }
          snapshot.ocrAttempted = ocrAttempted;
        }

        parsed.textMethod = effectiveMethod;
        parsed.rawTextSnippet = combined.slice(0, 1200);

        console.log("[upload-pipeline] finalizer:start", { ms: Date.now() - t0 });
        const finalizerStarted = Date.now();
        const finalized = finalizeCalibrationExtractionResult({
          parsed,
          combinedText: combined,
          usedImageOCR:
            (ocrAttempted && Boolean(docText)) || timings.imageOcrMs > 0,
          auditSpec:
            !clientMode &&
            (reportNumberHint || parsed.metadata.reportNumber)
              ? {
                  reportNumber:
                    reportNumberHint || parsed.metadata.reportNumber,
                  lab: parsed.metadata.lab,
                  scenarioId: "upload",
                }
              : undefined,
        });
        timings.finalizerMs = Date.now() - finalizerStarted;
        logUploadPipelineTiming({
          phase: "parser-finalizer",
          durationMs: timings.finalizerMs,
          labFamily: timings.labFamily,
          parserPath: finalized.parserType,
        });
        console.log("[upload-pipeline] finalizer:end", {
          ms: Date.now() - t0,
          eligible: finalized.calibrationEligible,
          excluded: finalized.excludedFromCalibrationStats,
        });

        timings.totalMs = Date.now() - pipelineStarted;

        logCalibrationRuntimeCheck({
          operation: "upload-extraction-pipeline",
          parserPath: finalized.parserType,
          durationMs: timings.totalMs,
          ocrDurationMs: timings.imageOcrMs || undefined,
        });

        return {
          ...finalized,
          pipelineNotices,
          ocrAttempted,
          ocrAvailable,
          pdfTextLayerLength,
          gcalImageOnlyPdf,
          extractedCharCount: combined.length,
          timings,
          parserPathUsed: finalized.parserType,
          calibrationEligible: finalized.calibrationEligible,
          excludedFromCalibrationStats: finalized.excludedFromCalibrationStats,
          corpusReviewFlags: finalized.corpusReviewFlags,
        };
      })(),
      timeoutMs,
      "upload-extraction-pipeline",
    );
  } catch (err) {
    const timedOut = err instanceof CalibrationTimeoutError;
    timings.totalMs = Date.now() - pipelineStarted;
    logCalibrationRuntimeCheck({
      operation: "upload-extraction-pipeline",
      durationMs: timings.totalMs,
      timedOut,
      error: timeoutErrorMessage(err),
    });

    // On timeout in client mode, return whatever snapshot we built so the
    // route can classify it deterministically (full / partial / failure).
    if (clientMode && snapshot.parsed) {
      const finalized = finalizeCalibrationExtractionResult({
        parsed: snapshot.parsed,
        combinedText: snapshot.combined,
        usedImageOCR: snapshot.ocrAttempted || timings.imageOcrMs > 0,
      });
      logUploadPipelineTiming({
        phase: "parser-finalizer",
        durationMs: 0,
        labFamily: timings.labFamily,
        parserPath: finalized.parserType,
        detail: "snapshot-after-timeout",
      });
      return assembleOutput(finalized, {
        ocrAttempted: snapshot.ocrAttempted,
        ocrAvailable: snapshot.ocrAvailable,
        combined: snapshot.combined,
        clientPartial: true,
        timedOut: true,
        pipelineError: timeoutErrorMessage(err),
      });
    }

    const empty = extractFieldsFromReportText("", {
      lab: input.lab,
      reportNumber: input.reportNumber,
      reportSource: input.reportSource ?? "manual",
    });

    const finalized = finalizeCalibrationExtractionResult({
      parsed: empty,
      combinedText: "",
      usedImageOCR: false,
      auditSpec:
        !clientMode && input.reportNumber && input.lab
          ? {
              reportNumber: input.reportNumber,
              lab: input.lab as never,
              scenarioId: "upload-timeout",
            }
          : undefined,
    });

    return assembleOutput(finalized, {
      ocrAttempted: false,
      ocrAvailable: false,
      combined: "",
      timedOut,
      pipelineError: timeoutErrorMessage(err),
    });
  }
}
