import {
  acknowledgeShapeStudioSession,
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

/**
 * Desktop acknowledgement after successful download + local adoption.
 * Idempotent when already consumed. Deletes the capture object.
 */
export async function POST(_request: Request, context: RouteContext) {
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
    const result = await acknowledgeShapeStudioSession(sessionId);
    return NextResponse.json(
      {
        ok: true,
        status: result.status,
        acknowledgedAt: result.acknowledgedAt,
      },
      { headers: NO_STORE },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Acknowledge failed";
    const status =
      message === "Session not found"
        ? 404
        : message === "Session has no image to acknowledge"
          ? 409
          : 500;
    return NextResponse.json(
      { error: "acknowledge_failed", message },
      { status, headers: NO_STORE },
    );
  }
}
