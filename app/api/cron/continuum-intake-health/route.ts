import { NextResponse } from "next/server";
import { runWebsiteIntakeHealthCheck } from "@/lib/continuum/website-intake/health";
import { verifyCronRequest } from "@/lib/intelligence/cron-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

export async function GET(request: Request) {
  if (!verifyCronRequest(request)) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }
  const result = await runWebsiteIntakeHealthCheck();
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.reason },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  return NextResponse.json(
    { ok: true, status: result.status, isolated: true },
    { headers: { "Cache-Control": "no-store" } },
  );
}
