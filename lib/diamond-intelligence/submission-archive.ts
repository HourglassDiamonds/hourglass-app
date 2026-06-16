import { randomUUID } from "crypto";
import type { UploadExtractionOutput } from "@/lib/calibration-library/extract-upload-pipeline";
import type { CalibrationReportFields } from "@/lib/calibration-library/types";
import { REPORT_FIELD_KEYS } from "@/lib/calibration-library/types";
import { hashUploadBytes } from "@/lib/diamond-intelligence/client-interpret-cache";
import type { ClientInterpretationDecision } from "@/lib/diamond-intelligence/client-interpretation-pipeline";
import type { ClientSafeInterpretationPayload } from "@/lib/diamond-intelligence/client-api";
import { assessExtractionCompleteness } from "@/lib/diamond-intelligence/extraction-completeness";
import {
  isPurchaseRecommendationEligibleForBroadPercentile,
  resolvePurchaseRecommendationLabel,
} from "@/lib/diamond-intelligence/purchase-recommendation-presentation";
import { resolveHourglassClarityPolicy } from "@/lib/diamond-intelligence/hourglass-clarity-policy";
import {
  type DiamondIntelligenceSubmissionInsert,
  type DiamondIntelligenceSubmissionStatus,
  insertDiamondIntelligenceSubmission,
  isDiamondIntelligenceArchiveAvailable,
  uploadDiamondIntelligenceSubmissionFile,
} from "@/lib/supabase/diamond-intelligence-submissions";
import type { UrlArchiveMetadata } from "@/lib/diamond-intelligence/url-ingestion/archive-mapping";

export type DiamondIntelligenceArchiveContext = {
  httpStatus: number;
  earlyFailure?: {
    reason:
      | "missing_file"
      | "unsupported_mime"
      | "upload_validation"
      | "form_parse"
      | "invalid_url"
      | "unsupported_vendor"
      | "listing_inaccessible";
    message: string;
  };
  cacheHit?: boolean;
  bytes?: Buffer;
  mime?: string;
  sourceFilename?: string;
  finalized?: UploadExtractionOutput;
  decision?: ClientInterpretationDecision;
  interpretation?: ClientSafeInterpretationPayload;
  timedOut?: boolean;
  pipelineError?: string;
  urlArchive?: UrlArchiveMetadata;
};

export function resolveArchiveStatus(
  ctx: DiamondIntelligenceArchiveContext,
): DiamondIntelligenceSubmissionStatus {
  if (ctx.earlyFailure) {
    if (
      ctx.earlyFailure.reason === "unsupported_mime" ||
      ctx.earlyFailure.reason === "upload_validation"
    ) {
      return "unsupported_report";
    }
    return "unable_to_verify";
  }

  if (ctx.timedOut && ctx.decision?.tier === "failure") {
    return "timeout";
  }

  if (ctx.finalized?.timedOut && ctx.decision?.tier !== "full" && ctx.decision?.tier !== "partial") {
    return "timeout";
  }

  const completeness = ctx.finalized
    ? assessExtractionCompleteness({
        fields: ctx.finalized.fields,
        pipelineError: ctx.finalized.pipelineError ?? ctx.pipelineError,
        timedOut: ctx.finalized.timedOut ?? ctx.timedOut,
        renderAudit: ctx.finalized.renderAudit,
      })
    : null;

  if (completeness?.hasParserError || completeness?.extractionState === "EXTRACTION_ERROR") {
    if (ctx.finalized?.timedOut || ctx.timedOut) return "timeout";
    return "parser_failure";
  }

  if (ctx.decision?.tier === "full" || (ctx.cacheHit && ctx.interpretation)) {
    return "success";
  }
  if (ctx.decision?.tier === "partial") {
    return "partial";
  }

  if (ctx.finalized?.timedOut || ctx.timedOut) {
    return "timeout";
  }

  if (ctx.pipelineError || ctx.finalized?.pipelineError) {
    return "parser_failure";
  }

  return "unable_to_verify";
}

function fieldValue(fields: CalibrationReportFields | undefined, key: keyof CalibrationReportFields): string | null {
  const value = fields?.[key]?.trim();
  return value || null;
}

function buildPurchasePresentation(
  interpretation: ClientSafeInterpretationPayload | undefined,
): { purchaseRecommendation: string | null; percentileScope: string | null } {
  const profile = interpretation?.decisionProfile;
  if (!profile) {
    return { purchaseRecommendation: null, percentileScope: null };
  }

  const clarity = interpretation?.gradeHints?.clarity;
  const color = interpretation?.gradeHints?.color;
  const clarityPolicy = resolveHourglassClarityPolicy(clarity);

  const purchaseRecommendation = resolvePurchaseRecommendationLabel({
    internalBand: profile.overallRecommendation.band as never,
    clarityPolicy,
    color,
    clarity,
    uncappedOpticalTierLabel: profile.opticalPerformance.band,
  });

  const percentileEligible = isPurchaseRecommendationEligibleForBroadPercentile({
    purchaseLabel: purchaseRecommendation,
    clarityPolicy,
    color,
  });

  return {
    purchaseRecommendation,
    percentileScope: percentileEligible ? "broad_eligible" : "suppressed",
  };
}

export function buildDiamondIntelligenceArchiveRecord(
  ctx: DiamondIntelligenceArchiveContext,
): DiamondIntelligenceSubmissionInsert {
  const status = resolveArchiveStatus(ctx);
  const fields = ctx.finalized?.fields;
  const snapshot = ctx.decision?.snapshot;
  const interpretation = ctx.interpretation;
  const gradeHints = interpretation?.gradeHints;
  const purchase = buildPurchasePresentation(interpretation);

  const rawExtractedText = [
    ctx.finalized?.rawTextSnippet,
    ctx.finalized?.reportGradeHintText,
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, 64000) || null;

  const errorCode =
    ctx.earlyFailure?.reason ??
    (status === "timeout"
      ? "timeout"
      : status === "parser_failure"
        ? "parser_failure"
        : status === "unable_to_verify"
          ? "unable_to_verify"
          : status === "unsupported_report"
            ? "unsupported_report"
            : null);

  const failureReason =
    ctx.earlyFailure?.message ??
    ctx.pipelineError ??
    ctx.finalized?.pipelineError ??
    (status === "partial"
      ? "partial_extraction"
      : status === "unable_to_verify" &&
          ctx.decision?.tier === "failure" &&
          !ctx.decision.useful
        ? "usefulness_gate_rejected_empty_snapshot"
        : null);

  return {
    status,
    httpStatus: ctx.httpStatus,
    cacheHit: ctx.cacheHit ?? false,
    reportNumber:
      snapshot?.reportNumber ??
      interpretation?.metadata.reportNumber ??
      ctx.finalized?.metadata.reportNumber ??
      null,
    lab: snapshot?.lab ?? interpretation?.metadata.lab ?? ctx.finalized?.metadata.lab ?? null,
    shape: snapshot?.shape ?? fieldValue(fields, "shape"),
    carat: snapshot?.carat ?? fieldValue(fields, "carat"),
    color: gradeHints?.color ?? null,
    clarity: gradeHints?.clarity ?? null,
    cut: fieldValue(fields, "cutGrade"),
    polish: snapshot?.polish ?? fieldValue(fields, "polish"),
    symmetry: snapshot?.symmetry ?? fieldValue(fields, "symmetry"),
    fluorescence: snapshot?.fluorescence ?? fieldValue(fields, "fluorescence"),
    measurements: snapshot?.measurements ?? fieldValue(fields, "measurements"),
    parserFamily:
      interpretation?.metadata.parserFamily ??
      ctx.finalized?.parserType ??
      null,
    parserPath: ctx.finalized?.parserPathUsed ?? ctx.finalized?.parserType ?? null,
    ocrUsed:
      Boolean(ctx.finalized?.ocrAttempted) ||
      ctx.finalized?.textMethod === "ocr",
    ocrConfidence: ctx.finalized?.textMethod
      ? { textMethod: ctx.finalized.textMethod }
      : null,
    extractionConfidence: (snapshot?.extractionConfidence ??
      ctx.finalized?.confidence ??
      null) as Record<string, unknown> | null,
    missingFields:
      snapshot?.missingFields ??
      (fields
        ? REPORT_FIELD_KEYS.filter((key) => !fields[key]?.trim())
        : []),
    opticalTier: interpretation?.decisionProfile?.opticalPerformance.band ?? null,
    purchaseRecommendation: purchase.purchaseRecommendation,
    percentileScope: purchase.percentileScope,
    warnings: ctx.finalized?.warnings ?? [],
    errorCode,
    failureReason,
    sourceFilename: ctx.sourceFilename ?? null,
    fileMime: ctx.mime ?? null,
    fileSizeBytes: ctx.bytes?.length ?? null,
    fileSha256: ctx.bytes ? hashUploadBytes(ctx.bytes) : null,
    rawExtractedText,
    rawFieldsJson: fields ? { fields, metadata: ctx.finalized?.metadata } : null,
    finalOutputJson: interpretation ? (interpretation as Record<string, unknown>) : null,
    renderAudit: (ctx.finalized?.renderAudit as Record<string, unknown> | undefined) ?? null,
    uploadMetadata: {
      pipelineNotices: ctx.finalized?.pipelineNotices ?? [],
      pdfTextLayerLength: ctx.finalized?.pdfTextLayerLength ?? null,
      extractedCharCount: ctx.finalized?.extractedCharCount ?? null,
      clientPartial: ctx.finalized?.clientPartial ?? false,
      decisionTier: ctx.decision?.tier ?? null,
      useful: ctx.decision?.useful ?? null,
      sufficient: ctx.decision?.sufficient ?? null,
      ocrAttempted:
        Boolean(ctx.finalized?.ocrAttempted) ||
        ctx.finalized?.textMethod === "ocr",
      parserLab:
        snapshot?.lab?.trim() ||
        interpretation?.metadata.lab ||
        ctx.finalized?.metadata.lab ||
        null,
      parserType: ctx.finalized?.parserType ?? null,
      lgdrDiagramRetryAttempted:
        ctx.finalized?.lgdrDiagramRetry?.lgdrDiagramRetryAttempted ?? false,
      lgdrDiagramRetryRecoveredFields:
        ctx.finalized?.lgdrDiagramRetry?.lgdrDiagramRetryRecoveredFields ?? [],
      lgdrDiagramRetryBandSnippets:
        ctx.finalized?.lgdrDiagramRetry?.lgdrDiagramRetryBandSnippets ?? null,
      ...(ctx.urlArchive ?? { source_type: "upload" as const }),
    },
    sourceType: ctx.urlArchive?.source_type ?? "upload",
    sourceUrl: ctx.urlArchive?.source_url ?? null,
    vendor: ctx.urlArchive?.vendor ?? null,
    listingId: ctx.urlArchive?.listing_id ?? null,
    listingPrice: ctx.urlArchive?.listing_price ?? null,
    listingCurrency: ctx.urlArchive?.listing_currency ?? null,
    listingExtractionJson: ctx.urlArchive?.listing_extraction_json ?? null,
    reportUrl: ctx.urlArchive?.report_url ?? null,
    urlIngestionStatus: ctx.urlArchive?.url_ingestion_status ?? null,
    urlIngestionWarnings: ctx.urlArchive?.url_ingestion_warnings ?? [],
  };
}

export async function persistDiamondIntelligenceArchive(
  ctx: DiamondIntelligenceArchiveContext,
): Promise<string | null> {
  if (!isDiamondIntelligenceArchiveAvailable()) return null;

  const submissionId = randomUUID();
  const record = buildDiamondIntelligenceArchiveRecord(ctx);

  if (ctx.bytes && ctx.mime) {
    record.id = submissionId;
    record.filePath = await uploadDiamondIntelligenceSubmissionFile({
      submissionId,
      bytes: ctx.bytes,
      mime: ctx.mime,
      sourceFilename: ctx.sourceFilename,
    });
  }

  return insertDiamondIntelligenceSubmission(record);
}

/** Awaited archive write — logs errors without failing the HTTP response. */
export async function archiveDiamondIntelligenceSubmission(
  ctx: DiamondIntelligenceArchiveContext,
): Promise<void> {
  try {
    await persistDiamondIntelligenceArchive(ctx);
  } catch (err) {
    console.error("[di-submission-archive]", err instanceof Error ? err.message : err);
  }
}
