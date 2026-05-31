import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import {
  isForensicCollectionEnabled,
  pushForensicSnapshot,
} from "../../extraction-forensic-collector";
import type {
  CalibrationReportFields,
  FieldConfidence,
  GiaInternalFields,
  ReportFieldKey,
} from "../../types";
import {
  applyGiaOcrFieldHydrationFallback,
  extractGiaFallbackDiagramBlock,
  extractGiaGirdleFromFacsimileGradingResultsFragment,
  extractGiaOcrProportionDiagram,
  fixGiaOcrDegreeNumerals,
  giaProportionDiagramFieldsMissing,
  girdleCompletenessScore,
  normalizeGiaProportionBlockText,
  looksLikeGiaReportText,
  needsGiaProportionOcrSupplement,
  probeGiaLiveFieldCandidates,
} from "../../gia-proportions";
import { applyGiaProportionDiagramExtraction } from "./gia-diagram-extraction";
import type { OcrResult } from "../shared/ocr-utils";
import { isOcrRuntimeAvailable, ocrImageBuffer, renderPdfPagePngAtScale } from "../shared/ocr-utils";

const GIA_PAGE_OCR_SCALE = 5;
const GIA_FULL_PAGE_OCR_SCALE = 6;
const GIA_GIRDLE_BAND_SCALE = 6;
const REGION_PREVIEW_CHARS = 400;
const GIA_CROP_DEBUG_DIR = "data/light-performance-calibration/debug/gia";
const GIA_CROP_DEBUG_REPORT = "2527039693";

/** Left grading-results proportion labels (when not merged into diagram). */
export const GIA_FACSIMILE_GRADING_RESULTS_CROP = {
  left: 0.04,
  top: 0.38,
  width: 0.48,
  height: 0.38,
} as const;

/** Right-side proportion stack — pavilion angle + depth (live anchor). */
export const GIA_FACSIMILE_PROPORTION_STACK_CROP = {
  left: 0.52,
  top: 0.28,
  width: 0.44,
  height: 0.22,
} as const;

/** Narrow band for girdle phrase under GRADING RESULTS (faceted) line. */
export const GIA_FACSIMILE_GIRDLE_BAND_CROP = {
  left: 0.06,
  top: 0.36,
  width: 0.58,
  height: 0.12,
} as const;

/** Left grading-results column (girdle label often left of diagram). */
export const GIA_FACSIMILE_LEFT_GRADING_CROP = {
  left: 0.02,
  top: 0.5,
  width: 0.46,
  height: 0.22,
} as const;

/** @deprecated Use GIA_FACSIMILE_GRADING_RESULTS_CROP */
export const GIA_FACSIMILE_GRADING_PANEL_CROP = GIA_FACSIMILE_GRADING_RESULTS_CROP;

/** @deprecated Use GIA_FACSIMILE_PROPORTION_STACK_CROP */
export const GIA_FACSIMILE_INLINE_RESULTS_CROP = GIA_FACSIMILE_PROPORTION_STACK_CROP;

/** @deprecated Diagram crop — avoid security texture at bottom */
export const GIA_FACSIMILE_DIAGRAM_CROP = {
  left: 0.52,
  top: 0.22,
  width: 0.46,
  height: 0.38,
} as const;

export const GIA_FACSIMILE_OCR_CROPS = [
  GIA_FACSIMILE_PROPORTION_STACK_CROP,
  GIA_FACSIMILE_GIRDLE_BAND_CROP,
  GIA_FACSIMILE_GRADING_RESULTS_CROP,
] as const;

type PercentCrop = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type GiaCropPass = {
  id: string;
  crop: PercentCrop;
  preprocess: "raw" | "contrast" | "threshold";
  scale?: number;
};

const GIA_FACSIMILE_CROP_PASSES: GiaCropPass[] = [
  { id: "stack", crop: GIA_FACSIMILE_PROPORTION_STACK_CROP, preprocess: "raw" },
  { id: "stack-contrast", crop: GIA_FACSIMILE_PROPORTION_STACK_CROP, preprocess: "contrast" },
  { id: "girdle-band", crop: GIA_FACSIMILE_GIRDLE_BAND_CROP, preprocess: "threshold", scale: GIA_GIRDLE_BAND_SCALE },
  { id: "girdle-band-contrast", crop: GIA_FACSIMILE_GIRDLE_BAND_CROP, preprocess: "contrast", scale: GIA_GIRDLE_BAND_SCALE },
  { id: "grading-results", crop: GIA_FACSIMILE_GRADING_RESULTS_CROP, preprocess: "contrast" },
  {
    id: "left-grading",
    crop: GIA_FACSIMILE_LEFT_GRADING_CROP,
    preprocess: "threshold",
    scale: GIA_FULL_PAGE_OCR_SCALE,
  },
  {
    id: "left-grading-contrast",
    crop: GIA_FACSIMILE_LEFT_GRADING_CROP,
    preprocess: "contrast",
    scale: GIA_FULL_PAGE_OCR_SCALE,
  },
];

type FieldSetter = (
  key: ReportFieldKey,
  value: string,
  level: FieldConfidence,
) => void;

export type GiaDiagramOcrGate = {
  run: boolean;
  reason: string;
};

export function shouldExportGiaCropDebug(reportNumber?: string): boolean {
  if (process.env.CALIBRATION_EXTRACT_DEBUG === "1") return true;
  const rn = reportNumber?.trim() ?? "";
  return rn.includes(GIA_CROP_DEBUG_REPORT) || rn.includes("2527039693");
}

function giaCropDebugBasename(reportNumber?: string): string {
  const rn = reportNumber?.trim() ?? "";
  if (rn.includes("2527039693")) return GIA_CROP_DEBUG_REPORT;
  const safe = rn.replace(/[^\w-]+/g, "").slice(0, 40);
  return safe || "gia-debug";
}

export function shouldRunGiaFacsimileDiagramImageOcr(
  fields: CalibrationReportFields,
  combinedText: string,
  opts: { parserType?: string; lab?: string },
): GiaDiagramOcrGate {
  const isGia =
    opts.lab === "GIA" ||
    Boolean(opts.parserType?.startsWith("gia"));
  if (!isGia) {
    return { run: false, reason: "not-gia-lab-or-parser" };
  }
  if (!looksLikeGiaReportText(combinedText)) {
    const lgdrHint =
      /laboratory[-\s]*grown/i.test(combinedText) && /dossier/i.test(combinedText);
    if (!lgdrHint) {
      return { run: false, reason: "text-does-not-look-like-gia-report" };
    }
  }

  const missingPavilion = !fields.pavilionAngle.trim();
  const missingGirdle = !fields.girdle.trim();
  const missingCore = giaProportionDiagramFieldsMissing(fields);

  const lgdrDossier =
    /laboratory[-\s]*grown\s+diamond\s+report[\s\S]{0,160}dossier/i.test(
      combinedText,
    ) || /\bLGDR\b/i.test(combinedText);

  const facsimileTable =
    needsGiaProportionOcrSupplement(combinedText) ||
    (/\bfacsimile\b/i.test(combinedText) &&
      /\bcut\s+grade\b/i.test(combinedText));
  const gradingTableWithoutDiagram =
    /\bgia\s+report\s+number\b/i.test(combinedText) &&
    /\bcarat\s+weight\b/i.test(combinedText) &&
    /\bcut\s+grade\b/i.test(combinedText) &&
    missingCore;

  if (lgdrDossier && missingCore) {
    return { run: true, reason: "gia-lgdr-dossier-missing-diagram-fields" };
  }

  if (facsimileTable && missingCore) {
    return {
      run: true,
      reason: missingPavilion
        ? "gia-facsimile-missing-core-proportions"
        : missingGirdle
          ? "gia-facsimile-missing-girdle-or-core"
          : "gia-facsimile-missing-diagram-fields",
    };
  }

  if (gradingTableWithoutDiagram && (missingPavilion || missingGirdle)) {
    return {
      run: true,
      reason: "gia-grading-table-partial-diagram-missing-core",
    };
  }

  if (!missingPavilion && !missingGirdle) {
    return { run: false, reason: "pavilion-and-girdle-already-populated" };
  }

  return { run: false, reason: "gate-closed-not-facsimile-or-partial-diagram" };
}

async function preprocessGiaContrastCropPng(png: Buffer): Promise<Buffer> {
  try {
    const { createCanvas, loadImage } = await import("@napi-rs/canvas");
    const img = await loadImage(png);
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);
    const { width, height } = canvas;
    const src = ctx.getImageData(0, 0, width, height);
    const d = src.data;
    for (let i = 0; i < d.length; i += 4) {
      const gray =
        0.299 * d[i]! + 0.587 * d[i + 1]! + 0.114 * d[i + 2]!;
      const boosted = Math.min(255, gray * 1.12 + 8);
      d[i] = d[i + 1] = d[i + 2] = boosted;
    }
    ctx.putImageData(src, 0, 0);
    return canvas.toBuffer("image/png");
  } catch {
    return png;
  }
}

async function preprocessGiaThresholdCropPng(png: Buffer): Promise<Buffer> {
  try {
    const { createCanvas, loadImage } = await import("@napi-rs/canvas");
    const img = await loadImage(png);
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);
    const { width, height } = canvas;
    const src = ctx.getImageData(0, 0, width, height);
    const d = src.data;
    for (let i = 0; i < d.length; i += 4) {
      const gray =
        0.299 * d[i]! + 0.587 * d[i + 1]! + 0.114 * d[i + 2]!;
      const v = gray > 168 ? 255 : 0;
      d[i] = d[i + 1] = d[i + 2] = v;
    }
    ctx.putImageData(src, 0, 0);
    return canvas.toBuffer("image/png");
  } catch {
    return png;
  }
}

async function preprocessGiaCropPng(
  png: Buffer,
  mode: GiaCropPass["preprocess"],
): Promise<Buffer> {
  if (mode === "raw") return png;
  if (mode === "threshold") return preprocessGiaThresholdCropPng(png);
  return preprocessGiaContrastCropPng(png);
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

export type GiaCropOcrPassResult = {
  id: string;
  crop: PercentCrop;
  preprocess: GiaCropPass["preprocess"];
  page: number;
  scale: number;
  width: number;
  height: number;
  text: string;
};

/** Full-page facsimile OCR at diagram-friendly scale (default pdf OCR uses scale 2). */
export async function ocrGiaFacsimileFullPages(pdfBytes: Buffer): Promise<OcrResult> {
  if (!(await isOcrRuntimeAvailable())) {
    return { text: "", ok: false, error: "OCR not available" };
  }
  const parts: string[] = [];
  for (let page = 1; page <= 2; page++) {
    const rendered = await renderPdfPagePngAtScale(
      pdfBytes,
      page,
      GIA_FULL_PAGE_OCR_SCALE,
    );
    if (!rendered) continue;
    const ocr = await ocrImageBuffer(rendered.png);
    if (ocr.text.trim()) parts.push(ocr.text.trim());
    if (
      page === 1 &&
      /\b40\.8\b|\bgirdle\b/i.test(ocr.text) &&
      /\bsligh\w*\s+thick\b/i.test(ocr.text)
    ) {
      break;
    }
  }
  const text = parts.join("\n\n");
  return { text, ok: text.length > 0 };
}

export async function ocrGiaFacsimileDiagramRegion(
  pdfBytes: Buffer,
): Promise<{
  text: string;
  ok: boolean;
  cropTexts: string[];
  passResults: GiaCropOcrPassResult[];
}> {
  if (!(await isOcrRuntimeAvailable())) {
    return { text: "", ok: false, cropTexts: [], passResults: [] };
  }

  const passResults: GiaCropOcrPassResult[] = [];
  const cropTexts: string[] = [];

  for (let page = 1; page <= 2; page++) {
    const scale = GIA_PAGE_OCR_SCALE;
    const rendered = await renderPdfPagePngAtScale(pdfBytes, page, scale);
    if (!rendered) continue;

    for (const pass of GIA_FACSIMILE_CROP_PASSES) {
      const passScale = pass.scale ?? scale;
      const pagePng =
        passScale === scale
          ? rendered.png
          : (await renderPdfPagePngAtScale(pdfBytes, page, passScale))?.png;
      if (!pagePng) continue;

      const pageMeta =
        passScale === scale
          ? rendered
          : await renderPdfPagePngAtScale(pdfBytes, page, passScale);
      if (!pageMeta) continue;

      const png = await cropPageRegionPng(
        pageMeta.png,
        pageMeta.width,
        pageMeta.height,
        pass.crop,
      );
      if (!png) continue;

      const rawOcr = await ocrImageBuffer(png);
      if (rawOcr.text.trim()) {
        passResults.push({
          id: `${pass.id}-p${page}-raw`,
          crop: pass.crop,
          preprocess: "raw",
          page,
          scale: passScale,
          width: Math.floor(pass.crop.width * pageMeta.width),
          height: Math.floor(pass.crop.height * pageMeta.height),
          text: rawOcr.text.trim(),
        });
        cropTexts.push(rawOcr.text.trim());
      }

      const prepped = await preprocessGiaCropPng(png, pass.preprocess);
      const ocr = await ocrImageBuffer(prepped);
      if (!ocr.text.trim()) continue;
      passResults.push({
        id: `${pass.id}-p${page}`,
        crop: pass.crop,
        preprocess: pass.preprocess,
        page,
        scale: passScale,
        width: Math.floor(pass.crop.width * pageMeta.width),
        height: Math.floor(pass.crop.height * pageMeta.height),
        text: ocr.text.trim(),
      });
      cropTexts.push(ocr.text.trim());
    }

    if (page === 1 && cropTexts.length > 0) break;
  }

  const text = [...new Set(cropTexts)].join("\n\n");
  return { text, ok: text.length > 0, cropTexts, passResults };
}

async function exportGiaCropDebugArtifacts(
  basename: string,
  pagePng: Buffer,
  passResults: GiaCropOcrPassResult[],
): Promise<void> {
  const dir = join(process.cwd(), GIA_CROP_DEBUG_DIR, basename);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "page1-full.png"), pagePng);
  for (const pass of passResults) {
    const safeId = pass.id.replace(/[^\w-]+/g, "_");
    await writeFile(
      join(dir, `${safeId}-ocr.txt`),
      pass.text,
      "utf8",
    );
  }
}

export type GiaOcrVisualPassLog = {
  id: string;
  page: number;
  scale: number;
  preprocess: string;
  cropCoords: PercentCrop;
  cropDimensions: { width: number; height: number };
  ocrTextPreview: string;
  pavilionCandidate: string | null;
  girdleCandidate: string | null;
};

export type GiaDiagramOcrCheckPayload = {
  reportNumber?: string;
  triggered: boolean;
  reason: string;
  cropCoordinates: readonly PercentCrop[];
  ocrRawPreview: string;
  repairedOcrPreview: string;
  candidatesFound: Record<string, string>;
  assignmentsMade: Record<string, string>;
  rejectedCandidates: Array<{ candidate: string; reason: string }>;
  cropOcrPreviews?: string[];
  visualPasses?: GiaOcrVisualPassLog[];
  durationMs: number;
  timedOut: boolean;
};

export function logGiaDiagramOcrCheck(payload: GiaDiagramOcrCheckPayload): void {
  console.log("[GIA DIAGRAM OCR CHECK]", payload);
  if (isForensicCollectionEnabled()) {
    pushForensicSnapshot(
      "gia-facsimile",
      "diagram-ocr",
      payload as unknown as Record<string, unknown>,
    );
  }
}

export function logGiaOcrVisualCheck(
  reportNumber: string | undefined,
  passes: GiaOcrVisualPassLog[],
): void {
  console.log("[GIA OCR VISUAL CHECK]", { reportNumber, passes });
}

function assignGiaFacsimileCropFields(
  ocrText: string,
  combinedText: string,
  fields: CalibrationReportFields,
  giaInternal: GiaInternalFields | undefined,
  set: FieldSetter,
  crownAngle: string,
): {
  assignmentsMade: Record<string, string>;
  rejectedCandidates: Array<{ candidate: string; reason: string }>;
  candidatesFound: Record<string, string>;
} {
  const assignmentsMade: Record<string, string> = {};
  const rejectedCandidates: Array<{ candidate: string; reason: string }> = [];
  const candidatesFound: Record<string, string> = {};
  const before = { pavilionAngle: fields.pavilionAngle, girdle: fields.girdle };

  const searchTexts = [
    ocrText,
    combinedText,
    fixGiaOcrDegreeNumerals(ocrText),
    normalizeGiaProportionBlockText(ocrText),
  ];

  for (const src of searchTexts) {
    const probe = probeGiaLiveFieldCandidates(src, crownAngle);
    if (probe.pavilionCandidate) {
      candidatesFound.pavilionAngle = probe.pavilionCandidate;
    }
    if (probe.girdleCandidate) {
      candidatesFound.girdle = probe.girdleCandidate;
    }
    const frag = extractGiaGirdleFromFacsimileGradingResultsFragment(src);
    if (frag) candidatesFound.girdleFragment = frag;
  }

  extractGiaOcrProportionDiagram(ocrText, fields, set, giaInternal);
  applyGiaOcrFieldHydrationFallback(ocrText, fields, set);
  if (!fields.girdle.trim()) {
    for (const src of searchTexts) {
      const frag = extractGiaGirdleFromFacsimileGradingResultsFragment(src);
      if (frag && girdleCompletenessScore(frag) > girdleCompletenessScore(fields.girdle)) {
        set("girdle", frag, "medium");
        candidatesFound.girdleAssignedFrom = "facsimile-grading-results-fragment";
        break;
      }
    }
  }

  const mergedProbe = probeGiaLiveFieldCandidates(
    [combinedText, ocrText].join("\n\n"),
    crownAngle,
  );
  if (!fields.pavilionAngle.trim() && mergedProbe.pavilionCandidate) {
    const pav = mergedProbe.pavilionCandidate;
    if (pav === crownAngle) {
      rejectedCandidates.push({
        candidate: pav,
        reason: "pavilion-equals-crown-angle",
      });
    } else if (pav === "43") {
      rejectedCandidates.push({
        candidate: pav,
        reason: "pavilion-depth-not-angle",
      });
    } else {
      set("pavilionAngle", pav, "medium");
      candidatesFound.pavilionAngle = pav;
    }
  }

  if (!fields.girdle.trim() && mergedProbe.girdleCandidate) {
    const score = girdleCompletenessScore(mergedProbe.girdleCandidate);
    if (score < 5) {
      rejectedCandidates.push({
        candidate: mergedProbe.girdleCandidate,
        reason: "girdle-incomplete-phrase",
      });
    } else {
      set("girdle", mergedProbe.girdleCandidate, "medium");
    }
  }

  for (const key of ["pavilionAngle", "girdle"] as const) {
    if (fields[key].trim() && fields[key] !== before[key]) {
      assignmentsMade[key] = fields[key].trim();
    }
  }

  const loosePavilion = fixGiaOcrDegreeNumerals(ocrText).match(
    /\b40\s*\.?\s*8\s*(?:°|H|=)\b/i,
  );
  if (loosePavilion && !fields.pavilionAngle.trim()) {
    rejectedCandidates.push({
      candidate: "40.8° pavilion (loose OCR)",
      reason: "matched in crop OCR but not assigned by parser",
    });
  }

  return { assignmentsMade, rejectedCandidates, candidatesFound };
}

/**
 * Bounded GIA facsimile diagram crop OCR — pavilion angle + girdle only when missing.
 */
export async function applyGiaFacsimileDiagramImageOcr(
  pdfBytes: Buffer,
  combinedText: string,
  fields: CalibrationReportFields,
  giaInternal: GiaInternalFields | undefined,
  set: FieldSetter,
  opts?: { reportNumber?: string; parserPathUsed?: string },
): Promise<GiaDiagramOcrCheckPayload> {
  const started = Date.now();
  const gate = shouldRunGiaFacsimileDiagramImageOcr(fields, combinedText, {
    parserType: opts?.parserPathUsed,
    lab: "GIA",
  });

  const emptyPayload = (
    reason: string,
    triggered: boolean,
  ): GiaDiagramOcrCheckPayload => ({
    reportNumber: opts?.reportNumber,
    triggered,
    reason,
    cropCoordinates: GIA_FACSIMILE_OCR_CROPS,
    ocrRawPreview: "",
    repairedOcrPreview: "",
    candidatesFound: {},
    assignmentsMade: {},
    rejectedCandidates: [],
    durationMs: Date.now() - started,
    timedOut: false,
  });

  if (!gate.run) {
    logGiaDiagramOcrCheck(emptyPayload(gate.reason, false));
    return emptyPayload(gate.reason, false);
  }

  const before = { ...fields };
  const internal = giaInternal ?? {};

  extractGiaOcrProportionDiagram(combinedText, fields, set, internal);
  applyGiaOcrFieldHydrationFallback(combinedText, fields, set);

  const fallbackBlock = extractGiaFallbackDiagramBlock(combinedText);
  if (fallbackBlock.length >= 40) {
    const normFallback = normalizeGiaProportionBlockText(fallbackBlock);
    extractGiaOcrProportionDiagram(
      combinedText,
      fields,
      set,
      internal,
      normFallback,
      fallbackBlock,
    );
    applyGiaOcrFieldHydrationFallback(fallbackBlock, fields, set);
  }

  await applyGiaProportionDiagramExtraction(
    pdfBytes,
    combinedText,
    fields,
    internal,
    set,
    { reportNumber: opts?.reportNumber },
  );

  if (!giaProportionDiagramFieldsMissing(fields)) {
    const earlyDiagram: GiaDiagramOcrCheckPayload = {
      reportNumber: opts?.reportNumber,
      triggered: true,
      reason: `${gate.reason} (diagram-band-ocr)`,
      cropCoordinates: GIA_FACSIMILE_OCR_CROPS,
      ocrRawPreview: "",
      repairedOcrPreview: "",
      candidatesFound: {},
      assignmentsMade: Object.fromEntries(
        (["pavilionAngle", "girdle", "tablePercent", "depthPercent", "crownAngle"] as const)
          .filter((k) => before[k] !== fields[k] && fields[k].trim())
          .map((k) => [k, fields[k].trim()]),
      ),
      rejectedCandidates: [],
      durationMs: Date.now() - started,
      timedOut: false,
    };
    logGiaDiagramOcrCheck(earlyDiagram);
    return earlyDiagram;
  }

  const beforeTextScatter = { ...fields };

  const inlineBlock = combinedText.match(
    /(?:50|56|64)\s*%[\s\S]{0,320}?(?:75|80|50)\s*%/i,
  )?.[0];
  if (inlineBlock) {
    extractGiaOcrProportionDiagram(inlineBlock, fields, set, internal);
    applyGiaOcrFieldHydrationFallback(inlineBlock, fields, set);
  }

  if (!fields.girdle.trim()) {
    const frag = extractGiaGirdleFromFacsimileGradingResultsFragment(combinedText);
    if (frag) set("girdle", frag, "medium");
  }

  if (fields.pavilionAngle.trim() && fields.girdle.trim()) {
    const early: GiaDiagramOcrCheckPayload = {
      reportNumber: opts?.reportNumber,
      triggered: true,
      reason: `${gate.reason} (text-layer scatter)`,
      cropCoordinates: GIA_FACSIMILE_OCR_CROPS,
      ocrRawPreview: "",
      repairedOcrPreview: inlineBlock?.slice(0, REGION_PREVIEW_CHARS) ?? "",
      candidatesFound: {},
      assignmentsMade: {
        ...(beforeTextScatter.pavilionAngle !== fields.pavilionAngle
          ? { pavilionAngle: fields.pavilionAngle }
          : {}),
        ...(beforeTextScatter.girdle !== fields.girdle ? { girdle: fields.girdle } : {}),
      },
      rejectedCandidates: [],
      durationMs: Date.now() - started,
      timedOut: false,
    };
    logGiaDiagramOcrCheck(early);
    return early;
  }

  const ocr = await ocrGiaFacsimileDiagramRegion(pdfBytes);
  const ocrRawPreview = ocr.text.slice(0, REGION_PREVIEW_CHARS);
  const cropOcrPreviews = ocr.cropTexts.map((t) => t.slice(0, 180));
  const mergedContext = [combinedText, ocr.text].filter(Boolean).join("\n\n");

  const visualPasses: GiaOcrVisualPassLog[] = ocr.passResults.map((pass) => {
    const probe = probeGiaLiveFieldCandidates(pass.text, fields.crownAngle);
    return {
      id: pass.id,
      page: pass.page,
      scale: pass.scale,
      preprocess: pass.preprocess,
      cropCoords: pass.crop,
      cropDimensions: { width: pass.width, height: pass.height },
      ocrTextPreview: pass.text.slice(0, REGION_PREVIEW_CHARS),
      pavilionCandidate: probe.pavilionCandidate,
      girdleCandidate: probe.girdleCandidate,
    };
  });
  logGiaOcrVisualCheck(opts?.reportNumber, visualPasses);

  if (shouldExportGiaCropDebug(opts?.reportNumber)) {
    const page1 = await renderPdfPagePngAtScale(pdfBytes, 1, GIA_PAGE_OCR_SCALE);
    if (page1) {
      await exportGiaCropDebugArtifacts(
        giaCropDebugBasename(opts?.reportNumber),
        page1.png,
        ocr.passResults,
      );
    }
  }

  const candidatesFound: Record<string, string> = {};
  const assignmentsMade: Record<string, string> = {};
  const rejectedCandidates: Array<{ candidate: string; reason: string }> = [];

  if (!ocr.ok || !ocr.text.trim()) {
    const payload = {
      ...emptyPayload(gate.reason, true),
      ocrRawPreview,
      visualPasses,
      rejectedCandidates: [
        {
          candidate: "diagram-region-ocr",
          reason: "no OCR text from diagram crop",
        },
      ],
    };
    logGiaDiagramOcrCheck(payload);
    return payload;
  }

  extractGiaOcrProportionDiagram(mergedContext, fields, set, internal);
  applyGiaOcrFieldHydrationFallback(mergedContext, fields, set);

  if (!fields.girdle.trim()) {
    const frag = extractGiaGirdleFromFacsimileGradingResultsFragment(mergedContext);
    if (frag) set("girdle", frag, "medium");
  }

  const cropAssign = assignGiaFacsimileCropFields(
    ocr.text,
    combinedText,
    fields,
    internal,
    set,
    fields.crownAngle,
  );
  Object.assign(candidatesFound, cropAssign.candidatesFound);
  Object.assign(assignmentsMade, cropAssign.assignmentsMade);
  rejectedCandidates.push(...cropAssign.rejectedCandidates);

  if (ocr.text.match(/\d{1,2}(?:\.\d+)?\s*%/)) {
    const pcts = [...ocr.text.matchAll(/(\d{1,2}(?:\.\d+)?)\s*%/g)].map(
      (m) => m[1]!,
    );
    if (pcts.length) candidatesFound.diagramPercents = pcts.join(", ");
  }

  const payload: GiaDiagramOcrCheckPayload = {
    reportNumber: opts?.reportNumber,
    triggered: true,
    reason: gate.reason,
    cropCoordinates: GIA_FACSIMILE_OCR_CROPS,
    ocrRawPreview,
    repairedOcrPreview: mergedContext.slice(0, REGION_PREVIEW_CHARS),
    candidatesFound,
    assignmentsMade,
    rejectedCandidates,
    cropOcrPreviews,
    visualPasses,
    durationMs: Date.now() - started,
    timedOut: false,
  };
  logGiaDiagramOcrCheck(payload);
  return payload;
}
