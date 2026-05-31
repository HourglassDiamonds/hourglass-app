/**
 * pdfjs + pdfjs-resolved @napi-rs/canvas + canvasFactory render path.
 * Used by GCAL Sarine and as production fallback for font-binding failures (LGDR dossier).
 */
import { createRequire } from "module";
import {
  CalibrationTimeoutError,
  logCalibrationRuntimeCheck,
  withTimeout,
} from "./runtime-guard";
import {
  capRenderScaleForPixels,
  PDF_GET_DOCUMENT_TIMEOUT_MS,
  PDF_RENDER_TIMEOUT_MS,
} from "./runtime-limits";

export type PdfJsNodeCanvas = {
  createCanvas: (width: number, height: number) => {
    getContext: (type: "2d") => CanvasRenderingContext2D;
    toBuffer: (mime: string) => Buffer;
    width: number;
    height: number;
  };
  loadImage?: (src: Buffer) => Promise<{ width: number; height: number }>;
  Path2D?: unknown;
  DOMMatrix?: unknown;
  ImageData?: unknown;
  Image?: unknown;
};

export type FactoryRenderedPdfPage = {
  png: Buffer;
  width: number;
  height: number;
};

let pdfJsCanvasModule: PdfJsNodeCanvas | null = null;
let pdfJsCanvasPolyfillsInstalled = false;

export function getPdfJsNodeCanvasModule(): PdfJsNodeCanvas {
  if (pdfJsCanvasModule) return pdfJsCanvasModule;
  const nodeRequire = createRequire(import.meta.url);
  const requireFromPdfjs = createRequire(
    nodeRequire.resolve("pdfjs-dist/legacy/build/pdf.mjs"),
  );
  pdfJsCanvasModule = requireFromPdfjs("@napi-rs/canvas") as PdfJsNodeCanvas;
  return pdfJsCanvasModule;
}

export function installPdfJsCanvasPolyfills(canvasPkg: PdfJsNodeCanvas): void {
  if (pdfJsCanvasPolyfillsInstalled) return;
  const g = globalThis as Record<string, unknown>;
  if (!g.Path2D && canvasPkg.Path2D) g.Path2D = canvasPkg.Path2D;
  if (!g.DOMMatrix && canvasPkg.DOMMatrix) g.DOMMatrix = canvasPkg.DOMMatrix;
  if (!g.ImageData && canvasPkg.ImageData) g.ImageData = canvasPkg.ImageData;
  if (!g.Image && canvasPkg.Image) g.Image = canvasPkg.Image;
  pdfJsCanvasPolyfillsInstalled = true;
}

export function createPdfJsNodeCanvasFactory(canvasPkg: PdfJsNodeCanvas) {
  return {
    create(width: number, height: number) {
      const canvas = canvasPkg.createCanvas(width, height);
      return { canvas, context: canvas.getContext("2d") };
    },
    reset(
      cc: { canvas: { width: number; height: number } },
      width: number,
      height: number,
    ) {
      cc.canvas.width = width;
      cc.canvas.height = height;
    },
    destroy(cc: { canvas: { width: number; height: number } }) {
      cc.canvas.width = 0;
      cc.canvas.height = 0;
    },
  };
}

/** Errors where the factory renderer may succeed when production bare-canvas fails. */
export function isPdfRenderRetryableError(message: string): boolean {
  return (
    /paintChar/i.test(message) ||
    /String[`'"]?\s*,\s*[`'"]?Path/i.test(message) ||
    /Invalid page request/i.test(message) ||
    /Image[`'"]?\s*,\s*[`'"]?ImageData/i.test(message) ||
    /CanvasElement/i.test(message)
  );
}

export async function renderPdfPagePngWithFactory(
  pdfBytes: Buffer,
  pageNumber: number,
  scale: number,
  logOperation = "pdf-render-factory",
): Promise<FactoryRenderedPdfPage | null> {
  const renderStarted = Date.now();
  const canvasPkg = getPdfJsNodeCanvasModule();

  try {
    return await withTimeout(
      (async () => {
        installPdfJsCanvasPolyfills(canvasPkg);
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        const doc = await withTimeout(
          pdfjs.getDocument({
            data: new Uint8Array(pdfBytes),
            disableFontFace: true,
            useSystemFonts: false,
          }).promise,
          PDF_GET_DOCUMENT_TIMEOUT_MS,
          `${logOperation}-open`,
        );
        const page = await doc.getPage(pageNumber);
        const base = page.getViewport({ scale: 1 });
        const effectiveScale = capRenderScaleForPixels(
          base.width,
          base.height,
          scale,
        );
        const viewport = page.getViewport({ scale: effectiveScale });
        const width = Math.ceil(viewport.width);
        const height = Math.ceil(viewport.height);
        const canvasFactory = createPdfJsNodeCanvasFactory(canvasPkg);
        const cc = canvasFactory.create(width, height);
        try {
          await page.render({
            canvasContext: cc.context as unknown as CanvasRenderingContext2D,
            viewport,
            canvasFactory,
          } as Parameters<typeof page.render>[0]).promise;
          return {
            png: cc.canvas.toBuffer("image/png"),
            width,
            height,
          };
        } finally {
          canvasFactory.destroy(cc);
        }
      })(),
      PDF_RENDER_TIMEOUT_MS,
      `${logOperation}-page`,
    );
  } catch (err) {
    logCalibrationRuntimeCheck({
      operation: logOperation,
      renderScale: scale,
      renderDurationMs: Date.now() - renderStarted,
      durationMs: Date.now() - renderStarted,
      timedOut: err instanceof CalibrationTimeoutError,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
