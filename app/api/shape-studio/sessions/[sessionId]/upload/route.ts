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
import sharp from "sharp";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ sessionId: string }>;
};

function isHeicLikeMime(mime: string, filename: string): boolean {
  const type = mime.toLowerCase();
  const name = filename.toLowerCase();
  return (
    type.includes("heic") ||
    type.includes("heif") ||
    name.endsWith(".heic") ||
    name.endsWith(".heif")
  );
}

async function normalizeUploadBytes(
  file: File,
): Promise<{ bytes: Buffer; mime: string; sourceFilename: string }> {
  const rawMime = normalizeCaptureMime(file.type, file.name);
  const bytes = Buffer.from(await file.arrayBuffer());

  if (isAcceptedCaptureMime(rawMime) && !isHeicLikeMime(rawMime, file.name)) {
    return { bytes, mime: rawMime, sourceFilename: file.name };
  }

  if (isHeicLikeMime(rawMime, file.name)) {
    const jpeg = await sharp(bytes).rotate().jpeg({ quality: 90 }).toBuffer();
    const sourceFilename = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return { bytes: jpeg, mime: "image/jpeg", sourceFilename };
  }

  // Some mobile browsers omit MIME; only accept if sharp can decode as an image.
  if (!file.type) {
    try {
      const jpeg = await sharp(bytes).rotate().jpeg({ quality: 90 }).toBuffer();
      const sourceFilename =
        (file.name.replace(/\.[^.]+$/, "") || "capture") + ".jpg";
      return { bytes: jpeg, mime: "image/jpeg", sourceFilename };
    } catch {
      throw new Error("unsupported_type");
    }
  }

  throw new Error("unsupported_type");
}

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

  if (file.size > SHAPE_STUDIO_MAX_IMAGE_BYTES) {
    return NextResponse.json(
      { error: "file_too_large", message: "Photo is too large (max 10 MB)." },
      { status: 413 },
    );
  }

  let normalized: { bytes: Buffer; mime: string; sourceFilename: string };
  try {
    normalized = await normalizeUploadBytes(file);
  } catch {
    return NextResponse.json(
      {
        error: "unsupported_type",
        message: "Use JPG, PNG, or WEBP.",
      },
      { status: 400 },
    );
  }

  if (normalized.bytes.byteLength > SHAPE_STUDIO_MAX_IMAGE_BYTES) {
    return NextResponse.json(
      { error: "file_too_large", message: "Photo is too large (max 10 MB)." },
      { status: 413 },
    );
  }

  try {
    await uploadShapeStudioCapture({
      sessionId,
      bytes: normalized.bytes,
      mime: normalized.mime,
      sourceFilename: normalized.sourceFilename,
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
