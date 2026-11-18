import { NextResponse } from "next/server";
import { beginPasskeyAuthentication } from
  "@/app/executive-dashboard/passkey-actions";
import { isVerifiedContinuumProductionShadowRuntime } from
  "@/lib/continuum/runtime-env";

export const dynamic = "force-dynamic";

export async function POST() {
  if (!isVerifiedContinuumProductionShadowRuntime()) {
    return new NextResponse("Not Found", { status: 404 });
  }
  const result = await beginPasskeyAuthentication();
  return NextResponse.json(result, {
    status: result.ok ? 200 : 401,
    headers: { "Cache-Control": "private, no-store" },
  });
}
