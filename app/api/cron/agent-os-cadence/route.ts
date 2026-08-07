/**
 * Authenticated internal Agent OS cadence job (publicly addressable URL).
 *
 * Security:
 * - Auth via CRON_SECRET header only (`Authorization: Bearer …` or `x-cron-secret`)
 * - Query-string secrets are NOT accepted (verifyCronRequest ignores `?secret=`)
 * - Auth is checked before any persistence, Agent OS, or email work
 * - Responses omit recipients, secrets, and raw stack traces
 *
 * Manual mode (authenticated only, same route — no extra serverless function):
 * - runMode=manual-preview — live reads, synthesis, quality gate, renderer;
 *   no email; no official cadence-window claim; lastSuccessfulAt unchanged;
 *   returns rendered subject/text only to authenticated callers
 * - runMode=force-send or force=1 — bypass due/in-progress gates and send
 *   (recovery / Vercel Cron Jobs manual verification)
 *
 * GET is retained for compatibility with the established Vercel Cron pattern
 * used by `/api/cron/weekly-intelligence`. Caching is explicitly disabled.
 *
 * Vercel schedules are UTC. Two daily invocations (`0 11` and `0 12`) cover
 * 07:00 America/New_York in both EDT and EST; the app `localEligibleAt` gate
 * and delivery ledger select the valid hour and prevent duplicate sends.
 */

import { NextResponse } from "next/server";
import { verifyCronRequest } from "@/lib/intelligence/cron-auth";
import type { CadenceRunMode } from "@/lib/agent-os/cadence-delivery";
import {
  httpStatusForCadenceOutcome,
  logCadenceDeliveryEvent,
  resolveCadenceDeliveryOutcome,
  type CadenceDeliveryOutcome,
} from "@/lib/agent-os/cadence-delivery/outcome";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;
export const revalidate = 0;

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

function parseRunMode(raw: string | null | undefined): CadenceRunMode | undefined {
  if (
    raw === "manual-preview" ||
    raw === "scheduled" ||
    raw === "force-send"
  ) {
    return raw;
  }
  return undefined;
}

function resultBody(result: {
  ok: boolean;
  cadenceId: string | null;
  cadenceWindow: string | null;
  officialCadenceWindow?: string | null;
  runId: string | null;
  runStatus: string | null;
  deliveryAction: string;
  deliveryStatus: string | null;
  emailSent: boolean;
  errorCode: string | null;
  safeSummary: string;
  runMode?: CadenceRunMode;
  dryRun?: boolean;
  suppressionReason?: string | null;
  deliveryOutcome?: CadenceDeliveryOutcome;
  providerMessageId?: string | null;
  cadenceLastSuccessfulAtBefore?: string | null;
  cadenceLastSuccessfulAtAfter?: string | null;
  previewRender?: {
    subject: string;
    text: string;
    html: string;
    qualityGateOk: boolean;
    qualityGateCodes: string[];
    recipientAlias: string | null;
    providerMessageId: string | null;
  } | null;
}) {
  const deliveryOutcome =
    result.deliveryOutcome ??
    resolveCadenceDeliveryOutcome({
      emailSent: result.emailSent,
      ok: result.ok,
      dryRun: result.dryRun,
      deliveryAction: result.deliveryAction,
      errorCode: result.errorCode,
      safeSummary: result.safeSummary,
      suppressionReason: result.suppressionReason,
    });

  const body: Record<string, unknown> = {
    ok: deliveryOutcome === "failed" ? false : result.ok,
    outcome: deliveryOutcome,
    runMode: result.runMode ?? "scheduled",
    cadenceId: result.cadenceId,
    cadenceWindow: result.cadenceWindow,
    officialCadenceWindow: result.officialCadenceWindow ?? null,
    runId: result.runId,
    runStatus: result.runStatus,
    deliveryAction: result.deliveryAction,
    deliveryStatus: result.deliveryStatus,
    emailSent: result.emailSent,
    errorCode: result.errorCode,
    safeSummary: result.safeSummary,
    suppressionReason: result.suppressionReason ?? null,
    providerMessageId: result.providerMessageId ?? null,
    cadenceLastSuccessfulAtBefore: result.cadenceLastSuccessfulAtBefore ?? null,
    cadenceLastSuccessfulAtAfter: result.cadenceLastSuccessfulAtAfter ?? null,
  };

  // Authenticated manual-preview only — subject/text for operator review.
  if (result.runMode === "manual-preview" && result.previewRender) {
    body.qualityGateOk = result.previewRender.qualityGateOk;
    body.qualityGateCodes = result.previewRender.qualityGateCodes;
    body.preview = {
      subject: result.previewRender.subject,
      text: result.previewRender.text,
    };
  }

  return body;
}

function statusForResult(result: {
  ok: boolean;
  emailSent: boolean;
  errorCode: string | null;
  deliveryOutcome?: CadenceDeliveryOutcome;
  dryRun?: boolean;
  deliveryAction: string;
  safeSummary: string;
  suppressionReason?: string | null;
}): number {
  const outcome =
    result.deliveryOutcome ??
    resolveCadenceDeliveryOutcome({
      emailSent: result.emailSent,
      ok: result.ok,
      dryRun: result.dryRun,
      deliveryAction: result.deliveryAction,
      errorCode: result.errorCode,
      safeSummary: result.safeSummary,
      suppressionReason: result.suppressionReason,
    });
  return httpStatusForCadenceOutcome(outcome, result.errorCode);
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
  const force =
    url.searchParams.get("force") === "1" ||
    url.searchParams.get("runMode") === "force-send";
  const runMode = parseRunMode(url.searchParams.get("runMode"));

  logCadenceDeliveryEvent("run_started", {
    method: "GET",
    cadenceId: cadenceId ?? null,
    force,
    runMode: runMode ?? "scheduled",
    recovery: runMode === "force-send" || force,
  });

  if (runMode === "force-send" || url.searchParams.get("force") === "1") {
    logCadenceDeliveryEvent("recovery_force_send", {
      method: "GET",
      cadenceId: cadenceId ?? null,
      note: "Authenticated force-send / force=1 recovery invocation",
    });
  }

  let result;
  try {
    result = await executeAgentOsCadence({
      mode: "scheduled-live",
      cadenceId,
      force: force || runMode === "manual-preview" || runMode === "force-send",
      runMode: runMode === "force-send" ? "force-send" : runMode,
      includePreviewRender: runMode === "manual-preview",
    });
  } catch {
    logCadenceDeliveryEvent("run_failed", {
      errorCode: "failed",
      safeSummary: "Agent OS cadence job failed",
    });
    return safeJson(
      {
        ok: false,
        outcome: "failed",
        errorCode: "failed",
        emailSent: false,
        safeSummary: "Agent OS cadence job failed",
      },
      500,
    );
  }

  const body = resultBody(result);
  const status = statusForResult(result);
  logCadenceDeliveryEvent("run_finished", {
    outcome: body.outcome,
    status,
    cadenceId: result.cadenceId,
    cadenceWindow: result.cadenceWindow,
    emailSent: result.emailSent,
    providerMessageId: result.providerMessageId ?? null,
    safeSummary: result.safeSummary,
  });

  return safeJson(body, status);
}

/** POST supported for explicit scheduler / authenticated manual invocations. */
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
  let runMode: CadenceRunMode | undefined;
  try {
    const body = (await request.json().catch(() => ({}))) as {
      cadenceId?: string;
      force?: boolean;
      runMode?: string;
    };
    cadenceId = body.cadenceId;
    force = body.force === true || body.runMode === "force-send";
    runMode = parseRunMode(body.runMode);
  } catch {
    cadenceId = undefined;
  }

  logCadenceDeliveryEvent("run_started", {
    method: "POST",
    cadenceId: cadenceId ?? null,
    force,
    runMode: runMode ?? "scheduled",
  });

  const result = await executeAgentOsCadence({
    mode: "scheduled-live",
    cadenceId,
    force: force || runMode === "manual-preview" || runMode === "force-send",
    runMode: runMode === "force-send" ? "force-send" : runMode,
    includePreviewRender: runMode === "manual-preview",
  });

  const body = resultBody(result);
  const status = statusForResult(result);
  logCadenceDeliveryEvent("run_finished", {
    outcome: body.outcome,
    status,
    cadenceId: result.cadenceId,
    cadenceWindow: result.cadenceWindow,
    emailSent: result.emailSent,
    providerMessageId: result.providerMessageId ?? null,
    safeSummary: result.safeSummary,
  });

  return safeJson(body, status);
}
