/**
 * Authenticated durable Gmail operating-freshness job.
 *
 * Auth: CRON_SECRET via Authorization Bearer or x-cron-secret only.
 * Kill-switched by CONTINUUM_GMAIL_INCREMENTAL_SYNC_ENABLED.
 * Responses: counts and safe error codes only — never mailbox content.
 */

import { NextResponse } from "next/server";
import { verifyCronRequest } from "@/lib/intelligence/cron-auth";
import { executeLiveGmailFreshnessCycle } from "@/lib/continuum/gmail/freshness-run";
import { sanitizeGmailFreshnessCycleResult } from "@/lib/continuum/gmail/freshness-cycle";
import { continuumEnvLogLabel } from "@/lib/continuum/runtime-env";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;
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

function json(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
  });
}

export async function GET(request: Request) {
  if (!verifyCronRequest(request)) {
    return unauthorized();
  }

  try {
    const envLabel = continuumEnvLogLabel();
    console.info("[continuum-gmail-freshness]", envLabel);
    const result = sanitizeGmailFreshnessCycleResult(
      await executeLiveGmailFreshnessCycle({
        founderSessionOk: false,
        secretProtectedOk: true,
      }),
    );
    const retryable =
      result.safeErrorCode === "gmail-sync-already-running" ||
      result.safeErrorCode === "sync-disabled";
    const ok = result.safeErrorCode == null || retryable;
    return json(
      {
        ok,
        env: envLabel,
        enabled: result.safeErrorCode !== "sync-disabled",
        chunksRun: result.chunksRun,
        indexedThisCycle: result.indexedThisCycle,
        insertedCount: result.insertedCount,
        duplicateCount: result.duplicateCount,
        intakeRan: result.intakeRan,
        morePagesRemain: result.morePagesRemain,
        skippedAsFresh: result.skippedAsFresh,
        completed: result.completed,
        errorCode: result.safeErrorCode,
      },
      ok ? 200 : 500,
    );
  } catch {
    return json({ ok: false, error: "freshness_failed" }, 500);
  }
}
