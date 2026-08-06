import {
  cancelShapeStudioSession,
  getShapeStudioSession,
  isShapeStudioSessionsAvailable,
  isValidSessionId,
} from "@/lib/shape-studio/sessions";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ sessionId: string }>;
};

const NO_STORE = {
  "Cache-Control": "private, no-store, no-cache, must-revalidate",
} as const;

export async function GET(_request: Request, context: RouteContext) {
  const { sessionId } = await context.params;

  if (!isValidSessionId(sessionId)) {
    return NextResponse.json({ error: "invalid_session" }, { status: 400, headers: NO_STORE });
  }

  if (!isShapeStudioSessionsAvailable()) {
    return NextResponse.json({ error: "capture_unavailable" }, { status: 503, headers: NO_STORE });
  }

  try {
    const session = await getShapeStudioSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: "not_found" }, { status: 404, headers: NO_STORE });
    }
    return NextResponse.json(session, { headers: NO_STORE });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Session read failed";
    return NextResponse.json(
      { error: "session_read_failed", message },
      { status: 500, headers: NO_STORE },
    );
  }
}

/** Desktop cancel / Start over — invalidates session and deletes any capture object. */
export async function DELETE(_request: Request, context: RouteContext) {
  const { sessionId } = await context.params;

  if (!isValidSessionId(sessionId)) {
    return NextResponse.json(
      { error: "invalid_session" },
      { status: 400, headers: NO_STORE },
    );
  }

  if (!isShapeStudioSessionsAvailable()) {
    return NextResponse.json(
      { error: "capture_unavailable" },
      { status: 503, headers: NO_STORE },
    );
  }

  try {
    await cancelShapeStudioSession(sessionId);
    return NextResponse.json({ ok: true, status: "cancelled" }, { headers: NO_STORE });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Cancel failed";
    const status = message === "Session not found" ? 404 : 500;
    return NextResponse.json(
      { error: "cancel_failed", message },
      { status, headers: NO_STORE },
    );
  }
}
