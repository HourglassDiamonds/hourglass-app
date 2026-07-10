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

/**
 * Normalize phone camera / library picks for upload.
 *
 * Important: do NOT decode/re-encode large iPhone photos in Safari
 * (createImageBitmap + full-res canvas can hang indefinitely).
 * Accepted JPEG/PNG/WEBP pass through. HEIC/empty MIME pass through
 * for server-side sharp conversion.
 */
export async function prepareCaptureFile(file: File): Promise<File> {
  if (isAcceptedCaptureFile(file) && !isHeicLike(file)) {
    return file;
  }

  if (isHeicLike(file) || !file.type || file.type === "application/octet-stream") {
    return file;
  }

  throw new Error("Please choose a JPG, PNG, or WEBP image.");
}
