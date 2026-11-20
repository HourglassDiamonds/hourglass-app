import { NextResponse, type NextRequest } from "next/server";
import {
  isOperationalShadowRewriteRequest,
  PRODUCTION_STAGING_OPERATIONAL_SHADOW_RESULT_ROUTE,
} from "@/lib/continuum/production-staging-access";
import {
  cleanupAuthenticatedOperationalShadowResult,
  restoreAuthenticatedOperationalShadowResult,
} from "@/lib/continuum/today-sterling/operational-shadow-review";
import { prepareAuthenticatedOperationalShadowFounderDirectives } from
  "@/lib/continuum/today-sterling/founder-directive-preflight";

export const dynamic = "force-dynamic";

function rewritten(request: NextRequest): boolean {
  return isOperationalShadowRewriteRequest(
    request.headers,
    PRODUCTION_STAGING_OPERATIONAL_SHADOW_RESULT_ROUTE,
  );
}

function notFound(): NextResponse {
  return new NextResponse("Not Found", {
    status: 404,
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function GET(request: NextRequest) {
  if (!rewritten(request)) return notFound();
  if (request.nextUrl.search) {
    return NextResponse.json({ ok: false, verdict: "UNAVAILABLE", reason: "request-denied" },
      { status: 403, headers: { "Cache-Control": "private, no-store" } });
  }
  const result = await restoreAuthenticatedOperationalShadowResult();
  return NextResponse.json(result, { status: result.ok ? 200 : 404,
    headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: NextRequest) {
  if (!rewritten(request)) return notFound();
  const origin = request.headers.get("origin");
  const sameOrigin = Boolean(origin && origin === request.nextUrl.origin &&
    request.headers.get("sec-fetch-site") !== "cross-site");
  if (!sameOrigin || request.nextUrl.search) {
    return NextResponse.json({ ok: false, reason: "request-denied" },
      { status: 403, headers: { "Cache-Control": "private, no-store" } });
  }
  const result = await prepareAuthenticatedOperationalShadowFounderDirectives();
  return NextResponse.json(result, { status: result.ok ? 200 : 409,
    headers: { "Cache-Control": "private, no-store" } });
}

export async function DELETE(request: NextRequest) {
  if (!rewritten(request)) return notFound();
  const origin = request.headers.get("origin");
  const sameOrigin = Boolean(origin && origin === request.nextUrl.origin &&
    request.headers.get("sec-fetch-site") !== "cross-site");
  if (!sameOrigin || request.nextUrl.search) {
    return NextResponse.json({ ok: false, reason: "request-denied" },
      { status: 403, headers: { "Cache-Control": "private, no-store" } });
  }
  const result = await cleanupAuthenticatedOperationalShadowResult();
  return NextResponse.json(result, { status: result.ok ? 200 : 404,
    headers: { "Cache-Control": "private, no-store" } });
}
