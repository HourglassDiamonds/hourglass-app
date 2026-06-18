import type {
  CalibrationLab,
  CalibrationReportFields,
  FieldConfidence,
  GcalInternalFields,
  ReportFieldKey,
} from "../../types";
import { looksLikeGiaReportText } from "../../gia-proportions";
import {
  applyGcal8xFinishGrades,
  extractGcal8xFinishGrades,
  extractGcal8xFinishGradesWithAudit,
  logGcal8xFinishOcrCheck,
  type Gcal8xFinishGrades,
} from "./gcal-finish";
import {
  applyGcal8xGradingIslands,
  applyGcal8xProportionIslands,
  extractGcal8xGradingIslands,
  extractGcal8xProportionGirdle,
  extractGcal8xProportionIslands,
  prepareGcal8xProportionDiagramText,
} from "./gcal-8x";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { isOcrRuntimeAvailable, ocrImageBuffer, renderPdfPagePngAtScale, renderUploadImageAsPage } from "../shared/ocr-utils";
import {
  SARINE_4CS_GRADING_PANEL_CROP,
  SARINE_4CS_GRADING_PANEL_WIDE_CROP,
} from "./gcal-sarine-image-ocr";
import {
  looksLikeGcal8xCertificateProbeText,
  looksLikeGcal8xReportText,
  hasStrongGcal8xDeferEvidence,
} from "./gcal-layout-detector";

const GCAL_PAGE_OCR_SCALE = 4;
const REGION_PREVIEW_CHARS = 300;
const GCAL_CROP_DEBUG_DIR = "data/light-performance-calibration/debug/gcal";
const GCAL_CROP_DEBUG_REPORT = "LG353466126";

export function shouldExportGcalCropDebug(reportNumber?: string): boolean {
  if (process.env.CALIBRATION_EXTRACT_DEBUG === "1") return true;
  const rn = reportNumber?.trim() ?? "";
  return rn.includes(GCAL_CROP_DEBUG_REPORT) || rn.includes("353466126");
}

function gcalCropDebugBasename(reportNumber?: string): string {
  const rn = reportNumber?.trim() ?? "";
  if (rn.includes("353466126")) return GCAL_CROP_DEBUG_REPORT;
  const safe = rn.replace(/[^\w-]+/g, "").slice(0, 40);
  return safe || "gcal-debug";
}

async function exportGcalCropDebugPngs(
  basename: string,
  pagePng: Buffer,
  proportionPng: Buffer | null,
  finishPng: Buffer | null,
): Promise<void> {
  const dir = join(process.cwd(), GCAL_CROP_DEBUG_DIR);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, `${basename}-page.png`), pagePng);
  if (proportionPng) {
    await writeFile(
      join(dir, `${basename}-proportion-crop.png`),
      proportionPng,
    );
  }
  if (finishPng) {
    await writeFile(join(dir, `${basename}-finish-crop.png`), finishPng);
  }
}

export function shouldRunGcalImageRegionOcr(
  fields: CalibrationReportFields,
  opts: {
    parserType?: string;
    lab?: CalibrationLab;
    gcalImageOnlyPdf?: boolean;
    labHint?: string;
    combinedText?: string;
  },
): boolean {
  if (opts.parserType === "gcal-sarine-4cs") return false;
  if (looksLikeGiaReportText(opts.combinedText ?? "")) return false;
  const isGcal =
    opts.parserType === "gcal-8x" ||
    opts.lab === "GCAL" ||
    opts.labHint === "GCAL";
  if (!isGcal) return false;
  if (opts.gcalImageOnlyPdf) return true;
  return needsGcalImageRegionOcrFallback(fields, {
    parserType: opts.parserType,
    lab: opts.lab,
  });
}

/** Bottom-right proportion diagram — depth %, pavilion angle, lower-half (GCAL 8X). */
const PROPORTION_DIAGRAM_CROP = {
  left: 0.5,
  top: 0.53,
  width: 0.48,
  height: 0.43,
} as const;

/** Certificate header band — image-only GCAL 8X PDF probe (LG353306143). */
export const GCAL_8X_IMAGE_ONLY_PROBE_CROP = {
  left: 0.45,
  top: 0.08,
  width: 0.52,
  height: 0.12,
} as const;

/** Top-right 8X grade table — Polish / External Symmetry / Proportions rows. */
const FINISH_GRADES_CROP = {
  // Slightly wider to include the rightmost "EX Excellent" column reliably.
  left: 0.53,
  top: 0.11,
  width: 0.46,
  height: 0.34,
} as const;

const GCAL_CROP_ACTION =
  "proportion crop moved to bottom-right diagram; finish crop moved to top-right 8X table; gcal-only OCR preprocess (grayscale/contrast/sharpen)";

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

export type GcalImageRegionOcrTexts = {
  proportionRegionText: string;
  finishRegionText: string;
  ok: boolean;
};

export function needsGcalImageRegionOcrFallback(
  fields: CalibrationReportFields,
  opts: { parserType?: string; lab?: CalibrationLab },
): boolean {
  const isGcal = opts.parserType === "gcal-8x" || opts.lab === "GCAL";
  if (!isGcal) return false;

  const proportionMissing =
    !fields.depthPercent.trim() ||
    !fields.crownAngle.trim() ||
    !fields.pavilionAngle.trim();
  const finishMissing =
    !fields.polish.trim() ||
    !fields.symmetry.trim() ||
    !fields.cutGrade.trim();
  const girdleMissing = !fields.girdle.trim();

  return proportionMissing || finishMissing || girdleMissing;
}

/** GCAL crop OCR only — grayscale, contrast, mild sharpen (not used on full-page OCR). */
async function preprocessGcalCropPng(png: Buffer): Promise<Buffer> {
  try {
    const { createCanvas, loadImage } = await import("@napi-rs/canvas");
    const img = await loadImage(png);
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);
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
        // Avoid hard binarization: the 8X finish table uses colored pills (e.g. red "EX Excellent")
        // which can become unreadable if thresholded.
        const bin = v;
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

function assessGcalCropOcr(
  proportionText: string,
  finishText: string,
  actionTaken: string,
): void {
  console.log("[GCAL CROP ASSESSMENT]", {
    proportionCropHasDepthArea:
      /61\.1|611|depth/i.test(proportionText) ||
      /\b6[01]\s*\.?\s*1?\s*%/.test(proportionText),
    proportionCropHasPavilionArea:
      /40\.8|408|pavilion/i.test(proportionText) ||
      /4[01]\s*\.?\s*8\s*°/.test(proportionText),
    finishCropHasGradeRows:
      /polish/i.test(finishText) &&
      /symmetry/i.test(finishText) &&
      (/excellent/i.test(finishText) || /\bex\b/i.test(finishText)),
    actionTaken,
  });
}

async function ocrGcalCropBuffer(png: Buffer): Promise<{ text: string; ok: boolean }> {
  const prepped = await preprocessGcalCropPng(png);
  return ocrImageBuffer(prepped);
}

export type Gcal8xImageOnlyPdfProbeResult = {
  detected: boolean;
  probeText: string;
};

/** Shared cert-band OCR — PDF image-only probe and upload image format probe. */
export async function probeGcal8xCertificateRegionFromRenderedPage(rendered: {
  png: Buffer;
  width: number;
  height: number;
}): Promise<Gcal8xImageOnlyPdfProbeResult> {
  const miss = { detected: false, probeText: "" };

  const probePng = await cropPageRegionPng(
    rendered.png,
    rendered.width,
    rendered.height,
    GCAL_8X_IMAGE_ONLY_PROBE_CROP,
  );
  if (!probePng) return miss;

  const ocr = await ocrGcalCropBuffer(probePng);
  const probeText = ocr.text.trim();
  if (!probeText || !ocr.ok) return miss;

  return {
    detected: hasStrongGcal8xDeferEvidence(probeText),
    probeText,
  };
}

/** Fast HEADER_TINY OCR — client image-only PDFs before full-page OCR. */
export async function probeGcal8xImageOnlyPdf(
  pdfBytes: Buffer,
): Promise<Gcal8xImageOnlyPdfProbeResult> {
  const miss = { detected: false, probeText: "" };
  if (!(await isOcrRuntimeAvailable())) return miss;

  const rendered = await renderPdfPagePngAtScale(pdfBytes, 1, 3);
  if (!rendered) return miss;

  return probeGcal8xCertificateRegionFromRenderedPage(rendered);
}

/** Cert-band OCR for uploaded images — mirrors probeGcal8xImageOnlyPdf crop/OCR. */
export async function probeGcal8xCertificateRegionFromImage(
  imageBytes: Buffer,
): Promise<Gcal8xImageOnlyPdfProbeResult> {
  const miss = { detected: false, probeText: "" };
  if (!(await isOcrRuntimeAvailable())) return miss;

  const rendered = await renderUploadImageAsPage(imageBytes);
  if (!rendered) return miss;

  return probeGcal8xCertificateRegionFromRenderedPage(rendered);
}

async function cropPageRegionPng(
  pagePng: Buffer,
  pageWidth: number,
  pageHeight: number,
  crop: PercentCrop,
): Promise<Buffer | null> {
  try {
    const { createCanvas, loadImage } = await import("@napi-rs/canvas");
    const img = await loadImage(pagePng);
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
    const canvas = createCanvas(w, h);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, sx, sy, w, h, 0, 0, w, h);
    return canvas.toBuffer("image/png");
  } catch {
    return null;
  }
}

/** Repair collapsed GCAL 8X grading header tokens from region OCR (e.g. RB 3.28 DFL). */
function repairGcal8xGradingPanelOcrText(text: string): string {
  return text.replace(
    /\bRB\s+(\d+\.\d+)\s+([D-Z])(FL|IF|VVS1|VVS2|VS1|VS2|SI1|SI2|I1|I2|I3)\b/gi,
    (_m, carat: string, color: string, clarity: string) =>
      `RB ${carat} ${color} ${clarity}`,
  );
}

export async function ocrGcal8xPdfRegions(
  pdfBytes: Buffer,
  opts?: {
    reportNumber?: string;
    lazySecondPage?: boolean;
    /** Client budget: never OCR page 2. */
    clientOnlyFirstPage?: boolean;
    imageUpload?: boolean;
    combinedText?: string;
  },
): Promise<GcalImageRegionOcrTexts> {
  const empty: GcalImageRegionOcrTexts = {
    proportionRegionText: "",
    finishRegionText: "",
    ok: false,
  };

  if (!(await isOcrRuntimeAvailable())) return empty;

  const scoreRegionTexts = (proportionText: string, finishText: string): number => {
    const proportionOk =
      /61\.1|611|depth/i.test(proportionText) ||
      /\b6[01]\s*\.?\s*1?\s*%/.test(proportionText) ||
      /40\.8|408|pavilion/i.test(proportionText);
    const finishOk =
      /polish/i.test(finishText) &&
      /symmetry/i.test(finishText) &&
      (/excellent/i.test(finishText) || /\bex\b/i.test(finishText));
    return (proportionOk ? 1 : 0) + (finishOk ? 1 : 0);
  };

  const renderScale = opts?.clientOnlyFirstPage ? 3 : GCAL_PAGE_OCR_SCALE;

  const needsGradingPanelOcr = (text: string) =>
    !/\bcolou?r\s+[D-Z]\b/i.test(text) ||
    !/\bclarity\s+(?:FL|IF|VVS\s*1|VVS\s*2|VS\s*1|VS\s*2|SI\s*1|SI\s*2|I\s*1|I\s*2|I\s*3|VVS1|VVS2|VS1|VS2|SI1|SI2|I1|I2|I3)\b/i.test(
      text,
    );

  const ocrImageUploadPage = async () => {
    const imagePage = await renderUploadImageAsPage(pdfBytes);
    if (!imagePage) return null;
    const rendered = {
      png: imagePage.png,
      width: imagePage.width,
      height: imagePage.height,
    };
    const runGradingPanel = needsGradingPanelOcr(opts?.combinedText ?? "");
    const [proportionPng, finishPng, gradingPng] = await Promise.all([
      cropPageRegionPng(
        rendered.png,
        rendered.width,
        rendered.height,
        PROPORTION_DIAGRAM_CROP,
      ),
      cropPageRegionPng(
        rendered.png,
        rendered.width,
        rendered.height,
        FINISH_GRADES_CROP,
      ),
      runGradingPanel
        ? cropPageRegionPng(
            rendered.png,
            rendered.width,
            rendered.height,
            SARINE_4CS_GRADING_PANEL_CROP,
          )
        : Promise.resolve(null),
    ]);
    const ocrJobs: Promise<{ text: string; ok: boolean }>[] = [
      proportionPng
        ? ocrGcalCropBuffer(proportionPng)
        : Promise.resolve({ text: "", ok: false }),
      finishPng
        ? ocrGcalCropBuffer(finishPng)
        : Promise.resolve({ text: "", ok: false }),
    ];
    if (gradingPng) {
      ocrJobs.push(ocrGcalCropBuffer(gradingPng));
    }
    const ocrResults = await Promise.all(ocrJobs);
    const proportionOcr = ocrResults[0]!;
    const finishOcr = ocrResults[1]!;
    let gradingPanelText = gradingPng ? (ocrResults[2]?.text.trim() ?? "") : "";
    if (
      runGradingPanel &&
      gradingPanelText &&
      needsGradingPanelOcr(gradingPanelText)
    ) {
      const wideGradingPng = await cropPageRegionPng(
        rendered.png,
        rendered.width,
        rendered.height,
        SARINE_4CS_GRADING_PANEL_WIDE_CROP,
      );
      if (wideGradingPng) {
        const wideGradingOcr = await ocrGcalCropBuffer(wideGradingPng);
        if (wideGradingOcr.text.trim()) {
          gradingPanelText = [gradingPanelText, wideGradingOcr.text.trim()]
            .filter(Boolean)
            .join("\n");
        }
      }
    }
    const proportionRegionText = proportionOcr.text.trim();
    const finishRegionText = repairGcal8xGradingPanelOcrText(
      [gradingPanelText, finishOcr.text.trim()].filter(Boolean).join("\n\n"),
    );
    return {
      rendered,
      proportionPng,
      finishPng,
      proportionRegionText,
      finishRegionText,
      ok:
        (proportionOcr.ok && proportionRegionText.length > 0) ||
        (finishOcr.ok && finishOcr.text.trim().length > 0) ||
        gradingPanelText.length > 0,
      score: scoreRegionTexts(proportionRegionText, finishOcr.text.trim()),
      page: 1,
    };
  };

  const ocrPage = async (page: number) => {
    if (opts?.imageUpload) {
      return ocrImageUploadPage();
    }
    const rendered = await renderPdfPagePngAtScale(pdfBytes, page, renderScale);
    if (!rendered) return null;

    const proportionPng = await cropPageRegionPng(
      rendered.png,
      rendered.width,
      rendered.height,
      PROPORTION_DIAGRAM_CROP,
    );
    const finishPng = await cropPageRegionPng(
      rendered.png,
      rendered.width,
      rendered.height,
      FINISH_GRADES_CROP,
    );

    const [proportionOcr, finishOcr] = await Promise.all([
      proportionPng
        ? ocrGcalCropBuffer(proportionPng)
        : Promise.resolve({ text: "", ok: false }),
      finishPng ? ocrGcalCropBuffer(finishPng) : Promise.resolve({ text: "", ok: false }),
    ]);

    const proportionRegionText = proportionOcr.text.trim();
    const finishRegionText = finishOcr.text.trim();

    return {
      rendered,
      proportionPng,
      finishPng,
      proportionRegionText,
      finishRegionText,
      ok:
        (proportionOcr.ok && proportionRegionText.length > 0) ||
        (finishOcr.ok && finishRegionText.length > 0),
      score: scoreRegionTexts(proportionRegionText, finishRegionText),
      page,
    };
  };

  const page1 = await ocrPage(1);
  const page2 =
    opts?.imageUpload || opts?.clientOnlyFirstPage
      ? null
      : opts?.lazySecondPage && page1 && page1.score >= 2
        ? null
        : await ocrPage(2);

  const best =
    page1 && page2 ? (page2.score > page1.score ? page2 : page1) : page1 ?? page2;
  if (!best) return empty;

  assessGcalCropOcr(best.proportionRegionText, best.finishRegionText, `${GCAL_CROP_ACTION} (page=${best.page})`);

  if (shouldExportGcalCropDebug(opts?.reportNumber)) {
    await exportGcalCropDebugPngs(
      gcalCropDebugBasename(opts?.reportNumber),
      best.rendered.png,
      best.proportionPng,
      best.finishPng,
    );
  }

  return {
    proportionRegionText: best.proportionRegionText,
    finishRegionText: best.finishRegionText,
    ok: best.ok,
  };
}

function collectRecovered(
  before: CalibrationReportFields,
  after: CalibrationReportFields,
): Record<string, string> {
  const keys: ReportFieldKey[] = [
    "depthPercent",
    "crownAngle",
    "pavilionAngle",
    "girdle",
    "polish",
    "symmetry",
    "cutGrade",
    "tablePercent",
    "starLengthPercent",
    "lowerHalfPercent",
  ];
  const out: Record<string, string> = {};
  for (const key of keys) {
    if (!before[key].trim() && after[key].trim()) {
      out[key] = after[key].trim();
    }
  }
  return out;
}

/**
 * OCR cropped page regions and merge into fields — only fills values still empty.
 */
export async function applyGcal8xImageRegionOcrFallback(
  pdfBytes: Buffer,
  fields: CalibrationReportFields,
  internal: GcalInternalFields,
  set: FieldSetter,
  opts?: {
    reportNumber?: string;
    combinedText?: string;
    lazySecondPage?: boolean;
    clientOnlyFirstPage?: boolean;
    imageUpload?: boolean;
  },
): Promise<{
  proportionRegionLength: number;
  finishRegionLength: number;
  recoveredFields: Record<string, string>;
  proportionRegionText: string;
  finishRegionText: string;
}> {
  const before = { ...fields };
  const regions = await ocrGcal8xPdfRegions(pdfBytes, {
    reportNumber: opts?.reportNumber,
    lazySecondPage: opts?.lazySecondPage,
    clientOnlyFirstPage: opts?.clientOnlyFirstPage,
    imageUpload: opts?.imageUpload,
    combinedText: opts?.combinedText,
  });

  if (regions.proportionRegionText) {
    const prepared = prepareGcal8xProportionDiagramText(
      regions.proportionRegionText,
    );
    const proportionIslands = extractGcal8xProportionIslands(
      regions.proportionRegionText,
    );
    const girdleFromRegion = extractGcal8xProportionGirdle(
      regions.proportionRegionText,
      prepared,
    );

    if (
      girdleFromRegion.girdleThicknessPercent &&
      !proportionIslands.girdleThicknessPercent
    ) {
      proportionIslands.girdleThicknessPercent =
        girdleFromRegion.girdleThicknessPercent;
    }

    applyGcal8xProportionIslands(proportionIslands, fields, set, internal);

    const girdleThickness =
      internal.girdleThicknessPercent ??
      proportionIslands.girdleThicknessPercent ??
      girdleFromRegion.girdleThicknessPercent;
    if (girdleThickness && !internal.girdleThicknessPercent) {
      internal.girdleThicknessPercent = girdleThickness;
    }

    if (girdleFromRegion.girdlePhrase && !fields.girdle.trim()) {
      set("girdle", girdleFromRegion.girdlePhrase, "high");
    }
  }

  let recoveredFinishGrades: Gcal8xFinishGrades = {};
  if (regions.finishRegionText) {
    const finishAudit = extractGcal8xFinishGradesWithAudit(
      regions.finishRegionText,
    );
    recoveredFinishGrades = {
      polish: finishAudit.polish,
      symmetry: finishAudit.symmetry,
      cutGrade: finishAudit.cutGrade,
    };
    applyGcal8xFinishGrades(recoveredFinishGrades, fields, set);
    logGcal8xFinishOcrCheck({
      cropRegion: FINISH_GRADES_CROP,
      ocrPreview: regions.finishRegionText.slice(0, REGION_PREVIEW_CHARS),
      finishCandidates: recoveredFinishGrades,
      rejectedGenericScale: finishAudit.rejected,
      assigned: {
        polish: fields.polish.trim() || undefined,
        symmetry: fields.symmetry.trim() || undefined,
        cutGrade: fields.cutGrade.trim() || undefined,
      },
      confidence: {
        polish: fields.polish.trim() ? "high-from-finish-crop" : "missing",
        symmetry: fields.symmetry.trim() ? "high-from-finish-crop" : "missing",
        cutGrade: fields.cutGrade.trim() ? "high-from-finish-crop" : "missing",
      },
    });
  }

  if (opts?.combinedText?.trim()) {
    // Hard guard: do not use full-page OCR/text as a fallback for finish/cut grades.
    // Those regions frequently contain generic grading scales ("Poor/Fair/Good/Very Good/Excellent")
    // which must never populate report-specific finish values.
  }

  const recoveredFields = collectRecovered(before, fields);

  logGcalImageOcrCheck({
    proportionRegionLength: regions.proportionRegionText.length,
    finishRegionLength: regions.finishRegionText.length,
    proportionRegionPreview: regions.proportionRegionText.slice(
      0,
      REGION_PREVIEW_CHARS,
    ),
    finishRegionPreview: regions.finishRegionText.slice(0, REGION_PREVIEW_CHARS),
    recoveredFields,
    recoveredFinishGrades: {
      polish: recoveredFinishGrades.polish ?? "",
      symmetry: recoveredFinishGrades.symmetry ?? "",
      cutGrade: recoveredFinishGrades.cutGrade ?? "",
    },
  });

  return {
    proportionRegionLength: regions.proportionRegionText.length,
    finishRegionLength: regions.finishRegionText.length,
    recoveredFields,
    proportionRegionText: regions.proportionRegionText,
    finishRegionText: regions.finishRegionText,
  };
}

export function logGcalImageOcrCheck(payload: {
  proportionRegionLength: number;
  finishRegionLength: number;
  proportionRegionPreview?: string;
  finishRegionPreview?: string;
  recoveredFields: Record<string, string>;
  recoveredFinishGrades?: {
    polish: string;
    symmetry: string;
    cutGrade: string;
  };
}): void {
  console.log("[GCAL IMAGE OCR CHECK]", payload);
}
