import { NextResponse } from "next/server";
import { verifyCronQuerySecret } from "@/lib/intelligence/cron-auth";
import { runWeeklyIntelligenceJob } from "@/lib/intelligence/weekly-report";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// TODO: Remove this route after production GA4 → Supabase → dashboard verification is complete.

/**
 * Browser-friendly GET smoke test — same job as POST /api/intelligence/weekly-report.
 * Auth: ?secret=<CRON_SECRET> (never commit or share the URL with the secret).
 */
export async function GET(request: Request) {
  if (!verifyCronQuerySecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runWeeklyIntelligenceJob();
  const status = result.ok ? 200 : 500;
  return NextResponse.json(result, { status });
}
