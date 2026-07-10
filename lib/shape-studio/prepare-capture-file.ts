import { isAcceptedCaptureFile } from "./validate-image";

function isHeicLike(file: File): boolean {
  const type = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  return (
    type.includes("heic") ||
    type.includes("heif") ||
    name.endsWith(".heic") ||
    name.endsWith(".heif")
  );
}

async function canvasToJpegFile(file: File, quality = 0.92): Promise<File> {
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable");
    ctx.drawImage(bitmap, 0, 0);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => {
          if (result) resolve(result);
          else reject(new Error("JPEG encode failed"));
        },
        "image/jpeg",
        quality,
      );
    });

    const base = file.name.replace(/\.[^.]+$/, "") || "capture";
    return new File([blob], `${base}.jpg`, { type: "image/jpeg" });
  } finally {
    bitmap.close();
  }
}

/**
 * Normalize phone camera / library picks into an uploadable JPG/PNG/WEBP File.
 * iPhone may return HEIC/HEIF or an empty MIME type.
 */
export async function prepareCaptureFile(file: File): Promise<File> {
  if (isAcceptedCaptureFile(file) && !isHeicLike(file)) {
    return file;
  }

  if (isHeicLike(file) || !file.type || file.type === "application/octet-stream") {
    try {
      return await canvasToJpegFile(file);
    } catch (err) {
      const message = err instanceof Error ? err.message : "convert failed";
      throw new Error(
        `Could not convert this photo for upload (${message}). Try JPG or take the photo again.`,
      );
    }
  }

  throw new Error("Please choose a JPG, PNG, or WEBP image.");
}
