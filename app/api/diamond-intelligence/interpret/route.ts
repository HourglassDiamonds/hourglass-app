import { toJsonSafe } from "@/lib/calibration-library/gcal-api-error";
import { verifyDiamondIntelligenceAccess } from "@/lib/diamond-intelligence/api-access";
import { interpretUploadedReport } from "@/lib/diamond-intelligence/interpret-uploaded-report";
import {
  CLIENT_UPLOAD_INTERPRET_ERROR,
} from "@/lib/diamond-intelligence/client-interpret-messages";
import {
  checkDiamondIntelligenceRateLimit,
  DI_RATE_LIMIT_ERROR,
  getDiamondIntelligenceClientIp,
} from "@/lib/diamond-intelligence/rate-limit";
import {
  archiveDiamondIntelligenceSubmission,
  type DiamondIntelligenceArchiveContext,
} from "@/lib/diamond-intelligence/submission-archive";
import { buildUrlArchiveMetadata } from "@/lib/diamond-intelligence/url-ingestion/archive-mapping";
import {
  normalizeDiamondIntelligenceUpload,
  resolveUploadIngestMetadata,
  type UploadIngestMetadata,
} from "@/lib/diamond-intelligence/upload-normalize";
import { validateDiamondIntelligenceUpload } from "@/lib/diamond-intelligence/upload-validation";
import {
  buildInterpretFailureDiagnostics,
  isInterpretDiagnosticsEnabled,
} from "@/lib/diamond-intelligence/interpret-failure-diagnostics";
import {
  buildGcalSarineInterpretDiagnostics,
  logGcalSarineInterpretDiagnostics,
} from "@/lib/diamond-intelligence/gcal-sarine-pipeline-diagnostics";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
/** GIA LGDR + GCAL Sarine cold Tesseract WASM on Vercel can exceed 90s. */
export const maxDuration = 120;

function json(body: Record<string, unknown>, status = 200, headers?: HeadersInit) {
  return NextResponse.json(toJsonSafe(body), { status, headers });
}

async function respond(
  body: Record<string, unknown>,
  status: number,
  archiveCtx?: DiamondIntelligenceArchiveContext,
  headers?: HeadersInit,
) {
  if (archiveCtx) {
    await archiveDiamondIntelligenceSubmission(archiveCtx);
  }
  return json(body, status, headers);
}

const uploadArchiveMeta = buildUrlArchiveMetadata({ sourceType: "upload" });

function buildUploadMetaResponse(input: {
  mime?: string;
  ingestMetadata?: UploadIngestMetadata;
}) {
  const { mime, ingestMetadata } = input;
  if (!mime && !ingestMetadata) return undefined;
  return {
    ...(mime ? { mime } : {}),
    ...(ingestMetadata?.normalizedMime
      ? { normalizedMime: ingestMetadata.normalizedMime }
      : {}),
    ...(ingestMetadata?.originalMime
      ? { originalMime: ingestMetadata.originalMime }
      : {}),
  };
}

export async function POST(request: Request) {
  if (!verifyDiamondIntelligenceAccess(request)) {
    return json({ ok: false, error: "Unauthorized" }, 401);
  }

  const clientIp = getDiamondIntelligenceClientIp(request);
  const rateLimit = checkDiamondIntelligenceRateLimit(clientIp);
  if (!rateLimit.allowed) {
    return json(
      { ok: false, error: DI_RATE_LIMIT_ERROR, code: "rate_limited" },
      429,
      { "Retry-After": String(rateLimit.retryAfterSeconds) },
    );
  }

  let bytes: Buffer;
  let mime: string;
  let sourceFilename: string | undefined;
  let ingestMetadata: ReturnType<typeof resolveUploadIngestMetadata> | undefined;
  try {
    const form = await request.formData();
    const file = form.get("file");

    if (!(file instanceof File) || file.size === 0) {
      return await respond(
        { ok: false, error: "A report file is required." },
        400,
        {
          httpStatus: 400,
          earlyFailure: {
            reason: "missing_file",
            message: "A report file is required.",
          },
          urlArchive: uploadArchiveMeta,
        },
      );
    }

    const rawBytes = Buffer.from(await file.arrayBuffer());
    sourceFilename = file.name;

    const normalized = await normalizeDiamondIntelligenceUpload({
      bytes: rawBytes,
      declaredMime: file.type,
      sourceFilename,
    });

    if (!normalized.ok) {
      const isMimeOrExtension =
        normalized.code === "unsupported_mime" ||
        normalized.code === "blocked_extension" ||
        normalized.code === "unsupported_extension" ||
        normalized.code === "unknown_binary" ||
        normalized.code === "mime_content_mismatch";

      return await respond(
        {
          ok: false,
          error: normalized.error,
          code: normalized.code,
        },
        400,
        {
          httpStatus: 400,
          bytes: rawBytes,
          mime: file.type,
          sourceFilename,
          earlyFailure: {
            reason: isMimeOrExtension ? "unsupported_mime" : "upload_validation",
            message: normalized.error,
          },
          urlArchive: uploadArchiveMeta,
        },
      );
    }

    bytes = normalized.bytes;
    sourceFilename = normalized.sourceFilename;

    const uploadValidation = validateDiamondIntelligenceUpload({
      bytes,
      declaredMime: normalized.mime,
      sourceFilename,
    });

    if (!uploadValidation.ok) {
      const isMimeOrExtension =
        uploadValidation.code === "unsupported_mime" ||
        uploadValidation.code === "blocked_extension" ||
        uploadValidation.code === "unsupported_extension" ||
        uploadValidation.code === "unknown_binary" ||
        uploadValidation.code === "mime_content_mismatch";

      return await respond(
        {
          ok: false,
          error: uploadValidation.error,
          code: uploadValidation.code,
          uploadMeta: buildUploadMetaResponse({
            mime: normalized.mime,
            ingestMetadata: normalized.ingestMetadata,
          }),
        },
        400,
        {
          httpStatus: 400,
          bytes,
          mime: normalized.mime,
          sourceFilename,
          ingestMetadata: normalized.ingestMetadata,
          earlyFailure: {
            reason: isMimeOrExtension ? "unsupported_mime" : "upload_validation",
            message: uploadValidation.error,
          },
          urlArchive: uploadArchiveMeta,
        },
      );
    }

    mime = uploadValidation.mime;
    ingestMetadata = resolveUploadIngestMetadata({
      mime,
      preNormalize: normalized.ingestMetadata,
    });
  } catch {
    return await respond(
      { ok: false, error: CLIENT_UPLOAD_INTERPRET_ERROR },
      400,
      {
        httpStatus: 400,
        earlyFailure: {
          reason: "form_parse",
          message: CLIENT_UPLOAD_INTERPRET_ERROR,
        },
        urlArchive: uploadArchiveMeta,
      },
    );
  }

  const result = await interpretUploadedReport({ bytes, mime, sourceFilename });

  if (!result.ok) {
    const isUploadValidation =
      result.httpStatus === 400 &&
      (result.error.includes("limit") || result.error.includes("Could not read PDF"));

    const isUnsupportedReportFormat = result.code === "unsupported_report_format";

    const diagnostics =
      isInterpretDiagnosticsEnabled() && result.httpStatus === 422 && !isUnsupportedReportFormat
        ? buildInterpretFailureDiagnostics(result)
        : undefined;

    return await respond(
      {
        ok: false,
        error: result.error,
        ...(result.code ? { code: result.code } : {}),
        ...(diagnostics ? { diagnostics } : {}),
        uploadMeta: buildUploadMetaResponse({ mime, ingestMetadata }),
      },
      result.httpStatus,
      {
        httpStatus: result.httpStatus,
        bytes,
        mime,
        sourceFilename,
        ingestMetadata,
        finalized: result.finalized,
        decision: result.decision,
        timedOut: result.timedOut,
        pipelineError: result.pipelineError,
        earlyFailure: isUploadValidation
          ? { reason: "upload_validation", message: result.error }
          : isUnsupportedReportFormat
            ? {
                reason: "unsupported_report_format",
                message: result.error,
                unsupportedFormatFamily: result.unsupportedFormat?.family,
              }
            : undefined,
        urlArchive: uploadArchiveMeta,
      },
    );
  }

  if (result.cacheHit) {
    return await respond(
      { ok: true, interpretation: result.interpretation, partial: false },
      200,
      {
        httpStatus: 200,
        bytes,
        mime,
        sourceFilename,
        cacheHit: true,
        interpretation: result.interpretation,
        ingestMetadata,
        urlArchive: uploadArchiveMeta,
      },
    );
  }

  const gcalSarineDiagnostics =
    isInterpretDiagnosticsEnabled()
      ? buildGcalSarineInterpretDiagnostics(result)
      : null;
  if (gcalSarineDiagnostics) {
    logGcalSarineInterpretDiagnostics(gcalSarineDiagnostics);
  }

  return await respond(
    {
      ok: true,
      interpretation: result.interpretation,
      partial: result.partial,
      ...(gcalSarineDiagnostics ? { diagnostics: gcalSarineDiagnostics } : {}),
    },
    200,
    {
      httpStatus: 200,
      bytes,
      mime,
      sourceFilename,
      finalized: result.finalized,
      decision: result.decision,
      interpretation: result.interpretation,
      ingestMetadata,
      urlArchive: uploadArchiveMeta,
    },
  );
}
