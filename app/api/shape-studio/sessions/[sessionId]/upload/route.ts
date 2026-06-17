import {
  isAcceptedCaptureMime,
  normalizeCaptureMime,
  SHAPE_STUDIO_MAX_IMAGE_BYTES,
} from "@/lib/shape-studio/validate-image";
import {
  isShapeStudioSessionsAvailable,
  isValidSessionId,
  uploadShapeStudioCapture,
} from "@/lib/shape-studio/sessions";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ sessionId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { sessionId } = await context.params;

  if (!isValidSessionId(sessionId)) {
    return NextResponse.json({ error: "invalid_session" }, { status: 400 });
  }

  if (!isShapeStudioSessionsAvailable()) {
    return NextResponse.json({ error: "capture_unavailable" }, { status: 503 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "invalid_form" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "missing_file" }, { status: 400 });
  }

  const mime = normalizeCaptureMime(file.type, file.name);
  if (!isAcceptedCaptureMime(mime)) {
    return NextResponse.json(
      { error: "unsupported_type", message: "Use JPG, PNG, or WEBP." },
      { status: 400 },
    );
  }

  if (file.size > SHAPE_STUDIO_MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "file_too_large" }, { status: 413 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());

  try {
    await uploadShapeStudioCapture({
      sessionId,
      bytes,
      mime,
      sourceFilename: file.name,
    });
    return NextResponse.json({ ok: true, status: "image_uploaded" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    const status =
      message === "Session not found"
        ? 404
        : message === "Session expired"
          ? 410
          : message === "Session already has an image"
            ? 409
            : 500;
    return NextResponse.json({ error: "upload_failed", message }, { status });
  }
}
