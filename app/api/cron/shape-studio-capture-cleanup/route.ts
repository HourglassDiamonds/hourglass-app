import { NextResponse } from "next/server";
import { verifyCronRequest } from "@/lib/intelligence/cron-auth";
import {
  cleanupExpiredShapeStudioCaptures,
  isShapeStudioSessionsAvailable,
} from "@/lib/shape-studio/sessions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Daily cleanup for unclaimed Scaled Preview captures (≤24h hard ceiling).
 * Auth: CRON_SECRET via Authorization Bearer or x-cron-secret.
 * Response logs counts only — never object paths or signed URLs.
 */
export async function GET(request: Request) {
  if (!verifyCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isShapeStudioSessionsAvailable()) {
    return NextResponse.json(
      { ok: false, error: "capture_unavailable" },
      { status: 503 },
    );
  }

  try {
    const result = await cleanupExpiredShapeStudioCaptures();
    return NextResponse.json({ ok: true, ...result });
  } catch {
    return NextResponse.json(
      { ok: false, error: "cleanup_failed" },
      { status: 500 },
    );
  }
}
