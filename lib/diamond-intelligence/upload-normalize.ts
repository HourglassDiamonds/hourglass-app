import {
  MAX_IMAGE_DIMENSION_PX,
  MAX_IMAGE_UPLOAD_BYTES,
  MAX_UPLOAD_BYTES,
} from "@/lib/calibration-library/runtime-limits";
import { readImageDimensionsFromBuffer } from "@/lib/calibration-library/runtime-guard";
import { DI_UNSUPPORTED_FILE_TYPE_MESSAGE } from "@/lib/diamond-intelligence/upload-format-policy";

export type UploadIngestKind =
  | "pdf"
  | "image"
  | "screenshot"
  | "bmp-converted"
  | "url";

export type UploadIngestMetadata = {
  ingestKind: UploadIngestKind;
  convertedFrom?: "bmp";
  normalizedMime?: string;
  originalFilename?: string;
  originalMime?: string;
};

export type DiamondIntelligenceUploadNormalizeResult =
  | {
      ok: true;
      bytes: Buffer;
      mime: string;
      sourceFilename?: string;
      ingestMetadata: UploadIngestMetadata;
    }
  | {
      ok: false;
      code: string;
      error: string;
    };

/** Windows BMP — "BM" signature at offset 0. */
export function detectBmpFromBytes(bytes: Buffer): boolean {
  return bytes.length >= 2 && bytes[0] === 0x42 && bytes[1] === 0x4d;
}

/** Reject truncated or malformed BMP before native decode (canvas can crash on garbage). */
export function isPlausibleBmpBuffer(bytes: Buffer): boolean {
  if (!detectBmpFromBytes(bytes) || bytes.length < 54) return false;

  const fileSize = bytes.readUInt32LE(2);
  const dataOffset = bytes.readUInt32LE(10);
  const dibSize = bytes.readUInt32LE(14);

  if (fileSize < 54 || fileSize > MAX_UPLOAD_BYTES) return false;
  if (bytes.length < Math.min(fileSize, dataOffset + 1)) return false;
  if (dataOffset < 14 || dataOffset >= bytes.length) return false;
  if (dibSize < 40 || 14 + dibSize > dataOffset) return false;

  const width = Math.abs(bytes.readInt32LE(18));
  const height = Math.abs(bytes.readInt32LE(22));
  if (width < 1 || height < 1) return false;
  if (width > MAX_IMAGE_DIMENSION_PX || height > MAX_IMAGE_DIMENSION_PX) return false;

  return true;
}

export function swapFilenameExtensionToPng(filename: string | undefined): string | undefined {
  if (!filename?.trim()) return filename;
  const trimmed = filename.trim();
  const dot = trimmed.lastIndexOf(".");
  if (dot <= 0) return `${trimmed}.png`;
  return `${trimmed.slice(0, dot)}.png`;
}

function imageDimensionError(
  width: number,
  height: number,
  maxPx: number,
): DiamondIntelligenceUploadNormalizeResult {
  return {
    ok: false,
    code: "image_dimensions_exceeded",
    error: `Image dimensions ${width}x${height} exceed ${maxPx}px limit.`,
  };
}

async function convertBmpToPng(bytes: Buffer): Promise<Buffer> {
  const { createCanvas, loadImage } = await import("@napi-rs/canvas");
  const img = await loadImage(bytes);
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);
  return canvas.toBuffer("image/png");
}

function buildPostNormalizeIngestMetadata(input: {
  mime: string;
  convertedFromBmp: boolean;
  originalFilename?: string;
  originalMime?: string;
}): UploadIngestMetadata {
  if (input.convertedFromBmp) {
    return {
      ingestKind: "bmp-converted",
      convertedFrom: "bmp",
      normalizedMime: "image/png",
      originalFilename: input.originalFilename,
      originalMime: input.originalMime,
    };
  }
  if (input.mime.includes("pdf")) {
    return { ingestKind: "pdf", normalizedMime: input.mime };
  }
  return { ingestKind: "screenshot", normalizedMime: input.mime };
}

/**
 * Converts BMP uploads to PNG before validation and extraction.
 * PDF, JPEG, and PNG bytes pass through unchanged.
 */
export async function normalizeDiamondIntelligenceUpload(input: {
  bytes: Buffer;
  declaredMime: string;
  sourceFilename?: string;
}): Promise<DiamondIntelligenceUploadNormalizeResult> {
  const { declaredMime, sourceFilename } = input;
  let bytes = input.bytes;

  if (!bytes.length) {
    return {
      ok: false,
      code: "empty_file",
      error: "A report file is required.",
    };
  }

  if (bytes.length > MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      code: "upload_too_large",
      error: `File exceeds ${Math.floor(MAX_UPLOAD_BYTES / 1024 / 1024)}MB limit.`,
    };
  }

  if (!detectBmpFromBytes(bytes)) {
    return {
      ok: true,
      bytes,
      mime: declaredMime,
      sourceFilename,
      ingestMetadata: buildPostNormalizeIngestMetadata({
        mime: declaredMime,
        convertedFromBmp: false,
      }),
    };
  }

  if (!isPlausibleBmpBuffer(bytes)) {
    return {
      ok: false,
      code: "unknown_binary",
      error: DI_UNSUPPORTED_FILE_TYPE_MESSAGE,
    };
  }

  const originalFilename = sourceFilename;
  const originalMime = declaredMime;

  let pngBytes: Buffer;
  try {
    pngBytes = await convertBmpToPng(bytes);
  } catch {
    return {
      ok: false,
      code: "unknown_binary",
      error: DI_UNSUPPORTED_FILE_TYPE_MESSAGE,
    };
  }

  if (pngBytes.length > MAX_IMAGE_UPLOAD_BYTES) {
    return {
      ok: false,
      code: "image_too_large",
      error: `Image exceeds ${Math.floor(MAX_IMAGE_UPLOAD_BYTES / 1024 / 1024)}MB limit.`,
    };
  }

  const dims = readImageDimensionsFromBuffer(pngBytes);
  if (
    dims &&
    (dims.width > MAX_IMAGE_DIMENSION_PX || dims.height > MAX_IMAGE_DIMENSION_PX)
  ) {
    return imageDimensionError(dims.width, dims.height, MAX_IMAGE_DIMENSION_PX);
  }

  bytes = pngBytes;
  const normalizedFilename = swapFilenameExtensionToPng(sourceFilename);

  return {
    ok: true,
    bytes,
    mime: "image/png",
    sourceFilename: normalizedFilename,
    ingestMetadata: buildPostNormalizeIngestMetadata({
      mime: "image/png",
      convertedFromBmp: true,
      originalFilename,
      originalMime,
    }),
  };
}

/** Resolve ingestKind after validation when MIME is canonical. */
export function resolveUploadIngestMetadata(input: {
  mime: string;
  preNormalize?: UploadIngestMetadata;
}): UploadIngestMetadata {
  if (input.preNormalize?.ingestKind === "bmp-converted") {
    return input.preNormalize;
  }
  if (input.mime.includes("pdf")) {
    return { ingestKind: "pdf", normalizedMime: input.mime };
  }
  if (input.mime.startsWith("image/")) {
    return { ingestKind: "screenshot", normalizedMime: input.mime };
  }
  return { ingestKind: "image", normalizedMime: input.mime };
}
