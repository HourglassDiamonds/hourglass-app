import {
  MAX_IMAGE_UPLOAD_BYTES,
  MAX_UPLOAD_BYTES,
} from "@/lib/calibration-library/runtime-limits";
import {
  DI_ACCEPTED_EXTENSIONS,
  DI_ACCEPTED_MIMES,
} from "@/lib/diamond-intelligence/upload-accept";
import { DI_UNSUPPORTED_FILE_TYPE_MESSAGE } from "@/lib/diamond-intelligence/upload-format-policy";

export {
  DI_ACCEPTED_EXTENSIONS,
  DI_ACCEPTED_MIMES,
  DI_CLIENT_ACCEPT,
} from "@/lib/diamond-intelligence/upload-accept";

const BLOCKED_EXTENSIONS = new Set([
  ".svg",
  ".zip",
  ".doc",
  ".docx",
  ".exe",
  ".js",
  ".mjs",
  ".html",
  ".htm",
  ".php",
  ".bat",
  ".cmd",
  ".sh",
  ".dll",
  ".msi",
  ".apk",
  ".wasm",
  ".xml",
  ".json",
  ".txt",
  ".csv",
  ".gif",
  ".webp",
  ".heic",
  ".heif",
  ".bmp",
  ".tiff",
  ".tif",
]);

export type DetectedUploadKind = "pdf" | "jpeg" | "png" | "unknown";

export type DiamondIntelligenceUploadValidationResult =
  | {
      ok: true;
      mime: string;
      detectedKind: DetectedUploadKind;
    }
  | {
      ok: false;
      code: string;
      error: string;
    };

export function normalizeReportFilename(filename: string | undefined): string {
  return (filename ?? "").trim().toLowerCase();
}

export function extensionFromFilename(filename: string | undefined): string {
  const normalized = normalizeReportFilename(filename);
  const dot = normalized.lastIndexOf(".");
  if (dot < 0) return "";
  return normalized.slice(dot);
}

export function isDiamondIntelligenceAcceptedMime(mime: string): boolean {
  const normalized = mime.toLowerCase().split(";")[0]!.trim();
  return DI_ACCEPTED_MIMES.has(normalized);
}

export function detectUploadKindFromBytes(bytes: Buffer): DetectedUploadKind {
  if (bytes.length >= 4 && bytes.subarray(0, 4).toString("ascii") === "%PDF") {
    return "pdf";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "jpeg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "png";
  }
  return "unknown";
}

function mimeForDetectedKind(kind: DetectedUploadKind): string | null {
  switch (kind) {
    case "pdf":
      return "application/pdf";
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    default:
      return null;
  }
}

function kindMatchesDeclaredMime(
  kind: DetectedUploadKind,
  declaredMime: string,
): boolean {
  const normalized = declaredMime.toLowerCase().split(";")[0]!.trim();
  if (kind === "pdf") return normalized === "application/pdf";
  if (kind === "jpeg") {
    return normalized === "image/jpeg" || normalized === "image/jpg";
  }
  if (kind === "png") return normalized === "image/png";
  return false;
}

export function validateDiamondIntelligenceUpload(input: {
  bytes: Buffer;
  declaredMime: string;
  sourceFilename?: string;
}): DiamondIntelligenceUploadValidationResult {
  const { bytes, declaredMime, sourceFilename } = input;

  if (!bytes.length) {
    return {
      ok: false,
      code: "empty_file",
      error: "A report file is required.",
    };
  }

  const ext = extensionFromFilename(sourceFilename);
  if (ext && BLOCKED_EXTENSIONS.has(ext)) {
    return {
      ok: false,
      code: "blocked_extension",
      error: DI_UNSUPPORTED_FILE_TYPE_MESSAGE,
    };
  }

  if (ext && !DI_ACCEPTED_EXTENSIONS.has(ext)) {
    return {
      ok: false,
      code: "unsupported_extension",
      error: DI_UNSUPPORTED_FILE_TYPE_MESSAGE,
    };
  }

  if (bytes.length > MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      code: "upload_too_large",
      error: `File exceeds ${Math.floor(MAX_UPLOAD_BYTES / 1024 / 1024)}MB limit.`,
    };
  }

  const detectedKind = detectUploadKindFromBytes(bytes);
  if (detectedKind === "unknown") {
    return {
      ok: false,
      code: "unknown_binary",
      error: DI_UNSUPPORTED_FILE_TYPE_MESSAGE,
    };
  }

  const canonicalMime = mimeForDetectedKind(detectedKind)!;
  const normalizedDeclared = declaredMime.toLowerCase().split(";")[0]!.trim();
  const effectiveMime =
    !normalizedDeclared || normalizedDeclared === "application/octet-stream"
      ? canonicalMime
      : normalizedDeclared;

  if (!isDiamondIntelligenceAcceptedMime(effectiveMime)) {
    return {
      ok: false,
      code: "unsupported_mime",
      error: DI_UNSUPPORTED_FILE_TYPE_MESSAGE,
    };
  }

  if (!kindMatchesDeclaredMime(detectedKind, effectiveMime)) {
    return {
      ok: false,
      code: "mime_content_mismatch",
      error: DI_UNSUPPORTED_FILE_TYPE_MESSAGE,
    };
  }
  if (
    detectedKind !== "pdf" &&
    bytes.length > MAX_IMAGE_UPLOAD_BYTES
  ) {
    return {
      ok: false,
      code: "image_too_large",
      error: `Image exceeds ${Math.floor(MAX_IMAGE_UPLOAD_BYTES / 1024 / 1024)}MB limit.`,
    };
  }

  return { ok: true, mime: canonicalMime, detectedKind };
}
