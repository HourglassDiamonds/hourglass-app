import type {
  CalibrationReportFields,
  FieldConfidence,
  GiaInternalFields,
  ReportFieldKey,
} from "../../types";
import {
  applyGiaOcrFieldHydrationFallback,
  extractGiaOcrProportionDiagram,
  formatGiaGirdlePhrase,
  giaProportionDiagramFieldsMissing,
} from "../../gia-proportions";
import {
  isOcrRuntimeAvailable,
  ocrImageBuffer,
  renderPdfPagePngAtScale,
  renderPdfPagePngLgdrDossier,
  renderUploadImageAsPage,
  type RenderedPdfPage,
} from "../shared/ocr-utils";
import {
  detectGiaReportStyle,
  detectGiaDiagramLayout,
  type GiaReportStyle,
  type GiaDiagramLayout,
  type GiaDiagramBandDef,
  type CropRegion,
  GIA_PROPORTION_DIAGRAM_REGION,
  GIA_LGDR_DOSSIER_DIAGRAM_REGION,
  GIA_COLORED_SIMPLIFIED_DIAGRAM_REGION,
  GIA_LGDR_DOSSIER_VALUE_BANDS,
  GIA_DIAGRAM_VALUE_BANDS,
  GIA_NATURAL_COLORED_SIMPLIFIED_BANDS,
  styleFromLayout,
} from "./gia-report-style";
import {
  exportGiaDiagramDebugArtifacts,
  giaDiagramDebugEnabled,
} from "./gia-diagram-debug";

export type { GiaDiagramLayout, GiaReportStyle, CropRegion };
export {
  detectGiaDiagramLayout,
  detectGiaReportStyle,
  GIA_PROPORTION_DIAGRAM_REGION,
  GIA_LGDR_DOSSIER_DIAGRAM_REGION,
  GIA_LGDR_DOSSIER_VALUE_BANDS,
  GIA_DIAGRAM_VALUE_BANDS,
  GIA_NATURAL_COLORED_SIMPLIFIED_BANDS,
};

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

type DiagramBand = GiaDiagramBandDef;

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

export type { LgdrDiagramRetryDiagnostic } from "./gia-lgdr-diagram-retry";

export type GiaDiagramExtractionReport = {
  ocrAvailable: boolean;
  diagramLocated: boolean;
  locateReason: string;
  reportStyle?: GiaReportStyle;
  region: CropRegion;
  bands: GiaDiagramBandOcr[];
  fields: GiaDiagramFieldResult[];
  internal?: Partial<GiaInternalFields>;
  lgdrDiagramRetry?: import("./gia-lgdr-diagram-retry").LgdrDiagramRetryDiagnostic;
};

import {
  cropRegionPng,
  preprocessCropPng,
} from "./gia-diagram-crop";

/** OCR degree-glyph cleanup: a trailing °/'/H/= after a 2-digit(.d) number. */
function normalizeDegreeText(text: string): string {
  return text
    .replace(/(\d{1,2}):(\d)/g, "$1.$2")
    .replace(/(\d{2})\s*-\s*(\d)\b/g, "$1.$2")
    .replace(/\b345\b/g, "34.5")
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

/** OCR sometimes splits total depth decimals ("61 5%" → 61.5%). Depth-band only. */
function collectGarbledDepthPercents(text: string): number[] {
  const out: number[] = [];
  for (const m of text.matchAll(/\b(\d{2})\s+(\d)\s*%/g)) {
    const n = parseFloat(`${m[1]}.${m[2]}`);
    if (Number.isFinite(n)) out.push(n);
  }
  return out;
}

function normalizeBandText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
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
  let all = collectPercents(band.text);
  if (field === "starLengthPercent") {
    const starish = all.filter((n) => n >= 44 && n <= 55);
    if (starish.length > 0) all = starish;
  }
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

/**
 * LGDR header band lists star length before table (e.g. "50% 57%").
 * Prefer the table tight range so star-length % is not bound as tablePercent.
 */
function assignLgdrTablePercent(
  band: GiaDiagramBandOcr,
  used: Set<number>,
): GiaDiagramFieldResult {
  const range = RANGES.tablePercent;
  const candidates = collectPercents(band.text).filter(
    (n) => n >= range.min && n <= range.max && !used.has(n),
  );
  if (candidates.length === 0) {
    return mk(
      "tablePercent",
      band,
      null,
      "none",
      "no percent in expected range/band",
    );
  }
  const tight = candidates.filter(
    (n) => n >= range.tight[0] && n <= range.tight[1],
  );
  const chosen = (tight[0] ?? candidates[0])!;
  used.add(chosen);
  const ambiguous = candidates.length > 1;
  return mk(
    "tablePercent",
    band,
    `${fmtPct(chosen)}%`,
    rangeConfidence(chosen, range, ambiguous),
    tight.length > 0 && candidates.some((n) => n !== chosen)
      ? `LGDR: table tight ${chosen}% (star-length precedes in header OCR)`
      : ambiguous
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

  const garbled = collectGarbledDepthPercents(band.text).filter(
    (n) => n >= range.min && n <= range.max && !used.has(n),
  );
  if (garbled.length > 0) {
    const tight = garbled.find(
      (n) => n >= range.tight[0] && n <= range.tight[1],
    );
    const chosen = tight ?? garbled[0]!;
    used.add(chosen);
    return mk(
      "depthPercent",
      band,
      `${fmtPct(chosen)}%`,
      "low",
      `LGDR/OCR: split decimal recovered as depthPercent (${chosen}%)`,
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
  const text = normalizeBandText(band.text);
  const width = text.match(GIRDLE_WIDTH)?.[0]?.trim();
  const faceted =
    GIRDLE_FACETED.test(text) || /\(fa[oc]s?t[et]d\)|\(acetec\)/i.test(text);
  const pct = collectPercents(text).find(
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

function assignGirdleFromBands(
  bands: GiaDiagramBandOcr[],
): GiaDiagramFieldResult {
  for (const band of bands) {
    const result = assignGirdle(band);
    if (result.parsedValue) return result;
  }
  return mk("girdle", null, null, "none", "no girdle in candidate bands");
}

function assignCuletFromBands(
  bands: GiaDiagramBandOcr[],
): GiaDiagramFieldResult {
  for (const band of bands) {
    const result = assignCulet(band);
    if (result.parsedValue) return result;
  }
  return mk("culet", null, null, "none", "no culet in candidate bands");
}

function assignCulet(band: GiaDiagramBandOcr): GiaDiagramFieldResult {
  const text = normalizeBandText(band.text);
  if (/\bnone\b/i.test(text)) {
    return mk("culet", band, "None", "medium", "culet none token read from band");
  }
  const m = text.match(CULET_SIZE);
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

function assignDegreeFromBands(
  field: "crownAngle" | "pavilionAngle",
  bands: GiaDiagramBandOcr[],
  used: Set<number>,
): GiaDiagramFieldResult {
  for (const band of bands) {
    const result = assignDegree(field, band, used);
    if (result.parsedValue) return result;
  }
  return mk(
    field,
    null,
    null,
    "none",
    `no ${field} in candidate bands`,
  );
}

function parseColoredSimplifiedDiagramFields(
  bands: GiaDiagramBandOcr[],
): GiaDiagramFieldResult[] {
  const byId = new Map(bands.map((b) => [b.id, b]));
  const headerBand =
    byId.get("proportions-header") ?? byId.get("header") ?? null;
  const stackBand =
    byId.get("proportions-stack") ?? byId.get("table") ?? null;
  const girdleBand = byId.get("girdle") ?? null;
  const culetBand = byId.get("culet") ?? byId.get("culet-depth") ?? null;
  const usedPct = new Set<number>();

  const angleNote =
    "GIA_NATURAL_COLORED_SIMPLIFIED: crown/pavilion not on report diagram";
  const results: GiaDiagramFieldResult[] = [
    mk("crownAngle", null, null, "none", angleNote),
    mk("pavilionAngle", null, null, "none", angleNote),
    headerBand
      ? assignPercent("tablePercent", headerBand, usedPct)
      : mk("tablePercent", null, null, "none", "table band not rendered"),
    stackBand
      ? assignDepthPercent(stackBand, usedPct)
      : mk("depthPercent", null, null, "none", "depth band not rendered"),
    mk("lowerHalfPercent", null, null, "none", angleNote),
    mk("starLengthPercent", null, null, "none", angleNote),
    girdleBand
      ? assignGirdle(girdleBand)
      : mk("girdle", null, null, "none", "girdle band not rendered"),
    culetBand
      ? assignCulet(culetBand)
      : mk("culet", null, null, "none", "culet band not rendered"),
  ];

  return GIA_DIAGRAM_TARGET_FIELDS.map(
    (f) => results.find((r) => r.field === f)!,
  );
}

function parseDiagramFields(
  bands: GiaDiagramBandOcr[],
  style: GiaReportStyle,
): GiaDiagramFieldResult[] {
  if (style === "GIA_NATURAL_COLORED_SIMPLIFIED") {
    return parseColoredSimplifiedDiagramFields(bands);
  }

  const byId = new Map(bands.map((b) => [b.id, b]));
  const usedDeg = new Set<number>();
  const usedPct = new Set<number>();

  const headerBand = byId.get("header");
  const tableBand = byId.get("table") ?? byId.get("stack");
  const crownAngleBand = byId.get("crown-angle");
  const regionBand = byId.get("lgdr-diagram-region");
  const crownBand = byId.get("crown");
  const girdleBand = byId.get("girdle");
  const pavBand = byId.get("pavilion");
  const culetBand = byId.get("culet-depth") ?? byId.get("culet");

  const stackBands = [
    headerBand,
    crownAngleBand,
    regionBand,
    tableBand,
    crownBand,
  ].filter(Boolean) as GiaDiagramBandOcr[];

  const results: GiaDiagramFieldResult[] = [];

  results.push(
    assignDegreeFromBands("crownAngle", stackBands, usedDeg),
  );
  results.push(
    assignDegreeFromBands(
      "pavilionAngle",
      [pavBand, crownBand, tableBand, headerBand].filter(
        Boolean,
      ) as GiaDiagramBandOcr[],
      usedDeg,
    ),
  );

  const tableSource = headerBand ?? tableBand ?? crownBand;
  results.push(
    tableSource
      ? style === "GIA_LGDR_DOSSIER" && tableSource === headerBand
        ? assignLgdrTablePercent(tableSource, usedPct)
        : assignPercent("tablePercent", tableSource, usedPct)
      : mk("tablePercent", null, null, "none", "table band not rendered"),
  );

  let depthResult = culetBand
    ? assignDepthPercent(culetBand, usedPct)
    : mk("depthPercent", null, null, "none", "depth band not rendered");
  if (!depthResult.parsedValue) {
    const depthFallbackBands =
      style === "GIA_LGDR_DOSSIER"
        ? [regionBand, tableBand, crownBand, headerBand]
        : [tableBand, crownBand, headerBand];
    for (const band of depthFallbackBands) {
      if (!band) continue;
      const tryDepth = assignDepthPercent(band, usedPct);
      if (tryDepth.parsedValue) {
        depthResult = tryDepth;
        break;
      }
    }
  }
  results.push(depthResult);

  const starSource = headerBand ?? crownBand;
  results.push(
    starSource
      ? assignPercent("starLengthPercent", starSource, usedPct)
      : mk("starLengthPercent", null, null, "none", "star band not rendered"),
  );

  let lowerResult = pavBand
    ? assignPercent("lowerHalfPercent", pavBand, usedPct)
    : mk("lowerHalfPercent", null, null, "none", "pavilion band not rendered");
  if (!lowerResult.parsedValue) {
    for (const band of [tableBand, crownBand]) {
      if (!band) continue;
      const tryLower = assignPercent("lowerHalfPercent", band, usedPct);
      if (tryLower.parsedValue) {
        lowerResult = tryLower;
        break;
      }
    }
  }
  results.push(lowerResult);

  const girdleBands =
    style === "GIA_LGDR_DOSSIER"
      ? ([girdleBand, headerBand, regionBand, tableBand, crownBand].filter(
          Boolean,
        ) as GiaDiagramBandOcr[])
      : girdleBand
        ? [girdleBand]
        : [];
  results.push(
    girdleBands.length > 0
      ? assignGirdleFromBands(girdleBands)
      : mk("girdle", null, null, "none", "girdle band not rendered"),
  );

  const culetBands =
    style === "GIA_LGDR_DOSSIER"
      ? ([culetBand, tableBand, crownBand, regionBand, headerBand].filter(
          Boolean,
        ) as GiaDiagramBandOcr[])
      : culetBand
        ? [culetBand]
        : [];
  results.push(
    culetBands.length > 0
      ? assignCuletFromBands(culetBands)
      : mk("culet", null, null, "none", "culet band not rendered"),
  );

  return GIA_DIAGRAM_TARGET_FIELDS.map(
    (f) => results.find((r) => r.field === f)!,
  );
}

/** Test seam — parse diagram fields from recorded band OCR without image IO. */
export function parseGiaDiagramFieldsFromBands(
  bands: GiaDiagramBandOcr[],
  style: GiaReportStyle,
): GiaDiagramFieldResult[] {
  return parseDiagramFields(bands, style);
}

const INTERNAL_RANGES = {
  crownHeightPercent: { min: 8, max: 20 },
  pavilionDepthPercent: { min: 38, max: 47 },
  girdleThicknessPercent: { min: 1, max: 8 },
} as const;

function usedPublicPercents(fields: GiaDiagramFieldResult[]): Set<number> {
  const used = new Set<number>();
  for (const row of fields) {
    if (!row.parsedValue) continue;
    const n = parseFloat(row.parsedValue.replace(/%/g, ""));
    if (Number.isFinite(n)) used.add(n);
  }
  return used;
}

function pickInternalPercent(
  bands: GiaDiagramBandOcr[],
  range: { min: number; max: number },
  used: Set<number>,
): { value: string; bandId: string } | null {
  for (const band of bands) {
    for (const n of collectPercents(band.text)) {
      if (n >= range.min && n <= range.max && !used.has(n)) {
        used.add(n);
        return { value: fmtPct(n), bandId: band.id };
      }
    }
  }
  return null;
}

function parseInternalDiagramFields(
  bands: GiaDiagramBandOcr[],
  publicFields: GiaDiagramFieldResult[],
  style: GiaReportStyle,
): Partial<GiaInternalFields> {
  if (style === "GIA_NATURAL_COLORED_SIMPLIFIED") {
    return {};
  }

  const used = usedPublicPercents(publicFields);
  const headerAndStack = bands.filter((b) =>
    ["header", "table", "stack", "crown"].includes(b.id),
  );
  const girdleBand = bands.find((b) => b.id === "girdle");

  const internal: Partial<GiaInternalFields> = {};

  const crownHeight = pickInternalPercent(
    headerAndStack,
    INTERNAL_RANGES.crownHeightPercent,
    used,
  );
  if (crownHeight) internal.crownHeightPercent = crownHeight.value;

  const pavilionDepth = pickInternalPercent(
    headerAndStack,
    INTERNAL_RANGES.pavilionDepthPercent,
    used,
  );
  if (pavilionDepth) internal.pavilionDepthPercent = pavilionDepth.value;

  if (girdleBand) {
    const girdlePct = pickInternalPercent(
      [girdleBand],
      INTERNAL_RANGES.girdleThicknessPercent,
      used,
    );
    if (girdlePct) internal.girdleThicknessPercent = girdlePct.value;
  }

  return internal;
}

/** Diagram is "located" when its OCR shows the expected numeric signature. */
function validateDiagramSignature(
  bandTexts: string[],
  style: GiaReportStyle,
): {
  located: boolean;
  reason: string;
} {
  const joined = bandTexts.join("\n");
  const degrees = collectDegrees(joined).length;
  const percents = collectPercents(joined).length;

  if (style === "GIA_NATURAL_COLORED_SIMPLIFIED") {
    if (percents >= 1) {
      return {
        located: true,
        reason: `colored simplified signature ok (${percents} percent(s))`,
      };
    }
    return {
      located: false,
      reason: `colored simplified weak signature (${percents} percent(s))`,
    };
  }

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

function layoutBands(layout: GiaDiagramLayout): DiagramBand[] {
  switch (layout) {
    case "lgdr-dossier":
      return GIA_LGDR_DOSSIER_VALUE_BANDS;
    case "colored-simplified":
      return GIA_NATURAL_COLORED_SIMPLIFIED_BANDS;
    default:
      return GIA_DIAGRAM_VALUE_BANDS;
  }
}

function layoutRegion(layout: GiaDiagramLayout): CropRegion {
  switch (layout) {
    case "lgdr-dossier":
      return GIA_LGDR_DOSSIER_DIAGRAM_REGION;
    case "colored-simplified":
      return GIA_COLORED_SIMPLIFIED_DIAGRAM_REGION;
    default:
      return GIA_PROPORTION_DIAGRAM_REGION;
  }
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

async function extractGiaProportionDiagramForRenderedPage(
  rendered: RenderedPdfPage,
  layout: GiaDiagramLayout,
  opts?: { reportNumber?: string },
): Promise<GiaDiagramExtractionReport> {
  const reportStyle = styleFromLayout(layout);
  const region = layoutRegion(layout);
  const valueBands = layoutBands(layout);
  const empty = (
    ocrAvailable: boolean,
    reason: string,
  ): GiaDiagramExtractionReport => ({
    ocrAvailable,
    diagramLocated: false,
    locateReason: reason,
    reportStyle,
    region,
    bands: [],
    fields: GIA_DIAGRAM_TARGET_FIELDS.map((f) =>
      mk(f, null, null, "none", reason),
    ),
  });

  const diagramValueBands =
    layout === "colored-simplified"
      ? valueBands.filter((b) => b.id.startsWith("proportions-"))
      : valueBands;

  const maxScale = Math.max(...diagramValueBands.map((b) => b.scale));

  const bands: GiaDiagramBandOcr[] = [];
  const bandCropPngs: Array<{ id: string; raw: Buffer; preprocessed?: Buffer }> =
    [];
  for (const band of diagramValueBands) {
    const cropped = await cropRegionPng(rendered, band.crop);
    if (!cropped) continue;
    const prepped = await preprocessCropPng(cropped.png, band.preprocess);
    const rawOcr = await ocrImageBuffer(cropped.png);
    const preppedOcr =
      layout === "colored-simplified"
        ? rawOcr
        : await ocrImageBuffer(prepped);
    const text = [rawOcr.text, preppedOcr.text].filter(Boolean).join("\n").trim();
    bands.push({
      id: band.id,
      crop: band.crop,
      preprocess: band.preprocess,
      scale: band.scale,
      width: cropped.width,
      height: cropped.height,
      text,
    });
    bandCropPngs.push({ id: band.id, raw: cropped.png, preprocessed: prepped });
  }

  if (layout === "lgdr-dossier") {
    const regionCrop = await cropRegionPng(rendered, region);
    if (regionCrop) {
      const prepped = await preprocessCropPng(regionCrop.png, "threshold");
      const rawOcr = await ocrImageBuffer(regionCrop.png);
      const preppedOcr = await ocrImageBuffer(prepped);
      const text = [rawOcr.text, preppedOcr.text].filter(Boolean).join("\n").trim();
      bands.push({
        id: "lgdr-diagram-region",
        crop: region,
        preprocess: "threshold",
        scale: maxScale,
        width: regionCrop.width,
        height: regionCrop.height,
        text,
      });
      bandCropPngs.push({
        id: "lgdr-diagram-region",
        raw: regionCrop.png,
        preprocessed: prepped,
      });
    }
  }

  const signature = validateDiagramSignature(
    bands.map((b) => b.text),
    reportStyle,
  );
  let fields = parseDiagramFields(bands, reportStyle);
  let lgdrDiagramRetry: GiaDiagramExtractionReport["lgdrDiagramRetry"];

  if (layout === "lgdr-dossier") {
    const { attemptLgdrDiagramOcrRetry } = await import("./gia-lgdr-diagram-retry");
    const retryResult = await attemptLgdrDiagramOcrRetry({
      rendered,
      bands,
      fields,
      bandCropPngs: bandCropPngs.map((b) => ({ id: b.id, raw: b.raw })),
    });
    if (retryResult) {
      fields = retryResult.fields;
      for (const updated of retryResult.bands) {
        const idx = bands.findIndex((b) => b.id === updated.id);
        if (idx >= 0) bands[idx] = updated;
      }
      lgdrDiagramRetry = retryResult.diagnostic;
    }
  }

  const internal = parseInternalDiagramFields(bands, fields, reportStyle);

  const report: GiaDiagramExtractionReport = {
    ocrAvailable: true,
    diagramLocated: signature.located,
    locateReason: `${layout}: ${signature.reason}`,
    reportStyle,
    region,
    bands,
    fields,
    internal,
    lgdrDiagramRetry,
  };

  if (giaDiagramDebugEnabled(opts?.reportNumber)) {
    const diagramRegionPng = await cropRegionPng(rendered, region);
    exportGiaDiagramDebugArtifacts({
      reportNumber: opts?.reportNumber ?? "unknown",
      reportStyle,
      pagePng: rendered.png,
      diagramRegionPng: diagramRegionPng?.png ?? null,
      report,
      bandCropPngs,
    });
  }

  return report;
}

async function extractGiaProportionDiagramForLayout(
  pdfBytes: Buffer,
  layout: GiaDiagramLayout,
  page: number,
  opts?: { reportNumber?: string },
): Promise<GiaDiagramExtractionReport> {
  const reportStyle = styleFromLayout(layout);
  const region = layoutRegion(layout);
  const empty = (
    ocrAvailable: boolean,
    reason: string,
  ): GiaDiagramExtractionReport => ({
    ocrAvailable,
    diagramLocated: false,
    locateReason: reason,
    reportStyle,
    region,
    bands: [],
    fields: GIA_DIAGRAM_TARGET_FIELDS.map((f) =>
      mk(f, null, null, "none", reason),
    ),
  });

  if (!(await isOcrRuntimeAvailable())) {
    return empty(false, "OCR runtime not available");
  }

  const diagramValueBands =
    layout === "colored-simplified"
      ? layoutBands(layout).filter((b) => b.id.startsWith("proportions-"))
      : layoutBands(layout);

  const maxScale = Math.max(...diagramValueBands.map((b) => b.scale));
  const rendered =
    layout === "lgdr-dossier"
      ? await renderPdfPagePngLgdrDossier(pdfBytes, page, maxScale)
      : await renderPdfPagePngAtScale(pdfBytes, page, maxScale);
  if (!rendered) return empty(true, `could not render PDF page ${page}`);

  return extractGiaProportionDiagramForRenderedPage(rendered, layout, opts);
}

// ─────────────────────────────── entry point ───────────────────────────────

export async function extractGiaProportionDiagram(
  pdfBytes: Buffer,
  opts?: {
    page?: number;
    layout?: GiaDiagramLayout;
    tryLayouts?: boolean;
    combinedText?: string;
    reportNumber?: string;
  },
): Promise<GiaDiagramExtractionReport> {
  const page = opts?.page ?? 1;
  const region = GIA_PROPORTION_DIAGRAM_REGION;
  const styleDetection = opts?.combinedText
    ? detectGiaReportStyle(opts.combinedText)
    : null;
  const empty = (
    ocrAvailable: boolean,
    reason: string,
  ): GiaDiagramExtractionReport => ({
    ocrAvailable,
    diagramLocated: false,
    locateReason: reason,
    reportStyle: styleDetection?.style,
    region,
    bands: [],
    fields: GIA_DIAGRAM_TARGET_FIELDS.map((f) =>
      mk(f, null, null, "none", reason),
    ),
  });

  if (!(await isOcrRuntimeAvailable())) {
    return empty(false, "OCR runtime not available");
  }

  const primaryLayout = opts?.layout ?? styleDetection?.layout ?? "facsimile";
  const layouts: GiaDiagramLayout[] = opts?.layout
    ? [opts.layout]
    : opts?.tryLayouts === false
      ? [primaryLayout]
      : primaryLayout === "colored-simplified"
        ? ["colored-simplified"]
        : primaryLayout === "lgdr-dossier"
          ? ["lgdr-dossier", "facsimile"]
          : styleDetection?.style === "GIA_UNKNOWN"
            ? ["facsimile", "lgdr-dossier", "colored-simplified"]
            : ["facsimile", "lgdr-dossier"];

  let best: GiaDiagramExtractionReport | null = null;
  for (const layout of layouts) {
    const result = await extractGiaProportionDiagramForLayout(
      pdfBytes,
      layout,
      page,
      { reportNumber: opts?.reportNumber },
    );
    best = best ? pickBetterDiagramReport(best, result) : result;
    if (result.diagramLocated && countAssignedFields(result) >= 6) break;
  }
  return best ?? empty(true, "no layout produced a diagram report");
}

/** Screenshot/JPG upload — band OCR on the uploaded image instead of a PDF render. */
export async function extractGiaProportionDiagramFromImage(
  imageBytes: Buffer,
  opts?: {
    layout?: GiaDiagramLayout;
    tryLayouts?: boolean;
    combinedText?: string;
    reportNumber?: string;
  },
): Promise<GiaDiagramExtractionReport> {
  const styleDetection = opts?.combinedText
    ? detectGiaReportStyle(opts.combinedText)
    : null;
  const region = GIA_PROPORTION_DIAGRAM_REGION;
  const empty = (
    ocrAvailable: boolean,
    reason: string,
  ): GiaDiagramExtractionReport => ({
    ocrAvailable,
    diagramLocated: false,
    locateReason: reason,
    reportStyle: styleDetection?.style,
    region,
    bands: [],
    fields: GIA_DIAGRAM_TARGET_FIELDS.map((f) =>
      mk(f, null, null, "none", reason),
    ),
  });

  if (!(await isOcrRuntimeAvailable())) {
    return empty(false, "OCR runtime not available");
  }

  const rendered = await renderUploadImageAsPage(imageBytes);
  if (!rendered) return empty(true, "could not load uploaded image");

  const primaryLayout = opts?.layout ?? styleDetection?.layout ?? "facsimile";
  const layouts: GiaDiagramLayout[] = opts?.layout
    ? [opts.layout]
    : opts?.tryLayouts === false
      ? [primaryLayout]
      : primaryLayout === "colored-simplified"
        ? ["colored-simplified"]
        : primaryLayout === "lgdr-dossier"
          ? ["lgdr-dossier", "facsimile"]
          : styleDetection?.style === "GIA_UNKNOWN"
            ? ["facsimile", "lgdr-dossier", "colored-simplified"]
            : ["facsimile", "lgdr-dossier"];

  let best: GiaDiagramExtractionReport | null = null;
  for (const layout of layouts) {
    const result = await extractGiaProportionDiagramForRenderedPage(
      rendered,
      layout,
      { reportNumber: opts?.reportNumber },
    );
    best = best ? pickBetterDiagramReport(best, result) : result;
    if (result.diagramLocated && countAssignedFields(result) >= 6) break;
  }
  return best ?? empty(true, "no layout produced a diagram report from image");
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
  reportStyle: GiaReportStyle;
  diagramLocated: boolean;
  locateReason: string;
  applied: Partial<Record<ReportFieldKey, string>>;
  internalApplied?: Partial<GiaInternalFields>;
  skipped: Array<{ field: ReportFieldKey; reason: string }>;
  lgdrDiagramRetry?: import("./gia-lgdr-diagram-retry").LgdrDiagramRetryDiagnostic;
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
  documentBytes: Buffer,
  combinedText: string,
  fields: CalibrationReportFields,
  giaInternal: GiaInternalFields | undefined,
  set: FieldSetter,
  opts?: {
    reportNumber?: string;
    layout?: GiaDiagramLayout;
    /** When true, documentBytes is a screenshot/JPG rather than PDF. */
    imageUpload?: boolean;
  },
): Promise<GiaDiagramApplyReport> {
  const styleDetection = detectGiaReportStyle(combinedText);
  const gate = shouldRunGiaProportionDiagramExtraction(fields, combinedText, {
    lab: "GIA",
  });
  const skipped: GiaDiagramApplyReport["skipped"] = [];
  const applied: GiaDiagramApplyReport["applied"] = {};
  const internalApplied: Partial<GiaInternalFields> = {};

  if (!gate.run) {
    return {
      layout: styleDetection.layout,
      reportStyle: styleDetection.style,
      diagramLocated: false,
      locateReason: gate.reason,
      applied,
      skipped: GIA_DIAGRAM_TARGET_FIELDS.map((f) => ({
        field: f,
        reason: gate.reason,
      })),
    };
  }

  // Scatter OCR often duplicates table % as depth when the diagram is image-only.
  if (
    fields.depthPercent.trim() &&
    fields.tablePercent.trim() &&
    fields.depthPercent.trim() === fields.tablePercent.trim()
  ) {
    fields.depthPercent = "";
  }

  const hintedLayout = opts?.layout ?? styleDetection.layout;
  const diagram = opts?.imageUpload
    ? await extractGiaProportionDiagramFromImage(documentBytes, {
        layout: hintedLayout,
        tryLayouts: !opts?.layout && styleDetection.style === "GIA_UNKNOWN",
        combinedText,
        reportNumber: opts?.reportNumber,
      })
    : await extractGiaProportionDiagram(documentBytes, {
        layout: hintedLayout,
        tryLayouts: !opts?.layout && styleDetection.style === "GIA_UNKNOWN",
        combinedText,
        reportNumber: opts?.reportNumber,
      });
  const layout = diagram.locateReason.startsWith("lgdr-dossier")
    ? "lgdr-dossier"
    : diagram.locateReason.startsWith("colored-simplified")
      ? "colored-simplified"
      : diagram.locateReason.startsWith("facsimile")
        ? "facsimile"
        : hintedLayout;
  const reportStyle = diagram.reportStyle ?? styleDetection.style;

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

  if (diagram.internal && giaInternal) {
    for (const key of [
      "crownHeightPercent",
      "pavilionDepthPercent",
      "girdleThicknessPercent",
    ] as const) {
      const v = diagram.internal[key];
      if (!v?.trim() || giaInternal[key]?.trim()) continue;
      giaInternal[key] = v.trim();
      internalApplied[key] = v.trim();
    }
  }

  // LGDR dossier: band degree glyphs are often missing — reuse text-layer scatter
  // on merged band OCR when diagram assignDegree did not recover crown.
  if (
    reportStyle === "GIA_LGDR_DOSSIER" &&
    !fields.crownAngle.trim() &&
    diagram.bands.length > 0
  ) {
    const bandText = diagram.bands
      .map((b) => b.text)
      .filter((t) => t.trim())
      .join("\n\n");
    if (bandText.trim()) {
      const before = fields.crownAngle.trim();
      extractGiaOcrProportionDiagram(bandText, fields, set, giaInternal);
      applyGiaOcrFieldHydrationFallback(bandText, fields, set);
      if (fields.crownAngle.trim() && fields.crownAngle.trim() !== before) {
        applied.crownAngle = fields.crownAngle.trim();
      }
    }
  }

  return {
    layout,
    reportStyle,
    diagramLocated: diagram.diagramLocated,
    locateReason: diagram.locateReason,
    applied,
    internalApplied:
      Object.keys(internalApplied).length > 0 ? internalApplied : undefined,
    skipped,
    lgdrDiagramRetry: diagram.lgdrDiagramRetry,
  };
}

const PAVILION_CLIENT_BAND_IDS = ["pavilion", "crown", "table", "header"] as const;

/**
 * Client fast path: when table/depth/crown are already recovered from the text
 * layer, run a single render + pavilion-band OCR only (~3s).
 */
export async function applyGiaClientPavilionDiagramOcr(
  pdfBytes: Buffer,
  fields: CalibrationReportFields,
  set: FieldSetter,
): Promise<{ applied: boolean; value?: string; bandId?: string }> {
  if (fields.pavilionAngle.trim()) return { applied: false };
  if (!(await isOcrRuntimeAvailable())) return { applied: false };

  const rendered = await renderPdfPagePngAtScale(pdfBytes, 1, 5);
  if (!rendered) return { applied: false };

  const usedDeg = new Set<number>();
  for (const bandId of ["pavilion", "crown"] as const) {
    const bandDef = GIA_DIAGRAM_VALUE_BANDS.find((b) => b.id === bandId);
    if (!bandDef) continue;
    const cropped = await cropRegionPng(rendered, bandDef.crop);
    if (!cropped) continue;
    const prepped = await preprocessCropPng(cropped.png, bandDef.preprocess);
    const rawOcr = await ocrImageBuffer(cropped.png);
    const preppedOcr = await ocrImageBuffer(prepped);
    const text = [rawOcr.text, preppedOcr.text].filter(Boolean).join("\n").trim();
    const band: GiaDiagramBandOcr = {
      id: bandDef.id,
      crop: bandDef.crop,
      preprocess: bandDef.preprocess,
      scale: bandDef.scale,
      width: cropped.width,
      height: cropped.height,
      text,
    };
    const result = assignDegree("pavilionAngle", band, usedDeg);
    if (!result.parsedValue) continue;
    const value = normalizeDiagramFieldValue("pavilionAngle", result.parsedValue);
    if (!value) continue;
    set("pavilionAngle", value, "medium");
    return { applied: true, value, bandId: band.id };
  }
  return { applied: false };
}

/**
 * Client fast path: run a single render + crown-band OCR only (~3s).
 * Used when pavilion/table/depth are already present but crown is missing.
 */
async function ocrGiaClientCrownBandText(
  rendered: RenderedPdfPage,
  bandDef: GiaDiagramBandDef,
): Promise<string> {
  const cropped = await cropRegionPng(rendered, bandDef.crop);
  if (!cropped) return "";
  const prepped = await preprocessCropPng(cropped.png, bandDef.preprocess);
  const rawOcr = await ocrImageBuffer(cropped.png);
  const preppedOcr = await ocrImageBuffer(prepped);
  return [rawOcr.text, preppedOcr.text].filter(Boolean).join("\n").trim();
}

function tryAssignCrownFromBandOcr(
  fields: CalibrationReportFields,
  set: FieldSetter,
  bandDef: GiaDiagramBandDef,
  text: string,
  cropped: { width: number; height: number },
): { applied: boolean; value?: string; bandId?: string } {
  if (!text.trim() || fields.crownAngle.trim()) {
    return { applied: false };
  }
  const band: GiaDiagramBandOcr = {
    id: bandDef.id,
    crop: bandDef.crop,
    preprocess: bandDef.preprocess,
    scale: bandDef.scale,
    width: cropped.width,
    height: cropped.height,
    text,
  };
  const usedDeg = new Set<number>();
  const pavilion = parseFloat(fields.pavilionAngle.trim());
  if (Number.isFinite(pavilion)) usedDeg.add(pavilion);

  const result = assignDegree("crownAngle", band, usedDeg);
  if (result.parsedValue) {
    const value = normalizeDiagramFieldValue("crownAngle", result.parsedValue);
    if (value) {
      set("crownAngle", value, "medium");
      return { applied: true, value, bandId: band.id };
    }
  }

  const before = fields.crownAngle.trim();
  extractGiaOcrProportionDiagram(text, fields, set, {});
  const after = fields.crownAngle.trim();
  if (after && after !== before) {
    return { applied: true, value: after, bandId: band.id };
  }
  return { applied: false };
}

export async function applyGiaClientCrownDiagramOcr(
  pdfBytes: Buffer,
  fields: CalibrationReportFields,
  set: FieldSetter,
): Promise<{ applied: boolean; value?: string; bandId?: string }> {
  if (fields.crownAngle.trim()) return { applied: false };
  if (!(await isOcrRuntimeAvailable())) return { applied: false };

  const rendered = await renderPdfPagePngAtScale(pdfBytes, 1, 6);
  if (!rendered) return { applied: false };

  for (const bandId of ["crown", "header"] as const) {
    const bandDef = GIA_DIAGRAM_VALUE_BANDS.find((b) => b.id === bandId);
    if (!bandDef) continue;
    const cropped = await cropRegionPng(rendered, bandDef.crop);
    if (!cropped) continue;
    const text = await ocrGiaClientCrownBandText(rendered, bandDef);
    const assigned = tryAssignCrownFromBandOcr(
      fields,
      set,
      bandDef,
      text,
      cropped,
    );
    if (assigned.applied) return assigned;
  }
  return { applied: false };
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
