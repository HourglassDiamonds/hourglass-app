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
import { existsSync } from "node:fs";
import { join } from "node:path";
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
  isRemoteOcrConfigured,
  remoteOcrImageBuffer,
  remoteOcrRuntimeAvailable,
} from "./ocr-transport";
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
/** Which OCR backend succeeded the last availability probe. */
let ocrTransportMode: "none" | "remote" | "local" = "none";

/** Override createWorker options (e.g. bundled lang data on DI interpret route). */
let workerCreateOptions: Record<string, unknown> = { logger: () => {} };

/** Isolate-scoped local Tesseract worker — reuse across diagram crops on Vercel. */
type LocalOcrWorker = {
  recognize: (b: Buffer) => Promise<{ data: { text?: string } }>;
  terminate: () => Promise<unknown>;
};
let localOcrWorkerPromise: Promise<LocalOcrWorker> | null = null;
let localOcrWorker: LocalOcrWorker | null = null;

export function setTesseractWorkerCreateOptions(
  opts: Record<string, unknown> | null,
): void {
  workerCreateOptions = opts ?? { logger: () => {} };
  ocrRuntimeChecked = false;
  ocrRuntimeAvailable = false;
  ocrRuntimeProbeError = undefined;
  ocrRuntimeProbeLog = [];
  ocrTransportMode = "none";
  // Drop any cached worker so new lang/cache options take effect.
  const stale = localOcrWorker;
  localOcrWorker = null;
  localOcrWorkerPromise = null;
  if (stale) {
    void terminateWorkerSafe(stale, "ocr-options-reset");
  }
}

export type OcrRuntimeProbeSnapshot = {
  checked: boolean;
  available: boolean;
  durationMs: number;
  error?: string;
  log?: string[];
  transport?: "none" | "remote" | "local";
};

export function getOcrRuntimeProbeSnapshot(): OcrRuntimeProbeSnapshot {
  return {
    checked: ocrRuntimeChecked,
    available: ocrRuntimeAvailable,
    durationMs: ocrRuntimeProbeDurationMs,
    error: ocrRuntimeProbeError,
    log: ocrRuntimeProbeLog.length > 0 ? [...ocrRuntimeProbeLog] : undefined,
    transport: ocrTransportMode,
  };
}

function tesseractWorkerOptions(): Record<string, unknown> {
  return workerCreateOptions;
}

/** Vendored eng tessdata present — skip cold probe; OCR createWorker is the real gate. */
export function isBundledTesseractLangReady(): boolean {
  const opts = workerCreateOptions;
  const langPath = opts.langPath;
  if (typeof langPath === "string") {
    if (existsSync(join(langPath, "eng.traineddata.gz"))) return true;
  }
  const cachePath = opts.cachePath;
  if (typeof cachePath === "string") {
    if (existsSync(join(cachePath, "eng.traineddata"))) return true;
  }
  return false;
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

async function probeLocalOcrRuntime(
  priorRemoteError?: string,
): Promise<boolean> {
  if (isBundledTesseractLangReady()) {
    ocrRuntimeChecked = true;
    ocrRuntimeAvailable = true;
    ocrTransportMode = "local";
    ocrRuntimeProbeLog.push(
      priorRemoteError
        ? "remote-unavailable-bundled-lang-fallback"
        : "bundled-lang-skip-probe",
    );
    ocrRuntimeProbeDurationMs = 0;
    // Keep remote error for diagnostics, but OCR is available via local.
    if (priorRemoteError) {
      ocrRuntimeProbeError = `${priorRemoteError};fallback=local-bundled`;
    }
    logCalibrationRuntimeCheck({
      operation: "ocr-runtime-probe-local-fallback",
      durationMs: 0,
      ocrDurationMs: 0,
      parserPath: "local-bundled",
      error: priorRemoteError,
    });
    return true;
  }

  const started = Date.now();
  ocrRuntimeChecked = true;
  if (ocrRuntimeProbeLog.length === 0) {
    ocrRuntimeProbeLog = [];
  }

  let worker: { terminate: () => Promise<unknown> } | null = null;
  let workerCleanupSuccess = false;

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
    if (ocrRuntimeAvailable) {
      ocrTransportMode = "local";
      if (priorRemoteError) {
        ocrRuntimeProbeLog.push("remote-unavailable-local-worker-fallback");
        ocrRuntimeProbeError = `${priorRemoteError};fallback=local-worker`;
      }
    } else {
      ocrTransportMode = "none";
      ocrRuntimeProbeError = priorRemoteError
        ? `${priorRemoteError};local-worker-terminate-failed`
        : "worker-terminate-failed";
    }
  } catch (err) {
    ocrRuntimeAvailable = false;
    ocrTransportMode = "none";
    const localErr = err instanceof Error ? err.message : String(err);
    ocrRuntimeProbeError = priorRemoteError
      ? `${priorRemoteError};local=${localErr}`
      : localErr;
  } finally {
    if (worker && !workerCleanupSuccess) {
      workerCleanupSuccess = await terminateWorkerSafe(worker, "ocr-runtime-probe-finally");
    }
    ocrRuntimeProbeDurationMs = Date.now() - started;
    logCalibrationRuntimeCheck({
      operation: priorRemoteError
        ? "ocr-runtime-probe-local-fallback"
        : "ocr-runtime-probe",
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

/**
 * Probe whether OCR can load in this runtime (e.g. Vercel vs local).
 *
 * When OCR_WORKER_URL is set but the remote worker is unhealthy (production
 * evidence: health-http-404), fall back to in-process bundled Tesseract instead
 * of marking OCR permanently unavailable.
 */
export async function isOcrRuntimeAvailable(): Promise<boolean> {
  if (isOcrDisabledByEnv()) return false;
  if (ocrRuntimeChecked) return ocrRuntimeAvailable;

  if (isRemoteOcrConfigured()) {
    const started = Date.now();
    ocrRuntimeProbeLog = [];
    let remoteError: string | undefined;
    try {
      const remoteOk = await remoteOcrRuntimeAvailable();
      if (remoteOk) {
        ocrRuntimeChecked = true;
        ocrRuntimeAvailable = true;
        ocrTransportMode = "remote";
        ocrRuntimeProbeLog.push("remote-ocr-health-ok");
        ocrRuntimeProbeDurationMs = Date.now() - started;
        logCalibrationRuntimeCheck({
          operation: "ocr-runtime-probe-remote",
          durationMs: ocrRuntimeProbeDurationMs,
          ocrDurationMs: ocrRuntimeProbeDurationMs,
        });
        return true;
      }
      remoteError = "remote-ocr-unavailable";
      ocrRuntimeProbeLog.push("remote-ocr-fallback-local");
    } catch (err) {
      remoteError = err instanceof Error ? err.message : String(err);
      ocrRuntimeProbeLog.push("remote-ocr-fallback-local");
    } finally {
      const remoteMs = Date.now() - started;
      ocrRuntimeProbeDurationMs = remoteMs;
      logCalibrationRuntimeCheck({
        operation: "ocr-runtime-probe-remote",
        durationMs: remoteMs,
        ocrDurationMs: remoteMs,
        error: remoteError,
      });
    }
    return probeLocalOcrRuntime(remoteError);
  }

  return probeLocalOcrRuntime();
}

async function getSharedLocalOcrWorker(): Promise<LocalOcrWorker> {
  if (localOcrWorker) return localOcrWorker;
  if (!localOcrWorkerPromise) {
    localOcrWorkerPromise = (async () => {
      const { createWorker } = await import("tesseract.js");
      const worker = await withTimeout(
        createWorker("eng", 1, tesseractWorkerOptions()),
        OCR_WORKER_CREATE_TIMEOUT_MS,
        "ocr-image-create-worker",
      );
      localOcrWorker = worker as LocalOcrWorker;
      return localOcrWorker;
    })().catch((err) => {
      localOcrWorkerPromise = null;
      localOcrWorker = null;
      throw err;
    });
  }
  return localOcrWorkerPromise;
}

async function ocrImageBufferLocal(buffer: Buffer): Promise<OcrResult> {
  const started = Date.now();
  try {
    const worker = await getSharedLocalOcrWorker();
    const { data } = await withTimeout(
      worker.recognize(buffer),
      OCR_SINGLE_IMAGE_TIMEOUT_MS,
      "ocr-image-recognize",
    );
    logCalibrationRuntimeCheck({
      operation: "ocr-image",
      ocrDurationMs: Date.now() - started,
      durationMs: Date.now() - started,
      workerCleanupSuccess: true,
      parserPath: "local-shared",
    });
    return { text: (data.text ?? "").trim(), ok: true };
  } catch (err) {
    // Drop a poisoned shared worker so the next crop can recreate it.
    const stale = localOcrWorker;
    localOcrWorker = null;
    localOcrWorkerPromise = null;
    if (stale) {
      void terminateWorkerSafe(stale, "ocr-image-poisoned");
    }
    logCalibrationRuntimeCheck({
      operation: "ocr-image",
      ocrDurationMs: Date.now() - started,
      durationMs: Date.now() - started,
      workerCleanupSuccess: false,
      parserPath: "local-shared",
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      text: "",
      ok: false,
      error: err instanceof Error ? err.message : "OCR failed",
    };
  }
}

export async function ocrImageBuffer(buffer: Buffer): Promise<OcrResult> {
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

  if (ocrTransportMode === "remote" && isRemoteOcrConfigured()) {
    const remote = await remoteOcrImageBuffer(buffer);
    if (remote.ok) return remote;
    // Remote recognize failed after a healthy probe — fall back to local for
    // this request and subsequent ones in the same isolate.
    ocrTransportMode = "local";
    ocrRuntimeProbeLog.push("remote-recognize-fallback-local");
    logCalibrationRuntimeCheck({
      operation: "ocr-image-remote-fallback-local",
      error: remote.error,
    });
    return ocrImageBufferLocal(buffer);
  }

  return ocrImageBufferLocal(buffer);
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
