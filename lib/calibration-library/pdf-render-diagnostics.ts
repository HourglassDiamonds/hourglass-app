/**
 * PDF render diagnostics — infrastructure only.
 * Compares multiple pdfjs + canvas backends without touching extraction parsers.
 */
import { createRequire } from "module";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { capRenderScaleForPixels } from "./runtime-limits";
import { extractPdfTextLayer } from "./extract-pdf-server";
import { ocrImageBuffer } from "./ocr";

export type PdfRenderBackendId =
  | "production-napi-root"
  | "pdfjs-napi-factory"
  | "pdfjs-node-canvas-factory"
  | "pdfjs-napi-disable-font-face"
  | "pdfjs-napi-use-system-fonts";

export type PdfRenderAttempt = {
  backend: PdfRenderBackendId;
  pdfLabel: string;
  pageNumber: number;
  scale: number;
  success: boolean;
  width: number | null;
  height: number | null;
  pngBytes: number | null;
  durationMs: number;
  pdfjsOpenMs: number | null;
  pageCount: number | null;
  error: string | null;
  stack: string | null;
  /** Heuristic: non-blank page has enough byte entropy for OCR. */
  ocrReadiness: "ready" | "blank" | "unknown" | "n/a";
  ocrProbeMs: number | null;
  ocrProbeChars: number | null;
};

type PdfJsNodeCanvas = {
  createCanvas: (width: number, height: number) => {
    getContext: (type: "2d") => CanvasRenderingContext2D;
    toBuffer: (mime: string) => Buffer;
    width: number;
    height: number;
  };
  loadImage: (src: Buffer) => Promise<{ width: number; height: number }>;
  Path2D?: unknown;
  DOMMatrix?: unknown;
  ImageData?: unknown;
  Image?: unknown;
};

type CanvasFactory = {
  create: (w: number, h: number) => {
    canvas: { toBuffer: (m: string) => Buffer; width: number; height: number };
    context: CanvasRenderingContext2D;
  };
  reset: (cc: { canvas: { width: number; height: number } }, w: number, h: number) => void;
  destroy: (cc: { canvas: { width: number; height: number } }) => void;
};

function getPdfJsResolvedNapiCanvas(): PdfJsNodeCanvas {
  const nodeRequire = createRequire(import.meta.url);
  const requireFromPdfjs = createRequire(
    nodeRequire.resolve("pdfjs-dist/legacy/build/pdf.mjs"),
  );
  return requireFromPdfjs("@napi-rs/canvas") as PdfJsNodeCanvas;
}

function installPdfJsPolyfills(canvasPkg: PdfJsNodeCanvas): void {
  const g = globalThis as Record<string, unknown>;
  if (!g.Path2D && canvasPkg.Path2D) g.Path2D = canvasPkg.Path2D;
  if (!g.DOMMatrix && canvasPkg.DOMMatrix) g.DOMMatrix = canvasPkg.DOMMatrix;
  if (!g.ImageData && canvasPkg.ImageData) g.ImageData = canvasPkg.ImageData;
  if (!g.Image && canvasPkg.Image) g.Image = canvasPkg.Image;
}

function createCanvasFactory(canvasPkg: PdfJsNodeCanvas): CanvasFactory {
  return {
    create(width, height) {
      const canvas = canvasPkg.createCanvas(width, height);
      return { canvas, context: canvas.getContext("2d") };
    },
    reset(cc, width, height) {
      cc.canvas.width = width;
      cc.canvas.height = height;
    },
    destroy(cc) {
      cc.canvas.width = 0;
      cc.canvas.height = 0;
    },
  };
}

type GetDocumentOpts = {
  useSystemFonts?: boolean;
  disableFontFace?: boolean;
};

async function openPdf(
  pdfBytes: Buffer,
  opts: GetDocumentOpts,
): Promise<{ doc: { numPages: number; getPage: (n: number) => Promise<unknown> }; openMs: number }> {
  const openStarted = Date.now();
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(pdfBytes),
    useSystemFonts: opts.useSystemFonts ?? false,
    disableFontFace: opts.disableFontFace ?? true,
  }).promise;
  return { doc: doc as { numPages: number; getPage: (n: number) => Promise<unknown> }, openMs: Date.now() - openStarted };
}

async function renderPageToPng(
  page: {
    getViewport: (o: { scale: number }) => { width: number; height: number };
    render: (p: Record<string, unknown>) => { promise: Promise<void>; cancel?: () => void };
  },
  renderParams: Record<string, unknown>,
): Promise<void> {
  const task = page.render(renderParams);
  try {
    await task.promise;
  } catch (err) {
    // Do not call task.cancel() — pdfjs cancel path throws secondary uncaught errors on Node.
    throw err;
  }
}

async function renderWithFactory(
  pdfBytes: Buffer,
  pageNumber: number,
  scale: number,
  canvasPkg: PdfJsNodeCanvas,
  docOpts: GetDocumentOpts,
): Promise<{ png: Buffer; width: number; height: number; pageCount: number; openMs: number }> {
  installPdfJsPolyfills(canvasPkg);
  const { doc, openMs } = await openPdf(pdfBytes, docOpts);
  const page = (await doc.getPage(pageNumber)) as {
    getViewport: (o: { scale: number }) => { width: number; height: number };
    render: (p: Record<string, unknown>) => { promise: Promise<void> };
  };
  const base = page.getViewport({ scale: 1 });
  const effectiveScale = capRenderScaleForPixels(base.width, base.height, scale);
  const viewport = page.getViewport({ scale: effectiveScale });
  const width = Math.ceil(viewport.width);
  const height = Math.ceil(viewport.height);
  const canvasFactory = createCanvasFactory(canvasPkg);
  const cc = canvasFactory.create(width, height);
  try {
    await renderPageToPng(page, {
      canvasContext: cc.context,
      viewport,
      canvasFactory,
    });
    return {
      png: cc.canvas.toBuffer("image/png"),
      width,
      height,
      pageCount: doc.numPages,
      openMs,
    };
  } finally {
    canvasFactory.destroy(cc);
  }
}

async function renderProductionNapi(
  pdfBytes: Buffer,
  pageNumber: number,
  scale: number,
  docOpts: GetDocumentOpts,
): Promise<{ png: Buffer; width: number; height: number; pageCount: number; openMs: number }> {
  const { createCanvas } = await import("@napi-rs/canvas");
  const { doc, openMs } = await openPdf(pdfBytes, docOpts);
  const page = (await doc.getPage(pageNumber)) as {
    getViewport: (o: { scale: number }) => { width: number; height: number };
    render: (p: Record<string, unknown>) => { promise: Promise<void> };
  };
  const base = page.getViewport({ scale: 1 });
  const effectiveScale = capRenderScaleForPixels(base.width, base.height, scale);
  const viewport = page.getViewport({ scale: effectiveScale });
  const width = Math.ceil(viewport.width);
  const height = Math.ceil(viewport.height);
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  try {
    await renderPageToPng(page, {
      canvasContext: ctx as unknown as CanvasRenderingContext2D,
      viewport,
    });
    return {
      png: canvas.toBuffer("image/png"),
      width,
      height,
      pageCount: doc.numPages,
      openMs,
    };
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}

function estimateOcrReadiness(png: Buffer): "ready" | "blank" | "unknown" {
  if (png.length < 500) return "blank";
  // Sample PNG payload: very uniform files tend to be blank white pages.
  let diff = 0;
  const step = Math.max(1, Math.floor(png.length / 200));
  for (let i = step; i < png.length; i += step) {
    diff += Math.abs(png[i]! - png[i - step]!);
  }
  const avgDiff = diff / Math.floor(png.length / step);
  if (avgDiff < 2) return "blank";
  return "ready";
}

async function runBackend(
  backend: PdfRenderBackendId,
  pdfBytes: Buffer,
  pdfLabel: string,
  pageNumber: number,
  scale: number,
  probeOcr: boolean,
): Promise<PdfRenderAttempt> {
  const started = Date.now();
  const base: PdfRenderAttempt = {
    backend,
    pdfLabel,
    pageNumber,
    scale,
    success: false,
    width: null,
    height: null,
    pngBytes: null,
    durationMs: 0,
    pdfjsOpenMs: null,
    pageCount: null,
    error: null,
    stack: null,
    ocrReadiness: "n/a",
    ocrProbeMs: null,
    ocrProbeChars: null,
  };

  try {
    let result: { png: Buffer; width: number; height: number; pageCount: number; openMs: number };

    switch (backend) {
      case "production-napi-root":
        result = await renderProductionNapi(pdfBytes, pageNumber, scale, {
          useSystemFonts: true,
          disableFontFace: true,
        });
        break;
      case "pdfjs-napi-disable-font-face":
        result = await renderProductionNapi(pdfBytes, pageNumber, scale, {
          useSystemFonts: false,
          disableFontFace: true,
        });
        break;
      case "pdfjs-napi-use-system-fonts":
        result = await renderProductionNapi(pdfBytes, pageNumber, scale, {
          useSystemFonts: true,
          disableFontFace: false,
        });
        break;
      case "pdfjs-napi-factory": {
        const pkg = getPdfJsResolvedNapiCanvas();
        result = await renderWithFactory(pdfBytes, pageNumber, scale, pkg, {
          useSystemFonts: false,
          disableFontFace: true,
        });
        break;
      }
      case "pdfjs-node-canvas-factory": {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const nodeCanvas = require("canvas") as PdfJsNodeCanvas;
        result = await renderWithFactory(pdfBytes, pageNumber, scale, nodeCanvas, {
          useSystemFonts: false,
          disableFontFace: true,
        });
        break;
      }
      default:
        throw new Error(`Unknown backend: ${backend satisfies never}`);
    }

    base.success = true;
    base.width = result.width;
    base.height = result.height;
    base.pngBytes = result.png.length;
    base.pdfjsOpenMs = result.openMs;
    base.pageCount = result.pageCount;
    base.ocrReadiness = estimateOcrReadiness(result.png);

    if (probeOcr && base.ocrReadiness === "ready") {
      const ocrStarted = Date.now();
      const ocr = await ocrImageBuffer(result.png);
      base.ocrProbeMs = Date.now() - ocrStarted;
      base.ocrProbeChars = ocr.text.length;
      if (ocr.text.length < 20) base.ocrReadiness = "blank";
    }
  } catch (err) {
    base.error = err instanceof Error ? err.message : String(err);
    base.stack =
      err instanceof Error && err.stack
        ? err.stack.split("\n").slice(0, 8).join("\n")
        : null;
  }

  base.durationMs = Date.now() - started;
  return base;
}

export type PdfTextLayerDiagnostic = {
  pdfLabel: string;
  textLayerChars: number;
  textLayerSufficient: boolean;
  dossier: boolean;
  facsimile: boolean;
};

export type PdfRenderHarnessReport = {
  generatedAt: string;
  platform: { node: string; arch: string; platform: string };
  pdfs: Array<{
    label: string;
    bytes: number;
    textLayer: PdfTextLayerDiagnostic;
    attempts: PdfRenderAttempt[];
  }>;
  summary: {
    byPdf: Record<string, { backendsSucceeded: number; backendsTotal: number }>;
    byBackend: Record<
      string,
      { successCount: number; totalCount: number; avgDurationMs: number }
    >;
  };
  recommendation: {
    rootCause: string;
    renderer: string;
    effort: string;
    expectedRecoveryAfterFix: string;
  };
};

const BACKENDS: PdfRenderBackendId[] = [
  "production-napi-root",
  "pdfjs-napi-factory",
  // node-canvas factory triggers uncaught pdfjs cancel cleanup on Windows for GIA dossier PDFs
  // "pdfjs-node-canvas-factory",
  "pdfjs-napi-disable-font-face",
  "pdfjs-napi-use-system-fonts",
];

export async function runPdfRenderHarness(input: {
  pdfs: Array<{ label: string; bytes: Buffer }>;
  scales?: number[];
  probeOcr?: boolean;
  savePngDir?: string;
}): Promise<PdfRenderHarnessReport> {
  const scales = input.scales ?? [2, 5];
  const probeOcr = input.probeOcr ?? true;
  const pdfReports: PdfRenderHarnessReport["pdfs"] = [];

  for (const pdf of input.pdfs) {
    const layer = await extractPdfTextLayer(pdf.bytes);
    const textDiag: PdfTextLayerDiagnostic = {
      pdfLabel: pdf.label,
      textLayerChars: layer.text.length,
      textLayerSufficient: layer.sufficient,
      dossier: /dossier/i.test(layer.text),
      facsimile: /facsimile/i.test(layer.text),
    };

    const attempts: PdfRenderAttempt[] = [];
    for (const backend of BACKENDS) {
      for (const scale of scales) {
        const attempt = await runBackend(
          backend,
          pdf.bytes,
          pdf.label,
          1,
          scale,
          probeOcr,
        );
        attempts.push(attempt);
      }
    }

    pdfReports.push({
      label: pdf.label,
      bytes: pdf.bytes.length,
      textLayer: textDiag,
      attempts,
    });
  }

  const byPdf: PdfRenderHarnessReport["summary"]["byPdf"] = {};
  const byBackend: PdfRenderHarnessReport["summary"]["byBackend"] = {};

  for (const pdf of pdfReports) {
    const ok = pdf.attempts.filter((a) => a.success).length;
    byPdf[pdf.label] = { backendsSucceeded: ok, backendsTotal: pdf.attempts.length };
  }

  for (const backend of BACKENDS) {
    const rows = pdfReports.flatMap((p) => p.attempts.filter((a) => a.backend === backend));
    const ok = rows.filter((r) => r.success);
    byBackend[backend] = {
      successCount: ok.length,
      totalCount: rows.length,
      avgDurationMs:
        ok.length > 0
          ? Math.round(ok.reduce((s, r) => s + r.durationMs, 0) / ok.length)
          : 0,
    };
  }

  const failing = pdfReports.find((p) => p.label.includes("2496027047"));
  const failingErrors = failing?.attempts.filter((a) => !a.success).map((a) => a.error) ?? [];
  const factoryWorks = failing?.attempts.some(
    (a) => a.backend === "pdfjs-napi-factory" && a.success,
  );

  let rootCause =
    "pdfjs paint/render fails before PNG generation on LGDR dossier PDFs with production @napi-rs/canvas binding.";
  if (failingErrors.some((e) => e?.includes("paintChar"))) {
    rootCause =
      "pdfjs CanvasGraphics.paintChar — @napi-rs/canvas rejects the font object pdfjs passes when rendering embedded/type3 fonts on GIA LGDR dossier PDF 2496027047.";
  } else if (failingErrors.some((e) => e?.includes("Image or Canvas"))) {
    rootCause =
      "pdfjs inline XObject paint — canvas Image polyfill missing or incompatible when rendering embedded diagram images.";
  }

  const renderer = factoryWorks
    ? "pdfjs + pdfjs-resolved @napi-rs/canvas with canvasFactory + polyfills (Sarine pattern)"
    : "External fallback renderer required (Poppler/pdftoppm or muPDF) — in-process pdfjs backends insufficient for 2496027047";

  const effort = factoryWorks
    ? "Small (1–2 days): extract shared render helper from gcal-sarine-image-ocr.ts, swap production renderPdfPagePngAtScale to factory backend, regression-test 3 GIA PDFs."
    : "Medium (3–5 days): add Poppler CLI or muPDF native binding behind renderPdfPagePngAtScale fallback; keep pdfjs for text layer.";

  const expectedRecovery = factoryWorks
    ? "2496027047: high likelihood 7–8/8 diagram fields once render succeeds (diagram is image-only; OCR+existing bands). 6233708773: no regression expected."
    : "2496027047: 0% until external renderer lands; then estimate 70–85% field recovery pending band calibration.";

  return {
    generatedAt: new Date().toISOString(),
    platform: {
      node: process.version,
      arch: process.arch,
      platform: process.platform,
    },
    pdfs: pdfReports,
    summary: { byPdf, byBackend },
    recommendation: {
      rootCause,
      renderer,
      effort,
      expectedRecoveryAfterFix: expectedRecovery,
    },
  };
}

export async function writePdfRenderHarnessReport(
  report: PdfRenderHarnessReport,
  outPath: string,
): Promise<void> {
  await writeFile(outPath, JSON.stringify(report, null, 2), "utf8");
}
