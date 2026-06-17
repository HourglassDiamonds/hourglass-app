import { isValidSessionId } from "@/lib/shape-studio/sessions";
import { notFound } from "next/navigation";
import { CaptureView } from "./capture-view";

type PageProps = {
  params: Promise<{ sessionId: string }>;
};

export default async function ShapeStudioCapturePage({ params }: PageProps) {
  const { sessionId } = await params;
  if (!isValidSessionId(sessionId)) notFound();
  return <CaptureView sessionId={sessionId} />;
}
