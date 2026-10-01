import { NextResponse } from "next/server";
import { verifyCronRequest } from "@/lib/intelligence/cron-auth";
import { runReviewVelocityJob } from "@/lib/intelligence/review-velocity/job";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET(request: Request) {
  if (!verifyCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runReviewVelocityJob();
  return NextResponse.json(result, { status: result.ok ? 200 : 207 });
}
