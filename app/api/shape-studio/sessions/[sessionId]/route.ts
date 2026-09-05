import { rejectIfShapeStudioRateLimited } from "@/lib/shape-studio/rate-limit";
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

export async function GET(request: Request, context: RouteContext) {
  const limited = await rejectIfShapeStudioRateLimited("read", request, NO_STORE);
  if (limited) return limited;

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
  } catch {
    console.warn("[shape-studio] session read failed");
    return NextResponse.json(
      { error: "session_read_failed", message: "Unable to read capture session." },
      { status: 500, headers: NO_STORE },
    );
  }
}

/** Desktop cancel / Start over — invalidates session and deletes any capture object. */
export async function DELETE(request: Request, context: RouteContext) {
  const limited = await rejectIfShapeStudioRateLimited("cancel", request, NO_STORE);
  if (limited) return limited;

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
    if (status === 500) {
      console.warn("[shape-studio] session cancel failed");
    }
    return NextResponse.json(
      {
        error: "cancel_failed",
        message: status === 404 ? "Session not found" : "Unable to cancel capture session.",
      },
      { status, headers: NO_STORE },
    );
  }
}
