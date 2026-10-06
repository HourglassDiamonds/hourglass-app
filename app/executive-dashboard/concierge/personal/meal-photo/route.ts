import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { estimateMealPhoto } from "@/lib/continuum/personal/meal-ai";
import { requireInternalClientMemorySession } from "@/lib/continuum/client-memory/read/access";
import { EXECUTIVE_DASHBOARD_SESSION_COOKIE } from "@/lib/executive-dashboard/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const jar = await cookies();
  const session = await requireInternalClientMemorySession(jar.get(EXECUTIVE_DASHBOARD_SESSION_COOKIE)?.value);
  if (!session.ok) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  try {
    const form = await request.formData();
    const image = form.get("image");
    if (!(image instanceof File)) return NextResponse.json({ ok: false, error: "image-required" }, { status: 400 });
    return NextResponse.json({ ok: true, estimate: await estimateMealPhoto(image) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "meal-analysis-failed";
    const status = message === "invalid-image" ? 400 : message === "meal-analysis-unavailable" ? 503 : 502;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
