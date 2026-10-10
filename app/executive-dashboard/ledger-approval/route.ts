import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { readExecutiveDashboardSession } from "@/lib/executive-dashboard/access";
import { EXECUTIVE_DASHBOARD_SESSION_COOKIE } from "@/lib/executive-dashboard/session";
import {
  createProductionLedgerAutomationStore,
  createProductionLedgerPublicationStore,
  decideLedgerPublication,
  type FounderDecision,
} from "@/lib/ledger-automation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

async function founderSession() {
  const jar = await cookies();
  return readExecutiveDashboardSession(jar.get(EXECUTIVE_DASHBOARD_SESSION_COOKIE)?.value);
}

export async function GET(request: Request) {
  const session = await founderSession();
  if (!session.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const runKey = new URL(request.url).searchParams.get("runKey")?.trim();
  if (!runKey) return NextResponse.json({ error: "runKey is required" }, { status: 400 });
  const run = await createProductionLedgerAutomationStore().getRun(runKey);
  if (!run || !run.canonicalPublication) return NextResponse.json({ error: "Pending proposal not found" }, { status: 404 });
  return NextResponse.json({
    runKey: run.runKey,
    state: run.state,
    classification: run.classification,
    proposal: run.canonicalPublication,
  });
}

export async function POST(request: Request) {
  const session = await founderSession();
  if (!session.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (request.headers.get("sec-fetch-site") === "cross-site") {
    return NextResponse.json({ error: "Cross-site request rejected" }, { status: 403 });
  }
  let body: { runKey?: unknown; decision?: unknown; note?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Valid JSON is required" }, { status: 400 });
  }
  const allowed = new Set<FounderDecision>(["APPROVE", "REJECT", "NEEDS_REVISION"]);
  if (typeof body.runKey !== "string" || typeof body.decision !== "string" || !allowed.has(body.decision as FounderDecision)) {
    return NextResponse.json({ error: "runKey and a valid decision are required" }, { status: 400 });
  }
  try {
    const result = await decideLedgerPublication({
      runKey: body.runKey,
      decision: body.decision as FounderDecision,
      decidedAt: new Date().toISOString(),
      decidedBy: session.username,
      note: typeof body.note === "string" ? body.note : undefined,
      store: createProductionLedgerAutomationStore(),
      publicationStore: createProductionLedgerPublicationStore(),
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Decision failed safely" }, { status: 409 });
  }
}
