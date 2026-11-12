import { NextResponse, type NextRequest } from "next/server";
import { runAuthenticatedOperationalShadowReview } from
  "@/lib/continuum/today-sterling/operational-shadow-review";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function sameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  return Boolean(origin && origin === request.nextUrl.origin &&
    request.headers.get("sec-fetch-site") !== "cross-site");
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request) || request.nextUrl.search) {
    return NextResponse.json({ ok: false, verdict: "UNAVAILABLE", reason: "request-denied" },
      { status: 403, headers: { "Cache-Control": "private, no-store" } });
  }
  const result = await runAuthenticatedOperationalShadowReview();
  return NextResponse.json(result, { status: result.ok ? 200 : 409,
    headers: { "Cache-Control": "private, no-store" } });
}
