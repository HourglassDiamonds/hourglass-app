import {
  getShapeStudioSession,
  isShapeStudioSessionsAvailable,
  isValidSessionId,
} from "@/lib/shape-studio/sessions";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ sessionId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { sessionId } = await context.params;

  if (!isValidSessionId(sessionId)) {
    return NextResponse.json({ error: "invalid_session" }, { status: 400 });
  }

  if (!isShapeStudioSessionsAvailable()) {
    return NextResponse.json({ error: "capture_unavailable" }, { status: 503 });
  }

  try {
    const session = await getShapeStudioSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json(session);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Session read failed";
    return NextResponse.json({ error: "session_read_failed", message }, { status: 500 });
  }
}
