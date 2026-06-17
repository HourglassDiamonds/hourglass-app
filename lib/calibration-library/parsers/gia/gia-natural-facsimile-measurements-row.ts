/**
 * Natural GIA facsimile — left measurements-row proportion supplement.
 * Caller must gate on isNaturalGiaFacsimileContext() (excludes LGDR).
 */
import {
  fixGiaOcrDegreeNumerals,
  formatGiaGirdlePhrase,
  girdleCompletenessScore,
  normalizeGiaProportionBlockText,
  stripGiaDotLeaderNoise,
} from "../../gia-proportions";
import { GIA_NATURAL_FACSIMILE_MEASUREMENTS_ROW_CROP } from "./gia-report-style";
import { cropRegionPng, preprocessCropPng } from "./gia-diagram-crop";
import {
  isOcrRuntimeAvailable,
  ocrImageBuffer,
  renderPdfPagePngAtScale,
  type RenderedPdfPage,
} from "../shared/ocr-utils";

const MEASUREMENTS_ROW_OCR_SCALE = 6;

const GIA_DEGREE_SUFFIX = String.raw`(?:°|H\b|=|[gG]\b)`;

function parseNum(s: string): string | null {
  const n = parseFloat(s.replace(/[^\d.]/g, ""));
  if (!Number.isFinite(n)) return null;
  return String(n);
}

function isPlausibleCrownHeightPct(value: string): boolean {
  const n = parseFloat(value);
  return Number.isFinite(n) && n >= 8 && n <= 25;
}

function isPlausibleCrownAngleDeg(value: string): boolean {
  const n = parseFloat(value);
  return Number.isFinite(n) && n >= 30 && n <= 39;
}

function isPlausibleGirdleThicknessPct(value: string): boolean {
  const n = parseFloat(value);
  return Number.isFinite(n) && n >= 2 && n <= 8;
}

/** Slice text from Measurements through GRADING RESULTS (natural facsimile layout). */
export function extractNaturalFacsimileMeasurementsRowWindow(text: string): string {
  const norm = normalizeGiaProportionBlockText(text);
  const anchor = norm.search(/\bmeasurements\b/i);
  if (anchor < 0) return "";
  const tail = norm.slice(anchor);
  const end = tail.search(/\bgrading\s+results\b/i);
  const window = end >= 0 ? tail.slice(0, end) : tail.slice(0, 520);
  return window.trim();
}

/**
 * Crown angle from measurements-row stack: crown-height % then bare angle (° may OCR as g).
 * Example: `slightly 14.5% 36.0 g`
 */
export function parseNaturalFacsimileCrownAngleFromMeasurementsRow(
  text: string,
): string | null {
  const window = extractNaturalFacsimileMeasurementsRowWindow(text);
  if (!window) return null;
  const norm = fixGiaOcrDegreeNumerals(window);

  const paired = norm.match(
    new RegExp(
      String.raw`(?<![\d.])(\d{1,2}(?:\.\d+)?)\s*%[\s\S]{0,64}?(?<![\d.])(3[0-9](?:\.\d+)?)\s*${GIA_DEGREE_SUFFIX}`,
      "i",
    ),
  );
  if (paired) {
    const pct = parseNum(paired[1]!);
    const deg = parseNum(paired[2]!);
    if (
      pct &&
      deg &&
      isPlausibleCrownHeightPct(pct) &&
      isPlausibleCrownAngleDeg(deg)
    ) {
      return deg.includes(".") ? deg : `${deg}.0`;
    }
  }

  const bare = norm.match(
    /(?<![\d.])(\d{1,2}(?:\.\d+)?)\s*%[\s\S]{0,90}?(?<![\d.])(3[0-9](?:\.\d+)?)\b(?!\s*%)/i,
  );
  if (bare) {
    const pct = parseNum(bare[1]!);
    const deg = parseNum(bare[2]!);
    if (
      pct &&
      deg &&
      isPlausibleCrownHeightPct(pct) &&
      isPlausibleCrownAngleDeg(deg)
    ) {
      const slice = norm.slice(bare.index ?? 0, (bare.index ?? 0) + 120);
      if (!/\bpavilion\b/i.test(slice)) {
        return deg.includes(".") ? deg : `${deg}.0`;
      }
    }
  }

  return null;
}

function findGirdleThicknessNearFaceted(window: string): string | null {
  const facetedIdx = window.search(/(?:\(faceted\)|\bfaceted\))/i);
  if (facetedIdx < 0) return null;
  const after = window.slice(facetedIdx, facetedIdx + 200);
  for (const m of after.matchAll(/(\d{1,2}(?:\.\d+)?)\s*%/g)) {
    const pct = parseNum(m[1]!);
    if (pct && isPlausibleGirdleThicknessPct(pct)) {
      const ctx = after.slice(m.index ?? 0, (m.index ?? 0) + 40);
      if (/\b40\s*\.?\s*6\b|\bpavilion\b/i.test(ctx)) continue;
      return pct;
    }
  }
  return null;
}

/**
 * Girdle from measurements row — requires faceted context; accepts truncated "slightly".
 */
export function parseNaturalFacsimileGirdleFromMeasurementsRow(
  text: string,
): string | null {
  const window = extractNaturalFacsimileMeasurementsRowWindow(text);
  if (!window) return null;
  const norm = normalizeGiaProportionBlockText(window);
  if (!/(?:\(faceted\)|\bfaceted\))/i.test(norm)) return null;

  const thicknessPhrase = norm.match(
    /\bmedium\b[\s\-–—]{0,24}\bsligh\w*\s+thick\b|\bsligh\w*\s+thick\b[\s\-–—]{0,24}\bmedium\b/i,
  )?.[0];
  if (thicknessPhrase) {
    let raw = stripGiaDotLeaderNoise(thicknessPhrase).replace(/\s+/g, " ");
    if (!/\(faceted\)/i.test(raw)) raw += " (Faceted)";
    const pct = findGirdleThicknessNearFaceted(norm);
    if (pct) raw += ` ${pct}%`;
    const formatted = formatGiaGirdlePhrase(raw);
    if (formatted) return formatted;
  }

  if (
    /\bmedium\b/i.test(norm) &&
    /\bsligh\w*/i.test(norm) &&
    /\bthick\b/i.test(norm) &&
    !thicknessPhrase
  ) {
    let raw = "Medium to Slightly Thick (Faceted)";
    const pct = findGirdleThicknessNearFaceted(norm);
    if (pct) raw += ` ${pct}%`;
    const formatted = formatGiaGirdlePhrase(raw);
    if (formatted) return formatted;
    return "Medium to Slightly Thick (Faceted)";
  }

  if (
    /\bsligh\w*\b/i.test(norm) &&
    !/\bsligh\w*\s+(?:thick|thin|large)\b/i.test(norm) &&
    !/\bsligh\w*\s+large\b/i.test(norm)
  ) {
    const pct = findGirdleThicknessNearFaceted(norm);
    let raw = "Slightly Thick (Faceted)";
    if (pct) raw += ` ${pct}%`;
    const formatted = formatGiaGirdlePhrase(raw);
    if (formatted) return formatted;
    return "Slightly Thick (Faceted)";
  }

  return null;
}

/** Reject crown 26 sourced from COLOR/CLARITY scale bleed (26-0 / FLAWLESS). */
export function isNaturalFacsimileScaleBleedCrownAngle(
  bandText: string,
  angleDeg: number,
): boolean {
  if (angleDeg < 25.5 || angleDeg > 26.5) return false;
  const t = bandText;
  if (/\b26\s*[-–—]\s*0\b/.test(t)) return true;
  if (/\b26\b[\s\S]{0,48}?\bFLAWLESS\b/i.test(t)) return true;
  if (
    /\bFLAWLESS\b/i.test(t) &&
    (/\bSCALE\b/i.test(t) ||
      /\bCOLOR\b/i.test(t) ||
      /\bCLARITY\b/i.test(t) ||
      /\bCUT\b/i.test(t))
  ) {
    return true;
  }
  return false;
}

export function isFalseNaturalFacsimileDiagramCrownValue(value: string): boolean {
  const n = parseFloat(value.replace(/[^\d.]/g, ""));
  if (!Number.isFinite(n) || n < 25.5 || n > 26.5) return false;
  return true;
}

async function renderFirstPage(
  pdfBytes: Buffer,
  scale: number,
): Promise<RenderedPdfPage | null> {
  return renderPdfPagePngAtScale(pdfBytes, 1, scale);
}

/** Targeted left measurements-row OCR (natural facsimile only — caller gates). */
export async function ocrNaturalFacsimileMeasurementsRow(
  pdfBytes: Buffer,
): Promise<{ text: string; ok: boolean }> {
  if (!(await isOcrRuntimeAvailable())) {
    return { text: "", ok: false };
  }
  const page = await renderFirstPage(pdfBytes, MEASUREMENTS_ROW_OCR_SCALE);
  if (!page) return { text: "", ok: false };

  const cropped = await cropRegionPng(
    page,
    GIA_NATURAL_FACSIMILE_MEASUREMENTS_ROW_CROP,
  );
  if (!cropped) return { text: "", ok: false };

  const png = await preprocessCropPng(cropped.png, "contrast");
  const ocr = await ocrImageBuffer(png);
  return { text: ocr.text.trim(), ok: ocr.text.trim().length > 0 };
}

export type NaturalFacsimileMeasurementsRowApplyReport = {
  rowTextPreview: string;
  ocrUsed: boolean;
  applied: Partial<Record<"crownAngle" | "girdle", string>>;
  rejectedScaleBleedCrown: boolean;
};

export function applyNaturalFacsimileMeasurementsRowFromText(
  rowText: string,
  fields: { crownAngle: string; girdle: string },
  set: (
    key: "crownAngle" | "girdle",
    value: string,
    level: "medium",
  ) => void,
): NaturalFacsimileMeasurementsRowApplyReport {
  const applied: NaturalFacsimileMeasurementsRowApplyReport["applied"] = {};
  let rejectedScaleBleedCrown = false;

  const crown = parseNaturalFacsimileCrownAngleFromMeasurementsRow(rowText);
  const currentCrown = fields.crownAngle.trim();
  const shouldReplaceCrown =
    Boolean(crown) &&
    (!currentCrown || isFalseNaturalFacsimileDiagramCrownValue(currentCrown));

  if (shouldReplaceCrown && crown) {
    if (isFalseNaturalFacsimileDiagramCrownValue(currentCrown)) {
      rejectedScaleBleedCrown = true;
      fields.crownAngle = "";
    }
    set("crownAngle", crown, "medium");
    fields.crownAngle = crown;
    applied.crownAngle = crown;
  }

  const girdle = parseNaturalFacsimileGirdleFromMeasurementsRow(rowText);
  if (girdle && girdleCompletenessScore(girdle) > girdleCompletenessScore(fields.girdle)) {
    set("girdle", girdle, "medium");
    fields.girdle = girdle;
    applied.girdle = girdle;
  }

  const window = extractNaturalFacsimileMeasurementsRowWindow(rowText);
  return {
    rowTextPreview: window.slice(0, 280),
    ocrUsed: false,
    applied,
    rejectedScaleBleedCrown,
  };
}
