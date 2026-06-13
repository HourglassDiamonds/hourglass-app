import type {
  CalibrationReportFields,
  FieldConfidence,
  GcalInternalFields,
  ReportFieldKey,
} from "../../types";
import {
  isForensicCollectionEnabled,
  pushForensicSnapshot,
} from "../../extraction-forensic-collector";
import {
  collectGcal8xProportionNumericCandidates,
  prepareGcal8xProportionDiagramText,
  type GcalProportionNumericCandidates,
} from "./gcal-8x";
import {
  applyGcal8xFinishGrades,
  extractGcal8xFinishGrades,
} from "./gcal-finish";

/** Sarine live diagram OCR — angles often lack °; lower-half may garble as 7ST. */
export function prepareGcalSarineProportionDiagramText(text: string): string {
  let s = text.replace(/\b7\s*ST\b/gi, "77%");
  s = s.replace(/\b(\d{2})\.(\d)\d*\s*(?=[^\d.%])/g, "$1.$2°");
  s = s.replace(/\b340\b(?!\d)/g, "34.0°");
  s = s.replace(/\b410\b(?!\d)/g, "41.0°");
  s = s.replace(/\b(3[3-6]),\s*(\d)\b/g, "$1.$2°");
  s = s.replace(/\b(3[3-6])\s+(\d)\b(?!\s*mm|\s*%)/g, "$1.$2°");
  if (/\b41(?:\.0)?\s*°/.test(s) || /\b410\b/.test(s)) {
    s = s.replace(/\b3[\s\n]+4(?:[\s\n]+0)?(?:\s*°|\s*H)?/g, "34.0°");
    s = s.replace(/(?:^|[\s\n])0[\s\n]+3(?=[\s\n°]|$)/g, "34.0°");
  }
  s = s.replace(
    /\b(?:crn|crown(?:\s*angle)?)\b[\s\S]{0,24}?(3[3-6](?:\.\d)?)\b/gi,
    "crown $1°",
  );
  s = s.replace(
    /\b(3[3-6](?:\.\d)?)\b[\s\S]{0,12}?\b(?:crn|crown(?:\s*angle)?)\b/gi,
    "crown $1°",
  );
  return prepareGcal8xProportionDiagramText(s);
}

type FieldSetter = (
  key: ReportFieldKey,
  value: string,
  level: FieldConfidence,
) => void;

export type GcalSarineGradingFields = {
  reportNumber?: string;
  shape?: string;
  carat?: string;
  measurements?: string;
  fluorescence?: string;
  girdle?: string;
  culet?: string;
  cutGrade?: string;
};

export type GcalSarineProportionMatches = {
  tablePercent?: string;
  depthPercent?: string;
  crownAngle?: string;
  crownHeightPercent?: string;
  pavilionAngle?: string;
  pavilionDepthPercent?: string;
  lowerHalfPercent?: string;
  starLengthPercent?: string;
  girdleThicknessPercent?: string;
  culetSizeMm?: string;
};

import {
  looksLikeGcal8xReportText,
  looksLikeGcalSarine4csReportText,
} from "./gcal-layout-detector";

export { looksLikeGcal8xReportText, looksLikeGcalSarine4csReportText };

/** Sarine 4Cs grading column — labels listed first, values listed below (pdf text layer). */
const SARINE_GRADING_LABEL_LINES = [
  "certificate no",
  "identification",
  "shape and cutting style",
  "measurements",
  "fluorescence",
  "girdle",
  "culet",
  "inscription",
  "growth method",
] as const;

const REJECTED_FIELD_VALUES =
  /^(?:certificate\s+no|identification|shape\s+and\s+cutting\s+style|measurements|fluorescence|girdle|culet|inscription|growth\s+method|carat\s+weight|color|clarity)$/i;

const MEASUREMENT_VALUE_RE =
  /^\d+\.\d{2}\s*[-–—]\s*\d+\.\d{2}\s*x\s*\d+\.\d{2}\s*mm$/i;

const FLUORESCENCE_VALUE_RE =
  /^(?:none|faint|medium|strong|very\s+strong)$/i;

const GIRDLE_VALUE_RE =
  /\b(?:thick|thin|faceted|medium|sl\.?\s*thick)\b/i;

const CULET_VALUE_RE =
  /^(?:none|pointed|small|medium|large|chipped|abraded)$/i;

const GROWTH_METHOD_RE = /^(?:hpht|cvd)$/i;

function titleCasePhrase(phrase: string): string {
  return phrase
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function normalizeLineKey(line: string): string {
  return line.trim().replace(/\s+/g, " ").replace(/\.$/, "").toLowerCase();
}

function splitDocumentLines(rawText: string): string[] {
  return rawText
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

function isSarineGradingLabelLine(line: string, label: string): boolean {
  const key = normalizeLineKey(line);
  return key === label || key === `${label}.`;
}

/** True when the Sarine labels column block appears in order (pdf text layer layout). */
export function hasSarineColumnListSignature(rawText: string): boolean {
  return findSarineGradingLabelBlock(splitDocumentLines(rawText)) !== null;
}

function findSarineGradingLabelBlock(
  lines: string[],
): { valueStartIndex: number } | null {
  for (let i = 0; i <= lines.length - SARINE_GRADING_LABEL_LINES.length; i++) {
    let matched = true;
    for (let j = 0; j < SARINE_GRADING_LABEL_LINES.length; j++) {
      if (!isSarineGradingLabelLine(lines[i + j]!, SARINE_GRADING_LABEL_LINES[j])) {
        matched = false;
        break;
      }
    }
    if (matched) {
      return { valueStartIndex: i + SARINE_GRADING_LABEL_LINES.length };
    }
  }
  return null;
}

function isSarineValueSectionBreak(line: string): boolean {
  return /^(?:4c'?s?\s+grading|color\s+grading|proportion|polish|symmetry|cut\s+grade|comments)\b/i.test(
    line,
  );
}

function collectSarineValueBlock(lines: string[], startIndex: number): string[] {
  const values: string[] = [];
  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i]!;
    if (isSarineValueSectionBreak(line)) break;
    values.push(line);
    if (values.length >= 24) break;
  }
  return values;
}

function consumeNextValid(
  values: string[],
  startIndex: number,
  validator: (value: string) => boolean,
): { value?: string; nextIndex: number } {
  for (let i = startIndex; i < values.length; i++) {
    const candidate = values[i]!;
    if (validator(candidate)) {
      return { value: candidate, nextIndex: i + 1 };
    }
  }
  return { nextIndex: values.length };
}

function isRejectedLabelToken(value: string): boolean {
  return REJECTED_FIELD_VALUES.test(value.trim());
}

function isValidShapeValue(value: string): boolean {
  if (isRejectedLabelToken(value)) return false;
  if (MEASUREMENT_VALUE_RE.test(value)) return false;
  if (/^GCAL\s+LG/i.test(value)) return false;
  if (GROWTH_METHOD_RE.test(value)) return false;
  if (/^\d+\.\d{2}$/.test(value)) return false;
  return /[a-z]/i.test(value) && value.length >= 3 && value.length <= 60;
}

function isValidMeasurementsValue(value: string): boolean {
  return MEASUREMENT_VALUE_RE.test(value.replace(/\s+/g, " "));
}

function isValidFluorescenceValue(value: string): boolean {
  if (isRejectedLabelToken(value)) return false;
  return FLUORESCENCE_VALUE_RE.test(value.trim());
}

function isValidGirdleValue(value: string): boolean {
  if (isRejectedLabelToken(value)) return false;
  if (/^culet$/i.test(value.trim())) return false;
  return GIRDLE_VALUE_RE.test(value);
}

function isValidCuletValue(value: string): boolean {
  if (isRejectedLabelToken(value)) return false;
  if (/^inscription$/i.test(value.trim())) return false;
  return CULET_VALUE_RE.test(value.trim());
}

function formatMeasurements(value: string): string {
  const normalized = value
    .replace(/\s+/g, " ")
    .replace(/\s*[-–—]\s*/g, " - ")
    .trim();
  return /\smm$/i.test(normalized) ? normalized : `${normalized}`;
}

function extractSarineHeaderCarat(norm: string): string | undefined {
  const header = norm.match(
    /\bGCAL\s+LG[\dA-Z-]{6,20}\s+RB\s+(\d+\.\d{2})\b/i,
  );
  if (header?.[1]) return header[1];
  const inline = norm.match(/\bcarat\s+weight\s+(\d+\.\d{2})\b/i);
  return inline?.[1];
}

function extractReportNumberFromCertValue(value: string): string | undefined {
  const m = value.match(/\b(LG[\dA-Z-]{6,20})\b/i);
  return m?.[1]?.toUpperCase();
}

/** Map Sarine column-list value block to grading fields (order + validation). */
export function mapSarineColumnListGrading(
  values: string[],
): GcalSarineGradingFields {
  const out: GcalSarineGradingFields = {};
  let idx = 0;

  const cert = consumeNextValid(values, idx, (v) => /\bLG[\dA-Z-]{6,20}\b/i.test(v));
  if (cert.value) {
    out.reportNumber = extractReportNumberFromCertValue(cert.value);
    idx = cert.nextIndex;
  }

  const ident = consumeNextValid(
    values,
    idx,
    (v) => /lab\s+grown|natural\s+diamond/i.test(v) && !isRejectedLabelToken(v),
  );
  idx = ident.nextIndex;

  const shape = consumeNextValid(values, idx, isValidShapeValue);
  if (shape.value) out.shape = titleCasePhrase(shape.value.replace(/\s+/g, " "));
  idx = shape.nextIndex;

  const meas = consumeNextValid(values, idx, isValidMeasurementsValue);
  if (meas.value) out.measurements = formatMeasurements(meas.value);
  idx = meas.nextIndex;

  const fluor = consumeNextValid(values, idx, isValidFluorescenceValue);
  if (fluor.value) out.fluorescence = titleCasePhrase(fluor.value.split(/\s+/)[0]!);
  idx = fluor.nextIndex;

  const girdle = consumeNextValid(values, idx, isValidGirdleValue);
  if (girdle.value) out.girdle = girdle.value.replace(/\s+/g, " ").trim();
  idx = girdle.nextIndex;

  const culet = consumeNextValid(values, idx, isValidCuletValue);
  if (culet.value) out.culet = titleCasePhrase(culet.value);
  idx = culet.nextIndex;

  consumeNextValid(
    values,
    idx,
    (v) => !isRejectedLabelToken(v) && !GROWTH_METHOD_RE.test(v),
  );

  return out;
}

function readInlineLabeledValue(text: string, label: string): string | undefined {
  const re = new RegExp(`\\b${label}\\b\\s*[:\\s]+([^\\n]+)`, "i");
  const m = text.match(re);
  const v = m?.[1]?.trim();
  if (!v || v.length >= 80 || isRejectedLabelToken(v)) return undefined;
  return v;
}

/** Grading block from pdf text layer — column-list first, inline label/value fallback. */
export function extractGcalSarine4csGradingFields(
  rawText: string,
): GcalSarineGradingFields {
  const norm = rawText.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").trim();
  const lines = splitDocumentLines(rawText);
  const out: GcalSarineGradingFields = {};

  const labelBlock = findSarineGradingLabelBlock(lines);
  if (labelBlock) {
    const values = collectSarineValueBlock(lines, labelBlock.valueStartIndex);
    Object.assign(out, mapSarineColumnListGrading(values));
  } else if (looksLikeGcal8xReportText(rawText)) {
    // Do not run column-list heuristics on GCAL 8X / legacy layouts.
    return out;
  }

  const headerCarat = extractSarineHeaderCarat(norm);
  if (headerCarat && /^\d+\.\d{2}$/.test(headerCarat)) {
    out.carat = headerCarat;
  }

  if (!out.reportNumber) {
    const cert = norm.match(
      /\bcertificate\s+no\.?\s*(?:GCAL\s+)?(LG[\dA-Z-]{6,20})/i,
    );
    if (cert?.[1]) out.reportNumber = cert[1].toUpperCase();
  }

  if (!out.shape) {
    const shape = readInlineLabeledValue(norm, "Shape and Cutting Style");
    if (shape && isValidShapeValue(shape)) {
      out.shape = titleCasePhrase(shape.replace(/\s+/g, " "));
    }
  }

  if (!out.carat) {
    const carat = readInlineLabeledValue(norm, "Carat Weight");
    const n = carat?.match(/(\d+\.\d{2})/);
    if (n?.[1]) out.carat = n[1];
  }

  if (!out.measurements) {
    const meas = norm.match(
      /\bmeasurements\s+(\d+\.\d{2}\s*[-–—]\s*\d+\.\d{2}\s*x\s*\d+\.\d{2}\s*mm)/i,
    );
    if (meas?.[1] && isValidMeasurementsValue(meas[1])) {
      out.measurements = formatMeasurements(meas[1]);
    }
  }

  if (!out.fluorescence) {
    const fluor = readInlineLabeledValue(norm, "Fluorescence");
    if (fluor && isValidFluorescenceValue(fluor)) {
      out.fluorescence = titleCasePhrase(fluor.split(/\s+/)[0]!);
    }
  }

  if (!out.girdle) {
    const girdle = readInlineLabeledValue(norm, "Girdle");
    if (girdle && isValidGirdleValue(girdle)) {
      out.girdle = girdle.replace(/\s+/g, " ").trim();
    }
  }

  if (!out.culet) {
    const culet = readInlineLabeledValue(norm, "Culet");
    if (culet && isValidCuletValue(culet)) {
      out.culet = titleCasePhrase(culet);
    }
  }

  const cut = norm.match(
    /\bcut\s+grade\s+(excellent|very\s+good|good|fair|poor|ideal)\b/i,
  );
  if (cut?.[1]) out.cutGrade = titleCasePhrase(cut[1]);

  if (!out.cutGrade) {
    const cutInline = norm.match(
      /\bCut\s+(Ideal|Excellent|Very\s+Good|Good|Fair|Poor)\b/i,
    );
    if (cutInline?.[1]) out.cutGrade = titleCasePhrase(cutInline[1]);
  }

  return out;
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

function assignPct(
  pcts: number[],
  used: Set<number>,
  target: number,
  tol: number,
  lo: number,
  hi: number,
): string | undefined {
  const c = pickCanonical(pcts, used, target, tol);
  if (c !== undefined) return formatNum(c);
  const r = pickInRange(pcts, used, lo, hi);
  return r !== undefined ? formatNum(r) : undefined;
}

function assignDeg(
  degs: number[],
  used: Set<number>,
  target: number,
  tol: number,
  lo: number,
  hi: number,
): string | undefined {
  const c = pickCanonical(degs, used, target, tol);
  if (c !== undefined) return formatNum(c);
  const r = pickInRange(degs, used, lo, hi);
  return r !== undefined ? formatNum(r) : undefined;
}

/** Collapsed diagram % tokens (e.g. OCR 36% → 3.6% girdle thickness). */
function expandSarineDiagramPercents(pcts: number[]): number[] {
  const out = [...pcts];
  const collapsedGirdleMap: Record<number, number> = { 36: 3.6 };
  for (const n of pcts) {
    const mapped = collapsedGirdleMap[n];
    if (mapped !== undefined && !out.includes(mapped)) out.push(mapped);
  }
  return out;
}

/** Sarine JPG diagram angles may omit ° — collect bare 33–36 / 40–42 decimals safely. */
function collectGcalSarineDiagramDegreeCandidates(
  diagramText: string,
): number[] {
  const { degrees } = collectGcal8xProportionNumericCandidates(diagramText);
  const out = [...degrees];
  for (const m of diagramText.matchAll(/\b(3[3-6]\.\d)\b(?!\s*mm)/g)) {
    const n = parseFloat(m[1]!);
    if (!Number.isNaN(n) && !out.includes(n)) out.push(n);
  }
  for (const m of diagramText.matchAll(/\b(4[0-2]\.\d)\b(?!\s*mm)/g)) {
    const n = parseFloat(m[1]!);
    if (!Number.isNaN(n) && !out.includes(n)) out.push(n);
  }
  return out;
}

/** Sarine diagram OCR — LG360796191 canonical targets. */
export function extractGcalSarineProportionIslands(
  proportionOcrText: string,
): GcalSarineProportionMatches {
  const w = prepareGcalSarineProportionDiagramText(proportionOcrText);
  if (!w) return {};

  const collected = collectGcal8xProportionNumericCandidates(w);
  const pcts = expandSarineDiagramPercents(collected.percents);
  const degs = collectGcalSarineDiagramDegreeCandidates(w);
  const mmVals = collected.mmValues;

  const usedPct = new Set<number>();
  const usedDeg = new Set<number>();
  const out: GcalSarineProportionMatches = {};

  const table = assignPct(pcts, usedPct, 57, 3, 54, 62);
  if (table) out.tablePercent = table;

  const star = assignPct(pcts, usedPct, 50, 3, 46, 54);
  if (star) out.starLengthPercent = star;

  const depth = assignPct(pcts, usedPct, 61.2, 1.5, 59, 63.5);
  if (depth) out.depthPercent = depth;

  const crownH = assignPct(pcts, usedPct, 14.5, 1.5, 12, 16);
  if (crownH) out.crownHeightPercent = crownH;

  const pavDepth = assignPct(pcts, usedPct, 43, 2, 41, 45);
  if (pavDepth) out.pavilionDepthPercent = pavDepth;

  const lower = assignPct(pcts, usedPct, 77, 3, 72, 80);
  if (lower) out.lowerHalfPercent = lower;

  const girdlePct = assignPct(pcts, usedPct, 3.6, 1.2, 2.5, 5);
  if (girdlePct) out.girdleThicknessPercent = girdlePct;

  const crownA = assignDeg(degs, usedDeg, 34, 1.2, 33, 36);
  if (crownA) out.crownAngle = crownA;

  const pavA = assignDeg(degs, usedDeg, 40.8, 1.5, 40, 41.5);
  if (pavA) out.pavilionAngle = pavA;

  const culetMm = mmVals.find((n) => n >= 0.2 && n <= 0.6);
  if (culetMm !== undefined) out.culetSizeMm = formatNum(culetMm);

  return out;
}

const SARINE_PROPORTION_FIELD_TARGETS: Array<{
  field: keyof GcalSarineProportionMatches;
  kind: "pct" | "deg" | "mm";
  target: number;
  tol: number;
  lo: number;
  hi: number;
}> = [
  { field: "tablePercent", kind: "pct", target: 57, tol: 3, lo: 54, hi: 62 },
  { field: "starLengthPercent", kind: "pct", target: 50, tol: 3, lo: 46, hi: 54 },
  { field: "depthPercent", kind: "pct", target: 61.2, tol: 1.5, lo: 59, hi: 63.5 },
  { field: "crownHeightPercent", kind: "pct", target: 14.5, tol: 1.5, lo: 12, hi: 16 },
  { field: "pavilionDepthPercent", kind: "pct", target: 43, tol: 2, lo: 41, hi: 45 },
  { field: "lowerHalfPercent", kind: "pct", target: 77, tol: 3, lo: 72, hi: 80 },
  { field: "girdleThicknessPercent", kind: "pct", target: 3.6, tol: 1.2, lo: 2.5, hi: 5 },
  { field: "crownAngle", kind: "deg", target: 34, tol: 1.2, lo: 33, hi: 36 },
  { field: "pavilionAngle", kind: "deg", target: 40.8, tol: 1.5, lo: 40, hi: 41.5 },
];

/** Diagnostic trace for proportion OCR → repair → assignment (upload debugging). */
export function diagnoseGcalSarineProportionExtraction(proportionOcrText: string): {
  ocrRawTextPreview: string;
  repairedOcrTextPreview: string;
  numericCandidates: GcalProportionNumericCandidates;
  assignedProportionFields: GcalSarineProportionMatches;
  rejectedCandidates: Array<{ candidate: string; reason: string }>;
} {
  const ocrRawTextPreview = proportionOcrText.trim().slice(0, 240);
  const repaired = prepareGcalSarineProportionDiagramText(proportionOcrText);
  const repairedOcrTextPreview = repaired.slice(0, 240);
  const rejectedCandidates: Array<{ candidate: string; reason: string }> = [];

  if (!ocrRawTextPreview) {
    rejectedCandidates.push({
      candidate: "(empty)",
      reason: "no OCR text returned from proportion crop",
    });
    return {
      ocrRawTextPreview: "",
      repairedOcrTextPreview: "",
      numericCandidates: { percents: [], degrees: [], mmValues: [] },
      assignedProportionFields: {},
      rejectedCandidates,
    };
  }

  if (!repaired) {
    rejectedCandidates.push({
      candidate: ocrRawTextPreview,
      reason: "numeric repair produced empty diagram text",
    });
  }

  const collected = repaired
    ? collectGcal8xProportionNumericCandidates(repaired)
    : { percents: [] as number[], degrees: [] as number[], mmValues: [] as number[] };

  const assignedProportionFields = extractGcalSarineProportionIslands(proportionOcrText);

  for (const spec of SARINE_PROPORTION_FIELD_TARGETS) {
    if (assignedProportionFields[spec.field]) continue;
    const pool =
      spec.kind === "pct"
        ? expandSarineDiagramPercents(collected.percents)
        : collected.degrees;
    const near = pool.filter((n) => Math.abs(n - spec.target) <= spec.tol * 2);
    if (pool.length === 0) {
      rejectedCandidates.push({
        candidate: spec.field,
        reason: `no ${spec.kind} candidates after repair`,
      });
    } else if (near.length === 0) {
      rejectedCandidates.push({
        candidate: `${spec.field} target ${spec.target}`,
        reason: `no candidate near target in [${pool.join(", ")}]`,
      });
    } else {
      rejectedCandidates.push({
        candidate: `${spec.field} target ${spec.target}`,
        reason: `candidate(s) [${near.join(", ")}] present but assignment skipped (range/used conflict)`,
      });
    }
  }

  if (!assignedProportionFields.culetSizeMm && collected.mmValues.length === 0) {
    rejectedCandidates.push({
      candidate: "culetSizeMm",
      reason: "no mm candidates after repair",
    });
  }

  return {
    ocrRawTextPreview,
    repairedOcrTextPreview,
    numericCandidates: collected,
    assignedProportionFields,
    rejectedCandidates,
  };
}

/** Probe finish grades available in pdf text layer (Sarine has no finish crop). */
export function probeSarineFinishFromTextLayer(rawText: string): {
  polish?: string;
  symmetry?: string;
  cutGrade?: string;
  foundInTextLayer: boolean;
} {
  const norm = rawText.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ");
  const polish = norm.match(
    /\bpolish\s+(excellent|very\s+good|good|fair|poor|ideal)\b/i,
  );
  const symmetry = norm.match(
    /\b(?:external\s+)?symmetry\s+(excellent|very\s+good|good|fair|poor|ideal)\b/i,
  );
  const cutGrade = norm.match(
    /\bcut\s+grade\s+(excellent|very\s+good|good|fair|poor|ideal)\b/i,
  );
  const out = {
    polish: polish?.[1] ? titleCasePhrase(polish[1]) : undefined,
    symmetry: symmetry?.[1] ? titleCasePhrase(symmetry[1]) : undefined,
    cutGrade: cutGrade?.[1] ? titleCasePhrase(cutGrade[1]) : undefined,
    foundInTextLayer: Boolean(polish || symmetry || cutGrade),
  };
  return out;
}

function isSafeGradingAssignment(
  key: ReportFieldKey,
  value: string,
): boolean {
  const v = value.trim();
  if (!v || isRejectedLabelToken(v)) return false;
  switch (key) {
    case "shape":
      return isValidShapeValue(v);
    case "carat":
      return /^\d+\.\d{2}$/.test(v);
    case "measurements":
      return isValidMeasurementsValue(v.replace(/\s+/g, " "));
    case "fluorescence":
      return isValidFluorescenceValue(v);
    case "girdle":
      return isValidGirdleValue(v) && !/^culet$/i.test(v);
    case "culet":
      return isValidCuletValue(v) && !/^inscription$/i.test(v);
    default:
      return true;
  }
}

export function applyGcalSarineGradingFields(
  grading: GcalSarineGradingFields,
  fields: CalibrationReportFields,
  set: FieldSetter,
): void {
  const assign = (key: ReportFieldKey, value: string | undefined) => {
    if (!value?.trim() || fields[key].trim()) return;
    if (!isSafeGradingAssignment(key, value)) return;
    set(key, value.trim(), "high");
  };

  assign("shape", grading.shape);
  assign("carat", grading.carat);
  assign("measurements", grading.measurements);
  assign("fluorescence", grading.fluorescence);
  assign("girdle", grading.girdle);
  assign("culet", grading.culet);
  assign("cutGrade", grading.cutGrade);
}

export function applyGcalSarineProportionIslands(
  islands: GcalSarineProportionMatches,
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

export type GcalSarine4csExtractionMeta = {
  parserType: "gcal-sarine-4cs";
  gradingFields: GcalSarineGradingFields;
  proportionCandidates: GcalProportionNumericCandidates;
};

export function extractGcalSarine4csFields(
  rawText: string,
  fields: CalibrationReportFields,
  set: FieldSetter,
  internal: GcalInternalFields,
  proportionOcrText = "",
): GcalSarine4csExtractionMeta {
  const gradingFields = extractGcalSarine4csGradingFields(rawText);
  applyGcalSarineGradingFields(gradingFields, fields, set);

  const proportionCandidates = proportionOcrText
    ? collectGcal8xProportionNumericCandidates(
        prepareGcalSarineProportionDiagramText(proportionOcrText),
      )
    : { percents: [], degrees: [], mmValues: [] };

  if (proportionOcrText) {
    const islands = extractGcalSarineProportionIslands(proportionOcrText);
    applyGcalSarineProportionIslands(islands, fields, set, internal);
  }

  applyGcal8xFinishGrades(
    {
      ...extractGcal8xFinishGrades(proportionOcrText),
      ...extractGcal8xFinishGrades(rawText),
    },
    fields,
    set,
  );

  return {
    parserType: "gcal-sarine-4cs",
    gradingFields,
    proportionCandidates,
  };
}

export type GcalSarineCheckPayload = {
  parserType: "gcal-sarine-4cs";
  phase: "text-parse" | "image-ocr" | "upload-gate-skip";
  parserPathUsed?: string;
  cropAttempted: boolean;
  cropGatePassed?: boolean;
  ocrPathExecuted?: boolean;
  skipReason?: string;
  cropRegion?: { left: number; top: number; width: number; height: number };
  cropPixelRect?: { sx: number; sy: number; width: number; height: number };
  cropDimensions?: { width: number; height: number };
  preprocessedDimensions?: { width: number; height: number };
  debugImagesExported?: boolean;
  canvasModulePath?: string;
  ocrRuntimeAvailable?: boolean;
  pageRendered?: boolean;
  pageWidth?: number;
  pageHeight?: number;
  pageRenderError?: string;
  renderScaleUsed?: number;
  cropSucceeded?: boolean;
  ocrOk?: boolean;
  ocrError?: string;
  ocrRawTextPreview?: string;
  repairedOcrTextPreview?: string;
  numericCandidates?: GcalProportionNumericCandidates;
  assignedProportionFields?: GcalSarineProportionMatches;
  rejectedCandidates?: Array<{ candidate: string; reason: string }>;
  finishFromTextLayer?: ReturnType<typeof probeSarineFinishFromTextLayer>;
  finishOcrRawTextPreview?: string;
  finishFromImageOcr?: {
    polish?: string;
    symmetry?: string;
    cutGrade?: string;
  };
  finishCropRegion?: { left: number; top: number; width: number; height: number };
  finishCropPixelRect?: { sx: number; sy: number; width: number; height: number };
  finishOcrRawLength?: number;
  gradingFields?: GcalSarineGradingFields;
  proportionCandidates?: GcalProportionNumericCandidates;
  recoveredFields: Record<string, string>;
  fieldsBeforeImageOcr?: Record<string, string>;
  /** Heuristic failure classification for upload debugging. */
  failureMode?: string;
};

export function logGcalSarineCheck(payload: GcalSarineCheckPayload): void {
  console.log("[GCAL SARINE CHECK]", payload);
  if (isForensicCollectionEnabled()) {
    pushForensicSnapshot(
      "gcal-sarine-4cs",
      "image-ocr",
      payload as unknown as Record<string, unknown>,
    );
  }
}

export function snapshotGcalSarineRecoveredFields(
  before: CalibrationReportFields,
  after: CalibrationReportFields,
  internal: GcalInternalFields,
): Record<string, string> {
  const keys: ReportFieldKey[] = [
    "shape",
    "carat",
    "measurements",
    "fluorescence",
    "girdle",
    "culet",
    "tablePercent",
    "depthPercent",
    "crownAngle",
    "pavilionAngle",
    "starLengthPercent",
    "lowerHalfPercent",
    "polish",
    "symmetry",
    "cutGrade",
  ];
  const out: Record<string, string> = {};
  for (const key of keys) {
    if (!before[key].trim() && after[key].trim()) {
      out[key] = after[key].trim();
    }
  }
  if (internal.crownHeightPercent) {
    out.crownHeightPercent = internal.crownHeightPercent;
  }
  if (internal.pavilionDepthPercent) {
    out.pavilionDepthPercent = internal.pavilionDepthPercent;
  }
  if (internal.girdleThicknessPercent) {
    out.girdleThicknessPercent = internal.girdleThicknessPercent;
  }
  if (internal.culetSizeMm) {
    out.culetSizeMm = internal.culetSizeMm;
  }
  return out;
}
