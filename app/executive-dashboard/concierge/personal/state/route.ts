import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireInternalClientMemorySession } from "@/lib/continuum/client-memory/read/access";
import { deletePerformanceSource, loadPerformanceState, PerformanceRevisionConflict, savePerformanceState, type PerformanceMutation } from "@/lib/continuum/personal/persistence";
import type { PersonalState } from "@/lib/continuum/personal/types";
import { EXECUTIVE_DASHBOARD_SESSION_COOKIE } from "@/lib/executive-dashboard/session";

export const runtime = "nodejs";
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

async function founderSession() {
  const jar = await cookies();
  return requireInternalClientMemorySession(jar.get(EXECUTIVE_DASHBOARD_SESSION_COOKIE)?.value);
}

export async function GET(request: Request) {
  const session = await founderSession();
  if (!session.ok) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  try {
    const today = new URL(request.url).searchParams.get("today") ?? "";
    if (!DATE_KEY.test(today)) return NextResponse.json({ ok: false, error: "invalid-date" }, { status: 400 });
    const loaded = await loadPerformanceState(session.username, today);
    return NextResponse.json({ ok: true, state: loaded?.state ?? null, revision: loaded?.revision ?? 0 }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ ok: false, error: "performance-persistence-unavailable" }, { status: 503 });
  }
}

export async function PUT(request: Request) { return write(request); }
export async function POST(request: Request) { return write(request); }

export async function DELETE(request: Request) {
  const session = await founderSession();
  if (!session.ok) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  try {
    const body = await request.json() as { expectedRevision: number; entryId: string; kind: "meal" | "activity"; idempotencyKey: string };
    if (!Number.isSafeInteger(body.expectedRevision) || body.expectedRevision < 1 || !body.entryId || !["meal", "activity"].includes(body.kind) || !body.idempotencyKey) return NextResponse.json({ ok: false, error: "invalid-source-deletion" }, { status: 400 });
    const saved = await deletePerformanceSource({ founderKey: session.username, ...body });
    return NextResponse.json({ ok: true, ...saved }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof PerformanceRevisionConflict) return NextResponse.json({ ok: false, error: error.message, state: error.current?.state ?? null, revision: error.current?.revision ?? 0 }, { status: 409, headers: { "Cache-Control": "private, no-store" } });
    const message = error instanceof Error ? error.message : "performance-source-delete-failed";
    return NextResponse.json({ ok: false, error: message }, { status: /not-found|invalid/.test(message) ? 400 : 503 });
  }
}

async function write(request: Request) {
  const session = await founderSession();
  if (!session.ok) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  try {
    let state: PersonalState; let mutation: PerformanceMutation; let expectedRevision: number; let sourceFile: File | undefined;
    if (request.headers.get("content-type")?.includes("multipart/form-data")) {
      const form = await request.formData();
      state = JSON.parse(String(form.get("state") ?? "null")) as PersonalState;
      mutation = JSON.parse(String(form.get("mutation") ?? "null")) as PerformanceMutation;
      expectedRevision = Number(form.get("expectedRevision"));
      const source = form.get("source"); sourceFile = source instanceof File && source.size ? source : undefined;
    } else {
      const body = await request.json() as { state: PersonalState; mutation: PerformanceMutation; expectedRevision: number };
      state = body.state; mutation = body.mutation; expectedRevision = body.expectedRevision;
    }
    if (!state || !mutation || !Number.isSafeInteger(expectedRevision) || expectedRevision < 0 || typeof mutation.idempotencyKey !== "string" || mutation.idempotencyKey.length < 8 || mutation.idempotencyKey.length > 200) return NextResponse.json({ ok: false, error: "invalid-mutation" }, { status: 400 });
    const saved = await savePerformanceState({ founderKey: session.username, expectedRevision, state, mutation, sourceFile });
    return NextResponse.json({ ok: true, ...saved }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof PerformanceRevisionConflict) return NextResponse.json({ ok: false, error: error.message, state: error.current?.state ?? null, revision: error.current?.revision ?? 0 }, { status: 409, headers: { "Cache-Control": "private, no-store" } });
    const message = error instanceof Error ? error.message : "performance-save-failed";
    const status = /invalid|required/.test(message) ? 400 : 503;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
