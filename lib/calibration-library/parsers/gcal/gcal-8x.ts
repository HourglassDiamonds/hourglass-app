import type {
  CalibrationReportFields,
  FieldConfidence,
  Gcal8xParserConfidence,
  GcalInternalFields,
  ReportFieldKey,
} from "../../types";

type FieldSetter = (
  key: ReportFieldKey,
  value: string,
  level: FieldConfidence,
) => void;

const REJECT_VALUE =
  /\b(?:fingerprint|certificate|assurance|ultimate|diamond\s+grading|your\s+lab\s+grown|gem\s+certification)\b/i;

const PROPORTION_WINDOW_BEFORE = 2200;
const PROPORTION_WINDOW_AFTER = 2200;
const REPAIRED_PROPORTION_PREVIEW_CHARS = 200;

export type GcalGradingIslandMatches = {
  shape?: string;
  carat?: string;
  measurements?: string;
  fluorescence?: string;
  culet?: string;
  girdle?: string;
  polish?: string;
  symmetry?: string;
  cutGrade?: string;
};

export type GcalProportionNumericCandidates = {
  percents: number[];
  degrees: number[];
  mmValues: number[];
};

export type GcalProportionIslandMatches = {
  tablePercent?: string;
  starLengthPercent?: string;
  crownAngle?: string;
  crownHeightPercent?: string;
  pavilionAngle?: string;
  pavilionDepthPercent?: string;
  lowerHalfPercent?: string;
  depthPercent?: string;
  girdleThicknessPercent?: string;
  culetSizeMm?: string;
};

/** Normalize GCAL OCR (collapse whitespace, fix numerals; keep % and °). */
export function normalizeGcal8xOcrText(text: string): string {
  if (!text.trim()) return "";
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\u00b0/g, "°")
    .replace(/[°º˚]/g, "°")
    .replace(/(\d)O\.(\d)/gi, "$10.$2")
    .replace(/(\d)\s*,\s*(\d)/g, "$1.$2")
    .replace(/(\d)\s+\.\s+(\d)/g, "$1.$2")
    .replace(/(\d)\s+(\d{1,2})\s*(?=°|H\b)/gi, (_, a, b) => `${a}.${b}`)
    .replace(/(\d{1,3}(?:\.\d+)?)\s*H\b/gi, "$1°")
    .replace(/(\d)\s*O\b(?!\w)/gi, "$1°")
    .replace(/(\d)\s*%/g, "$1%")
    .replace(/(\d)\s*°/g, "$1°")
    .replace(/[×✕]/g, "x")
    .replace(/\s+/g, " ")
    .trim();
}

/** @deprecated Use normalizeGcal8xOcrText — kept for extract-file window helper. */
export const normalizeGcal8xWindowText = normalizeGcal8xOcrText;

/**
 * GCAL proportion-diagram only: repair collapsed OCR numerals (345° → 34.5°, 147mm → 14.7%).
 * Preserves stone measurement strings (7.98-8.01 x 4.88mm, 0.02mm, 7.99mm).
 */
export function repairGcalDiagramNumericSoup(text: string): string {
  const placeholders: string[] = [];
  let s = text;

  const protect = (re: RegExp) => {
    s = s.replace(re, (m) => {
      const i = placeholders.length;
      placeholders.push(m);
      return `__GCAL_MEAS_${i}__`;
    });
  };

  // Split OCR-flattened width (e.g. "4 88mm" → "4.88mm") before protecting measurements.
  s = s.replace(/\b(\d)\s+(\d{2})\s*mm\b/gi, "$1.$2mm");

  protect(/\b\d\.\d{2}\s*[-–—]\s*\d\.\d{2}\s*x\s*\d(?:\.\d{1,2})?\s*mm\b/gi);
  protect(/\b0\.0\d{1,2}\s*mm\b/gi);
  protect(/\b\d\.\d{2}\s*mm\b/gi);

  // Collapsed diagram numerals (345° → 34.5°, 611% → 61.1%). No trailing \b after °/% (non-word).
  s = s.replace(/\b(\d{2})(\d)°/g, "$1.$2°");
  s = s.replace(/\b(\d{2})(\d)%/g, "$1.$2%");
  s = s.replace(/\b(\d{2})(\d)mm\b/g, "$1.$2%");
  s = s.replace(/\b(\d)(\d)mm\b/g, "$1.$2%");

  for (let i = 0; i < placeholders.length; i++) {
    s = s.replaceAll(`__GCAL_MEAS_${i}__`, placeholders[i]!);
  }

  return s;
}

/** Normalize then repair — use for all proportion-diagram numeric extraction. */
export function prepareGcal8xProportionDiagramText(text: string): string {
  return repairGcalDiagramNumericSoup(normalizeGcal8xOcrText(text));
}

export type Gcal8xFocusedWindows = {
  gradingWindow: string;
  proportionWindow: string;
  rawProportionSlice: string;
};

/** Proportion diagram locality only (grading uses full-text islands). */
export function extractGcal8xFocusedWindows(rawText: string): Gcal8xFocusedWindows {
  const source = rawText.replace(/\r\n/g, "\n");
  const diagramIdx = source.search(/proportion\s+diagram/i);
  const proportionCenter = diagramIdx >= 0 ? diagramIdx : -1;

  const proportionSlice =
    proportionCenter >= 0
      ? source.slice(
          Math.max(0, proportionCenter - PROPORTION_WINDOW_BEFORE),
          Math.min(
            source.length,
            proportionCenter + PROPORTION_WINDOW_AFTER,
          ),
        )
      : "";

  return {
    gradingWindow: "",
    proportionWindow: normalizeGcal8xOcrText(proportionSlice),
    rawProportionSlice: proportionSlice,
  };
}

/** Flat screenshot OCR often omits the Proportion Diagram heading — use full text. */
export function extractGcal8xFocusedWindowsForScreenshot(
  rawText: string,
): Gcal8xFocusedWindows {
  const base = extractGcal8xFocusedWindows(rawText);
  if (base.proportionWindow.trim()) return base;
  const norm = normalizeGcal8xOcrText(rawText);
  return {
    gradingWindow: "",
    proportionWindow: norm,
    rawProportionSlice: rawText,
  };
}

function fixNumericOcr(s: string): string {
  return s
    .replace(/(\d)O\.(\d)/gi, "$10.$2")
    .replace(/(\d)O(\d)/gi, "$10$2")
    .replace(/(\d)O\b/gi, "$10")
    .replace(/\bO(\d)/g, "0$1");
}

function isRejectedGcal8xValue(value: string): boolean {
  const v = value.trim();
  if (!v) return true;
  if (REJECT_VALUE.test(v)) return true;
  if (/\bGCAL\b/i.test(v)) return true;
  if (v.length > 48) return true;
  if (/\d\.\d{2}\s*[-–—]\s*\d\.\d{2}\s*x\s*\d\.\d{2}/i.test(v)) return false;
  if (/[.!?]/.test(v) && v.split(/\s+/).length > 6) return true;
  return false;
}

function titleCaseWord(w: string): string {
  const lower = w.toLowerCase();
  if (lower === "to") return "to";
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function titleCasePhrase(phrase: string): string {
  return phrase
    .split(/\s+/)
    .map((w) => titleCaseWord(w))
    .join(" ");
}

/**
 * Whitelisted short-pattern grading islands — does not require label adjacency.
 */
export function extractGcal8xGradingIslands(
  rawText: string,
): GcalGradingIslandMatches {
  const norm = normalizeGcal8xOcrText(rawText);
  const matches: GcalGradingIslandMatches = {};

  if (/\bround\s+brilliant\b/i.test(norm)) {
    matches.shape = "Round Brilliant";
  }

  const meas =
    norm.match(
      /\bmeasurements?\s+(\d\.\d{2})\s*[-–—]\s*(\d\.\d{2})\s*x\s*(\d\.\d{2})\s*mm?\b/i,
    ) ??
    norm.match(
      /\b(\d\.\d{2})\s*[-–—]\s*(\d\.\d{2})\s*x\s*(\d\.\d{2})\s*mm?\b/i,
    );
  if (meas && !isRejectedGcal8xValue(meas[0])) {
    const a = meas[1]!;
    const b = meas[2]!;
    const c = meas[3]!;
    matches.measurements = `${a} - ${b} x ${c} mm`;
  }

  const caratPatterns = [
    /carat\s*weight\b[^0-9]{0,48}(\d\.\d{2})/i,
    /\bGCAL\s+LG\d+\s+\w+\s+(\d\.\d{2})\b/i,
    /\bRB\s+(\d\.\d{2})\b/i,
  ];
  for (const re of caratPatterns) {
    const m = norm.match(re);
    if (!m?.[1]) continue;
    const c = parseFloat(fixNumericOcr(m[1]));
    if (c >= 0.2 && c <= 15) {
      matches.carat = m[1];
      break;
    }
  }

  const fl = norm.match(
    /\bfluorescence\s+(none|faint|medium|strong|very\s+strong|negligible)\b/i,
  );
  if (fl?.[1]) matches.fluorescence = titleCasePhrase(fl[1]);

  const culet = norm.match(
    /\bculet\s+(none|pointed|very\s+small|small)\b/i,
  );
  if (culet?.[1]) matches.culet = titleCasePhrase(culet[1]);

  if (/\bmedium\s*,?\s*faceted\b/i.test(norm)) {
    matches.girdle = "Medium, Faceted";
  }

  const polish = norm.match(
    /\bpolish\s+(excellent|very\s+good|good|fair|poor|ideal)\b/i,
  );
  if (polish?.[1]) matches.polish = titleCasePhrase(polish[1]);

  const symmetry = norm.match(
    /\bsymmetry\s+(excellent|very\s+good|good|fair|poor|ideal)\b/i,
  );
  if (symmetry?.[1]) matches.symmetry = titleCasePhrase(symmetry[1]);

  const cutGrade = norm.match(
    /\bcut\s*grade\s+(excellent|very\s+good|good|fair|poor|ideal)\b/i,
  );
  if (cutGrade?.[1]) {
    const mapped = titleCasePhrase(cutGrade[1]);
    const scaleLeak =
      mapped === "Fair" &&
      /\b(?:grading\s+scale|proportion\s+grading\s+scale)\b/i.test(norm);
    if (!scaleLeak) matches.cutGrade = mapped;
  }

  return matches;
}

/** Girdle phrase + thickness from proportion diagram region (supports split OCR lines). */
export function extractGcal8xProportionGirdle(
  rawProportionSlice: string,
  normalizedWindow: string,
): { girdlePhrase?: string; girdleThicknessPercent?: string } {
  const raw = rawProportionSlice.replace(/\r\n/g, "\n");
  const norm = normalizedWindow || normalizeGcal8xOcrText(raw);

  let girdlePhrase: string | undefined;
  if (
    /\bmedium\s*,?\s*faceted\b/i.test(norm) ||
    /\bmedium\s+faceted\b/i.test(norm) ||
    /\bmedium\s*[-–—]\s*faceted\b/i.test(norm) ||
    /medium[\s\n]{1,8}faceted/i.test(raw)
  ) {
    girdlePhrase = "Medium, Faceted";
  }

  let girdleThicknessPercent: string | undefined;
  const thickLabel = norm.match(
    /\bgirdle\s+thickness\b[^%]{0,20}(\d{1,3}(?:\.\d+)?)\s*%/i,
  );
  if (thickLabel?.[1]) {
    const n = parseFloat(fixNumericOcr(thickLabel[1]));
    if (!Number.isNaN(n) && n >= 0.5 && n <= 6) {
      girdleThicknessPercent = formatNum(n);
    }
  }
  if (!girdleThicknessPercent) {
    const pcts: number[] = [];
    for (const m of norm.matchAll(/(?<![\d.])(\d{1,3}(?:\.\d+)?)\s*%/gi)) {
      const n = parseFloat(fixNumericOcr(m[1]!));
      if (!Number.isNaN(n) && n >= 0.5 && n <= 6) pcts.push(n);
    }
    const hit = pickInRange(pcts, new Set(), 0.5, 6);
    if (hit !== undefined) girdleThicknessPercent = formatNum(hit);
  }

  if (!girdlePhrase && girdleThicknessPercent) {
    const n = parseFloat(girdleThicknessPercent);
    if (!Number.isNaN(n) && n >= 2.5 && n <= 4.5) {
      girdlePhrase = "Medium, Faceted";
    }
  }

  return { girdlePhrase, girdleThicknessPercent };
}

function formatNum(n: number): string {
  return Number.isInteger(n) ? String(n) : String(n);
}

function pickCanonical(
  values: number[],
  used: Set<number>,
  target: number,
  tolerance: number,
): number | undefined {
  const hit = values.find(
    (n) => !used.has(n) && Math.abs(n - target) <= tolerance,
  );
  if (hit === undefined) return undefined;
  used.add(hit);
  return hit;
}

function pickInRange(
  values: number[],
  used: Set<number>,
  lo: number,
  hi: number,
): number | undefined {
  const hits = values.filter((n) => n >= lo && n <= hi && !used.has(n));
  if (hits.length === 1) {
    used.add(hits[0]!);
    return hits[0];
  }
  return undefined;
}

function assignPctRole(
  pcts: number[],
  used: Set<number>,
  target: number,
  tolerance: number,
  rangeLo: number,
  rangeHi: number,
): string | undefined {
  const canonical = pickCanonical(pcts, used, target, tolerance);
  if (canonical !== undefined) return formatNum(canonical);
  const ranged = pickInRange(pcts, used, rangeLo, rangeHi);
  return ranged !== undefined ? formatNum(ranged) : undefined;
}

function assignDegRole(
  degs: number[],
  used: Set<number>,
  target: number,
  tolerance: number,
  rangeLo: number,
  rangeHi: number,
): string | undefined {
  const canonical = pickCanonical(degs, used, target, tolerance);
  if (canonical !== undefined) return formatNum(canonical);
  const ranged = pickInRange(degs, used, rangeLo, rangeHi);
  return ranged !== undefined ? formatNum(ranged) : undefined;
}

export function collectGcal8xProportionNumericCandidates(
  proportionWindow: string,
): GcalProportionNumericCandidates {
  const w = prepareGcal8xProportionDiagramText(proportionWindow);
  const percents: number[] = [];
  const degrees: number[] = [];
  const mmValues: number[] = [];

  if (!w) return { percents, degrees, mmValues };

  for (const m of w.matchAll(/(?<![\d.])(\d{1,3}(?:\.\d+)?)\s*%/gi)) {
    const n = parseFloat(fixNumericOcr(m[1]!));
    if (!Number.isNaN(n)) percents.push(n);
  }

  for (const m of w.matchAll(/(?<![\d.])(\d{1,3}(?:\.\d+)?)\s*(?:°|H)/gi)) {
    const n = parseFloat(fixNumericOcr(m[1]!));
    if (!Number.isNaN(n) && n >= 20 && n <= 50) degrees.push(n);
  }

  for (const m of w.matchAll(/\b(3[3-6]\.\d)\b/g)) {
    const n = parseFloat(m[1]!);
    if (!Number.isNaN(n) && n >= 33 && n <= 36.5 && !degrees.includes(n)) {
      degrees.push(n);
    }
  }

  for (const m of w.matchAll(/(?<![\d.])(0\.\d{1,2})\s*mm\b/gi)) {
    const n = parseFloat(m[1]!);
    if (!Number.isNaN(n)) mmValues.push(n);
  }

  return { percents, degrees, mmValues };
}

/**
 * Proportion numeric islands — only within the Proportion Diagram locality window.
 */
export function extractGcal8xProportionIslands(
  proportionWindow: string,
): GcalProportionIslandMatches {
  const w = prepareGcal8xProportionDiagramText(proportionWindow);
  if (!w) return {};

  const { percents: pcts, degrees: degs, mmValues: mmVals } =
    collectGcal8xProportionNumericCandidates(w);

  const usedPct = new Set<number>();
  const usedDeg = new Set<number>();
  const out: GcalProportionIslandMatches = {};

  const table = assignPctRole(pcts, usedPct, 58, 3, 55, 62);
  if (table) out.tablePercent = table;

  const star = assignPctRole(pcts, usedPct, 48, 3, 46, 52);
  if (star) out.starLengthPercent = star;

  const depth = assignPctRole(pcts, usedPct, 61.1, 1.5, 59, 63);
  if (depth) out.depthPercent = depth;

  const crownH = assignPctRole(pcts, usedPct, 14.5, 1.5, 12, 16);
  if (crownH) out.crownHeightPercent = crownH;

  const pavDepth = assignPctRole(pcts, usedPct, 43, 2, 41, 45);
  if (pavDepth) out.pavilionDepthPercent = pavDepth;

  const lower = assignPctRole(pcts, usedPct, 77, 3, 72, 80);
  if (lower) out.lowerHalfPercent = lower;

  const girdlePct = assignPctRole(pcts, usedPct, 3.5, 1.2, 0.5, 6);
  if (girdlePct) out.girdleThicknessPercent = girdlePct;

  const crownA = assignDegRole(degs, usedDeg, 34.5, 1.2, 33, 36.5);
  if (crownA) out.crownAngle = crownA;

  const pavA = assignDegRole(degs, usedDeg, 40.8, 1.5, 40.2, 41.2);
  if (pavA) out.pavilionAngle = pavA;

  const culetMm = mmVals.find((n) => n >= 0.15 && n <= 0.5);
  if (culetMm !== undefined) out.culetSizeMm = formatNum(culetMm);

  fillProportionIslandsFromLabels(w, out, usedPct, usedDeg);

  return out;
}

function fillProportionIslandsFromLabels(
  w: string,
  out: GcalProportionIslandMatches,
  usedPct: Set<number>,
  usedDeg: Set<number>,
): void {
  const labeled: Array<{
    key: keyof GcalProportionIslandMatches;
    re: RegExp;
    kind: "pct" | "deg";
  }> = [
    {
      key: "tablePercent",
      re: /\btable\s+(?:size\s+)?(\d{2})\s*%/i,
      kind: "pct",
    },
    { key: "depthPercent", re: /\b(?:total\s+)?depth\b[^%]{0,24}(\d{1,3}(?:\.\d+)?)\s*%/i, kind: "pct" },
    { key: "starLengthPercent", re: /\bstar\s+length\b[^%]{0,24}(\d{1,3}(?:\.\d+)?)\s*%/i, kind: "pct" },
    { key: "crownHeightPercent", re: /\bcrown\s+height\b[^%]{0,24}(\d{1,3}(?:\.\d+)?)\s*%/i, kind: "pct" },
    { key: "pavilionDepthPercent", re: /\bpavilion\s+depth\b[^%]{0,24}(\d{1,3}(?:\.\d+)?)\s*%/i, kind: "pct" },
    { key: "lowerHalfPercent", re: /\blower\s+half\b[^%]{0,24}(\d{1,3}(?:\.\d+)?)\s*%/i, kind: "pct" },
    { key: "girdleThicknessPercent", re: /\bgirdle\s+thickness\b[^%]{0,24}(\d{1,3}(?:\.\d+)?)\s*%/i, kind: "pct" },
    {
      key: "crownAngle",
      re: /\bcrown\s+angle\b[^°]{0,20}(\d{1,3}(?:\.\d+)?)\s*(?:°|H)/i,
      kind: "deg",
    },
    {
      key: "pavilionAngle",
      re: /\bpavilion\s+angle\b[^°]{0,20}(\d{1,3}(?:\.\d+)?)\s*(?:°|H)/i,
      kind: "deg",
    },
  ];

  for (const { key, re, kind } of labeled) {
    if (out[key]) continue;
    const m = w.match(re);
    if (!m?.[1]) continue;
    const n = parseFloat(fixNumericOcr(m[1]));
    if (Number.isNaN(n)) continue;
    if (kind === "pct" && usedPct.has(n)) continue;
    if (kind === "deg" && usedDeg.has(n)) continue;
    out[key] = formatNum(n);
    if (kind === "pct") usedPct.add(n);
    if (kind === "deg") usedDeg.add(n);
  }
}

export function applyGcal8xGradingIslands(
  islands: GcalGradingIslandMatches,
  fields: CalibrationReportFields,
  set: FieldSetter,
): void {
  if (islands.shape && !fields.shape.trim()) {
    set("shape", islands.shape, "high");
  }
  if (islands.measurements && !fields.measurements.trim()) {
    set("measurements", islands.measurements, "high");
  }
  if (islands.carat && !fields.carat.trim()) {
    set("carat", islands.carat, "high");
  }
  if (islands.fluorescence && !fields.fluorescence.trim()) {
    set("fluorescence", islands.fluorescence, "high");
  }
  if (islands.culet && !fields.culet.trim()) {
    set("culet", islands.culet, "high");
  }
  if (islands.girdle && !fields.girdle.trim()) {
    set("girdle", islands.girdle, "high");
  }
  if (islands.polish && !fields.polish.trim()) {
    set("polish", islands.polish, "high");
  }
  if (islands.symmetry && !fields.symmetry.trim()) {
    set("symmetry", islands.symmetry, "high");
  }
  if (islands.cutGrade && !fields.cutGrade.trim()) {
    set("cutGrade", islands.cutGrade, "high");
  }
}

export function applyGcal8xProportionIslands(
  islands: GcalProportionIslandMatches,
  fields: CalibrationReportFields,
  set: FieldSetter,
  internal: GcalInternalFields,
): void {
  const setPct = (key: ReportFieldKey, val?: string) => {
    if (val && !fields[key].trim()) set(key, val, "high");
  };

  setPct("tablePercent", islands.tablePercent);
  setPct("starLengthPercent", islands.starLengthPercent);
  setPct("depthPercent", islands.depthPercent);
  setPct("lowerHalfPercent", islands.lowerHalfPercent);
  setPct("crownAngle", islands.crownAngle);
  setPct("pavilionAngle", islands.pavilionAngle);

  if (islands.crownHeightPercent && !internal.crownHeightPercent) {
    internal.crownHeightPercent = islands.crownHeightPercent;
  }
  if (islands.pavilionDepthPercent && !internal.pavilionDepthPercent) {
    internal.pavilionDepthPercent = islands.pavilionDepthPercent;
  }
  if (islands.girdleThicknessPercent && !internal.girdleThicknessPercent) {
    internal.girdleThicknessPercent = islands.girdleThicknessPercent;
  }
  if (islands.culetSizeMm && !internal.culetSizeMm) {
    internal.culetSizeMm = islands.culetSizeMm;
  }
}

function computeGcal8xParserConfidence(
  fields: CalibrationReportFields,
): Gcal8xParserConfidence {
  const core = [
    fields.shape,
    fields.measurements,
    fields.carat,
    fields.tablePercent,
    fields.depthPercent,
    fields.crownAngle,
    fields.pavilionAngle,
    fields.lowerHalfPercent,
    fields.starLengthPercent,
    fields.girdle,
    fields.culet,
    fields.fluorescence,
  ].filter((v) => v.trim()).length;

  if (core >= 10) return "high";
  if (core >= 6) return "medium";
  return "low";
}

export function logGcalWindowCheck(
  gradingIslandMatches: GcalGradingIslandMatches,
  proportionIslandMatches: GcalProportionIslandMatches,
  fields: CalibrationReportFields,
  proportionNumericCandidates: GcalProportionNumericCandidates,
  repairedProportionPreview = "",
): void {
  console.log("[GCAL WINDOW CHECK]", {
    gradingIslandMatches,
    proportionIslandMatches,
    proportionNumericCandidates,
    repairedProportionPreview,
    parsedFields: {
      shape: fields.shape,
      measurements: fields.measurements,
      carat: fields.carat,
      fluorescence: fields.fluorescence,
      culet: fields.culet,
      girdle: fields.girdle,
      polish: fields.polish,
      symmetry: fields.symmetry,
      cutGrade: fields.cutGrade,
      tablePercent: fields.tablePercent,
      depthPercent: fields.depthPercent,
      crownAngle: fields.crownAngle,
      pavilionAngle: fields.pavilionAngle,
      starLengthPercent: fields.starLengthPercent,
      lowerHalfPercent: fields.lowerHalfPercent,
    },
  });
}

/** Alias for API-route logging (same as logGcalWindowCheck). */
export const logGcal8xCheck = logGcalWindowCheck;

export type Gcal8xExtractionMeta = {
  parserType: "gcal-8x";
  parserConfidence: Gcal8xParserConfidence;
  gradingIslandMatches: GcalGradingIslandMatches;
  proportionIslandMatches: GcalProportionIslandMatches;
};

/**
 * GCAL 8X extraction via grading + proportion numeric islands (not full-document regex).
 */
export function extractGcal8xFields(
  rawText: string,
  fields: CalibrationReportFields,
  set: FieldSetter,
  internal: GcalInternalFields = {},
  opts?: { screenshotUpload?: boolean },
): Gcal8xExtractionMeta {
  const windows = opts?.screenshotUpload
    ? extractGcal8xFocusedWindowsForScreenshot(rawText)
    : extractGcal8xFocusedWindows(rawText);
  const gradingIslandMatches = extractGcal8xGradingIslands(rawText);
  const repairedProportion = prepareGcal8xProportionDiagramText(
    windows.proportionWindow,
  );
  const proportionNumericCandidates =
    collectGcal8xProportionNumericCandidates(windows.proportionWindow);
  const proportionIslandMatches = extractGcal8xProportionIslands(
    windows.proportionWindow,
  );

  const proportionGirdle = extractGcal8xProportionGirdle(
    windows.rawProportionSlice,
    repairedProportion,
  );
  if (proportionGirdle.girdlePhrase && !gradingIslandMatches.girdle) {
    gradingIslandMatches.girdle = proportionGirdle.girdlePhrase;
  }
  if (
    proportionGirdle.girdleThicknessPercent &&
    !proportionIslandMatches.girdleThicknessPercent
  ) {
    proportionIslandMatches.girdleThicknessPercent =
      proportionGirdle.girdleThicknessPercent;
  }

  applyGcal8xGradingIslands(gradingIslandMatches, fields, set);
  applyGcal8xProportionIslands(
    proportionIslandMatches,
    fields,
    set,
    internal,
  );

  const parserConfidence = computeGcal8xParserConfidence(fields);
  logGcalWindowCheck(
    gradingIslandMatches,
    proportionIslandMatches,
    fields,
    proportionNumericCandidates,
    repairedProportion.slice(0, REPAIRED_PROPORTION_PREVIEW_CHARS),
  );

  return {
    parserType: "gcal-8x",
    parserConfidence,
    gradingIslandMatches,
    proportionIslandMatches,
  };
}
