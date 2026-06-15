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
import { loadServerPdfjs } from "./server-pdfjs";
import {
  isPdfRenderRetryableError,
  renderPdfPagePngWithFactory,
} from "./pdf-render-factory";

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
let ocrRuntimeProbeError: string | undefined;
let ocrRuntimeProbeDurationMs = 0;
let ocrRuntimeProbeLog: string[] = [];

/** Override createWorker options (e.g. bundled lang data on DI interpret route). */
let workerCreateOptions: Record<string, unknown> = { logger: () => {} };

export function setTesseractWorkerCreateOptions(
  opts: Record<string, unknown> | null,
): void {
  workerCreateOptions = opts ?? { logger: () => {} };
  ocrRuntimeChecked = false;
  ocrRuntimeAvailable = false;
  ocrRuntimeProbeError = undefined;
  ocrRuntimeProbeLog = [];
}

export type OcrRuntimeProbeSnapshot = {
  checked: boolean;
  available: boolean;
  durationMs: number;
  error?: string;
  log?: string[];
};

export function getOcrRuntimeProbeSnapshot(): OcrRuntimeProbeSnapshot {
  return {
    checked: ocrRuntimeChecked,
    available: ocrRuntimeAvailable,
    durationMs: ocrRuntimeProbeDurationMs,
    error: ocrRuntimeProbeError,
    log: ocrRuntimeProbeLog.length > 0 ? [...ocrRuntimeProbeLog] : undefined,
  };
}

function tesseractWorkerOptions(): Record<string, unknown> {
  return workerCreateOptions;
}

function probeLogger(entry: { status?: string; progress?: number }) {
  const status = entry.status ?? "unknown";
  const progress =
    typeof entry.progress === "number"
      ? ` ${Math.round(entry.progress * 100)}%`
      : "";
  ocrRuntimeProbeLog.push(`${status}${progress}`);
  if (ocrRuntimeProbeLog.length > 24) ocrRuntimeProbeLog.shift();
}

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
  ocrRuntimeProbeLog = [];
  try {
    const { createWorker } = await import("tesseract.js");
    const baseOpts = tesseractWorkerOptions();
    worker = await withTimeout(
      createWorker("eng", 1, {
        ...baseOpts,
        logger: probeLogger,
        errorHandler: (err: unknown) => {
          ocrRuntimeProbeError =
            typeof err === "string" ? err : err instanceof Error ? err.message : String(err);
        },
      }),
      OCR_WORKER_CREATE_TIMEOUT_MS,
      "ocr-runtime-probe-create",
    );
    workerCleanupSuccess = await terminateWorkerSafe(worker, "ocr-runtime-probe");
    ocrRuntimeAvailable = workerCleanupSuccess;
    if (!ocrRuntimeAvailable) {
      ocrRuntimeProbeError = "worker-terminate-failed";
    }
  } catch (err) {
    ocrRuntimeAvailable = false;
    ocrRuntimeProbeError =
      err instanceof Error ? err.message : String(err);
  } finally {
    if (worker && !workerCleanupSuccess) {
      workerCleanupSuccess = await terminateWorkerSafe(worker, "ocr-runtime-probe-finally");
    }
    ocrRuntimeProbeDurationMs = Date.now() - started;
    logCalibrationRuntimeCheck({
      operation: "ocr-runtime-probe",
      durationMs: ocrRuntimeProbeDurationMs,
      ocrDurationMs: ocrRuntimeProbeDurationMs,
      workerCleanupSuccess,
      error: ocrRuntimeProbeError,
    });
    if (!ocrRuntimeAvailable) {
      console.log("[tesseract-runtime-probe]", {
        available: false,
        durationMs: ocrRuntimeProbeDurationMs,
        error: ocrRuntimeProbeError,
      });
    }
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
      createWorker("eng", 1, tesseractWorkerOptions()),
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

export type PdfRenderBackend = "production" | "factory-fallback";

export type RenderedPdfPage = {
  png: Buffer;
  width: number;
  height: number;
  backend: PdfRenderBackend;
};

type PdfRenderDocOpts = {
  useSystemFonts?: boolean;
  disableFontFace?: boolean;
};

async function renderPdfPagePngProduction(
  pdfBytes: Buffer,
  pageNumber: number,
  scale: number,
  docOpts?: PdfRenderDocOpts,
): Promise<{ png: Buffer; width: number; height: number } | { error: string }> {
  const { createCanvas } = await import("@napi-rs/canvas");
  const pdfjs = await loadServerPdfjs();
  const data = new Uint8Array(pdfBytes);
  const doc = await withTimeout(
    pdfjs.getDocument({
      data,
      useSystemFonts: docOpts?.useSystemFonts ?? true,
      disableFontFace: docOpts?.disableFontFace ?? true,
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
}

/**
 * GIA LGDR dossier render — harness-validated font options for embedded/type3 glyphs.
 * Isolated from default production + facsimile paths (see pdf-render-harness).
 */
export async function renderPdfPagePngLgdrDossier(
  pdfBytes: Buffer,
  pageNumber: number,
  scale: number,
): Promise<RenderedPdfPage | null> {
  const renderStarted = Date.now();
  const logOp = "pdf-render-lgdr-dossier";
  try {
    const rendered = await withTimeout(
      renderPdfPagePngProduction(pdfBytes, pageNumber, scale, {
        useSystemFonts: true,
        disableFontFace: false,
      }),
      PDF_RENDER_TIMEOUT_MS,
      `${logOp}-page`,
    );
    if ("error" in rendered) {
      throw new Error(rendered.error);
    }
    logCalibrationRuntimeCheck({
      operation: logOp,
      renderScale: scale,
      renderDurationMs: Date.now() - renderStarted,
      durationMs: Date.now() - renderStarted,
      parserPath: "lgdr-dossier",
    });
    return { ...rendered, backend: "production" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logCalibrationRuntimeCheck({
      operation: logOp,
      renderScale: scale,
      renderDurationMs: Date.now() - renderStarted,
      durationMs: Date.now() - renderStarted,
      timedOut: err instanceof CalibrationTimeoutError,
      error: message,
    });
    if (!isPdfRenderRetryableError(message)) {
      return null;
    }
    const factory = await renderPdfPagePngWithFactory(
      pdfBytes,
      pageNumber,
      scale,
      "pdf-render-lgdr-factory-fallback",
    );
    if (!factory) return null;
    return { ...factory, backend: "factory-fallback" };
  }
}

/**
 * GCAL Sarine / 8X hybrid — diagram panel is on page 2; embedded fonts need
 * disableFontFace: false (same class of fix as LGDR dossier render).
 */
export async function renderPdfPagePngGcalSarine(
  pdfBytes: Buffer,
  pageNumber: number,
  scale: number,
): Promise<RenderedPdfPage | null> {
  const renderStarted = Date.now();
  const logOp = "pdf-render-gcal-sarine";
  try {
    const rendered = await withTimeout(
      renderPdfPagePngProduction(pdfBytes, pageNumber, scale, {
        useSystemFonts: true,
        disableFontFace: false,
      }),
      PDF_RENDER_TIMEOUT_MS,
      `${logOp}-page`,
    );
    if ("error" in rendered) {
      throw new Error(rendered.error);
    }
    logCalibrationRuntimeCheck({
      operation: logOp,
      renderScale: scale,
      renderDurationMs: Date.now() - renderStarted,
      durationMs: Date.now() - renderStarted,
      parserPath: "gcal-sarine",
    });
    return { ...rendered, backend: "production" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logCalibrationRuntimeCheck({
      operation: logOp,
      renderScale: scale,
      renderDurationMs: Date.now() - renderStarted,
      durationMs: Date.now() - renderStarted,
      timedOut: err instanceof CalibrationTimeoutError,
      error: message,
    });
    if (!isPdfRenderRetryableError(message)) {
      return null;
    }
    const factory = await renderPdfPagePngWithFactory(
      pdfBytes,
      pageNumber,
      scale,
      "pdf-render-gcal-sarine-factory-fallback",
    );
    if (!factory) return null;
    return { ...factory, backend: "factory-fallback" };
  }
}

/** Render a PDF page to PNG — production first, factory fallback on font/canvas failures. */
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

  let productionError: string | null = null;

  try {
    const production = await withTimeout(
      renderPdfPagePngProduction(pdfBytes, pageNumber, scale),
      PDF_RENDER_TIMEOUT_MS,
      "pdf-render-page",
    );
    logCalibrationRuntimeCheck({
      ...checkBase,
      renderDurationMs: Date.now() - renderStarted,
      durationMs: Date.now() - renderStarted,
      parserPath: "production",
    });
    if ("error" in production) {
      throw new Error(production.error);
    }
    return { ...production, backend: "production" };
  } catch (err) {
    productionError = err instanceof Error ? err.message : String(err);
    logCalibrationRuntimeCheck({
      ...checkBase,
      renderDurationMs: Date.now() - renderStarted,
      durationMs: Date.now() - renderStarted,
      timedOut: err instanceof CalibrationTimeoutError,
      error: productionError,
    });
  }

  if (!productionError || !isPdfRenderRetryableError(productionError)) {
    return null;
  }

  const fallbackStarted = Date.now();
  const factory = await renderPdfPagePngWithFactory(
    pdfBytes,
    pageNumber,
    scale,
    "pdf-render-factory-fallback",
  );
  if (factory) {
    logCalibrationRuntimeCheck({
      operation: "pdf-render-factory-fallback",
      renderScale: scale,
      renderDurationMs: Date.now() - fallbackStarted,
      durationMs: Date.now() - fallbackStarted,
      parserPath: "factory-fallback",
    });
    return { ...factory, backend: "factory-fallback" };
  }

  return null;
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
    const pdfjs = await loadServerPdfjs();
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

/** Normalize uploaded screenshot/JPG into a page PNG for region-crop diagram OCR. */
export async function renderUploadImageAsPage(
  imageBytes: Buffer,
): Promise<RenderedPdfPage | null> {
  try {
    const { createCanvas, loadImage } = await import("@napi-rs/canvas");
    const img = await loadImage(imageBytes);
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);
    return {
      png: canvas.toBuffer("image/png"),
      width: img.width,
      height: img.height,
      backend: "production",
    };
  } catch {
    return null;
  }
}
