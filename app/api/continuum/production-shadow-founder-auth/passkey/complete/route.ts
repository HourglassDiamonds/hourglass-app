import { NextRequest, NextResponse } from "next/server";
import { completePasskeyAuthentication } from
  "@/app/executive-dashboard/passkey-actions";
import { PRODUCTION_STAGING_OPERATIONAL_SHADOW_PATH } from
  "@/lib/continuum/production-staging-access";
import { isVerifiedContinuumProductionShadowRuntime } from
  "@/lib/continuum/runtime-env";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!isVerifiedContinuumProductionShadowRuntime()) {
    return new NextResponse("Not Found", { status: 404 });
  }
  const body = await request.json().catch(() => null) as
    | { response?: unknown }
    | null;
  if (!body || body.response == null) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const result = await completePasskeyAuthentication(
    body.response,
    { next: PRODUCTION_STAGING_OPERATIONAL_SHADOW_PATH, viewport: "desktop" },
    { returnDestination: true },
  );
  return NextResponse.json(result.ok
    ? { ok: true, redirect: result.destination }
    : result, {
      status: result.ok ? 200 : 401,
      headers: { "Cache-Control": "private, no-store" },
    });
}
