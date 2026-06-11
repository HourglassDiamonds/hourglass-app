import { verifyCalibrationAccess } from "@/lib/calibration-library/auth";
import { isAcceptedReportMime } from "@/lib/calibration-library/document-extract";
import { toJsonSafe } from "@/lib/calibration-library/gcal-api-error";
import { interpretUploadedReport } from "@/lib/diamond-intelligence/interpret-uploaded-report";
import {
  CLIENT_UPLOAD_INTERPRET_ERROR,
} from "@/lib/diamond-intelligence/client-interpret-messages";
import {
  archiveDiamondIntelligenceSubmission,
  type DiamondIntelligenceArchiveContext,
} from "@/lib/diamond-intelligence/submission-archive";
import { buildUrlArchiveMetadata } from "@/lib/diamond-intelligence/url-ingestion/archive-mapping";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(toJsonSafe(body), { status });
}

function respond(
  body: Record<string, unknown>,
  status: number,
  archiveCtx?: DiamondIntelligenceArchiveContext,
) {
  if (archiveCtx) {
    archiveDiamondIntelligenceSubmission(archiveCtx);
  }
  return json(body, status);
}

const uploadArchiveMeta = buildUrlArchiveMetadata({ sourceType: "upload" });

export async function POST(request: Request) {
  if (!verifyCalibrationAccess(request)) {
    return json({ ok: false, error: "Unauthorized" }, 401);
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
    if (!isAcceptedReportMime(file.type)) {
      return respond(
        { ok: false, error: "Please upload a PDF or image of your lab report." },
        400,
        {
          httpStatus: 400,
          mime: file.type,
          sourceFilename: file.name,
          earlyFailure: {
            reason: "unsupported_mime",
            message: "Please upload a PDF or image of your lab report.",
          },
          urlArchive: uploadArchiveMeta,
        },
      );
    }

    bytes = Buffer.from(await file.arrayBuffer());
    mime = file.type;
    sourceFilename = file.name;
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
