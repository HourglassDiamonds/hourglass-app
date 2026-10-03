import { NextResponse } from "next/server";
import { ingestWebsiteInquiryServer } from "@/lib/continuum/website-intake/server";
import {
  isSyntheticAcceptanceSubmissionId,
  runSyntheticWebsiteIntakeAcceptance,
} from "@/lib/continuum/website-intake/synthetic-acceptance";
import { verifyCronRequest } from "@/lib/intelligence/cron-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};

function fail(error: string, status: number) {
  return NextResponse.json(
    { ok: false, error },
    { status, headers: NO_STORE_HEADERS },
  );
}

export async function POST(request: Request) {
  if (!verifyCronRequest(request)) return fail("unauthorized", 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("invalid_request", 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return fail("invalid_request", 400);
  }
  const record = body as Record<string, unknown>;
  if (
    Object.keys(record).length !== 1
    || !isSyntheticAcceptanceSubmissionId(record.submissionId)
  ) {
    return fail("invalid_request", 400);
  }

  const result = await runSyntheticWebsiteIntakeAcceptance({
    submissionId: record.submissionId,
    ingest: ingestWebsiteInquiryServer,
  });
  if (!result.ok) return fail(result.reason, 503);

  return NextResponse.json(
    {
      ok: true,
      intakeId: result.intakeId,
      initialStatus: result.initialStatus,
      replayStatus: result.replayStatus,
      isolated: result.isolated,
    },
    { headers: NO_STORE_HEADERS },
  );
}
