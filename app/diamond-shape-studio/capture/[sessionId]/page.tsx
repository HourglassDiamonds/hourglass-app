import { isValidSessionId } from "@/lib/shape-studio/sessions";
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
  return (
    <CaptureView sessionId={sessionId} captureMode={parseCaptureMode(mode)} />
  );
}
