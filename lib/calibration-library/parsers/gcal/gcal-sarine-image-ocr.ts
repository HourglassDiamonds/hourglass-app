import { mkdir, writeFile } from "fs/promises";
import { createRequire } from "module";
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
  getPdfJsNodeCanvasModule,
  renderPdfPagePngWithFactory,
  type PdfJsNodeCanvas,
} from "../../pdf-render-factory";
import { isOcrRuntimeAvailable, ocrImageBuffer } from "../shared/ocr-utils";
import {
  applyGcal8xFinishGrades,
  extractGcal8xFinishGrades,
} from "./gcal-finish";
import {
  diagnoseGcalSarineProportionExtraction,
  extractGcalSarine4csFields,
  logGcalSarineCheck,
  probeSarineFinishFromTextLayer,
  snapshotGcalSarineRecoveredFields,
} from "./gcal-sarine-4cs";

const GCAL_SARINE_PAGE_SCALE = 4;
const GCAL_SARINE_CROP_DEBUG_DIR = "data/light-performance-calibration/debug/gcal";
const GCAL_SARINE_CROP_DEBUG_REPORT = "LG360796191";

export function shouldExportGcalSarineCropDebug(reportNumber?: string): boolean {
  if (process.env.CALIBRATION_EXTRACT_DEBUG === "1") return true;
  const rn = reportNumber?.trim() ?? "";
  return rn.includes(GCAL_SARINE_CROP_DEBUG_REPORT) || rn.includes("360796191");
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

/** 8X grade table on far-right panel (hybrid Sarine cert — not gcal-image-ocr center crop). */
export const SARINE_FINISH_GRADES_CROP = {
  left: 0.74,
  top: 0.18,
  width: 0.26,
  height: 0.48,
} as const;

export type GcalSarineProportionOcrStepDiagnostics = {
  ocrPathExecuted: boolean;
  ocrRuntimeAvailable: boolean;
  canvasModulePath?: string;
  pageRendered: boolean;
  pageWidth?: number;
  pageHeight?: number;
  pageRenderError?: string;
  renderScaleUsed?: number;
  cropSucceeded: boolean;
  cropRegion: typeof SARINE_PROPORTION_DIAGRAM_CROP;
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
  opts?: { reportNumber?: string; includeFinishCrop?: boolean },
): Promise<{
  text: string;
  finishText: string;
  diagnostics: GcalSarineProportionOcrStepDiagnostics;
}> {
  const canvasPkg = getPdfJsNodeCanvasModule();
  const nodeRequire = createRequire(import.meta.url);
  const canvasModulePath = createRequire(
    nodeRequire.resolve("pdfjs-dist/legacy/build/pdf.mjs"),
  ).resolve("@napi-rs/canvas");

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

  for (const scale of [GCAL_SARINE_PAGE_SCALE, 5, 3, 2]) {
    const attempt = await renderPdfPagePngWithFactory(
      pdfBytes,
      1,
      scale,
      "sarine-pdf-render",
    );
    if (!attempt) {
      pageRenderError = "sarine-pdf-render-failed";
      continue;
    }
    rendered = attempt;
    renderScaleUsed = scale;
    break;
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
  diagnostics.renderScaleUsed = renderScaleUsed;

  const cropResult = await cropPageRegionPng(
    rendered.png,
    rendered.width,
    rendered.height,
    SARINE_PROPORTION_DIAGRAM_CROP,
    canvasPkg,
  );
  diagnostics.cropPixelRect = cropResult.pixelRect;
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
      // Finish rows use colored grade buttons — raw crop OCR reads EX labels better than binarized.
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

  const rawOcr = await ocrImageBuffer(cropPng);
  const preppedOcr = await ocrImageBuffer(prepped);
  diagnostics.ocrOk = rawOcr.ok || preppedOcr.ok;
  diagnostics.ocrError = preppedOcr.error ?? rawOcr.error;
  const text = [rawOcr.text, preppedOcr.text].filter(Boolean).join("\n").trim();
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
  opts?: { reportNumber?: string; parserPathUsed?: string },
): Promise<{ proportionRegionText: string; recoveredFields: Record<string, string> }> {
  const before = { ...fields };
  const fieldsBeforeImageOcr = snapshotGcalSarineRecoveredFields(
    emptyReportFields(),
    before,
    internal,
  );

  const {
    text: proportionRegionText,
    finishText: finishRegionText,
    diagnostics: ocrSteps,
  } = await ocrGcalSarineProportionRegionWithDiagnostics(pdfBytes, {
    reportNumber: opts?.reportNumber,
    includeFinishCrop: true,
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

  const failureMode = !ocrSteps.pageRendered
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

  return { proportionRegionText, recoveredFields };
}
