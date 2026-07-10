import {
  getShapeStudioSession,
  isShapeStudioSessionsAvailable,
  isValidSessionId,
} from "@/lib/shape-studio/sessions";
import {
  evaluateCaptureGate,
} from "@/lib/shape-studio/session-lifecycle";
import type { CaptureGateResult } from "@/lib/shape-studio/session-types";
import { parseCaptureMode } from "@/lib/shape-studio/types";
import { notFound } from "next/navigation";
import { CaptureView } from "./capture-view";

type PageProps = {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ mode?: string }>;
};

export default async function ShapeStudioCapturePage({
  params,
  searchParams,
}: PageProps) {
  const { sessionId } = await params;
  const { mode } = await searchParams;
  if (!isValidSessionId(sessionId)) notFound();

  let initialGate: CaptureGateResult = {
    allowed: false,
    reason: "unavailable",
  };

  if (isShapeStudioSessionsAvailable()) {
    try {
      const session = await getShapeStudioSession(sessionId);
      initialGate = evaluateCaptureGate(session);
    } catch {
      initialGate = { allowed: false, reason: "unavailable" };
    }
  } else {
    initialGate = { allowed: false, reason: "unavailable" };
  }

  return (
    <CaptureView
      sessionId={sessionId}
      captureMode={parseCaptureMode(mode)}
      initialGate={initialGate}
    />
  );
}
