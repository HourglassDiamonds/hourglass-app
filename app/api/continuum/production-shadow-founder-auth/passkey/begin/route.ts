import { NextResponse } from "next/server";
import { beginPasskeyAuthentication } from
  "@/app/executive-dashboard/passkey-actions";
import { isVerifiedContinuumProductionShadowRuntime } from
  "@/lib/continuum/runtime-env";
import { isOperationalShadowBrowserE2eRuntime } from
  "@/lib/continuum/today-sterling/operational-shadow-browser-e2e-runtime";

export const dynamic = "force-dynamic";

export async function POST() {
  if (!isVerifiedContinuumProductionShadowRuntime() &&
      !isOperationalShadowBrowserE2eRuntime()) {
    return new NextResponse("Not Found", { status: 404 });
  }
  const result = await beginPasskeyAuthentication();
  return NextResponse.json(result, {
    status: result.ok ? 200 : 401,
    headers: { "Cache-Control": "private, no-store" },
  });
}
