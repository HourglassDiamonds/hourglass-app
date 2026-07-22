import { NextResponse } from "next/server";
import { verifyCronRequest } from "@/lib/intelligence/cron-auth";
import {
  cleanupExpiredDiamondIntelligenceSubmissions,
  isDiamondIntelligenceArchiveAvailable,
} from "@/lib/supabase/diamond-intelligence-submissions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Daily cleanup for Diamond Intelligence submissions older than 30 days.
 * Auth: CRON_SECRET via Authorization Bearer or x-cron-secret (fail closed).
 * Response and logs: aggregate counts only — never paths, filenames, OCR, or IDs.
 */
export async function GET(request: Request) {
  if (!verifyCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isDiamondIntelligenceArchiveAvailable()) {
    return NextResponse.json(
      { ok: false, error: "archive_unavailable" },
      { status: 503 },
    );
  }

  try {
    const result = await cleanupExpiredDiamondIntelligenceSubmissions();
    console.info("[di-submission-cleanup]", {
      scanned: result.scanned,
      expired: result.expired,
      storageDeleted: result.storageDeleted,
      rowsDeleted: result.rowsDeleted,
      alreadyMissing: result.alreadyMissing,
      failed: result.failed,
    });

    if (result.failed > 0) {
      return NextResponse.json({ ok: false, ...result }, { status: 500 });
    }

    return NextResponse.json({ ok: true, ...result });
  } catch {
    return NextResponse.json(
      { ok: false, error: "cleanup_failed" },
      { status: 500 },
    );
  }
}
