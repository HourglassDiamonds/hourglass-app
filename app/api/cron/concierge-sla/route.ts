/**
 * Hourly Concierge Lead SLA watchdog (P0-5).
 *
 * Auth: CRON_SECRET via Authorization Bearer or x-cron-secret only.
 * Independent of Chief of Staff — secondary CoS escalation reads the same ledger.
 * When CONCIERGE_SLA_ENABLED is not "true", returns an explicit no-op (no HubSpot /
 * Supabase / Resend calls).
 * Responses and logs: deal/task IDs and counts only — never customer PII.
 */

import { NextResponse } from "next/server";
import { verifyCronRequest } from "@/lib/intelligence/cron-auth";
import { isConciergeSlaEnabled } from "@/lib/concierge/sla/enabled";
import { runConciergeSlaWatchdog } from "@/lib/concierge/sla/watchdog";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;
export const revalidate = 0;

function unauthorized() {
  return NextResponse.json(
    { error: "Unauthorized" },
    {
      status: 401,
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
    },
  );
}

export async function GET(request: Request) {
  if (!verifyCronRequest(request)) {
    return unauthorized();
  }

  if (!isConciergeSlaEnabled()) {
    console.info("[concierge-sla-watchdog]", {
      ok: true,
      enabled: false,
      checked: 0,
      alertsSent: 0,
    });
    return NextResponse.json(
      {
        ok: true,
        enabled: false,
        checked: 0,
        completed: 0,
        dueSoonSent: 0,
        overdueSent: 0,
        recoveredTasks: 0,
        errors: 0,
        alertsSent: 0,
      },
      {
        status: 200,
        headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
      },
    );
  }

  try {
    const result = await runConciergeSlaWatchdog({ enabled: true });
    console.info("[concierge-sla-watchdog]", {
      ok: result.ok,
      enabled: true,
      checked: result.checked,
      completed: result.completed,
      dueSoonSent: result.dueSoonSent,
      overdueSent: result.overdueSent,
      recoveredTasks: result.recoveredTasks,
      errors: result.errors,
      alertsSent: result.alertsSent,
    });

    return NextResponse.json(
      {
        ok: result.ok,
        enabled: true,
        checked: result.checked,
        completed: result.completed,
        dueSoonSent: result.dueSoonSent,
        overdueSent: result.overdueSent,
        recoveredTasks: result.recoveredTasks,
        errors: result.errors,
        alertsSent: result.alertsSent,
      },
      {
        status: result.ok ? 200 : 500,
        headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
      },
    );
  } catch (error) {
    console.error("[concierge_sla_watchdog_failed]", {
      event: "concierge_sla_watchdog_failed",
      error: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      { ok: false, enabled: true, error: "watchdog_failed" },
      {
        status: 500,
        headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
      },
    );
  }
}
