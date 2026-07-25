import { NextResponse } from "next/server";
import { verifyCronRequest } from "@/lib/intelligence/cron-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;
export const revalidate = 0;

/**
 * Authenticated internal Agent OS cadence job (publicly addressable URL).
 *
 * Security:
 * - Auth via CRON_SECRET header only (`Authorization: Bearer …` or `x-cron-secret`)
 * - Query-string secrets are NOT accepted (verifyCronRequest ignores `?secret=`)
 * - Auth is checked before any persistence, Agent OS, or email work
 * - Responses omit recipients, secrets, full briefs, and raw stack traces
 *
 * GET is retained for compatibility with the established Vercel Cron pattern
 * used by `/api/cron/weekly-intelligence`. Caching is explicitly disabled.
 *
 * Vercel schedules are UTC. Two daily invocations (`0 11` and `0 12`) cover
 * 07:00 America/New_York in both EDT and EST; the app `localEligibleAt` gate
 * and delivery ledger select the valid hour and prevent duplicate sends.
 */
function unauthorized() {
  return NextResponse.json(
    { error: "Unauthorized" },
    {
      status: 401,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    },
  );
}

function safeJson(
  body: Record<string, unknown>,
  status: number,
): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
      Pragma: "no-cache",
    },
  });
}

export async function GET(request: Request) {
  // Auth BEFORE dynamic imports / config / persistence / email
  if (!verifyCronRequest(request)) {
    return unauthorized();
  }

  // Reject accidental query-secret reliance (obscurity is not auth)
  const url = new URL(request.url);
  if (url.searchParams.has("secret")) {
    return unauthorized();
  }

  const { executeAgentOsCadence } = await import(
    "@/lib/agent-os/cadence-delivery"
  );

  const cadenceParam = url.searchParams.get("cadence");
  const cadenceId =
    cadenceParam && cadenceParam.length > 0 ? cadenceParam : undefined;
  const force = url.searchParams.get("force") === "1";

  let result;
  try {
    result = await executeAgentOsCadence({
      mode: "scheduled-live",
      cadenceId,
      force,
    });
  } catch {
    return safeJson(
      {
        ok: false,
        errorCode: "failed",
        safeSummary: "Agent OS cadence job failed",
      },
      500,
    );
  }

  const status = result.ok
    ? 200
    : result.errorCode === "unconfigured"
      ? 503
      : 500;

  return safeJson(
    {
      ok: result.ok,
      cadenceId: result.cadenceId,
      cadenceWindow: result.cadenceWindow,
      runId: result.runId,
      runStatus: result.runStatus,
      deliveryAction: result.deliveryAction,
      deliveryStatus: result.deliveryStatus,
      emailSent: result.emailSent,
      errorCode: result.errorCode,
      safeSummary: result.safeSummary,
    },
    status,
  );
}

/** POST supported for explicit scheduler invocations (same auth + body semantics). */
export async function POST(request: Request) {
  if (!verifyCronRequest(request)) {
    return unauthorized();
  }
  const url = new URL(request.url);
  if (url.searchParams.has("secret")) {
    return unauthorized();
  }

  const { executeAgentOsCadence } = await import(
    "@/lib/agent-os/cadence-delivery"
  );

  let cadenceId: string | undefined;
  let force = false;
  try {
    const body = (await request.json().catch(() => ({}))) as {
      cadenceId?: string;
      force?: boolean;
    };
    cadenceId = body.cadenceId;
    force = body.force === true;
  } catch {
    cadenceId = undefined;
  }

  const result = await executeAgentOsCadence({
    mode: "scheduled-live",
    cadenceId,
    force,
  });

  const status = result.ok
    ? 200
    : result.errorCode === "unconfigured"
      ? 503
      : 500;

  return safeJson(
    {
      ok: result.ok,
      cadenceId: result.cadenceId,
      cadenceWindow: result.cadenceWindow,
      runId: result.runId,
      runStatus: result.runStatus,
      deliveryAction: result.deliveryAction,
      deliveryStatus: result.deliveryStatus,
      emailSent: result.emailSent,
      errorCode: result.errorCode,
      safeSummary: result.safeSummary,
    },
    status,
  );
}
