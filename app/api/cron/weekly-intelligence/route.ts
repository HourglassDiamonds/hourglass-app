import { NextResponse } from "next/server";
import { verifyCronRequest } from "@/lib/intelligence/cron-auth";
import { runWeeklyIntelligenceJob } from "@/lib/intelligence/weekly-report";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

/** Vercel Cron — Monday weekly intelligence (secured). */
export async function GET(request: Request) {
  if (!verifyCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runWeeklyIntelligenceJob();
  const status = result.ok ? 200 : 500;
  return NextResponse.json(result, { status });
}
