import {
  ACCEPTED_IMAGE_EXTENSIONS,
  ACCEPTED_IMAGE_TYPES,
} from "./types";

export const SHAPE_STUDIO_MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export function isAcceptedCaptureMime(mime: string): boolean {
  return ACCEPTED_IMAGE_TYPES.includes(
    mime as (typeof ACCEPTED_IMAGE_TYPES)[number],
  );
}

export function isAcceptedCaptureFile(file: File): boolean {
  if (isAcceptedCaptureMime(file.type)) return true;
  const lower = file.name.toLowerCase();
  return ACCEPTED_IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export function extensionForCaptureMime(
  mime: string,
  sourceFilename?: string,
): string {
  const fromName = sourceFilename?.match(/\.[a-z0-9]+$/i)?.[0]?.toLowerCase();
  if (fromName && ACCEPTED_IMAGE_EXTENSIONS.some((e) => fromName.endsWith(e))) {
    return fromName;
  }
  switch (mime) {
    case "image/jpeg":
    case "image/jpg":
      return ".jpg";
    case "image/png":
      return ".png";
    case "image/webp":
      return ".webp";
    default:
      return ".jpg";
  }
}

export function normalizeCaptureMime(mime: string, filename?: string): string {
  if (isAcceptedCaptureMime(mime)) return mime;
  const lower = filename?.toLowerCase() ?? "";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  return mime;
}
