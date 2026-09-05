import { resolveCaptureOrigin } from "@/lib/shape-studio/capture-origin";
import { rejectIfShapeStudioRateLimited } from "@/lib/shape-studio/rate-limit";
import {
  createShapeStudioSession,
  isShapeStudioSessionsAvailable,
} from "@/lib/shape-studio/sessions";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const limited = await rejectIfShapeStudioRateLimited("create", request);
  if (limited) return limited;

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
    console.warn("[shape-studio] session create failed");
    const message = err instanceof Error ? err.message : "Session create failed";
    const publicMessage =
      message.includes("Supabase") || message.includes("not configured")
        ? "Phone capture is unavailable. Use upload from this device instead."
        : "Unable to start a capture session.";
    return NextResponse.json(
      { error: "session_create_failed", message: publicMessage },
      { status: 500 },
    );
  }
}
