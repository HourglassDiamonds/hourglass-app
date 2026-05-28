import { toJsonSafe } from "./gcal-api-error";
import {
  MAX_IMAGE_DIMENSION_PX,
  MAX_IMAGE_UPLOAD_BYTES,
  MAX_PDF_PAGES_PROCESS,
  MAX_UPLOAD_BYTES,
} from "./runtime-limits";

export class CalibrationTimeoutError extends Error {
  readonly code = "CALIBRATION_TIMEOUT" as const;

  constructor(
    public readonly operation: string,
    public readonly timeoutMs: number,
  ) {
    super(`Calibration timeout: ${operation} exceeded ${timeoutMs}ms`);
    this.name = "CalibrationTimeoutError";
  }
}

export type CalibrationRuntimeCheckPayload = {
  operation: string;
  parserPath?: string;
  durationMs?: number;
  renderDurationMs?: number;
  ocrDurationMs?: number;
  pageCount?: number;
  renderScale?: number;
  imageWidth?: number;
  imageHeight?: number;
  timedOut?: boolean;
  timeoutMs?: number;
  workerCleanupSuccess?: boolean;
  error?: string;
  phase?: string;
};

export function logCalibrationRuntimeCheck(
  payload: CalibrationRuntimeCheckPayload,
): void {
  try {
    console.log("[CALIBRATION RUNTIME CHECK]", toJsonSafe(payload));
  } catch {
    console.log("[CALIBRATION RUNTIME CHECK]", {
      operation: payload.operation,
      error: "log serialization failed",
    });
  }
}

export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operation: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          reject(new CalibrationTimeoutError(operation, timeoutMs));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function runScriptWithTimeout(
  main: () => Promise<void>,
  timeoutMs: number,
  scriptName: string,
): Promise<void> {
  const started = Date.now();
  try {
    await withTimeout(main(), timeoutMs, scriptName);
  } catch (err) {
    const timedOut = err instanceof CalibrationTimeoutError;
    logCalibrationRuntimeCheck({
      operation: scriptName,
      durationMs: Date.now() - started,
      timedOut,
      timeoutMs: timedOut ? timeoutMs : undefined,
      error: err instanceof Error ? err.message : String(err),
    });
    console.error(
      timedOut
        ? `[${scriptName}] aborted: exceeded ${timeoutMs}ms`
        : `[${scriptName}] failed:`,
      err instanceof Error ? err.message : err,
    );
    process.exit(timedOut ? 124 : 1);
  }
}

export type UploadValidationResult =
  | { ok: true; pageCount?: number; imageWidth?: number; imageHeight?: number }
  | { ok: false; error: string; code: string };

function readPngDimensions(buffer: Buffer): { width: number; height: number } | null {
  if (buffer.length < 24) return null;
  if (buffer[0] !== 0x89 || buffer[1] !== 0x50) return null;
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

function readJpegDimensions(buffer: Buffer): { width: number; height: number } | null {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) break;
    const marker = buffer[offset + 1];
    const len = buffer.readUInt16BE(offset + 2);
    if (len < 2) break;
    if (marker === 0xc0 || marker === 0xc2) {
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7),
      };
    }
    offset += 2 + len;
  }
  return null;
}

export function readImageDimensionsFromBuffer(
  buffer: Buffer,
): { width: number; height: number } | null {
  return readPngDimensions(buffer) ?? readJpegDimensions(buffer);
}

export async function getPdfPageCountBounded(
  pdfBytes: Buffer,
  timeoutMs: number,
): Promise<number> {
  const { PDF_GET_DOCUMENT_TIMEOUT_MS } = await import("./runtime-limits");
  const ms = timeoutMs || PDF_GET_DOCUMENT_TIMEOUT_MS;
  return withTimeout(
    (async () => {
      const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
      const doc = await pdfjs.getDocument({
        data: new Uint8Array(pdfBytes),
        useSystemFonts: true,
      }).promise;
      return doc.numPages;
    })(),
    ms,
    "pdf-page-count",
  );
}

export async function validateCalibrationUpload(
  bytes: Buffer,
  mimeType: string,
): Promise<UploadValidationResult> {
  if (bytes.length > MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      code: "upload_too_large",
      error: `File exceeds ${Math.floor(MAX_UPLOAD_BYTES / 1024 / 1024)}MB limit.`,
    };
  }

  const mime = mimeType.toLowerCase();

  if (mime.startsWith("image/")) {
    if (bytes.length > MAX_IMAGE_UPLOAD_BYTES) {
      return {
        ok: false,
        code: "image_too_large",
        error: `Image exceeds ${Math.floor(MAX_IMAGE_UPLOAD_BYTES / 1024 / 1024)}MB limit.`,
      };
    }
    const dims = readImageDimensionsFromBuffer(bytes);
    if (dims) {
      if (
        dims.width > MAX_IMAGE_DIMENSION_PX ||
        dims.height > MAX_IMAGE_DIMENSION_PX
      ) {
        return {
          ok: false,
          code: "image_dimensions_exceeded",
          error: `Image dimensions ${dims.width}x${dims.height} exceed ${MAX_IMAGE_DIMENSION_PX}px limit.`,
        };
      }
      return { ok: true, imageWidth: dims.width, imageHeight: dims.height };
    }
    return { ok: true };
  }

  if (mime.includes("pdf")) {
    try {
      const pageCount = await getPdfPageCountBounded(bytes, 0);
      if (pageCount > MAX_PDF_PAGES_PROCESS) {
        return {
          ok: false,
          code: "pdf_too_many_pages",
          error: `PDF has ${pageCount} pages (max ${MAX_PDF_PAGES_PROCESS}).`,
        };
      }
      return { ok: true, pageCount };
    } catch (err) {
      return {
        ok: false,
        code: "pdf_unreadable",
        error:
          err instanceof Error
            ? `Could not read PDF: ${err.message}`
            : "Could not read PDF.",
      };
    }
  }

  return { ok: true };
}

export function timeoutErrorMessage(err: unknown): string {
  if (err instanceof CalibrationTimeoutError) {
    return `${err.operation} timed out after ${err.timeoutMs}ms`;
  }
  return err instanceof Error ? err.message : String(err);
}
