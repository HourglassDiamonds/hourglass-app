import { resolveCaptureOrigin } from "@/lib/shape-studio/capture-origin";
import {
  createShapeStudioSession,
  isShapeStudioSessionsAvailable,
} from "@/lib/shape-studio/sessions";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isShapeStudioSessionsAvailable()) {
    return NextResponse.json(
      {
        error: "capture_unavailable",
        message:
          "Phone capture requires Supabase. Use upload from this device instead.",
      },
      { status: 503 },
    );
  }

  try {
    const session = await createShapeStudioSession();
    const origin = resolveCaptureOrigin(request);
    return NextResponse.json({
      sessionId: session.sessionId,
      capturePath: session.capturePath,
      captureUrl: `${origin}${session.capturePath}`,
      expiresAt: session.expiresAt,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Session create failed";
    return NextResponse.json({ error: "session_create_failed", message }, { status: 500 });
  }
}
