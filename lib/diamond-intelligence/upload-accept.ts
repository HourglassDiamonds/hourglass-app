/** Client-safe Diamond Intelligence public upload accept policy (browser file picker only). */

export const DI_ACCEPTED_MIMES = new Set(["application/pdf"]);

export const DI_ACCEPTED_EXTENSIONS = new Set([".pdf"]);

export const DI_CLIENT_ACCEPT = "application/pdf,.pdf";

const IMAGE_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".bmp",
  ".webp",
  ".heic",
  ".heif",
  ".tiff",
  ".tif",
  ".gif",
]);

export function extensionFromUploadFilename(filename: string): string {
  const normalized = filename.trim().toLowerCase();
  const dot = normalized.lastIndexOf(".");
  if (dot < 0) return "";
  return normalized.slice(dot);
}

/** Public Diamond Intelligence upload path — original grading report PDFs only. */
export function isPublicDiamondIntelligencePdfUpload(file: File): boolean {
  const ext = extensionFromUploadFilename(file.name);
  const mime = file.type.toLowerCase().split(";")[0]!.trim();

  if (mime.startsWith("image/")) return false;
  if (ext && IMAGE_EXTENSIONS.has(ext)) return false;

  if (mime === "application/pdf") return true;
  if (ext === ".pdf") {
    return !mime || mime === "application/octet-stream";
  }

  return false;
}
