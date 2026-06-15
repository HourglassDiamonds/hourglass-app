import { loadServerPdfjs } from "../../server-pdfjs";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { emptyReportFields } from "../../fields";
import type {
  CalibrationReportFields,
  FieldConfidence,
  GcalInternalFields,
  ReportFieldKey,
} from "../../types";
import {
  withTimeout,
} from "../../runtime-guard";
import {
  IMAGE_PREPROCESS_TIMEOUT_MS,
} from "../../runtime-limits";
import {
  getPdfJsResolvedCanvasModule,
  renderPdfPagePngWithFactory,
  resolvePdfJsCanvasModulePathForDiagnostics,
  type PdfJsNodeCanvas,
} from "../../pdf-render-factory";
import { isOcrRuntimeAvailable, ocrImageBuffer, renderPdfPagePngGcalSarine, renderUploadImageAsPage } from "../shared/ocr-utils";
import {
  extractGcal8xFinishGrades,
  applyGcal8xFinishGrades,
} from "./gcal-finish";
import {
  diagnoseGcalSarineProportionExtraction,
  extractGcalSarine4csFields,
  extractGcalSarineProportionIslands,
  logGcalSarineCheck,
  probeSarineFinishFromTextLayer,
  snapshotGcalSarineRecoveredFields,
} from "./gcal-sarine-4cs";

const GCAL_SARINE_PAGE_SCALE = 4;
const GCAL_SARINE_CROP_DEBUG_DIR = "data/light-performance-calibration/debug/gcal";
const GCAL_SARINE_CROP_DEBUG_REPORT = "LG360796191";

/** 8X proportion block — page-2 back matter / fallback when Sarine corner crop is empty. */
export const GCAL_HYBRID_8X_PROPORTION_CROP = {
  left: 0.5,
  top: 0.53,
  width: 0.48,
  height: 0.43,
} as const;

export function shouldExportGcalSarineCropDebug(reportNumber?: string): boolean {
  if (process.env.CALIBRATION_EXTRACT_DEBUG === "1") return true;
  const rn = reportNumber?.trim() ?? "";
  return (
    rn.includes(GCAL_SARINE_CROP_DEBUG_REPORT) ||
    rn.includes("360796191") ||
    rn.includes("360796192")
  );
}

function sarineCropDebugBasename(reportNumber?: string): string {
  const rn = reportNumber?.trim() ?? "";
  if (rn.includes("360796191")) return GCAL_SARINE_CROP_DEBUG_REPORT;
  const safe = rn.replace(/[^\w-]+/g, "").slice(0, 40);
  return safe || "gcal-sarine-debug";
}

export type GcalSarineDebugImageWriteResult = {
  ok: boolean;
  error?: string;
  dir?: string;
};

/** Debug PNG export must never crash live upload (read-only FS on serverless). */
export async function exportGcalSarineCropDebugPngs(
  basename: string,
  pagePng: Buffer,
  proportionCropPng: Buffer | null,
  proportionPreppedPng: Buffer | null,
  finishCropPng?: Buffer | null,
): Promise<GcalSarineDebugImageWriteResult> {
  const dir = join(process.cwd(), GCAL_SARINE_CROP_DEBUG_DIR);
  try {
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, `${basename}-sarine-page.png`), pagePng);
    if (proportionCropPng) {
      await writeFile(
        join(dir, `${basename}-sarine-proportion-crop.png`),
        proportionCropPng,
      );
    }
    if (proportionPreppedPng) {
      await writeFile(
        join(dir, `${basename}-sarine-preprocessed-ocr.png`),
        proportionPreppedPng,
      );
    }
    if (finishCropPng) {
      await writeFile(join(dir, `${basename}-sarine-finish-crop.png`), finishCropPng);
    }
    return { ok: true, dir };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      dir,
    };
  }
}

/**
 * Proportion diagram only — bottom of right panel (hybrid Sarine + 8X layout).
 * Wider crops (0.52, 0.58) include Optical Symmetry prose above the diagram.
 */
export const SARINE_PROPORTION_DIAGRAM_CROP = {
  left: 0.74,
  top: 0.71,
  width: 0.24,
  height: 0.28,
} as const;

/** Angle labels + upper diagram (LG360796192); merged when bottom-corner crop omits crown °. */
export const SARINE_CROWN_ANGLE_BAND_CROP = {
  left: 0.68,
  top: 0.6,
  width: 0.3,
  height: 0.38,
} as const;

/** Full proportion diagram band for uploaded JPG screenshots (angles + percents). */
export const SARINE_IMAGE_PROPORTION_WIDE_CROP = {
  left: 0.52,
  top: 0.48,
  width: 0.46,
  height: 0.5,
} as const;

/** Diamond schematic with angle callouts — uploaded JPG layout (LG341066155). */
export const SARINE_DIAGRAM_ILLUSTRATION_CROP = {
  left: 0.02,
  top: 0.22,
  width: 0.52,
  height: 0.62,
} as const;

/** Crown angle callout — upper-left shoulder on center diagram (LG341066155 JPG). */
export const SARINE_DIAGRAM_CROWN_CALLOUT_CROP = {
  left: 0.32,
  top: 0.22,
  width: 0.08,
  height: 0.06,
} as const;

/** Center proportion diagram — crown + pavilion labels on uploaded JPG layout. */
export const SARINE_IMAGE_CENTER_DIAGRAM_CROP = {
  left: 0.2,
  top: 0.23,
  width: 0.38,
  height: 0.42,
} as const;

/** Lower diagram band — angle callouts on uploaded Sarine JPG screenshots. */
export const SARINE_IMAGE_DIAGRAM_LOWER_CROP = {
  left: 0.08,
  top: 0.5,
  width: 0.88,
  height: 0.45,
} as const;

/** 8X grade table on far-right panel (hybrid Sarine cert — not gcal-image-ocr center crop). */
export const SARINE_FINISH_GRADES_CROP = {
  left: 0.74,
  top: 0.18,
  width: 0.26,
  height: 0.48,
} as const;

/**
 * 4Cs color/clarity block — upper-left panel (Sarine JPG + hybrid PDF page 1).
 * LG353456516 anchor: Carat Weight, 4Cs Color, Clarity, Cut above shape row.
 */
export const SARINE_4CS_GRADING_PANEL_CROP = {
  left: 0.03,
  top: 0.14,
  width: 0.52,
  height: 0.36,
} as const;

/** Wider fallback when mobile screenshots crop the left margin. */
export const SARINE_4CS_GRADING_PANEL_WIDE_CROP = {
  left: 0,
  top: 0.1,
  width: 0.62,
  height: 0.42,
} as const;

/** Identification column mid-page — 4Cs block on tall Sarine JPG screenshots. */
export const SARINE_4CS_GRADING_PANEL_LOWER_CROP = {
  left: 0,
  top: 0.38,
  width: 0.65,
  height: 0.3,
} as const;

export type GcalSarine4CsPanelOcrDiagnostics = {
  ocrRuntimeAvailable: boolean;
  pageRendered: boolean;
  pageWidth?: number;
  pageHeight?: number;
  cropSucceeded: boolean;
  ocrOk: boolean;
  ocrRawLength: number;
  ocrRawPreview: string;
  cropsAttempted: number;
};

export function mergeSarine4CsGradeHintText(
  baseText: string,
  panelText: string,
): string {
  const panel = panelText.trim();
  const base = baseText.trim();
  if (!panel) return base.slice(0, 16000);
  if (!base) return panel.slice(0, 16000);
  // Prefer isolated grading panel — prepend so grade-hint parsers see clean 4Cs tokens first.
  return `${panel}\n\n${base}`.slice(0, 16000);
}

export function shouldRunGcalSarine4CsGradingPanelOcr(input: {
  parserType?: string;
  combinedText: string;
  gradeHintText: string;
  imageUpload?: boolean;
}): boolean {
  if (input.parserType !== "gcal-sarine-4cs") return false;
  const hint = input.gradeHintText || input.combinedText;
  const has4CsColor =
    /\b4C'?s?\s+Color\s+[D-Z]\b/i.test(hint) ||
    (input.imageUpload && /\bcolou?r\s+[D-Z]\b/i.test(hint));
  const hasValidClarity =
    /\b(?:GRAD\s*I?\s*NG\s+)?Clarity\s+(?:FL|IF|VVS\s*1|VVS\s*2|VS\s*1|VS\s*2|SI\s*1|SI\s*2|I\s*1|I\s*2|I\s*3|VVS1|VVS2|VS1|VS2|SI1|SI2|I1|I2|I3)\b/i.test(
      hint,
    );
  if (input.imageUpload) {
    return !(has4CsColor && hasValidClarity);
  }
  if (has4CsColor && !hasValidClarity) return true;
  return (
    /\bclarity\b[\s\S]{0,24}\bMe\b/i.test(hint) ||
    /\bG\s*RAD\s*N\s*G\s+Clarity\s+[A-Za-z]{1,3}\b/i.test(hint)
  );
}

async function resolveSarinePagePng(
  documentBytes: Buffer,
  imageUpload: boolean,
): Promise<{ png: Buffer; width: number; height: number } | null> {
  if (imageUpload) {
    const rendered = await renderUploadImageAsPage(documentBytes);
    if (!rendered) return null;
    return {
      png: rendered.png,
      width: rendered.width,
      height: rendered.height,
    };
  }
  const rendered = await renderGcalSarineDiagramPage(
    documentBytes,
    1,
    GCAL_SARINE_PAGE_SCALE,
  );
  return rendered;
}

/** Isolated 4Cs grading panel OCR — prefer over full-page when clarity is garbled. */
export async function ocrGcalSarine4CsGradingPanel(
  documentBytes: Buffer,
  opts?: { imageUpload?: boolean; reportNumber?: string },
): Promise<{ text: string; diagnostics: GcalSarine4CsPanelOcrDiagnostics }> {
  const diagnostics: GcalSarine4CsPanelOcrDiagnostics = {
    ocrRuntimeAvailable: await isOcrRuntimeAvailable(),
    pageRendered: false,
    cropSucceeded: false,
    ocrOk: false,
    ocrRawLength: 0,
    ocrRawPreview: "",
    cropsAttempted: 0,
  };

  if (!diagnostics.ocrRuntimeAvailable) {
    return { text: "", diagnostics };
  }

  const canvasPkg = await getPdfJsResolvedCanvasModule();
  if (!canvasPkg?.loadImage) {
    return { text: "", diagnostics };
  }

  const rendered = await resolveSarinePagePng(
    documentBytes,
    Boolean(opts?.imageUpload),
  );
  if (!rendered) {
    return { text: "", diagnostics };
  }

  diagnostics.pageRendered = true;
  diagnostics.pageWidth = rendered.width;
  diagnostics.pageHeight = rendered.height;

  const crops = [
    SARINE_4CS_GRADING_PANEL_CROP,
    SARINE_4CS_GRADING_PANEL_WIDE_CROP,
    SARINE_4CS_GRADING_PANEL_LOWER_CROP,
  ];
  const ocrChunks: string[] = [];

  for (const crop of crops) {
    diagnostics.cropsAttempted += 1;
    const cropResult = await cropPageRegionPng(
      rendered.png,
      rendered.width,
      rendered.height,
      crop,
      canvasPkg,
    );
    if (!cropResult.png) continue;
    diagnostics.cropSucceeded = true;

    const prepped =
      (await withTimeout(
        preprocessGcalCropPng(cropResult.png, canvasPkg),
        IMAGE_PREPROCESS_TIMEOUT_MS,
        "sarine-4cs-panel-preprocess",
      ).catch(() => cropResult.png)) ?? cropResult.png;

    const rawOcr = await ocrImageBuffer(cropResult.png);
    const preppedOcr = await ocrImageBuffer(prepped);
    const chunk = [rawOcr.text, preppedOcr.text].filter(Boolean).join("\n").trim();
    if (chunk) ocrChunks.push(chunk);
  }

  const text = ocrChunks.join("\n").trim();
  diagnostics.ocrOk = text.length > 0;
  diagnostics.ocrRawLength = text.length;
  diagnostics.ocrRawPreview = text.slice(0, 240);

  if (shouldExportGcalSarineCropDebug(opts?.reportNumber) && rendered.png) {
    const basename = `${sarineCropDebugBasename(opts?.reportNumber)}-4cs-panel`;
    await exportGcalSarineCropDebugPngs(basename, rendered.png, null, null);
  }

  return { text, diagnostics };
}

type GcalProportionCropRegion =
  | typeof SARINE_PROPORTION_DIAGRAM_CROP
  | typeof GCAL_HYBRID_8X_PROPORTION_CROP
  | typeof SARINE_IMAGE_PROPORTION_WIDE_CROP;

export type GcalSarineProportionOcrStepDiagnostics = {
  ocrPathExecuted: boolean;
  ocrRuntimeAvailable: boolean;
  canvasModulePath?: string;
  pageRendered: boolean;
  pageWidth?: number;
  pageHeight?: number;
  pageNumber?: number;
  pageRenderError?: string;
  renderScaleUsed?: number;
  cropSucceeded: boolean;
  cropRegion: GcalProportionCropRegion;
  cropPixelRect?: { sx: number; sy: number; width: number; height: number };
  cropDimensions?: { width: number; height: number };
  preprocessedDimensions?: { width: number; height: number };
  finishCropRegion?: typeof SARINE_FINISH_GRADES_CROP;
  finishCropPixelRect?: { sx: number; sy: number; width: number; height: number };
  finishCropDimensions?: { width: number; height: number };
  finishOcrRawLength?: number;
  finishOcrOk?: boolean;
  debugImagesExported?: boolean;
  debugImageWriteStatus?: string;
  ocrOk: boolean;
  ocrError?: string;
  ocrRawLength: number;
};

type FieldSetter = (
  key: ReportFieldKey,
  value: string,
  level: FieldConfidence,
) => void;

type PercentCrop = {
  left: number;
  top: number;
  width: number;
  height: number;
};

async function readPdfPageCount(pdfBytes: Buffer): Promise<number> {
  try {
    const pdfjs = await loadServerPdfjs();
    const doc = await pdfjs.getDocument({ data: new Uint8Array(pdfBytes) }).promise;
    return doc.numPages;
  } catch {
    return 1;
  }
}

async function renderGcalSarineDiagramPage(
  pdfBytes: Buffer,
  pageNumber: number,
  scale: number,
): Promise<{ png: Buffer; width: number; height: number } | null> {
  const factory = await renderPdfPagePngWithFactory(
    pdfBytes,
    pageNumber,
    scale,
    "gcal-sarine-factory",
    pageNumber === 1
      ? { disableFontFace: false, useSystemFonts: true }
      : undefined,
  );
  if (factory) return factory;
  const legacy = await renderPdfPagePngGcalSarine(pdfBytes, pageNumber, scale);
  if (legacy) return legacy;
  return null;
}

function proportionCropForPage(pageNumber: number | undefined): GcalProportionCropRegion {
  return pageNumber === 1 ? SARINE_PROPORTION_DIAGRAM_CROP : GCAL_HYBRID_8X_PROPORTION_CROP;
}

async function ocrProportionCrop(
  rendered: { png: Buffer; width: number; height: number },
  crop: { left: number; top: number; width: number; height: number },
  canvasPkg: PdfJsNodeCanvas,
  opts?: { singlePass?: boolean; scaleUp?: number },
): Promise<string> {
  const cropResult = await cropPageRegionPng(
    rendered.png,
    rendered.width,
    rendered.height,
    crop,
    canvasPkg,
  );
  if (!cropResult.png) return "";
  const scaleUp = Math.max(1, opts?.scaleUp ?? 1);
  let cropPng = cropResult.png;
  if (scaleUp > 1 && canvasPkg.loadImage) {
    const img = await canvasPkg.loadImage(cropResult.png);
    const cw = Math.max(1, Math.floor(cropResult.pixelRect.width * scaleUp));
    const ch = Math.max(1, Math.floor(cropResult.pixelRect.height * scaleUp));
    const canvas = canvasPkg.createCanvas(cw, ch);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(
      img as unknown as Parameters<CanvasRenderingContext2D["drawImage"]>[0],
      0,
      0,
      cropResult.pixelRect.width,
      cropResult.pixelRect.height,
      0,
      0,
      cw,
      ch,
    );
    cropPng = canvas.toBuffer("image/png");
  }
  const prepped =
    (await withTimeout(
      preprocessGcalCropPng(cropPng, canvasPkg),
      IMAGE_PREPROCESS_TIMEOUT_MS,
      "sarine-crop-preprocess",
    ).catch(() => cropPng)) ?? cropPng;
  if (opts?.singlePass) {
    const ocr = await ocrImageBuffer(prepped);
    return ocr.text.trim();
  }
  const rawOcr = await ocrImageBuffer(cropPng);
  const preppedOcr = await ocrImageBuffer(prepped);
  return [rawOcr.text, preppedOcr.text].filter(Boolean).join("\n").trim();
}

async function cropPageRegionPng(
  pagePng: Buffer,
  pageWidth: number,
  pageHeight: number,
  crop: PercentCrop,
  canvasPkg: PdfJsNodeCanvas,
): Promise<{ png: Buffer | null; pixelRect: { sx: number; sy: number; width: number; height: number } }> {
  const sx = Math.max(0, Math.floor(crop.left * pageWidth));
  const sy = Math.max(0, Math.floor(crop.top * pageHeight));
  const w = Math.max(
    1,
    Math.min(pageWidth - sx, Math.floor(crop.width * pageWidth)),
  );
  const h = Math.max(
    1,
    Math.min(pageHeight - sy, Math.floor(crop.height * pageHeight)),
  );
  const pixelRect = { sx, sy, width: w, height: h };
  const loadImage = canvasPkg.loadImage;
  if (!loadImage) {
    return { png: null, pixelRect };
  }
  try {
    const img = await loadImage(pagePng);
    const canvas = canvasPkg.createCanvas(w, h);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(
      img as unknown as Parameters<CanvasRenderingContext2D["drawImage"]>[0],
      sx,
      sy,
      w,
      h,
      0,
      0,
      w,
      h,
    );
    return { png: canvas.toBuffer("image/png"), pixelRect };
  } catch {
    return { png: null, pixelRect };
  }
}

/** GCAL-only crop preprocess (same treatment as 8X region OCR). */
async function preprocessGcalCropPng(
  png: Buffer,
  canvasPkg: PdfJsNodeCanvas,
): Promise<Buffer> {
  const loadImage = canvasPkg.loadImage;
  if (!loadImage) {
    return png;
  }
  try {
    const img = await loadImage(png);
    const canvas = canvasPkg.createCanvas(img.width, img.height);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(
      img as unknown as Parameters<CanvasRenderingContext2D["drawImage"]>[0],
      0,
      0,
    );
    const { width, height } = canvas;
    const src = ctx.getImageData(0, 0, width, height);
    const gray = new Float32Array(width * height);

    for (let i = 0, p = 0; i < src.data.length; i += 4, p++) {
      gray[p] =
        0.299 * src.data[i]! +
        0.587 * src.data[i + 1]! +
        0.114 * src.data[i + 2]!;
    }

    const contrast = 1.45;
    const midpoint = 128;
    const out = ctx.createImageData(width, height);
    const od = out.data;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const p = y * width + x;
        let v = (gray[p]! - midpoint) * contrast + midpoint;
        const lap =
          gray[p]! * 5 -
          (gray[p - 1] ?? gray[p]!) -
          (gray[p + 1] ?? gray[p]!) -
          (gray[p - width] ?? gray[p]!) -
          (gray[p + width] ?? gray[p]!);
        v = Math.max(0, Math.min(255, v + lap * 0.12));
        const bin = v > 168 ? 255 : v < 92 ? 0 : v;
        const o = p * 4;
        od[o] = od[o + 1] = od[o + 2] = bin;
        od[o + 3] = 255;
      }
    }

    ctx.putImageData(out, 0, 0);
    return canvas.toBuffer("image/png");
  } catch {
    return png;
  }
}

export async function ocrGcalSarineProportionRegionWithDiagnostics(
  pdfBytes: Buffer,
  opts?: {
    reportNumber?: string;
    includeFinishCrop?: boolean;
    imageUpload?: boolean;
  },
): Promise<{
  text: string;
  finishText: string;
  diagnostics: GcalSarineProportionOcrStepDiagnostics;
}> {
  const canvasPkg = getPdfJsResolvedCanvasModule();
  const canvasModulePath = resolvePdfJsCanvasModulePathForDiagnostics();

  const diagnostics: GcalSarineProportionOcrStepDiagnostics = {
    ocrPathExecuted: true,
    ocrRuntimeAvailable: await isOcrRuntimeAvailable(),
    canvasModulePath,
    pageRendered: false,
    cropSucceeded: false,
    cropRegion: SARINE_PROPORTION_DIAGRAM_CROP,
    ocrOk: false,
    ocrRawLength: 0,
  };

  if (!diagnostics.ocrRuntimeAvailable) {
    return { text: "", finishText: "", diagnostics };
  }

  let rendered: { png: Buffer; width: number; height: number } | null = null;
  let pageRenderError: string | undefined;
  let renderScaleUsed: number | undefined;
  let pageNumberUsed: number | undefined;

  if (opts?.imageUpload) {
    rendered = await resolveSarinePagePng(pdfBytes, true);
    if (!rendered) {
      pageRenderError = "gcal-sarine-image-render-failed";
    } else {
      pageNumberUsed = 1;
      renderScaleUsed = GCAL_SARINE_PAGE_SCALE;
    }
  } else {
    const pageCount = await readPdfPageCount(pdfBytes);
    /** Hybrid 2-page certs: proportion diagram on page 1; page 2 is 8X back matter. */
    const pageCandidates =
      pageCount >= 2 ? [1, 2] : [1];

    outer: for (const pageNumber of pageCandidates) {
      for (const scale of [GCAL_SARINE_PAGE_SCALE, 5, 3, 2]) {
        const attempt = await renderGcalSarineDiagramPage(pdfBytes, pageNumber, scale);
        if (!attempt) {
          pageRenderError = "gcal-sarine-pdf-render-failed";
          continue;
        }
        rendered = attempt;
        renderScaleUsed = scale;
        pageNumberUsed = pageNumber;
        break outer;
      }
    }
  }

  if (!rendered) {
    return {
      text: "",
      finishText: "",
      diagnostics: { ...diagnostics, pageRenderError },
    };
  }

  diagnostics.pageRendered = true;
  diagnostics.pageWidth = rendered.width;
  diagnostics.pageHeight = rendered.height;
  diagnostics.pageNumber = pageNumberUsed;
  diagnostics.renderScaleUsed = renderScaleUsed;

  const primaryCrop = opts?.imageUpload
    ? SARINE_IMAGE_PROPORTION_WIDE_CROP
    : proportionCropForPage(pageNumberUsed);
  diagnostics.cropRegion = primaryCrop;

  let text = await ocrProportionCrop(rendered, primaryCrop, canvasPkg);
  let cropResult = await cropPageRegionPng(
    rendered.png,
    rendered.width,
    rendered.height,
    primaryCrop,
    canvasPkg,
  );
  diagnostics.cropPixelRect = cropResult.pixelRect;

  if (pageNumberUsed === 1 && !extractGcalSarineProportionIslands(text).tablePercent) {
    const fallbackText = await ocrProportionCrop(
      rendered,
      GCAL_HYBRID_8X_PROPORTION_CROP,
      canvasPkg,
    );
    if (extractGcalSarineProportionIslands(fallbackText).tablePercent) {
      text = fallbackText;
      diagnostics.cropRegion = GCAL_HYBRID_8X_PROPORTION_CROP;
      cropResult = await cropPageRegionPng(
        rendered.png,
        rendered.width,
        rendered.height,
        GCAL_HYBRID_8X_PROPORTION_CROP,
        canvasPkg,
      );
      diagnostics.cropPixelRect = cropResult.pixelRect;
    }
  }

  if (
    !opts?.imageUpload &&
    pageNumberUsed === 1 &&
    !extractGcalSarineProportionIslands(text).crownAngle?.trim()
  ) {
    const crownBandText = await ocrProportionCrop(
      rendered,
      SARINE_CROWN_ANGLE_BAND_CROP,
      canvasPkg,
    );
    if (crownBandText.trim()) {
      text = [text, crownBandText].filter(Boolean).join("\n").trim();
    }
  }

  if (
    opts?.imageUpload &&
    !extractGcalSarineProportionIslands(text).tablePercent?.trim()
  ) {
    const narrowText = await ocrProportionCrop(
      rendered,
      SARINE_PROPORTION_DIAGRAM_CROP,
      canvasPkg,
    );
    if (narrowText.trim()) {
      text = [text, narrowText].filter(Boolean).join("\n").trim();
    }
  }

  if (opts?.imageUpload) {
    let islands = extractGcalSarineProportionIslands(text);
    if (!islands.crownAngle?.trim() || !islands.pavilionAngle?.trim()) {
      const angleFallbackCrops: Array<{
        crop: {
          left: number;
          top: number;
          width: number;
          height: number;
        };
        scaleUp?: number;
      }> = [
        { crop: SARINE_DIAGRAM_CROWN_CALLOUT_CROP, scaleUp: 4 },
        { crop: SARINE_IMAGE_CENTER_DIAGRAM_CROP },
        { crop: SARINE_DIAGRAM_ILLUSTRATION_CROP },
        { crop: SARINE_IMAGE_DIAGRAM_LOWER_CROP },
        { crop: GCAL_HYBRID_8X_PROPORTION_CROP },
        { crop: SARINE_PROPORTION_DIAGRAM_CROP },
      ];
      for (const { crop, scaleUp } of angleFallbackCrops) {
        const angleText = await ocrProportionCrop(rendered, crop, canvasPkg, {
          scaleUp,
        });
        if (!angleText.trim()) continue;
        text = [text, angleText].filter(Boolean).join("\n").trim();
        islands = extractGcalSarineProportionIslands(text);
        if (islands.crownAngle?.trim() && islands.pavilionAngle?.trim()) {
          break;
        }
      }
    }
  }

  if (!cropResult.png) {
    return { text: "", finishText: "", diagnostics };
  }

  const includeFinish = opts?.includeFinishCrop !== false;
  let finishText = "";
  let finishCropPng: Buffer | null = null;
  if (includeFinish) {
    diagnostics.finishCropRegion = SARINE_FINISH_GRADES_CROP;
    const finishCrop = await cropPageRegionPng(
      rendered.png,
      rendered.width,
      rendered.height,
      SARINE_FINISH_GRADES_CROP,
      canvasPkg,
    );
    diagnostics.finishCropPixelRect = finishCrop.pixelRect;
    diagnostics.finishCropDimensions = {
      width: finishCrop.pixelRect.width,
      height: finishCrop.pixelRect.height,
    };
    if (finishCrop.png) {
      finishCropPng = finishCrop.png;
      const finishOcr = await ocrImageBuffer(finishCropPng);
      diagnostics.finishOcrOk = finishOcr.ok;
      finishText = (finishOcr.text ?? "").trim();
      diagnostics.finishOcrRawLength = finishText.length;
    }
  }

  diagnostics.cropSucceeded = true;
  diagnostics.cropDimensions = {
    width: cropResult.pixelRect.width,
    height: cropResult.pixelRect.height,
  };

  const cropPng = cropResult.png;
  const prepped: Buffer = await withTimeout(
    preprocessGcalCropPng(cropPng, canvasPkg),
    IMAGE_PREPROCESS_TIMEOUT_MS,
    "sarine-crop-preprocess",
  ).catch(() => cropPng);
  diagnostics.preprocessedDimensions = {
    width: cropResult.pixelRect.width,
    height: cropResult.pixelRect.height,
  };

  if (shouldExportGcalSarineCropDebug(opts?.reportNumber)) {
    const debugWrite = await exportGcalSarineCropDebugPngs(
      sarineCropDebugBasename(opts?.reportNumber),
      rendered.png,
      cropResult.png,
      prepped,
      finishCropPng,
    );
    diagnostics.debugImageWriteStatus = debugWrite.ok
      ? `ok:${debugWrite.dir ?? GCAL_SARINE_CROP_DEBUG_DIR}`
      : `failed:${debugWrite.error ?? "unknown"}`;
    diagnostics.debugImagesExported = debugWrite.ok;
  }

  diagnostics.ocrOk = text.length > 0;
  diagnostics.ocrRawLength = text.length;

  return { text, finishText, diagnostics };
}

export async function ocrGcalSarineProportionRegion(
  pdfBytes: Buffer,
): Promise<string> {
  const { text } = await ocrGcalSarineProportionRegionWithDiagnostics(pdfBytes);
  return text;
}

export function needsGcalSarineProportionImageOcr(
  fields: CalibrationReportFields,
): boolean {
  return (
    !fields.depthPercent.trim() ||
    !fields.crownAngle.trim() ||
    !fields.pavilionAngle.trim() ||
    !fields.tablePercent.trim()
  );
}

/** Finish grades live on image panel — text layer often omits polish/symmetry/cut. */
export function needsGcalSarineFinishImageOcr(
  fields: CalibrationReportFields,
): boolean {
  return (
    !fields.polish.trim() ||
    !fields.symmetry.trim() ||
    !fields.cutGrade.trim()
  );
}

export function needsGcalSarineImageOcr(
  fields: CalibrationReportFields,
): boolean {
  return (
    needsGcalSarineProportionImageOcr(fields) ||
    needsGcalSarineFinishImageOcr(fields)
  );
}

/**
 * OCR Sarine proportion diagram crop and merge — grading fields come from text layer.
 */
export async function applyGcalSarineProportionImageOcr(
  pdfBytes: Buffer,
  rawText: string,
  fields: CalibrationReportFields,
  internal: GcalInternalFields,
  set: FieldSetter,
  opts?: { reportNumber?: string; parserPathUsed?: string; imageUpload?: boolean },
): Promise<{
  proportionRegionText: string;
  recoveredFields: Record<string, string>;
  diagramOcrFailure?: string;
  coreProportionsRecovered: boolean;
  stepDiagnostics: GcalSarineProportionOcrStepDiagnostics;
}> {
  const before = { ...fields };
  const fieldsBeforeImageOcr = snapshotGcalSarineRecoveredFields(
    emptyReportFields(),
    before,
    internal,
  );

  const finishFromTextLayerEarly = probeSarineFinishFromTextLayer(rawText);
  const skipFinishCrop =
    Boolean(opts?.imageUpload) &&
    Boolean(
      finishFromTextLayerEarly.polish?.trim() &&
        finishFromTextLayerEarly.symmetry?.trim(),
    ) &&
    Boolean(fields.crownAngle?.trim() && fields.pavilionAngle?.trim());

  const {
    text: proportionRegionText,
    finishText: finishRegionText,
    diagnostics: ocrSteps,
  } = await ocrGcalSarineProportionRegionWithDiagnostics(pdfBytes, {
    reportNumber: opts?.reportNumber,
    includeFinishCrop: !skipFinishCrop,
    imageUpload: opts?.imageUpload,
  });

  const meta = extractGcalSarine4csFields(
    rawText,
    fields,
    set,
    internal,
    proportionRegionText,
  );

  const proportionDiag = diagnoseGcalSarineProportionExtraction(
    proportionRegionText,
  );
  const finishFromTextLayer = probeSarineFinishFromTextLayer(rawText);
  const finishFromImageOcr = extractGcal8xFinishGrades(finishRegionText);
  applyGcal8xFinishGrades(finishFromImageOcr, fields, set);

  const recoveredFields = snapshotGcalSarineRecoveredFields(
    before,
    fields,
    internal,
  );

  const failureMode = !ocrSteps.ocrRuntimeAvailable
    ? "F-ocr-runtime-unavailable"
    : !ocrSteps.pageRendered
      ? "E-page-render-failed-pdfjs-canvas"
      : !ocrSteps.cropSucceeded
      ? "A-crop-failed"
      : ocrSteps.ocrRawLength === 0
        ? ocrSteps.ocrOk
          ? "B-ocr-empty-after-crop"
          : "B-ocr-runtime-error"
        : proportionDiag.numericCandidates.percents.length === 0
          ? "C-repair-rejected-numerics"
          : Object.keys(proportionDiag.assignedProportionFields).length === 0
            ? "D-assignment-failed"
            : undefined;

  const coreProportionsRecovered = !needsGcalSarineProportionImageOcr(fields);

  logGcalSarineCheck({
    parserType: "gcal-sarine-4cs",
    phase: "image-ocr",
    parserPathUsed: opts?.parserPathUsed ?? "gcal-sarine-4cs",
    cropAttempted: true,
    cropGatePassed: true,
    ocrPathExecuted: ocrSteps.ocrPathExecuted,
    failureMode,
    cropRegion: ocrSteps.cropRegion,
    cropPixelRect: ocrSteps.cropPixelRect,
    cropDimensions: ocrSteps.cropDimensions,
    preprocessedDimensions: ocrSteps.preprocessedDimensions,
    debugImagesExported: ocrSteps.debugImagesExported,
    canvasModulePath: ocrSteps.canvasModulePath,
    ocrRuntimeAvailable: ocrSteps.ocrRuntimeAvailable,
    pageRendered: ocrSteps.pageRendered,
    pageWidth: ocrSteps.pageWidth,
    pageHeight: ocrSteps.pageHeight,
    cropSucceeded: ocrSteps.cropSucceeded,
    ocrOk: ocrSteps.ocrOk,
    ocrError: ocrSteps.ocrError,
    pageRenderError: ocrSteps.pageRenderError,
    renderScaleUsed: ocrSteps.renderScaleUsed,
    ocrRawTextPreview: proportionDiag.ocrRawTextPreview,
    repairedOcrTextPreview: proportionDiag.repairedOcrTextPreview,
    numericCandidates: proportionDiag.numericCandidates,
    assignedProportionFields: proportionDiag.assignedProportionFields,
    rejectedCandidates: proportionDiag.rejectedCandidates,
    finishFromTextLayer: {
      ...finishFromTextLayer,
      polish: finishFromTextLayer.polish ?? finishFromImageOcr.polish,
      symmetry: finishFromTextLayer.symmetry ?? finishFromImageOcr.symmetry,
      cutGrade: finishFromTextLayer.cutGrade ?? finishFromImageOcr.cutGrade,
      foundInTextLayer:
        finishFromTextLayer.foundInTextLayer ||
        Boolean(
          finishFromImageOcr.polish ||
            finishFromImageOcr.symmetry ||
            finishFromImageOcr.cutGrade,
        ),
    },
    finishCropRegion: ocrSteps.finishCropRegion,
    finishCropPixelRect: ocrSteps.finishCropPixelRect,
    finishOcrRawLength: ocrSteps.finishOcrRawLength,
    finishOcrRawTextPreview: (finishRegionText ?? "").slice(0, 240),
    finishFromImageOcr,
    gradingFields: meta.gradingFields,
    proportionCandidates: meta.proportionCandidates,
    fieldsBeforeImageOcr,
    recoveredFields,
  });

  return {
    proportionRegionText,
    recoveredFields,
    diagramOcrFailure: failureMode,
    coreProportionsRecovered,
    stepDiagnostics: ocrSteps,
  };
}
