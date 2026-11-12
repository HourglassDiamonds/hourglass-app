import { NextResponse, type NextRequest } from "next/server";
import {
  cleanupAuthenticatedOperationalShadowResult,
  restoreAuthenticatedOperationalShadowResult,
} from "@/lib/continuum/today-sterling/operational-shadow-review";

export const dynamic = "force-dynamic";

function sameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  return Boolean(origin && origin === request.nextUrl.origin &&
    request.headers.get("sec-fetch-site") !== "cross-site");
}

export async function GET(request: NextRequest) {
  if (request.nextUrl.search) {
    return NextResponse.json({ ok: false, verdict: "UNAVAILABLE", reason: "request-denied" },
      { status: 403, headers: { "Cache-Control": "private, no-store" } });
  }
  const result = await restoreAuthenticatedOperationalShadowResult();
  return NextResponse.json(result, { status: result.ok ? 200 : 404,
    headers: { "Cache-Control": "private, no-store" } });
}

export async function DELETE(request: NextRequest) {
  if (!sameOrigin(request) || request.nextUrl.search) {
    return NextResponse.json({ ok: false, reason: "request-denied" },
      { status: 403, headers: { "Cache-Control": "private, no-store" } });
  }
  const result = await cleanupAuthenticatedOperationalShadowResult();
  return NextResponse.json(result, { status: result.ok ? 200 : 404,
    headers: { "Cache-Control": "private, no-store" } });
}
