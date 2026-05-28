import { verifyCalibrationAccess } from "@/lib/calibration-library/auth";
import {
  ACCEPTED_REPORT_EXTENSIONS,
  extractTextFromDocument,
  isAcceptedReportMime,
  isPdfMime,
} from "@/lib/calibration-library/document-extract";
import {
  logFinalDiagnosticBeforeReturn,
  shouldLogExtractPipeline,
} from "@/lib/calibration-library/extract-debug";
import { extractFieldsFromReportText } from "@/lib/calibration-library/extract-from-text";
import { buildFieldProvenanceFromExtraction } from "@/lib/calibration-library/extraction-provenance";
import {
  errorDetailsFromUnknown,
  errorMessageFromUnknown,
  logGcalApiError,
  toJsonSafe,
} from "@/lib/calibration-library/gcal-api-error";
import {
  applyGcal8xImageRegionOcrFallback,
  shouldRunGcalImageRegionOcr,
} from "@/lib/calibration-library/gcal-image-ocr";
import {
  applyGcalSarineProportionImageOcr,
  needsGcalSarineFinishImageOcr,
  needsGcalSarineImageOcr,
  needsGcalSarineProportionImageOcr,
  SARINE_PROPORTION_DIAGRAM_CROP,
} from "@/lib/calibration-library/gcal-sarine-image-ocr";
import {
  hasSarineColumnListSignature,
  logGcalSarineCheck,
  probeSarineFinishFromTextLayer,
  snapshotGcalSarineRecoveredFields,
} from "@/lib/calibration-library/gcal-sarine-4cs";
import { looksLikeGcal8xReportText } from "@/lib/calibration-library/parsers/gcal/gcal-layout-detector";
import {
  applyGiaFacsimileDiagramImageOcr,
  shouldRunGiaFacsimileDiagramImageOcr,
} from "@/lib/calibration-library/parsers/gia/gia-facsimile-image-ocr";
import {
  applyIgiDiagramImageOcr,
  shouldRunIgiDiagramImageOcr,
} from "@/lib/calibration-library/parsers/igi/igi-diagram-image-ocr";
import { emptyReportFields } from "@/lib/calibration-library/fields";
import {
  collectGcal8xProportionNumericCandidates,
  extractGcal8xFocusedWindows,
  extractGcal8xGradingIslands,
  extractGcal8xProportionIslands,
  logGcal8xCheck,
  prepareGcal8xProportionDiagramText,
} from "@/lib/calibration-library/gcal-8x";
import type {
  ExtractionResult,
  FieldConfidence,
  ReportFieldKey,
} from "@/lib/calibration-library/types";
import { inferReportSourceFromUpload } from "@/lib/calibration-library/infer-report-source";
import {
  CalibrationTimeoutError,
  logCalibrationRuntimeCheck,
  timeoutErrorMessage,
  validateCalibrationUpload,
  withTimeout,
} from "@/lib/calibration-library/runtime-guard";
import { runCalibrationUploadExtraction } from "@/lib/calibration-library/extract-upload-pipeline";
import {
  DOCUMENT_EXTRACT_TIMEOUT_MS,
  EXTRACT_FILE_PIPELINE_TIMEOUT_MS,
  IMAGE_REGION_OCR_TIMEOUT_MS,
  MAX_UPLOAD_BYTES,
} from "@/lib/calibration-library/runtime-limits";
import { saveUpload } from "@/lib/calibration-library/workbook";
import type { TextExtractionMethod } from "@/lib/calibration-library/types";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;
const GCAL_WINDOW_CHECK_REPORT = "LG353466126";

type ExtractFileApiContext = {
  parserPath?: string;
  reportNumber?: string;
  ocrStarted: boolean;
  ocrCompleted: boolean;
  debugImageWrite: string;
  phase: string;
  pipelineStartedAt: number;
};

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
): NextResponse {
  return NextResponse.json(toJsonSafe(body), { status });
}

function apiErrorResponse(
  ctx: ExtractFileApiContext,
  err: unknown,
  status = 500,
): NextResponse {
  const message = errorMessageFromUnknown(err);
  const { name, stack } = errorDetailsFromUnknown(err);
  logGcalApiError({
    ...ctx,
    error: message,
    name,
    stack,
  });
  return jsonResponse(
    {
      ok: false,
      error: message,
      details: toJsonSafe({
        ...ctx,
        name,
      }),
    },
    status,
  );
}

export async function POST(request: Request) {
  const ctx: ExtractFileApiContext = {
    ocrStarted: false,
    ocrCompleted: false,
    debugImageWrite: "not-attempted",
    phase: "init",
    pipelineStartedAt: Date.now(),
  };

  try {
    return await withTimeout(
      handleExtractFile(request, ctx),
      EXTRACT_FILE_PIPELINE_TIMEOUT_MS,
      "extract-file-pipeline",
    );
  } catch (err) {
    const timedOut = err instanceof CalibrationTimeoutError;
    logCalibrationRuntimeCheck({
      operation: "extract-file-pipeline",
      parserPath: ctx.parserPath,
      phase: ctx.phase,
      durationMs: Date.now() - ctx.pipelineStartedAt,
      timedOut,
      error: timeoutErrorMessage(err),
    });
    if (timedOut) {
      return jsonResponse(
        {
          ok: false,
          error: timeoutErrorMessage(err),
          details: toJsonSafe({ ...ctx, timedOut: true }),
        },
        504,
      );
    }
    return apiErrorResponse(ctx, err);
  }
}

async function handleExtractFile(
  request: Request,
  ctx: ExtractFileApiContext,
): Promise<NextResponse> {
  try {
    const t0 = Date.now();
    if (!verifyCalibrationAccess(request)) {
      return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
    }

    ctx.phase = "parse-form";
    console.log("[extract-file] received", { t: 0 });
    const form = await request.formData();
    const file = form.get("file");
    const pastedText = String(form.get("pastedText") ?? "").trim();

    let storedFilename: string | undefined;
    let uploadMime: string | undefined;
    let docText = "";
    let textMethod: TextExtractionMethod = pastedText ? "manual" : "none";
    let ocrAttempted = false;
    let ocrAvailable = false;
    const pipelineNotices: string[] = [];
    let uploadPdfBytes: Buffer | undefined;
    let gcalImageOnlyPdf = false;
    let pdfTextLayerLength = 0;
    let preExtractedDocument:
      | Awaited<ReturnType<typeof extractTextFromDocument>>
      | undefined;

    if (file instanceof File && file.size > 0) {
      if (file.size > MAX_UPLOAD_BYTES) {
        return jsonResponse(
          {
            ok: false,
            error: `File too large (max ${MAX_UPLOAD_BYTES / 1024 / 1024}MB).`,
          },
          400,
        );
      }

      uploadMime = file.type || "application/octet-stream";
      if (!isAcceptedReportMime(uploadMime)) {
        return jsonResponse(
          {
            ok: false,
            error: `Unsupported file type. Accepted: ${ACCEPTED_REPORT_EXTENSIONS}`,
          },
          400,
        );
      }

      ctx.phase = "read-upload";
      console.log("[extract-file] read-upload:start", { ms: Date.now() - t0 });
      const bytes = Buffer.from(await file.arrayBuffer());
      console.log("[extract-file] read-upload:end", { ms: Date.now() - t0, bytes: bytes.length });

      ctx.phase = "validate-upload";
      console.log("[extract-file] validate-upload:start", { ms: Date.now() - t0 });
      const uploadCheck = await validateCalibrationUpload(bytes, uploadMime);
      console.log("[extract-file] validate-upload:end", { ms: Date.now() - t0, ok: uploadCheck.ok });
      if (!uploadCheck.ok) {
        return jsonResponse(
          { ok: false, error: uploadCheck.error, code: uploadCheck.code },
          400,
        );
      }
      logCalibrationRuntimeCheck({
        operation: "validate-upload",
        pageCount: uploadCheck.pageCount,
        imageWidth: uploadCheck.imageWidth,
        imageHeight: uploadCheck.imageHeight,
      });

      if (isPdfMime(uploadMime)) {
        uploadPdfBytes = bytes;
      }

      ctx.phase = "save-upload";
      console.log("[extract-file] save-upload:start", { ms: Date.now() - t0 });
      try {
        storedFilename = await saveUpload(file.name, bytes);
      } catch (saveErr) {
        pipelineNotices.push(
          `Upload save skipped: ${errorMessageFromUnknown(saveErr)}`,
        );
        logGcalApiError({
          ...ctx,
          phase: "save-upload",
          error: errorMessageFromUnknown(saveErr),
          stack: errorDetailsFromUnknown(saveErr).stack,
        });
      }
      console.log("[extract-file] save-upload:end", { ms: Date.now() - t0, storedFilename: Boolean(storedFilename) });

      ctx.phase = "document-extract";
      console.log("[extract-file] document-extract:start", { ms: Date.now() - t0 });
      const doc = await withTimeout(
        extractTextFromDocument(bytes, uploadMime),
        DOCUMENT_EXTRACT_TIMEOUT_MS,
        "document-extract",
      );
      console.log("[extract-file] document-extract:end", { ms: Date.now() - t0, method: doc.method, textLen: doc.text.length });
      docText = doc.text;
      textMethod = doc.method;
      ocrAttempted = doc.ocrAttempted;
      ocrAvailable = doc.ocrAvailable;
      pdfTextLayerLength = doc.pdfTextLayerLength;
      gcalImageOnlyPdf = doc.gcalImageOnlyPdf;
      pipelineNotices.push(...doc.notices);
      preExtractedDocument = doc;
    }

    const combined = [pastedText, docText].filter(Boolean).join("\n\n").trim();
    const effectiveMethod =
      pastedText && docText
        ? textMethod
        : pastedText
          ? "manual"
          : textMethod;

    const reportSource = inferReportSourceFromUpload(
      uploadMime,
      Boolean(pastedText),
    );
    const reportNumberHint = String(form.get("reportNumber") ?? "").trim();
    ctx.reportNumber = reportNumberHint;

    const debug = shouldLogExtractPipeline(combined, reportNumberHint);
    if (debug) {
      console.log(
        "[calibration-extract-file] incoming",
        JSON.stringify(
          toJsonSafe({
            combinedTextLength: combined.length,
            docTextLength: docText.length,
            pastedTextLength: pastedText.length,
            textMethod: effectiveMethod,
            reportSource,
            reportNumberHint,
            uploadMime,
          }),
          null,
          2,
        ),
      );
    }

    const labHint = String(form.get("lab") ?? "").trim();

    ctx.phase = "upload-extraction-pipeline";
    console.log("[extract-file] upload-extraction-pipeline:start", { ms: Date.now() - t0 });
    const pipeline = await runCalibrationUploadExtraction({
      bytes: uploadPdfBytes,
      mime: uploadMime,
      pastedText,
      lab: labHint || undefined,
      reportNumber: reportNumberHint || undefined,
      reportSource,
      preExtractedDocument,
      initialPipelineNotices: pipelineNotices,
    });
    console.log("[extract-file] upload-extraction-pipeline:end", { ms: Date.now() - t0, timedOut: pipeline.timedOut, parser: pipeline.parserType });
    ctx.parserPath = pipeline.parserPathUsed ?? pipeline.parserType;
    ctx.reportNumber = pipeline.metadata.reportNumber || reportNumberHint;
    ctx.ocrStarted = pipeline.ocrAttempted;
    ctx.ocrCompleted = pipeline.ocrAttempted;

    if (debug) {
      console.log(
        "[calibration-extract-file] response",
        JSON.stringify(
          toJsonSafe({
            metadata: pipeline.metadata,
            fields: pipeline.fields,
            giaInternal: pipeline.giaInternal,
            confidence: pipeline.confidence,
          }),
          null,
          2,
        ),
      );
    }

    logFinalDiagnosticBeforeReturn(
      pipeline.metadata.lab,
      pipeline.metadata.reportNumber,
      pipeline.fields,
    );

    if (
      reportNumberHint === GCAL_WINDOW_CHECK_REPORT ||
      pipeline.metadata.reportNumber === GCAL_WINDOW_CHECK_REPORT ||
      combined.includes(GCAL_WINDOW_CHECK_REPORT)
    ) {
      try {
        const gcalWindows = extractGcal8xFocusedWindows(combined);
        const repairedProportion = prepareGcal8xProportionDiagramText(
          gcalWindows.proportionWindow,
        );
        logGcal8xCheck(
          extractGcal8xGradingIslands(combined),
          extractGcal8xProportionIslands(gcalWindows.proportionWindow),
          pipeline.fields,
          collectGcal8xProportionNumericCandidates(
            gcalWindows.proportionWindow,
          ),
          repairedProportion.slice(0, 200),
        );
      } catch (windowErr) {
        logGcalApiError({
          ...ctx,
          phase: "gcal-window-check",
          error: errorMessageFromUnknown(windowErr),
          stack: errorDetailsFromUnknown(windowErr).stack,
        });
      }
    }

    ctx.phase = "respond";
    logCalibrationRuntimeCheck({
      operation: "extract-file-pipeline",
      parserPath: ctx.parserPath,
      phase: "complete",
      durationMs: Date.now() - ctx.pipelineStartedAt,
      ocrDurationMs: ctx.ocrStarted
        ? Date.now() - ctx.pipelineStartedAt
        : undefined,
    });
    const body: ExtractionResult & {
      ok: true;
      storedFilename?: string;
      filename?: string;
      ocrAttempted: boolean;
      ocrAvailable: boolean;
      pipelineNotices: string[];
      extractedCharCount: number;
      pdfTextLayerLength: number;
      gcalImageOnlyPdf: boolean;
    } = {
      ...pipeline,
      ok: true,
      storedFilename,
      filename: file instanceof File ? file.name : undefined,
      textMethod: effectiveMethod,
      ocrAttempted: pipeline.ocrAttempted,
      ocrAvailable: pipeline.ocrAvailable,
      pipelineNotices: pipeline.pipelineNotices ?? pipelineNotices,
      extractedCharCount: combined.length,
      pdfTextLayerLength: pipeline.pdfTextLayerLength ?? pdfTextLayerLength,
      gcalImageOnlyPdf: pipeline.gcalImageOnlyPdf ?? gcalImageOnlyPdf,
    };

    console.log("[extract-file] respond", { ms: Date.now() - t0 });
    return jsonResponse(body as unknown as Record<string, unknown>);
  } catch (err) {
    return apiErrorResponse(ctx, err);
  }
}
