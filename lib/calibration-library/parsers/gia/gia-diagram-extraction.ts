import type {
  CalibrationReportFields,
  FieldConfidence,
  GiaInternalFields,
  ReportFieldKey,
} from "../../types";
import { formatGiaGirdlePhrase, giaProportionDiagramFieldsMissing } from "../../gia-proportions";
import {
  isOcrRuntimeAvailable,
  ocrImageBuffer,
  renderPdfPagePngAtScale,
  type RenderedPdfPage,
} from "../shared/ocr-utils";

/**
 * GIA proportion-diagram extraction — region → crop → targeted OCR → labeled parse.
 *
 * Deterministic diagram-first recovery for GIA round-brilliant proportions when
 * PDF text / broad OCR scatter fails. Band coordinates are layout-specific
 * (facsimile vs LGDR dossier).
 */

export type DiagramConfidence = "high" | "medium" | "low" | "none";

/** Eight target fields this layer attempts to read from the diagram. */
export const GIA_DIAGRAM_TARGET_FIELDS = [
  "tablePercent",
  "depthPercent",
  "crownAngle",
  "pavilionAngle",
  "lowerHalfPercent",
  "starLengthPercent",
  "girdle",
  "culet",
] as const satisfies readonly ReportFieldKey[];

export type CropRegion = {
  left: number;
  top: number;
  width: number;
  height: number;
};

/** A positional value band inside the diagram, with the fields it should hold. */
type DiagramBand = {
  id: string;
  crop: CropRegion;
  /** Fields whose labels/values are expected to fall inside this band. */
  expects: ReportFieldKey[];
  preprocess: "raw" | "contrast" | "threshold";
  scale: number;
};

/** Whole right-side proportion diagram (used for the locate/validate pass). */
export const GIA_PROPORTION_DIAGRAM_REGION: CropRegion = {
  left: 0.5,
  top: 0.2,
  width: 0.48,
  height: 0.44,
};

/**
 * Positional bands top→bottom across the GIA profile diagram:
 *   table (top) · crown angle/height + star length · girdle · pavilion
 *   angle/depth + lower half · total depth + culet (bottom).
 */
/**
 * Bands calibrated against the live GIA facsimile (report 2527039693): the
 * profile diagram's numerics cluster in the upper ~0.19–0.39 of the page, with
 * the crown values (table %, crown angle, crown height) above the girdle and
 * the pavilion values (pavilion angle, pavilion depth, total depth, culet)
 * just below. Bands intentionally overlap; cross-band double-assignment is
 * prevented by the reserved value sets in parseDiagramFields().
 */
export type GiaDiagramLayout = "facsimile" | "lgdr-dossier";

/** LGDR dossier: proportion diagram sits lower on page 1 than facsimile layout. */
export const GIA_LGDR_DOSSIER_DIAGRAM_REGION: CropRegion = {
  left: 0.48,
  top: 0.52,
  width: 0.5,
  height: 0.38,
};

export const GIA_LGDR_DOSSIER_VALUE_BANDS: DiagramBand[] = [
  {
    id: "table",
    crop: { left: 0.5, top: 0.52, width: 0.48, height: 0.06 },
    expects: ["tablePercent"],
    preprocess: "threshold",
    scale: 6,
  },
  {
    id: "crown",
    crop: { left: 0.5, top: 0.54, width: 0.48, height: 0.09 },
    expects: ["crownAngle", "starLengthPercent"],
    preprocess: "threshold",
    scale: 6,
  },
  {
    id: "girdle",
    crop: { left: 0.5, top: 0.62, width: 0.48, height: 0.06 },
    expects: ["girdle"],
    preprocess: "contrast",
    scale: 6,
  },
  {
    id: "pavilion",
    crop: { left: 0.5, top: 0.61, width: 0.48, height: 0.11 },
    expects: ["pavilionAngle", "lowerHalfPercent"],
    preprocess: "threshold",
    scale: 6,
  },
  {
    id: "culet-depth",
    crop: { left: 0.5, top: 0.66, width: 0.48, height: 0.14 },
    expects: ["depthPercent", "culet"],
    preprocess: "contrast",
    scale: 6,
  },
];

export const GIA_DIAGRAM_VALUE_BANDS: DiagramBand[] = [
  {
    id: "table",
    crop: { left: 0.5, top: 0.19, width: 0.48, height: 0.06 },
    expects: ["tablePercent"],
    preprocess: "threshold",
    scale: 6,
  },
  {
    id: "crown",
    crop: { left: 0.5, top: 0.2, width: 0.48, height: 0.08 },
    expects: ["crownAngle", "starLengthPercent"],
    preprocess: "threshold",
    scale: 6,
  },
  {
    id: "girdle",
    crop: { left: 0.5, top: 0.28, width: 0.48, height: 0.05 },
    expects: ["girdle"],
    preprocess: "contrast",
    scale: 6,
  },
  {
    id: "pavilion",
    crop: { left: 0.5, top: 0.27, width: 0.48, height: 0.1 },
    expects: ["pavilionAngle", "lowerHalfPercent"],
    preprocess: "threshold",
    scale: 6,
  },
  {
    id: "culet-depth",
    crop: { left: 0.5, top: 0.27, width: 0.48, height: 0.12 },
    expects: ["depthPercent", "culet"],
    preprocess: "contrast",
    scale: 6,
  },
];

export type GiaDiagramFieldResult = {
  field: ReportFieldKey;
  bandId: string | null;
  cropRegion: CropRegion | null;
  ocrText: string;
  parsedValue: string | null;
  confidence: DiagramConfidence;
  /** Why this confidence / why nothing was assigned. */
  note: string;
};

export type GiaDiagramBandOcr = {
  id: string;
  crop: CropRegion;
  preprocess: string;
  scale: number;
  width: number;
  height: number;
  text: string;
};

export type GiaDiagramExtractionReport = {
  ocrAvailable: boolean;
  diagramLocated: boolean;
  locateReason: string;
  region: CropRegion;
  bands: GiaDiagramBandOcr[];
  fields: GiaDiagramFieldResult[];
};

// ─────────────────────────────── image helpers ───────────────────────────────

async function preprocessCropPng(
  png: Buffer,
  mode: DiagramBand["preprocess"],
): Promise<Buffer> {
  if (mode === "raw") return png;
  try {
    const { createCanvas, loadImage } = await import("@napi-rs/canvas");
    const img = await loadImage(png);
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);
    const src = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = src.data;
    for (let i = 0; i < d.length; i += 4) {
      const gray = 0.299 * d[i]! + 0.587 * d[i + 1]! + 0.114 * d[i + 2]!;
      const v =
        mode === "threshold"
          ? gray > 168
            ? 255
            : 0
          : Math.min(255, gray * 1.12 + 8);
      d[i] = d[i + 1] = d[i + 2] = v;
    }
    ctx.putImageData(src, 0, 0);
    return canvas.toBuffer("image/png");
  } catch {
    return png;
  }
}

async function cropRegionPng(
  page: RenderedPdfPage,
  crop: CropRegion,
): Promise<{ png: Buffer; width: number; height: number } | null> {
  try {
    const { createCanvas, loadImage } = await import("@napi-rs/canvas");
    const img = await loadImage(page.png);
    const sx = Math.max(0, Math.floor(crop.left * page.width));
    const sy = Math.max(0, Math.floor(crop.top * page.height));
    const w = Math.max(1, Math.min(page.width - sx, Math.floor(crop.width * page.width)));
    const h = Math.max(1, Math.min(page.height - sy, Math.floor(crop.height * page.height)));
    const canvas = createCanvas(w, h);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, sx, sy, w, h, 0, 0, w, h);
    return { png: canvas.toBuffer("image/png"), width: w, height: h };
  } catch {
    return null;
  }
}

// ─────────────────────────── deterministic parsing ───────────────────────────

/** OCR degree-glyph cleanup: a trailing °/'/H/= after a 2-digit(.d) number. */
function normalizeDegreeText(text: string): string {
  return text
    .replace(/(\d{2}(?:\.\d)?)\s*[°ºoO*]/g, "$1°")
    .replace(/(\d{2})\s*\.\s*(\d)/g, "$1.$2");
}

function collectDegrees(text: string): number[] {
  const t = normalizeDegreeText(text);
  const out: number[] = [];
  for (const m of t.matchAll(/\b(\d{2}(?:\.\d)?)\s*°/g)) {
    const n = parseFloat(m[1]!);
    if (Number.isFinite(n)) out.push(n);
  }
  // Fallback: bare 2-digit.1-decimal in angle range even without a degree glyph.
  if (out.length === 0) {
    for (const m of t.matchAll(/\b(\d{2}\.\d)\b/g)) {
      const n = parseFloat(m[1]!);
      if (Number.isFinite(n)) out.push(n);
    }
  }
  // OCR often drops the decimal point: "360" → 36.0°, "406" → 40.6°.
  for (const m of t.matchAll(/\b(\d{3})\b/g)) {
    const raw = parseInt(m[1]!, 10);
    if (raw < 280 || raw > 429) continue;
    const n = raw / 10;
    if (n >= 26 && n <= 43) out.push(n);
  }
  return out;
}

function collectPercents(text: string): number[] {
  const out: number[] = [];
  for (const m of text.matchAll(/\b(\d{1,2}(?:\.\d)?)\s*%/g)) {
    const n = parseFloat(m[1]!);
    if (Number.isFinite(n)) out.push(n);
  }
  return out;
}

function fmtPct(n: number): string {
  return Number.isInteger(n) ? `${n}` : n.toFixed(1);
}

/** Plausible GIA round-brilliant ranges (used only for diagnostic confidence). */
const RANGES = {
  tablePercent: { min: 49, max: 68, tight: [53, 62] as [number, number] },
  depthPercent: { min: 55, max: 70, tight: [58, 65] as [number, number] },
  crownAngle: { min: 26, max: 39, tight: [31, 37] as [number, number] },
  pavilionAngle: { min: 38, max: 43, tight: [40, 41.5] as [number, number] },
  lowerHalfPercent: { min: 65, max: 90, tight: [70, 85] as [number, number] },
  starLengthPercent: { min: 40, max: 55, tight: [45, 55] as [number, number] },
  pavilionDepth: { min: 41, max: 46 },
  girdleThickness: { min: 2, max: 6 },
} as const;

function rangeConfidence(
  value: number,
  range: { min: number; max: number; tight?: [number, number] },
  ambiguous: boolean,
): DiagramConfidence {
  if (value < range.min || value > range.max) return "low";
  if (range.tight && (value < range.tight[0] || value > range.tight[1])) {
    return ambiguous ? "low" : "medium";
  }
  return ambiguous ? "medium" : "high";
}

const GIRDLE_WIDTH =
  /(extremely thin|very thin|thin|medium|slightly thick|sl\.?\s*thick|thick|very thick|extremely thick)/i;
const GIRDLE_FACETED = /faceted/i;
const CULET_SIZE =
  /\b(none|very small|small|medium|slightly large|large|very large|extremely large)\b/i;

function assignDegree(
  field: "crownAngle" | "pavilionAngle",
  band: GiaDiagramBandOcr,
  used: Set<number>,
): GiaDiagramFieldResult {
  const range = RANGES[field];
  const candidates = collectDegrees(band.text).filter(
    (n) => n >= range.min && n <= range.max && !used.has(n),
  );
  if (candidates.length === 0) {
    return mk(field, band, null, "none", "no degree value in expected range/band");
  }
  // Prefer a value inside the tight range; otherwise first plausible.
  const tight = candidates.find(
    (n) => n >= range.tight[0] && n <= range.tight[1],
  );
  const chosen = tight ?? candidates[0]!;
  used.add(chosen);
  const ambiguous = candidates.length > 1;
  return mk(
    field,
    band,
    `${fmtPct(chosen)}°`.replace("°", "") + "°",
    rangeConfidence(chosen, range, ambiguous),
    ambiguous
      ? `chose ${chosen} from ${candidates.length} degree candidates`
      : `single degree candidate ${chosen}`,
  );
}

function assignPercent(
  field: "tablePercent" | "depthPercent" | "lowerHalfPercent" | "starLengthPercent",
  band: GiaDiagramBandOcr,
  used: Set<number>,
): GiaDiagramFieldResult {
  const range = RANGES[field];
  const all = collectPercents(band.text);
  const candidates = all.filter(
    (n) => n >= range.min && n <= range.max && !used.has(n),
  );
  if (candidates.length === 0) {
    return mk(field, band, null, "none", "no percent in expected range/band");
  }
  const tight = candidates.find(
    (n) => n >= range.tight[0] && n <= range.tight[1],
  );
  const chosen =
    field === "tablePercent" ? candidates[0]! : (tight ?? candidates[0]!);
  used.add(chosen);
  const ambiguous = candidates.length > 1;
  return mk(
    field,
    band,
    `${fmtPct(chosen)}%`,
    rangeConfidence(chosen, range, ambiguous),
    ambiguous
      ? `chose ${chosen}% from ${candidates.length} percent candidates`
      : `single percent candidate ${chosen}%`,
  );
}

/** GIA total-depth window for the percent-glyph-lost fallback (narrow). */
const DEPTH_FALLBACK_MIN = 55;
const DEPTH_FALLBACK_MAX = 67;

/**
 * Bare 2-digit.1-decimal numbers, even when embedded in OCR noise
 * (e.g. "163.17]" → 63.1). Used ONLY by the depth-band fallback below.
 */
function collectBareNumbers(text: string): number[] {
  const out: number[] = [];
  for (const m of text.matchAll(/(\d{2})\.(\d)/g)) {
    const n = parseFloat(`${m[1]}.${m[2]}`);
    if (Number.isFinite(n)) out.push(n);
  }
  return out;
}

/**
 * depthPercent with a narrow, depth-band-only fallback. GIA total depth often
 * OCRs with the percent glyph mangled ("63.17]"), so the standard %-tagged
 * pass misses it. When that happens we accept a bare number in the tight GIA
 * round total-depth window (55–67) FROM THE DEPTH/CULET BAND ONLY. This is not
 * applied to any other field or band.
 */
function assignDepthPercent(
  band: GiaDiagramBandOcr,
  used: Set<number>,
): GiaDiagramFieldResult {
  const range = RANGES.depthPercent;
  const tagged = collectPercents(band.text).filter(
    (n) => n >= range.min && n <= range.max && !used.has(n),
  );
  if (tagged.length > 0) {
    const tight = tagged.find(
      (n) => n >= range.tight[0] && n <= range.tight[1],
    );
    const chosen = tight ?? tagged[0]!;
    used.add(chosen);
    const ambiguous = tagged.length > 1;
    return mk(
      "depthPercent",
      band,
      `${fmtPct(chosen)}%`,
      rangeConfidence(chosen, range, ambiguous),
      ambiguous
        ? `chose ${chosen}% from ${tagged.length} percent candidates`
        : `single percent candidate ${chosen}%`,
    );
  }

  // Fallback: percent glyph lost. Accept a plausible bare total-depth number.
  const fallback = collectBareNumbers(band.text).filter(
    (n) => n >= DEPTH_FALLBACK_MIN && n <= DEPTH_FALLBACK_MAX && !used.has(n),
  );
  if (fallback.length > 0) {
    const chosen = fallback[0]!;
    used.add(chosen);
    return mk(
      "depthPercent",
      band,
      `${fmtPct(chosen)}%`,
      "low",
      `percent glyph lost; accepted as depthPercent from depth band by plausible GIA round range (${DEPTH_FALLBACK_MIN}–${DEPTH_FALLBACK_MAX})`,
    );
  }

  return mk(
    "depthPercent",
    band,
    null,
    "none",
    "no percent (or plausible bare depth) in depth band",
  );
}

function assignGirdle(band: GiaDiagramBandOcr): GiaDiagramFieldResult {
  const width = band.text.match(GIRDLE_WIDTH)?.[0]?.trim();
  const faceted = GIRDLE_FACETED.test(band.text);
  const pct = collectPercents(band.text).find(
    (n) => n >= RANGES.girdleThickness.min && n <= RANGES.girdleThickness.max,
  );
  if (!width && !faceted && pct === undefined) {
    return mk("girdle", band, null, "none", "no girdle width/faceted/% in band");
  }
  // Only emit a girdle value when the WIDTH descriptor is legible — a bare
  // "Faceted 3.5%" without a width class would require inventing the width.
  if (!width) {
    return mk(
      "girdle",
      band,
      null,
      "low",
      `width descriptor illegible (faceted=${faceted}, thickness=${pct ?? "?"}%) — not assigning`,
    );
  }
  const parts = [width];
  if (faceted) parts.push("Faceted");
  const value = parts.join(", ");
  return mk(
    "girdle",
    band,
    pct !== undefined ? `${value} ${fmtPct(pct)}%` : value,
    faceted && pct !== undefined ? "high" : "medium",
    "girdle width descriptor read from band",
  );
}

function assignCulet(band: GiaDiagramBandOcr): GiaDiagramFieldResult {
  const m = band.text.match(CULET_SIZE);
  if (!m) return mk("culet", band, null, "none", "no culet size token in band");
  const raw = m[1]!;
  const value = raw
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return mk("culet", band, value, "medium", "culet size token read from band");
}

function mk(
  field: ReportFieldKey,
  band: GiaDiagramBandOcr | null,
  parsedValue: string | null,
  confidence: DiagramConfidence,
  note: string,
): GiaDiagramFieldResult {
  return {
    field,
    bandId: band?.id ?? null,
    cropRegion: band?.crop ?? null,
    ocrText: band?.text ?? "",
    parsedValue,
    confidence,
    note,
  };
}

function parseDiagramFields(bands: GiaDiagramBandOcr[]): GiaDiagramFieldResult[] {
  const byId = new Map(bands.map((b) => [b.id, b]));
  const usedDeg = new Set<number>();
  const usedPct = new Set<number>();
  const results: GiaDiagramFieldResult[] = [];

  const tableBand = byId.get("table");
  const crownBand = byId.get("crown");
  const girdleBand = byId.get("girdle");
  const pavBand = byId.get("pavilion");
  const culetBand = byId.get("culet-depth");

  // Angles first so their numbers are reserved before percent passes.
  results.push(
    crownBand
      ? assignDegree("crownAngle", crownBand, usedDeg)
      : mk("crownAngle", null, null, "none", "crown band not rendered"),
  );
  results.push(
    pavBand
      ? assignDegree("pavilionAngle", pavBand, usedDeg)
      : mk("pavilionAngle", null, null, "none", "pavilion band not rendered"),
  );
  // Table % reliably renders alongside the crown values (apex of the profile);
  // the dedicated top band often clips it. Reserve it before the facet
  // percents (star/lower) so it can't be mis-claimed by them.
  const tableSource = crownBand ?? tableBand;
  results.push(
    tableSource
      ? assignPercent("tablePercent", tableSource, usedPct)
      : mk("tablePercent", null, null, "none", "table band not rendered"),
  );
  results.push(
    culetBand
      ? assignDepthPercent(culetBand, usedPct)
      : mk("depthPercent", null, null, "none", "depth band not rendered"),
  );
  results.push(
    crownBand
      ? assignPercent("starLengthPercent", crownBand, usedPct)
      : mk("starLengthPercent", null, null, "none", "crown band not rendered"),
  );
  results.push(
    pavBand
      ? assignPercent("lowerHalfPercent", pavBand, usedPct)
      : mk("lowerHalfPercent", null, null, "none", "pavilion band not rendered"),
  );
  results.push(
    girdleBand
      ? assignGirdle(girdleBand)
      : mk("girdle", null, null, "none", "girdle band not rendered"),
  );
  results.push(
    culetBand
      ? assignCulet(culetBand)
      : mk("culet", null, null, "none", "culet band not rendered"),
  );

  // Stable order matching GIA_DIAGRAM_TARGET_FIELDS.
  return GIA_DIAGRAM_TARGET_FIELDS.map(
    (f) => results.find((r) => r.field === f)!,
  );
}

/** Diagram is "located" when its OCR shows the expected numeric signature. */
function validateDiagramSignature(bandTexts: string[]): {
  located: boolean;
  reason: string;
} {
  const joined = bandTexts.join("\n");
  const degrees = collectDegrees(joined).length;
  const percents = collectPercents(joined).length;
  if (degrees >= 1 && percents >= 2) {
    return {
      located: true,
      reason: `numeric signature ok (${degrees} degree(s), ${percents} percent(s))`,
    };
  }
  return {
    located: false,
    reason: `weak signature (${degrees} degree(s), ${percents} percent(s)) — region may be misaligned`,
  };
}

export function detectGiaDiagramLayout(combinedText: string): GiaDiagramLayout {
  if (
    /laboratory[-\s]*grown\s+diamond\s+report[\s\S]{0,160}dossier/i.test(
      combinedText,
    ) ||
    /\bLGDR\b/i.test(combinedText)
  ) {
    return "lgdr-dossier";
  }
  return "facsimile";
}

function layoutBands(layout: GiaDiagramLayout): DiagramBand[] {
  return layout === "lgdr-dossier"
    ? GIA_LGDR_DOSSIER_VALUE_BANDS
    : GIA_DIAGRAM_VALUE_BANDS;
}

function layoutRegion(layout: GiaDiagramLayout): CropRegion {
  return layout === "lgdr-dossier"
    ? GIA_LGDR_DOSSIER_DIAGRAM_REGION
    : GIA_PROPORTION_DIAGRAM_REGION;
}

function countAssignedFields(report: GiaDiagramExtractionReport): number {
  return report.fields.filter((f) => f.parsedValue).length;
}

function pickBetterDiagramReport(
  a: GiaDiagramExtractionReport,
  b: GiaDiagramExtractionReport,
): GiaDiagramExtractionReport {
  if (a.diagramLocated !== b.diagramLocated) {
    return a.diagramLocated ? a : b;
  }
  const aCount = countAssignedFields(a);
  const bCount = countAssignedFields(b);
  if (aCount !== bCount) return aCount > bCount ? a : b;
  return a;
}

async function extractGiaProportionDiagramForLayout(
  pdfBytes: Buffer,
  layout: GiaDiagramLayout,
  page: number,
): Promise<GiaDiagramExtractionReport> {
  const region = layoutRegion(layout);
  const valueBands = layoutBands(layout);
  const empty = (
    ocrAvailable: boolean,
    reason: string,
  ): GiaDiagramExtractionReport => ({
    ocrAvailable,
    diagramLocated: false,
    locateReason: reason,
    region,
    bands: [],
    fields: GIA_DIAGRAM_TARGET_FIELDS.map((f) =>
      mk(f, null, null, "none", reason),
    ),
  });

  if (!(await isOcrRuntimeAvailable())) {
    return empty(false, "OCR runtime not available");
  }

  const maxScale = Math.max(...valueBands.map((b) => b.scale));
  const rendered = await renderPdfPagePngAtScale(pdfBytes, page, maxScale);
  if (!rendered) return empty(true, `could not render PDF page ${page}`);

  const bands: GiaDiagramBandOcr[] = [];
  for (const band of valueBands) {
    const cropped = await cropRegionPng(rendered, band.crop);
    if (!cropped) continue;
    const prepped = await preprocessCropPng(cropped.png, band.preprocess);
    const ocr = await ocrImageBuffer(prepped);
    bands.push({
      id: band.id,
      crop: band.crop,
      preprocess: band.preprocess,
      scale: band.scale,
      width: cropped.width,
      height: cropped.height,
      text: ocr.text.trim(),
    });
  }

  const signature = validateDiagramSignature(bands.map((b) => b.text));
  const fields = parseDiagramFields(bands);

  return {
    ocrAvailable: true,
    diagramLocated: signature.located,
    locateReason: `${layout}: ${signature.reason}`,
    region,
    bands,
    fields,
  };
}

// ─────────────────────────────── entry point ───────────────────────────────

export async function extractGiaProportionDiagram(
  pdfBytes: Buffer,
  opts?: { page?: number; layout?: GiaDiagramLayout; tryLayouts?: boolean },
): Promise<GiaDiagramExtractionReport> {
  const page = opts?.page ?? 1;
  const region = GIA_PROPORTION_DIAGRAM_REGION;
  const empty = (
    ocrAvailable: boolean,
    reason: string,
  ): GiaDiagramExtractionReport => ({
    ocrAvailable,
    diagramLocated: false,
    locateReason: reason,
    region,
    bands: [],
    fields: GIA_DIAGRAM_TARGET_FIELDS.map((f) =>
      mk(f, null, null, "none", reason),
    ),
  });

  if (!(await isOcrRuntimeAvailable())) {
    return empty(false, "OCR runtime not available");
  }

  const layouts: GiaDiagramLayout[] = opts?.layout
    ? [opts.layout]
    : opts?.tryLayouts === false
      ? ["facsimile"]
      : ["facsimile", "lgdr-dossier"];

  let best: GiaDiagramExtractionReport | null = null;
  for (const layout of layouts) {
    const result = await extractGiaProportionDiagramForLayout(
      pdfBytes,
      layout,
      page,
    );
    best = best ? pickBetterDiagramReport(best, result) : result;
    if (result.diagramLocated && countAssignedFields(result) >= 6) break;
  }
  return best ?? empty(true, "no layout produced a diagram report");
}

type FieldSetter = (
  key: ReportFieldKey,
  value: string,
  level: FieldConfidence,
) => void;

function diagramConfidenceToField(
  confidence: DiagramConfidence,
): FieldConfidence | null {
  if (confidence === "none") return null;
  if (confidence === "high" || confidence === "medium") return "medium";
  return "low";
}

function normalizeDiagramFieldValue(
  field: ReportFieldKey,
  raw: string,
): string {
  switch (field) {
    case "tablePercent":
    case "depthPercent":
    case "lowerHalfPercent":
    case "starLengthPercent":
      return raw.replace(/\s*%/g, "").trim();
    case "crownAngle":
    case "pavilionAngle":
      return raw.replace(/[°%]/g, "").trim();
    case "girdle": {
      const formatted = formatGiaGirdlePhrase(raw);
      return formatted || raw.trim();
    }
    default:
      return raw.trim();
  }
}

export type GiaDiagramApplyReport = {
  layout: GiaDiagramLayout;
  diagramLocated: boolean;
  locateReason: string;
  applied: Partial<Record<ReportFieldKey, string>>;
  skipped: Array<{ field: ReportFieldKey; reason: string }>;
};

export function shouldRunGiaProportionDiagramExtraction(
  fields: CalibrationReportFields,
  combinedText: string,
  opts: { parserType?: string; lab?: string },
): { run: boolean; reason: string } {
  const isGia =
    opts.lab === "GIA" || Boolean(opts.parserType?.startsWith("gia"));
  if (!isGia) return { run: false, reason: "not-gia" };
  if (!giaProportionDiagramFieldsMissing(fields)) {
    return { run: false, reason: "diagram-fields-complete" };
  }
  if (!combinedText.trim()) {
    return { run: true, reason: "gia-empty-text-diagram-fallback" };
  }
  return { run: true, reason: "gia-core-proportions-missing" };
}

/** Production: fill empty GIA diagram fields from targeted band OCR. */
export async function applyGiaProportionDiagramExtraction(
  pdfBytes: Buffer,
  combinedText: string,
  fields: CalibrationReportFields,
  _giaInternal: GiaInternalFields | undefined,
  set: FieldSetter,
  opts?: { reportNumber?: string; layout?: GiaDiagramLayout },
): Promise<GiaDiagramApplyReport> {
  const gate = shouldRunGiaProportionDiagramExtraction(fields, combinedText, {
    lab: "GIA",
  });
  const skipped: GiaDiagramApplyReport["skipped"] = [];
  const applied: GiaDiagramApplyReport["applied"] = {};

  if (!gate.run) {
    return {
      layout: detectGiaDiagramLayout(combinedText),
      diagramLocated: false,
      locateReason: gate.reason,
      applied,
      skipped: GIA_DIAGRAM_TARGET_FIELDS.map((f) => ({
        field: f,
        reason: gate.reason,
      })),
    };
  }

  const hintedLayout = opts?.layout ?? detectGiaDiagramLayout(combinedText);
  const diagram = await extractGiaProportionDiagram(pdfBytes, {
    layout: hintedLayout,
    tryLayouts: !opts?.layout,
  });
  const layout = diagram.locateReason.startsWith("lgdr-dossier")
    ? "lgdr-dossier"
    : diagram.locateReason.startsWith("facsimile")
      ? "facsimile"
      : hintedLayout;

  for (const row of diagram.fields) {
    if (!row.parsedValue?.trim()) {
      skipped.push({ field: row.field, reason: row.note || "no parsed value" });
      continue;
    }
    if (fields[row.field]?.trim()) {
      skipped.push({ field: row.field, reason: "field-already-populated" });
      continue;
    }
    const level = diagramConfidenceToField(row.confidence);
    if (!level) {
      skipped.push({
        field: row.field,
        reason: `confidence-none: ${row.note}`,
      });
      continue;
    }
    const value = normalizeDiagramFieldValue(row.field, row.parsedValue);
    if (!value) {
      skipped.push({ field: row.field, reason: "normalized-empty" });
      continue;
    }
    set(row.field, value, level);
    if (fields[row.field]?.trim()) {
      applied[row.field] = fields[row.field].trim();
    }
  }

  return {
    layout,
    diagramLocated: diagram.diagramLocated,
    locateReason: diagram.locateReason,
    applied,
    skipped,
  };
}

// ────────────────────────── compare vs current route ──────────────────────────

export type GiaDiagramFieldComparison = {
  field: ReportFieldKey;
  diagramValue: string | null;
  diagramConfidence: DiagramConfidence;
  currentValue: string | null;
  status: "match" | "mismatch" | "diagram-only" | "current-only" | "both-missing";
  /** Diagnostic note from the diagram parse (why the value / confidence). */
  note: string;
};

/**
 * Tiny numeric tolerance for the no-conflict guard. Two numeric values within
 * this absolute delta (e.g. current "63" vs diagram "63.1%") are treated as
 * agreement, not a conflict. Anything beyond it is a true mismatch.
 */
export const DIAGRAM_NUMERIC_TOLERANCE = 0.6;

function normalizeForCompare(value: string | null): string {
  if (!value) return "";
  return value
    .toLowerCase()
    .replace(/[°%,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Agreement test for the no-conflict guard. Numeric fields agree when their
 * leading numbers are within DIAGRAM_NUMERIC_TOLERANCE; text fields agree on
 * containment. The layer never overrides production — a true conflict is only
 * surfaced (status "mismatch"), and both values are reported.
 */
function valuesAgree(a: string | null, b: string | null): boolean {
  const na = normalizeForCompare(a);
  const nb = normalizeForCompare(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const numA = na.match(/\d+(?:\.\d+)?/)?.[0];
  const numB = nb.match(/\d+(?:\.\d+)?/)?.[0];
  if (numA !== undefined && numB !== undefined) {
    return Math.abs(parseFloat(numA) - parseFloat(numB)) <= DIAGRAM_NUMERIC_TOLERANCE;
  }
  return na.includes(nb) || nb.includes(na);
}

export function compareGiaDiagramVsCurrent(
  diagram: GiaDiagramExtractionReport,
  currentFields: Partial<CalibrationReportFields>,
): GiaDiagramFieldComparison[] {
  return diagram.fields.map((f) => {
    const currentRaw = currentFields[f.field]?.trim() ?? "";
    const currentValue = currentRaw || null;
    const diagramValue = f.parsedValue;

    let status: GiaDiagramFieldComparison["status"];
    if (!diagramValue && !currentValue) status = "both-missing";
    else if (diagramValue && !currentValue) status = "diagram-only";
    else if (!diagramValue && currentValue) status = "current-only";
    else status = valuesAgree(diagramValue, currentValue) ? "match" : "mismatch";

    return {
      field: f.field,
      diagramValue,
      diagramConfidence: f.confidence,
      currentValue,
      status,
      note: f.note,
    };
  });
}
