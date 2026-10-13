import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireInternalClientMemorySession } from "@/lib/continuum/client-memory/read/access";
import { buildSterlingScheduleAdjustment } from "@/lib/continuum/personal/adaptation";
import { interpretPerformanceAdjustment } from "@/lib/continuum/personal/adjustment-ai";
import { parsePersonalState } from "@/lib/continuum/personal/state";
import { EXECUTIVE_DASHBOARD_SESSION_COOKIE } from "@/lib/executive-dashboard/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const jar = await cookies();
  const session = await requireInternalClientMemorySession(jar.get(EXECUTIVE_DASHBOARD_SESSION_COOKIE)?.value);
  if (!session.ok) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  try {
    const body = await request.json() as { command?: unknown; today?: unknown; state?: unknown };
    const command = typeof body.command === "string" ? body.command.trim().slice(0, 2_000) : "";
    const today = typeof body.today === "string" ? body.today : "";
    if (!command || !/^\d{4}-\d{2}-\d{2}$/.test(today) || !body.state) {
      return NextResponse.json({ ok: false, error: "invalid-adjustment" }, { status: 400 });
    }
    const state = parsePersonalState(JSON.stringify(body.state), today);
    const interpreted = await interpretPerformanceAdjustment({ command, today, state });
    if (interpreted.status !== "proposed" || !interpreted.workoutId || !interpreted.targetDate) {
      return NextResponse.json({ ok: false, error: "adjustment-needs-clarification", clarification: interpreted.clarification }, { status: 422 });
    }
    const proposal = buildSterlingScheduleAdjustment({
      state,
      command,
      workoutId: interpreted.workoutId,
      targetDate: interpreted.targetDate,
      summary: interpreted.summary,
      warnings: interpreted.warnings,
      confidence: interpreted.confidence,
    });
    if (!proposal) return NextResponse.json({ ok: false, error: "adjustment-unsupported" }, { status: 422 });
    return NextResponse.json({ ok: true, proposal }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "performance-adjustment-failed";
    const status = message === "performance-analysis-unavailable" ? 503 : 502;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
