const MAX_ORIGINAL_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_UPLOAD_IMAGE_BYTES = 3_700_000;
const MAX_IMAGE_EDGE = 2_400;

export type PerformanceImageErrorCode =
  | "unsupported-format"
  | "file-too-large"
  | "conversion-failed";

export class PerformanceImageError extends Error {
  constructor(public readonly code: PerformanceImageErrorCode) { super(code); }
}

export type PreparedPerformanceImage = {
  file: File;
  original: { name: string; type: string; size: number; digest: string };
  converted: boolean;
};

export function detectedImageType(bytes: Uint8Array): string | undefined {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return "image/png";
  if (bytes.length >= 6 && String.fromCharCode(...bytes.slice(0, 6)).startsWith("GIF8")) return "image/gif";
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return "image/webp";
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(4, 8)) === "ftyp") {
    const brand = String.fromCharCode(...bytes.slice(8, 12)).toLowerCase();
    if (["heic", "heix", "hevc", "hevx", "mif1", "msf1"].includes(brand)) return brand === "mif1" || brand === "msf1" ? "image/heif" : "image/heic";
  }
  return undefined;
}

async function sha256(file: Blob): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("");
}

type DecodedImage = { source: CanvasImageSource; width: number; height: number; close: () => void };

async function decodeImage(file: File): Promise<DecodedImage> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const image = new Image(); image.src = url; await image.decode();
      if (!image.naturalWidth || !image.naturalHeight) throw new Error("empty-image");
      return { source: image, width: image.naturalWidth, height: image.naturalHeight, close: () => URL.revokeObjectURL(url) };
    } catch { URL.revokeObjectURL(url); throw new PerformanceImageError("conversion-failed"); }
  }
}

async function jpegBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  for (const quality of [0.86, 0.76, 0.64, 0.52]) {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (blob && blob.size <= MAX_UPLOAD_IMAGE_BYTES) return blob;
  }
  throw new PerformanceImageError("file-too-large");
}

export async function preparePerformanceImage(file: File): Promise<PreparedPerformanceImage> {
  if (!file.size || file.size > MAX_ORIGINAL_IMAGE_BYTES) throw new PerformanceImageError("file-too-large");
  const bytes = new Uint8Array(await file.slice(0, 32).arrayBuffer());
  const detectedType = detectedImageType(bytes);
  if (!detectedType) throw new PerformanceImageError("unsupported-format");
  const original = { name: file.name, type: detectedType, size: file.size, digest: await sha256(file) };
  const bitmap = await decodeImage(file);
  try {
    const needsConversion = detectedType === "image/heic" || detectedType === "image/heif" || file.size > MAX_UPLOAD_IMAGE_BYTES || Math.max(bitmap.width, bitmap.height) > MAX_IMAGE_EDGE;
    if (!needsConversion) return { file: new File([file], file.name, { type: detectedType }), original, converted: false };
    const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new PerformanceImageError("conversion-failed");
    context.drawImage(bitmap.source, 0, 0, canvas.width, canvas.height);
    const blob = await jpegBlob(canvas);
    return { file: new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" }), original, converted: true };
  } finally { bitmap.close(); }
}

export function performanceImageMessage(error: unknown): string {
  const code = error instanceof PerformanceImageError ? error.code : error instanceof Error ? error.message : "";
  if (code === "unsupported-format") return "Unsupported photo format. Choose an iPhone Camera/Photo Library image, JPEG, PNG, WebP, GIF, HEIC, or HEIF.";
  if (code === "file-too-large") return "That photo is too large to prepare safely. Choose an original no larger than 20 MB.";
  if (code === "conversion-failed") return "The iPhone photo could not be converted safely. Export it as JPEG or take a screenshot, then retry.";
  if (code === "upload-failed") return "The prepared photo could not be uploaded. Nothing was saved.";
  if (code === "extraction-failed") return "Sterling could not read the prepared photo. Nothing was saved.";
  return "The photo could not be prepared. Nothing was saved.";
}

export const PERFORMANCE_IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,.heic,.heif";
