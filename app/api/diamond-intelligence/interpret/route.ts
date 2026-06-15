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
import { validateDiamondIntelligenceUpload } from "@/lib/diamond-intelligence/upload-validation";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
/** GIA LGDR diagram OCR can use ~54s; leave headroom beyond cold-start overhead. */
export const maxDuration = 90;

function json(body: Record<string, unknown>, status = 200, headers?: HeadersInit) {
  return NextResponse.json(toJsonSafe(body), { status, headers });
}

function respond(
  body: Record<string, unknown>,
  status: number,
  archiveCtx?: DiamondIntelligenceArchiveContext,
  headers?: HeadersInit,
) {
  if (archiveCtx) {
    archiveDiamondIntelligenceSubmission(archiveCtx);
  }
  return json(body, status, headers);
}

const uploadArchiveMeta = buildUrlArchiveMetadata({ sourceType: "upload" });

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
  try {
    const form = await request.formData();
    const file = form.get("file");

    if (!(file instanceof File) || file.size === 0) {
      return respond(
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

    bytes = Buffer.from(await file.arrayBuffer());
    sourceFilename = file.name;

    const uploadValidation = validateDiamondIntelligenceUpload({
      bytes,
      declaredMime: file.type,
      sourceFilename,
    });

    if (!uploadValidation.ok) {
      const isMimeOrExtension =
        uploadValidation.code === "unsupported_mime" ||
        uploadValidation.code === "blocked_extension" ||
        uploadValidation.code === "unsupported_extension" ||
        uploadValidation.code === "unknown_binary" ||
        uploadValidation.code === "mime_content_mismatch";

      return respond(
        { ok: false, error: uploadValidation.error },
        400,
        {
          httpStatus: 400,
          bytes,
          mime: file.type,
          sourceFilename,
          earlyFailure: {
            reason: isMimeOrExtension ? "unsupported_mime" : "upload_validation",
            message: uploadValidation.error,
          },
          urlArchive: uploadArchiveMeta,
        },
      );
    }

    mime = uploadValidation.mime;
  } catch {
    return respond(
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

    return respond(
      { ok: false, error: result.error },
      result.httpStatus,
      {
        httpStatus: result.httpStatus,
        bytes,
        mime,
        sourceFilename,
        finalized: result.finalized,
        decision: result.decision,
        timedOut: result.timedOut,
        pipelineError: result.pipelineError,
        earlyFailure: isUploadValidation
          ? { reason: "upload_validation", message: result.error }
          : undefined,
        urlArchive: uploadArchiveMeta,
      },
    );
  }

  if (result.cacheHit) {
    return respond(
      { ok: true, interpretation: result.interpretation, partial: false },
      200,
      {
        httpStatus: 200,
        bytes,
        mime,
        sourceFilename,
        cacheHit: true,
        interpretation: result.interpretation,
        urlArchive: uploadArchiveMeta,
      },
    );
  }

  return respond(
    { ok: true, interpretation: result.interpretation, partial: result.partial },
    200,
    {
      httpStatus: 200,
      bytes,
      mime,
      sourceFilename,
      finalized: result.finalized,
      decision: result.decision,
      interpretation: result.interpretation,
      urlArchive: uploadArchiveMeta,
    },
  );
}
