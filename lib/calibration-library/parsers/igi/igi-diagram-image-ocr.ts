import type {
  CalibrationReportFields,
  FieldConfidence,
  IgiInternalFields,
  ReportFieldKey,
} from "../../types";
import { formatIgiGirdlePhrase } from "../../igi-proportions";
import { extractIgiProportionFields } from "../../igi-proportions";
import { looksLikeIgiReportText } from "../../lab-parsers";
import { isOcrRuntimeAvailable, ocrImageBuffer, renderPdfPagePngAtScale } from "../shared/ocr-utils";
import {
  logSafeDiagnostic,
  populatedFieldKeysFromRecord,
} from "../../safe-diagnostic-log";

const IGI_PAGE_OCR_SCALE = 4;
const REGION_PREVIEW_CHARS = 400;

/** IGI proportion diagram + girdle / star labels (page 1 center-right). */
export const IGI_DIAGRAM_CROP = {
  left: 0.12,
  top: 0.2,
  width: 0.78,
  height: 0.58,
} as const;

type PercentCrop = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type FieldSetter = (
  key: ReportFieldKey,
  value: string,
  level: FieldConfidence,
) => void;

export type IgiDiagramOcrGate = {
  run: boolean;
  reason: string;
};

export function shouldRunIgiDiagramImageOcr(
  fields: CalibrationReportFields,
  combinedText: string,
  opts: { parserType?: string; lab?: string },
): IgiDiagramOcrGate {
  const isIgi =
    opts.lab === "IGI" ||
    Boolean(opts.parserType?.includes("igi")) ||
    /\bLG\d{6,}\b/i.test(combinedText);
  if (!isIgi) {
    return { run: false, reason: "not-igi-lab-or-parser" };
  }
  if (!looksLikeIgiReportText(combinedText)) {
    return { run: false, reason: "text-does-not-look-like-igi-report" };
  }

  const missingStar = !fields.starLengthPercent.trim();
  const missingGirdle = !fields.girdle.trim();
  if (!missingStar && !missingGirdle) {
    return { run: false, reason: "star-and-girdle-already-populated" };
  }

  return {
    run: true,
    reason: missingStar
      ? missingGirdle
        ? "igi-diagram-missing-star-and-girdle"
        : "igi-diagram-missing-star-length"
      : "igi-diagram-missing-girdle",
  };
}

async function preprocessIgiCropPng(png: Buffer): Promise<Buffer> {
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
      const boosted = Math.min(255, gray * 1.1 + 10);
      d[i] = d[i + 1] = d[i + 2] = boosted;
    }
    ctx.putImageData(src, 0, 0);
    return canvas.toBuffer("image/png");
  } catch {
    return png;
  }
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

/** Detect lower-girdle facet % on diagram — do not map to lowerHalfPercent without confirmation. */
export function detectIgiDiagramLowerGirdleCandidate(
  ocrText: string,
  tablePercent: string,
): string | undefined {
  const table = tablePercent.trim();
  for (const m of ocrText.matchAll(/(?<![\d.])(\d{1,2}(?:\.\d+)?)\s*%/gi)) {
    const v = m[1]!;
    if (table && v === table) continue;
    const n = parseFloat(v);
    if (!Number.isFinite(n) || n < 38 || n > 52) continue;
    if (table && Math.abs(n - parseFloat(table)) < 0.01) continue;
    return v;
  }
  return undefined;
}

export async function ocrIgiDiagramRegion(
  pdfBytes: Buffer,
): Promise<{ text: string; ok: boolean }> {
  if (!(await isOcrRuntimeAvailable())) {
    return { text: "", ok: false };
  }

  const rendered = await renderPdfPagePngAtScale(
    pdfBytes,
    1,
    IGI_PAGE_OCR_SCALE,
  );
  if (!rendered) return { text: "", ok: false };

  const diagramPng = await cropPageRegionPng(
    rendered.png,
    rendered.width,
    rendered.height,
    IGI_DIAGRAM_CROP,
  );
  if (!diagramPng) return { text: "", ok: false };

  const prepped = await preprocessIgiCropPng(diagramPng);
  const ocr = await ocrImageBuffer(prepped);
  return { text: ocr.text.trim(), ok: ocr.ok && ocr.text.trim().length > 0 };
}

export type IgiDiagramOcrCheckPayload = {
  reportNumber?: string;
  triggered: boolean;
  reason: string;
  cropCoordinates: typeof IGI_DIAGRAM_CROP;
  ocrRawPreview: string;
  assignmentsMade: Record<string, string>;
  igiDiagramLowerGirdleCandidate?: string;
  durationMs: number;
};

export function logIgiDiagramOcrCheck(payload: IgiDiagramOcrCheckPayload): void {
  logSafeDiagnostic("[IGI DIAGRAM OCR CHECK]", {
    triggered: payload.triggered,
    reason: payload.reason,
    durationMs: payload.durationMs,
    assignedFieldKeys: populatedFieldKeysFromRecord(payload.assignmentsMade),
    ocrCharCount: payload.ocrRawPreview?.length ?? null,
  });
}

export async function applyIgiDiagramImageOcr(
  pdfBytes: Buffer,
  combinedText: string,
  fields: CalibrationReportFields,
  igiInternal: IgiInternalFields | undefined,
  set: FieldSetter,
  opts?: {
    reportNumber?: string;
    parserPathUsed?: string;
    onMetadata?: (meta: Record<string, unknown>) => void;
  },
): Promise<IgiDiagramOcrCheckPayload> {
  const started = Date.now();
  const gate = shouldRunIgiDiagramImageOcr(fields, combinedText, {
    parserType: opts?.parserPathUsed,
    lab: "IGI",
  });

  const base = (): IgiDiagramOcrCheckPayload => ({
    reportNumber: opts?.reportNumber,
    triggered: gate.run,
    reason: gate.reason,
    cropCoordinates: IGI_DIAGRAM_CROP,
    ocrRawPreview: "",
    assignmentsMade: {},
    durationMs: Date.now() - started,
  });

  if (!gate.run) {
    const payload = base();
    logIgiDiagramOcrCheck(payload);
    return payload;
  }

  const before = { ...fields };
  const internal = igiInternal ?? {};
  extractIgiProportionFields(combinedText, fields, set, internal);

  const ocr = await ocrIgiDiagramRegion(pdfBytes);

  if (!ocr.ok) {
    const payload = { ...base(), ocrRawPreview: ocr.text.slice(0, 120) };
    logIgiDiagramOcrCheck(payload);
    return payload;
  }

  const merged = [combinedText, ocr.text].filter(Boolean).join("\n\n");
  extractIgiProportionFields(merged, fields, set, internal);
  extractIgiProportionFields(ocr.text, fields, set, internal);

  const girdleNorm = fields.girdle.replace(/\s+/g, " ").trim();
  if (girdleNorm && girdleNorm !== fields.girdle) {
    const formatted = formatIgiGirdlePhrase(girdleNorm, true);
    if (formatted) {
      fields.girdle = formatted;
      set("girdle", formatted, "medium");
    }
  } else if (!fields.girdle.trim()) {
    const fromOcr = formatIgiGirdlePhrase(ocr.text.replace(/\s+/g, " "), true);
    if (fromOcr) {
      fields.girdle = fromOcr;
      set("girdle", fromOcr, "medium");
    }
  }

  if (!fields.starLengthPercent.trim()) {
    const starLabel = ocr.text.match(
      /star\s*length[^\d]{0,24}(\d{1,2}(?:\.\d+)?)\s*%?/i,
    );
    if (starLabel?.[1]) {
      set("starLengthPercent", starLabel[1], "medium");
    } else {
      const table = fields.tablePercent.trim();
      for (const m of ocr.text.matchAll(/(?<![\d.])(\d{1,2})\s*%/g)) {
        const v = m[1]!;
        if (table && v === table) continue;
        const n = parseFloat(v);
        if (n >= 8 && n <= 70 && n !== parseFloat(table)) {
          set("starLengthPercent", v, "medium");
          break;
        }
      }
    }
  }

  const lowerGirdleCandidate = detectIgiDiagramLowerGirdleCandidate(
    ocr.text,
    fields.tablePercent,
  );
  if (lowerGirdleCandidate) {
    opts?.onMetadata?.({
      igiDiagramLowerGirdleCandidate: lowerGirdleCandidate,
    });
    if (!internal.pavilionDepthPercent) {
      internal.pavilionDepthPercent = lowerGirdleCandidate;
    }
  }

  const assignmentsMade: Record<string, string> = {};
  for (const key of ["starLengthPercent", "girdle", "lowerHalfPercent"] as const) {
    if (fields[key].trim() && fields[key] !== before[key]) {
      assignmentsMade[key] = fields[key].trim();
    }
  }

  const payload: IgiDiagramOcrCheckPayload = {
    reportNumber: opts?.reportNumber,
    triggered: true,
    reason: gate.reason,
    cropCoordinates: IGI_DIAGRAM_CROP,
    ocrRawPreview: ocr.text.slice(0, REGION_PREVIEW_CHARS),
    assignmentsMade,
    igiDiagramLowerGirdleCandidate: lowerGirdleCandidate,
    durationMs: Date.now() - started,
  };
  logIgiDiagramOcrCheck(payload);
  return payload;
}
