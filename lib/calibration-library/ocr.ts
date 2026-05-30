/**
 * Isolated OCR helper (Tesseract). Optional — disabled via CALIBRATION_OCR_DISABLED=1.
 * All paths are bounded by timeouts; workers are terminated in finally blocks.
 */

import {
  CalibrationTimeoutError,
  logCalibrationRuntimeCheck,
  withTimeout,
  type CalibrationRuntimeCheckPayload,
} from "./runtime-guard";
import {
  capRenderScaleForPixels,
  MAX_IMAGE_UPLOAD_BYTES,
  MAX_PDF_OCR_PAGES,
  OCR_SINGLE_IMAGE_TIMEOUT_MS,
  OCR_WORKER_CREATE_TIMEOUT_MS,
  OCR_WORKER_TERMINATE_TIMEOUT_MS,
  PDF_GET_DOCUMENT_TIMEOUT_MS,
  PDF_RENDER_TIMEOUT_MS,
} from "./runtime-limits";

export type OcrResult = {
  text: string;
  ok: boolean;
  error?: string;
};

export function isOcrDisabledByEnv(): boolean {
  return process.env.CALIBRATION_OCR_DISABLED === "1";
}

let ocrRuntimeChecked = false;
let ocrRuntimeAvailable = false;

async function terminateWorkerSafe(
  worker: { terminate: () => Promise<unknown> },
  operation: string,
): Promise<boolean> {
  try {
    await withTimeout(
      worker.terminate(),
      OCR_WORKER_TERMINATE_TIMEOUT_MS,
      `${operation}-worker-terminate`,
    );
    return true;
  } catch {
    return false;
  }
}

/** Probe whether OCR can load in this runtime (e.g. Vercel vs local). */
export async function isOcrRuntimeAvailable(): Promise<boolean> {
  if (isOcrDisabledByEnv()) return false;
  if (ocrRuntimeChecked) return ocrRuntimeAvailable;

  const started = Date.now();
  let worker: { terminate: () => Promise<unknown> } | null = null;
  let workerCleanupSuccess = false;

  ocrRuntimeChecked = true;
  try {
    const { createWorker } = await import("tesseract.js");
    worker = await withTimeout(
      createWorker("eng", 1, { logger: () => {} }),
      OCR_WORKER_CREATE_TIMEOUT_MS,
      "ocr-runtime-probe-create",
    );
    workerCleanupSuccess = await terminateWorkerSafe(worker, "ocr-runtime-probe");
    ocrRuntimeAvailable = workerCleanupSuccess;
  } catch {
    ocrRuntimeAvailable = false;
  } finally {
    if (worker && !workerCleanupSuccess) {
      workerCleanupSuccess = await terminateWorkerSafe(worker, "ocr-runtime-probe-finally");
    }
    logCalibrationRuntimeCheck({
      operation: "ocr-runtime-probe",
      durationMs: Date.now() - started,
      ocrDurationMs: Date.now() - started,
      workerCleanupSuccess,
    });
  }
  return ocrRuntimeAvailable;
}

export async function ocrImageBuffer(buffer: Buffer): Promise<OcrResult> {
  const started = Date.now();
  let worker: { recognize: (b: Buffer) => Promise<{ data: { text?: string } }>; terminate: () => Promise<unknown> } | null = null;
  let workerCleanupSuccess = false;

  if (!(await isOcrRuntimeAvailable())) {
    return {
      text: "",
      ok: false,
      error: "OCR not available in this environment",
    };
  }

  if (buffer.length > MAX_IMAGE_UPLOAD_BYTES) {
    return {
      text: "",
      ok: false,
      error: `OCR image exceeds ${Math.floor(MAX_IMAGE_UPLOAD_BYTES / 1024 / 1024)}MB limit`,
    };
  }

  try {
    const { createWorker } = await import("tesseract.js");
    worker = await withTimeout(
      createWorker("eng", 1, { logger: () => {} }),
      OCR_WORKER_CREATE_TIMEOUT_MS,
      "ocr-image-create-worker",
    );
    const { data } = await withTimeout(
      worker.recognize(buffer),
      OCR_SINGLE_IMAGE_TIMEOUT_MS,
      "ocr-image-recognize",
    );
    return { text: (data.text ?? "").trim(), ok: true };
  } catch (err) {
    return {
      text: "",
      ok: false,
      error: err instanceof Error ? err.message : "OCR failed",
    };
  } finally {
    if (worker) {
      workerCleanupSuccess = await terminateWorkerSafe(worker, "ocr-image");
    }
    logCalibrationRuntimeCheck({
      operation: "ocr-image",
      ocrDurationMs: Date.now() - started,
      durationMs: Date.now() - started,
      workerCleanupSuccess,
    });
  }
}

export type RenderedPdfPage = {
  png: Buffer;
  width: number;
  height: number;
};

/** Render a PDF page to PNG at the given scale (capped for memory safety). */
export async function renderPdfPagePngAtScale(
  pdfBytes: Buffer,
  pageNumber: number,
  scale: number,
): Promise<RenderedPdfPage | null> {
  const renderStarted = Date.now();
  const checkBase: CalibrationRuntimeCheckPayload = {
    operation: "pdf-render",
    renderScale: scale,
  };

  try {
    return await withTimeout(
      (async () => {
        const { createCanvas } = await import("@napi-rs/canvas");
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        const data = new Uint8Array(pdfBytes);
        const doc = await withTimeout(
          pdfjs.getDocument({
            data,
            useSystemFonts: true,
            disableFontFace: true,
          }).promise,
          PDF_GET_DOCUMENT_TIMEOUT_MS,
          "pdf-render-open",
        );
        const page = await doc.getPage(pageNumber);
        const baseViewport = page.getViewport({ scale: 1 });
        const effectiveScale = capRenderScaleForPixels(
          baseViewport.width,
          baseViewport.height,
          scale,
        );
        const viewport = page.getViewport({ scale: effectiveScale });
        const width = Math.ceil(viewport.width);
        const height = Math.ceil(viewport.height);
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext("2d");
        try {
          await page.render({
            canvasContext: ctx as unknown as CanvasRenderingContext2D,
            viewport,
          }).promise;
          return {
            png: canvas.toBuffer("image/png"),
            width,
            height,
          };
        } finally {
          canvas.width = 0;
          canvas.height = 0;
        }
      })(),
      PDF_RENDER_TIMEOUT_MS,
      "pdf-render-page",
    );
  } catch (err) {
    logCalibrationRuntimeCheck({
      ...checkBase,
      renderDurationMs: Date.now() - renderStarted,
      durationMs: Date.now() - renderStarted,
      timedOut: err instanceof CalibrationTimeoutError,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

async function renderPdfPagePng(
  pdfBytes: Buffer,
  pageNumber: number,
): Promise<Buffer | null> {
  const rendered = await renderPdfPagePngAtScale(pdfBytes, pageNumber, 2);
  return rendered?.png ?? null;
}

/** OCR up to MAX_PDF_OCR_PAGES pages of a PDF (image-based reports). */
export async function ocrPdfBuffer(pdfBytes: Buffer): Promise<OcrResult> {
  const started = Date.now();
  if (!(await isOcrRuntimeAvailable())) {
    return {
      text: "",
      ok: false,
      error: "OCR not available in this environment",
    };
  }

  const parts: string[] = [];
  let pageCount = 0;
  try {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const doc = await withTimeout(
      pdfjs.getDocument({
        data: new Uint8Array(pdfBytes),
        useSystemFonts: true,
        disableFontFace: true,
      }).promise,
      PDF_GET_DOCUMENT_TIMEOUT_MS,
      "pdf-ocr-open",
    );
    pageCount = doc.numPages;
    const pages = Math.min(doc.numPages, MAX_PDF_OCR_PAGES);

    for (let p = 1; p <= pages; p++) {
      const png = await renderPdfPagePng(pdfBytes, p);
      if (!png) continue;
      const pageOcr = await ocrImageBuffer(png);
      if (pageOcr.text) parts.push(pageOcr.text);
    }

    const text = parts.join("\n\n").trim();
    return { text, ok: text.length > 0 };
  } catch (err) {
    return {
      text: "",
      ok: false,
      error: err instanceof Error ? err.message : "PDF OCR failed",
    };
  } finally {
    logCalibrationRuntimeCheck({
      operation: "pdf-ocr",
      pageCount,
      ocrDurationMs: Date.now() - started,
      durationMs: Date.now() - started,
    });
  }
}
