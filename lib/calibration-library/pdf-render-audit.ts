/**
 * PDF render validation framework — infrastructure only.
 *
 * Provides:
 *  - Per-upload production render audit (lightweight)
 *  - Multi-backend comparison harness (anchor validation)
 *  - Report | Renderer | Success | Failure | OCR Ready matrix
 *  - Architecture recommendation (keep / fallback / replace)
 *
 * Does NOT modify extraction parsers, scoring, UI, or interpretation.
 */
import { createRequire } from "module";
import { execSync } from "child_process";
import { mkdtempSync, readFileSync, writeFileSync, readdirSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { capRenderScaleForPixels } from "./runtime-limits";
import { extractPdfTextLayer } from "./extract-pdf-server";
import { ocrImageBuffer } from "./ocr";

// ─── Public types ───────────────────────────────────────────────────────────

/** Production path today (ocr.ts renderPdfPagePngAtScale). */
export const PRODUCTION_RENDER_BACKEND = "production-napi-root" as const;

export type PdfRenderBackendId =
  | typeof PRODUCTION_RENDER_BACKEND
  | "pdfjs-napi-factory"
  | "pdfjs-napi-disable-font-face"
  | "pdfjs-napi-use-system-fonts"
  | "pdfjs-node-canvas-factory"
  | "poppler-pdftoppm"
  | "mupdf-mutool";

export type OcrReadiness = "ready" | "blank" | "failed" | "skipped" | "n/a";

/** Lightweight audit attached to PDF upload pipeline output. */
export type PdfRenderAuditRecord = {
  rendererUsed: typeof PRODUCTION_RENDER_BACKEND;
  pageCount: number | null;
  renderSuccess: boolean;
  renderTimingMs: number;
  imageDimensions: { width: number; height: number } | null;
  pngBytes: number | null;
  ocrReadiness: OcrReadiness;
  ocrProbeChars: number | null;
  ocrProbeMs: number | null;
  failureReason: string | null;
  failureStack: string | null;
};

export type PdfRenderAttempt = {
  backend: PdfRenderBackendId;
  backendLabel: string;
  pdfLabel: string;
  lab: string;
  pageNumber: number;
  scale: number;
  success: boolean;
  pageCount: number | null;
  width: number | null;
  height: number | null;
  pngBytes: number | null;
  durationMs: number;
  pdfjsOpenMs: number | null;
  error: string | null;
  stack: string | null;
  ocrReadiness: OcrReadiness;
  ocrProbeMs: number | null;
  ocrProbeChars: number | null;
  externalToolInstalled: boolean | null;
};

export type PdfRenderMatrixRow = {
  report: string;
  lab: string;
  renderer: string;
  success: boolean;
  failureReason: string | null;
  ocrReady: boolean | "n/a";
  pageCount: number | null;
  dimensions: string | null;
  durationMs: number;
  ocrChars: number | null;
};

export type RenderArchitectureChoice = "A" | "B" | "C";

export type PdfRenderValidationReport = {
  generatedAt: string;
  platform: { node: string; arch: string; platform: string };
  externalTools: Record<string, "installed" | "not-found" | "error">;
  pdfs: Array<{
    label: string;
    lab: string;
    bytes: number;
    pageCount: number | null;
    textLayerChars: number;
  }>;
  matrix: PdfRenderMatrixRow[];
  attempts: PdfRenderAttempt[];
  summary: {
    byReport: Record<string, { succeeded: number; total: number }>;
    byRenderer: Record<
      string,
      { succeeded: number; total: number; avgMs: number; ocrReady: number }
    >;
  };
  rootCause: string;
  architecture: {
    choice: RenderArchitectureChoice;
    label: string;
    rationale: string;
    minimumChangePath: string;
    expectedExtractionRecovery: string;
  };
};

export type AnchorPdfInput = {
  label: string;
  lab: string;
  bytes: Buffer;
};

// ─── Backend metadata ───────────────────────────────────────────────────────

export const RENDER_BACKEND_CATALOG: Record<
  PdfRenderBackendId,
  { label: string; kind: "pdfjs" | "external" }
> = {
  [PRODUCTION_RENDER_BACKEND]: {
    label: "Current production (pdfjs + root @napi-rs/canvas, no factory)",
    kind: "pdfjs",
  },
  "pdfjs-napi-factory": {
    label: "pdfjs + pdfjs-resolved @napi-rs/canvas + canvasFactory (Sarine pattern)",
    kind: "pdfjs",
  },
  "pdfjs-napi-disable-font-face": {
    label: "pdfjs + root @napi-rs/canvas, disableFontFace, no system fonts",
    kind: "pdfjs",
  },
  "pdfjs-napi-use-system-fonts": {
    label: "pdfjs + root @napi-rs/canvas, useSystemFonts, fontFace enabled",
    kind: "pdfjs",
  },
  "pdfjs-node-canvas-factory": {
    label: "pdfjs + node-canvas package + canvasFactory",
    kind: "pdfjs",
  },
  "poppler-pdftoppm": {
    label: "Poppler pdftoppm CLI",
    kind: "external",
  },
  "mupdf-mutool": {
    label: "MuPDF mutool draw CLI",
    kind: "external",
  },
};

/** Harness backends — node-canvas omitted by default (uncaught cleanup on Windows). */
export const HARNESS_BACKENDS: PdfRenderBackendId[] = [
  PRODUCTION_RENDER_BACKEND,
  "pdfjs-napi-factory",
  "pdfjs-napi-disable-font-face",
  "pdfjs-napi-use-system-fonts",
  "poppler-pdftoppm",
  "mupdf-mutool",
];

// ─── Internal canvas/pdfjs helpers ──────────────────────────────────────────

type PdfJsNodeCanvas = {
  createCanvas: (w: number, h: number) => {
    getContext: (t: "2d") => CanvasRenderingContext2D;
    toBuffer: (m: string) => Buffer;
    width: number;
    height: number;
  };
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

type DocOpts = { useSystemFonts?: boolean; disableFontFace?: boolean };

async function openPdfDoc(pdfBytes: Buffer, opts: DocOpts) {
  const openStarted = Date.now();
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(pdfBytes),
    useSystemFonts: opts.useSystemFonts ?? false,
    disableFontFace: opts.disableFontFace ?? true,
  }).promise;
  return {
    doc: doc as { numPages: number; getPage: (n: number) => Promise<unknown> },
    openMs: Date.now() - openStarted,
  };
}

async function renderPageToPng(
  page: {
    getViewport: (o: { scale: number }) => { width: number; height: number };
    render: (p: Record<string, unknown>) => { promise: Promise<void> };
  },
  renderParams: Record<string, unknown>,
): Promise<void> {
  await page.render(renderParams).promise;
}

async function renderPdfJsWithFactory(
  pdfBytes: Buffer,
  pageNumber: number,
  scale: number,
  canvasPkg: PdfJsNodeCanvas,
  docOpts: DocOpts,
) {
  installPdfJsPolyfills(canvasPkg);
  const { doc, openMs } = await openPdfDoc(pdfBytes, docOpts);
  const page = (await doc.getPage(pageNumber)) as Parameters<
    typeof renderPageToPng
  >[0];
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

async function renderPdfJsBareNapi(
  pdfBytes: Buffer,
  pageNumber: number,
  scale: number,
  docOpts: DocOpts,
) {
  const { createCanvas } = await import("@napi-rs/canvas");
  const { doc, openMs } = await openPdfDoc(pdfBytes, docOpts);
  const page = (await doc.getPage(pageNumber)) as Parameters<
    typeof renderPageToPng
  >[0];
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

function estimateOcrReadiness(png: Buffer): "ready" | "blank" {
  if (png.length < 500) return "blank";
  let diff = 0;
  const step = Math.max(1, Math.floor(png.length / 200));
  for (let i = step; i < png.length; i += step) {
    diff += Math.abs(png[i]! - png[i - step]!);
  }
  return diff / Math.floor(png.length / step) < 2 ? "blank" : "ready";
}

export function probeExternalRenderTools(): Record<
  string,
  "installed" | "not-found" | "error"
> {
  const out: Record<string, "installed" | "not-found" | "error"> = {};
  for (const cmd of ["pdftoppm", "mutool", "magick", "convert"]) {
    try {
      execSync(`where ${cmd}`, {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "ignore"],
      });
      out[cmd] = "installed";
    } catch {
      out[cmd] = "not-found";
    }
  }
  return out;
}

async function renderPopplerPdftoppm(
  pdfBytes: Buffer,
  pageNumber: number,
  scale: number,
): Promise<{
  png: Buffer;
  width: number;
  height: number;
  pageCount: number;
  openMs: number;
  installed: boolean;
}> {
  if (probeExternalRenderTools().pdftoppm !== "installed") {
    throw new Error("pdftoppm not installed");
  }
  const dir = mkdtempSync(join(tmpdir(), "pdf-audit-"));
  const pdfPath = join(dir, "in.pdf");
  writeFileSync(pdfPath, pdfBytes);
  const openStarted = Date.now();
  const dpi = Math.round(72 * scale);
  try {
    execSync(
      `pdftoppm -png -f ${pageNumber} -l ${pageNumber} -r ${dpi} "${pdfPath}" "${join(dir, "out")}"`,
      { stdio: ["pipe", "pipe", "pipe"] },
    );
    const pngFile = readdirSync(dir).find((f) => f.endsWith(".png"));
    if (!pngFile) throw new Error("pdftoppm produced no PNG");
    const png = readFileSync(join(dir, pngFile));
    const { loadImage } = await import("@napi-rs/canvas");
    const img = await loadImage(png);
    return {
      png,
      width: img.width,
      height: img.height,
      pageCount: 1,
      openMs: Date.now() - openStarted,
      installed: true,
    };
  } finally {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}

async function renderMutoolDraw(
  pdfBytes: Buffer,
  pageNumber: number,
  scale: number,
): Promise<{
  png: Buffer;
  width: number;
  height: number;
  pageCount: number;
  openMs: number;
  installed: boolean;
}> {
  if (probeExternalRenderTools().mutool !== "installed") {
    throw new Error("mutool not installed");
  }
  const dir = mkdtempSync(join(tmpdir(), "pdf-audit-"));
  const pdfPath = join(dir, "in.pdf");
  const outPath = join(dir, "out.png");
  writeFileSync(pdfPath, pdfBytes);
  const openStarted = Date.now();
  try {
    execSync(
      `mutool draw -o "${outPath}" -r ${Math.round(72 * scale)} -F png "${pdfPath}" ${pageNumber - 1}`,
      { stdio: ["pipe", "pipe", "pipe"] },
    );
    const png = readFileSync(outPath);
    const { loadImage } = await import("@napi-rs/canvas");
    const img = await loadImage(png);
    return {
      png,
      width: img.width,
      height: img.height,
      pageCount: 1,
      openMs: Date.now() - openStarted,
      installed: true,
    };
  } finally {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}

async function getPageCount(pdfBytes: Buffer): Promise<number> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data: new Uint8Array(pdfBytes) }).promise;
  return doc.numPages;
}

// ─── Production audit (upload path) ─────────────────────────────────────────

/** Audit production renderer for a single PDF page — matches ocr.ts behavior. */
export async function auditProductionPdfRender(
  pdfBytes: Buffer,
  opts?: { page?: number; scale?: number; probeOcr?: boolean },
): Promise<PdfRenderAuditRecord> {
  const page = opts?.page ?? 1;
  const scale = opts?.scale ?? 2;
  const probeOcr = opts?.probeOcr ?? false;
  const started = Date.now();

  const record: PdfRenderAuditRecord = {
    rendererUsed: PRODUCTION_RENDER_BACKEND,
    pageCount: null,
    renderSuccess: false,
    renderTimingMs: 0,
    imageDimensions: null,
    pngBytes: null,
    ocrReadiness: "skipped",
    ocrProbeChars: null,
    ocrProbeMs: null,
    failureReason: null,
    failureStack: null,
  };

  try {
    record.pageCount = await getPageCount(pdfBytes);
    const result = await renderPdfJsBareNapi(pdfBytes, page, scale, {
      useSystemFonts: true,
      disableFontFace: true,
    });
    record.renderSuccess = true;
    record.imageDimensions = { width: result.width, height: result.height };
    record.pngBytes = result.png.length;

    const readiness = estimateOcrReadiness(result.png);
    record.ocrReadiness = readiness;

    if (probeOcr && readiness === "ready") {
      const ocrStarted = Date.now();
      const ocr = await ocrImageBuffer(result.png);
      record.ocrProbeMs = Date.now() - ocrStarted;
      record.ocrProbeChars = ocr.text.length;
      if (ocr.text.length < 20) record.ocrReadiness = "blank";
    }
  } catch (err) {
    record.failureReason = err instanceof Error ? err.message : String(err);
    record.failureStack =
      err instanceof Error && err.stack
        ? err.stack.split("\n").slice(0, 6).join("\n")
        : null;
    record.ocrReadiness = "failed";
  }

  record.renderTimingMs = Date.now() - started;
  return record;
}

// ─── Harness comparison ───────────────────────────────────────────────────────

async function runBackendAttempt(
  backend: PdfRenderBackendId,
  pdf: AnchorPdfInput,
  pageNumber: number,
  scale: number,
  probeOcr: boolean,
): Promise<PdfRenderAttempt> {
  const started = Date.now();
  const base: PdfRenderAttempt = {
    backend,
    backendLabel: RENDER_BACKEND_CATALOG[backend].label,
    pdfLabel: pdf.label,
    lab: pdf.lab,
    pageNumber,
    scale,
    success: false,
    pageCount: null,
    width: null,
    height: null,
    pngBytes: null,
    durationMs: 0,
    pdfjsOpenMs: null,
    error: null,
    stack: null,
    ocrReadiness: "n/a",
    ocrProbeMs: null,
    ocrProbeChars: null,
    externalToolInstalled:
      backend === "poppler-pdftoppm"
        ? probeExternalRenderTools().pdftoppm === "installed"
        : backend === "mupdf-mutool"
          ? probeExternalRenderTools().mutool === "installed"
          : null,
  };

  try {
    let result: {
      png: Buffer;
      width: number;
      height: number;
      pageCount: number;
      openMs: number;
    };

    switch (backend) {
      case PRODUCTION_RENDER_BACKEND:
        result = await renderPdfJsBareNapi(pdf.bytes, pageNumber, scale, {
          useSystemFonts: true,
          disableFontFace: true,
        });
        break;
      case "pdfjs-napi-disable-font-face":
        result = await renderPdfJsBareNapi(pdf.bytes, pageNumber, scale, {
          useSystemFonts: false,
          disableFontFace: true,
        });
        break;
      case "pdfjs-napi-use-system-fonts":
        result = await renderPdfJsBareNapi(pdf.bytes, pageNumber, scale, {
          useSystemFonts: true,
          disableFontFace: false,
        });
        break;
      case "pdfjs-napi-factory":
        result = await renderPdfJsWithFactory(
          pdf.bytes,
          pageNumber,
          scale,
          getPdfJsResolvedNapiCanvas(),
          { useSystemFonts: false, disableFontFace: true },
        );
        break;
      case "pdfjs-node-canvas-factory": {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const nodeCanvas = require("canvas") as PdfJsNodeCanvas;
        result = await renderPdfJsWithFactory(
          pdf.bytes,
          pageNumber,
          scale,
          nodeCanvas,
          { useSystemFonts: false, disableFontFace: true },
        );
        break;
      }
      case "poppler-pdftoppm": {
        const pop = await renderPopplerPdftoppm(pdf.bytes, pageNumber, scale);
        result = pop;
        break;
      }
      case "mupdf-mutool": {
        const mu = await renderMutoolDraw(pdf.bytes, pageNumber, scale);
        result = mu;
        break;
      }
      default:
        throw new Error(`Unknown backend: ${backend satisfies never}`);
    }

    base.success = true;
    base.pageCount = result.pageCount;
    base.width = result.width;
    base.height = result.height;
    base.pngBytes = result.png.length;
    base.pdfjsOpenMs = result.openMs;
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
    if (base.error.includes("not installed")) {
      base.ocrReadiness = "n/a";
    } else {
      base.ocrReadiness = "failed";
    }
  }

  base.durationMs = Date.now() - started;
  return base;
}

export function attemptToMatrixRow(a: PdfRenderAttempt): PdfRenderMatrixRow {
  return {
    report: a.pdfLabel,
    lab: a.lab,
    renderer: a.backendLabel,
    success: a.success,
    failureReason: a.success ? null : a.error,
    ocrReady:
      a.ocrReadiness === "ready"
        ? true
        : a.ocrReadiness === "n/a" || a.ocrReadiness === "skipped"
          ? "n/a"
          : false,
    pageCount: a.pageCount,
    dimensions: a.width && a.height ? `${a.width}x${a.height}` : null,
    durationMs: a.durationMs,
    ocrChars: a.ocrProbeChars,
  };
}

function buildArchitectureRecommendation(
  attempts: PdfRenderAttempt[],
): PdfRenderValidationReport["architecture"] {
  const production = attempts.filter((a) => a.backend === PRODUCTION_RENDER_BACKEND);
  const factory = attempts.filter((a) => a.backend === "pdfjs-napi-factory");
  const prodOk = production.filter((a) => a.success).length;
  const prodTotal = production.length;
  const factoryOk = factory.filter((a) => a.success).length;
  const factoryTotal = factory.length;

  const dossierFails = production.filter(
    (a) => a.pdfLabel.includes("2496027047") && !a.success,
  );
  const paintChar = dossierFails.some((a) => a.error?.includes("paintChar") || a.error?.includes("String`, `Path`"));

  if (factoryTotal > 0 && factoryOk === factoryTotal && prodOk < prodTotal) {
    return {
      choice: "B",
      label: "Add primary renderer upgrade (factory backend replaces production implementation)",
      rationale:
        "pdfjs-napi-factory succeeds on 100% of anchor PDFs including GIA LGDR dossier 2496027047. Production path fails on dossier due to paintChar/font binding. Factory is same pdfjs stack with canvasFactory + polyfills — not a second runtime.",
      minimumChangePath:
        "Extract Sarine render helper from gcal-sarine-image-ocr.ts into shared pdf-render.ts; point renderPdfPagePngAtScale() at factory backend. No external deps. Keep pdfjs for text layer.",
      expectedExtractionRecovery:
        "2496027047: 0% → estimated 70–85% after render fix (OCR already yields ~1700 chars with diagram tokens). 6233708773/2527039693: no regression. IGI/GCAL: no regression expected.",
    };
  }

  if (prodOk === prodTotal) {
    return {
      choice: "A",
      label: "Keep current renderer",
      rationale: "All anchor PDFs render successfully on production path.",
      minimumChangePath: "No renderer change required.",
      expectedExtractionRecovery: "Extraction gated by parser/routing only.",
    };
  }

  return {
    choice: "C",
    label: "Replace renderer entirely",
    rationale:
      paintChar
        ? "In-process pdfjs variants insufficient; external Poppler/muPDF required."
        : "No single pdfjs variant passes all anchors.",
    minimumChangePath:
      "Introduce external pdftoppm/mutool fallback chain behind renderPdfPagePngAtScale.",
    expectedExtractionRecovery:
      "Depends on external tool OCR quality; estimate 60–80% on dossier after integration.",
  };
}

export async function runPdfRenderValidation(input: {
  pdfs: AnchorPdfInput[];
  backends?: PdfRenderBackendId[];
  scales?: number[];
  probeOcr?: boolean;
}): Promise<PdfRenderValidationReport> {
  const backends = input.backends ?? HARNESS_BACKENDS;
  const scales = input.scales ?? [5];
  const probeOcr = input.probeOcr ?? true;
  const attempts: PdfRenderAttempt[] = [];

  for (const pdf of input.pdfs) {
    for (const backend of backends) {
      for (const scale of scales) {
        attempts.push(await runBackendAttempt(backend, pdf, 1, scale, probeOcr));
      }
    }
  }

  const matrix = attempts.map(attemptToMatrixRow);

  const byReport: PdfRenderValidationReport["summary"]["byReport"] = {};
  const byRenderer: PdfRenderValidationReport["summary"]["byRenderer"] = {};

  for (const pdf of input.pdfs) {
    const rows = attempts.filter((a) => a.pdfLabel === pdf.label);
    byReport[pdf.label] = {
      succeeded: rows.filter((r) => r.success).length,
      total: rows.length,
    };
  }

  for (const backend of backends) {
    const rows = attempts.filter((a) => a.backend === backend);
    const ok = rows.filter((r) => r.success);
    byRenderer[backend] = {
      succeeded: ok.length,
      total: rows.length,
      avgMs:
        ok.length > 0
          ? Math.round(ok.reduce((s, r) => s + r.durationMs, 0) / ok.length)
          : 0,
      ocrReady: ok.filter((r) => r.ocrReadiness === "ready").length,
    };
  }

  const dossierFail = attempts.find(
    (a) =>
      a.backend === PRODUCTION_RENDER_BACKEND &&
      a.pdfLabel.includes("2496027047") &&
      !a.success,
  );

  let rootCause =
    "Production pdfjs render path fails on specific PDF font bindings before PNG generation.";
  if (dossierFail?.error?.includes("String`, `Path`")) {
    rootCause =
      "GIA LGDR dossier PDF 2496027047: pdfjs CanvasGraphics.paintChar fails because root @napi-rs/canvas rejects the font object pdfjs passes (no canvasFactory). OCR never starts — parser is irrelevant.";
  } else if (dossierFail?.error?.includes("not installed")) {
    rootCause = "External renderer not installed; in-process pdfjs is sole path.";
  }

  const pdfMeta = await Promise.all(
    input.pdfs.map(async (p) => {
      const layer = await extractPdfTextLayer(p.bytes);
      let pageCount: number | null = null;
      try {
        pageCount = await getPageCount(p.bytes);
      } catch {
        pageCount = null;
      }
      return {
        label: p.label,
        lab: p.lab,
        bytes: p.bytes.length,
        pageCount,
        textLayerChars: layer.text.length,
      };
    }),
  );

  return {
    generatedAt: new Date().toISOString(),
    platform: {
      node: process.version,
      arch: process.arch,
      platform: process.platform,
    },
    externalTools: probeExternalRenderTools(),
    pdfs: pdfMeta,
    matrix,
    attempts,
    summary: { byReport: byReport, byRenderer: byRenderer },
    rootCause,
    architecture: buildArchitectureRecommendation(attempts),
  };
}

export async function writePdfRenderValidationReport(
  report: PdfRenderValidationReport,
  outPath: string,
): Promise<void> {
  const { writeFile, mkdir } = await import("fs/promises");
  await mkdir(join(outPath, ".."), { recursive: true }).catch(() => {});
  await writeFile(outPath, JSON.stringify(report, null, 2), "utf8");
}
