import { verifyDiamondIntelligenceAccess } from "@/lib/diamond-intelligence/api-access";
import {
  checkDiamondIntelligenceRateLimit,
  DI_RATE_LIMIT_ERROR,
  getDiamondIntelligenceClientIp,
} from "@/lib/diamond-intelligence/rate-limit";
import { toJsonSafe } from "@/lib/calibration-library/gcal-api-error";
import {
  archiveDiamondIntelligenceSubmission,
  type DiamondIntelligenceArchiveContext,
} from "@/lib/diamond-intelligence/submission-archive";
import { buildUrlArchiveMetadata } from "@/lib/diamond-intelligence/url-ingestion/archive-mapping";
import {
  ingestDiamondListingUrl,
  logUrlIngestion,
  resolveUrlIngestionStatus,
} from "@/lib/diamond-intelligence/url-ingestion/ingest-url";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

function json(body: Record<string, unknown>, status = 200, headers?: HeadersInit) {
  return NextResponse.json(toJsonSafe(body), { status, headers });
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

  let url: string;
  try {
    const body = (await request.json()) as { url?: string };
    url = typeof body.url === "string" ? body.url.trim() : "";
  } catch {
    return respond(
      { ok: false, status: "invalid_url", error: "A listing URL is required." },
      400,
      {
        httpStatus: 400,
        earlyFailure: {
          reason: "invalid_url",
          message: "A listing URL is required.",
        },
        urlArchive: buildUrlArchiveMetadata({
          sourceType: "url",
          urlIngestionStatus: "invalid_url",
        }),
      },
    );
  }

  if (!url) {
    return respond(
      { ok: false, status: "invalid_url", error: "A listing URL is required." },
      400,
      {
        httpStatus: 400,
        earlyFailure: {
          reason: "invalid_url",
          message: "A listing URL is required.",
        },
        urlArchive: buildUrlArchiveMetadata({
          sourceType: "url",
          urlIngestionStatus: "invalid_url",
        }),
      },
    );
  }

  const result = await ingestDiamondListingUrl(url);
  logUrlIngestion(result);
  const ingestionStatus = resolveUrlIngestionStatus(result);

  if (!result.ok) {
    const httpStatus =
      result.status === "invalid_url"
        ? 400
        : result.status === "unsupported_vendor"
          ? 422
          : 502;

    return respond(
      {
        ok: false,
        status: result.status,
        error: result.error,
      },
      httpStatus,
      {
        httpStatus,
        earlyFailure: {
          reason: result.status,
          message: result.error,
        },
        urlArchive: buildUrlArchiveMetadata({
          sourceType: "url",
          sourceUrl: url,
          listing: result.listing,
          urlIngestionStatus: ingestionStatus,
        }),
      },
    );
  }

  if (result.status === "listing_found_no_report") {
    return respond(
      {
        ok: true,
        status: result.status,
        listing: result.listing,
        message: result.message,
      },
      200,
      {
        httpStatus: 200,
        urlArchive: buildUrlArchiveMetadata({
          sourceType: "url",
          sourceUrl: url,
          listing: result.listing,
          urlIngestionStatus: ingestionStatus,
        }),
      },
    );
  }

  const archiveCtx: DiamondIntelligenceArchiveContext = {
    httpStatus: 200,
    bytes: result.reportBytes,
    mime: result.reportMime,
    sourceFilename: result.reportFilename,
    cacheHit: result.cacheHit,
    finalized: result.finalized,
    decision: result.decision,
    interpretation: result.interpretation,
    urlArchive: buildUrlArchiveMetadata({
      sourceType: "url",
      sourceUrl: url,
      listing: result.listing,
      reportUrl: result.reportUrl,
      urlIngestionStatus: ingestionStatus,
    }),
  };

  return respond(
    {
      ok: true,
      status: result.status,
      listing: result.listing,
      interpretation: result.interpretation,
      partial: result.partial,
      reportUrl: result.reportUrl,
    },
    200,
    archiveCtx,
  );
}
