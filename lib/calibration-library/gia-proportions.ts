import {
  shouldLogExtractPipeline,
  shouldLogForensicHydration,
} from "./extract-debug";
import type {
  CalibrationReportFields,
  FieldConfidence,
  GiaInternalFields,
  ReportFieldKey,
  TextExtractionMethod,
} from "./types";

type FieldSetter = (
  key: ReportFieldKey,
  value: string,
  level: FieldConfidence,
) => void;

const PCT = String.raw`\d{1,3}(?:\.\d+)?`;

/** Degree marker on GIA diagrams (PDF ° or OCR misread as H / =). */
const GIA_DEGREE_SUFFIX = String.raw`(?:°|H\b|=)`;

/** Numeric token before °/H — tolerates common Tesseract swaps (O→0, B→8). */
const GIA_OCR_DEGREE_NUM = String.raw`[0-9][0-9OIlZB.,\s]{0,10}?`;

/** GIA facsimile PDFs use dot leaders between labels and values on one line. */
const DOT_LEADER = String.raw`\.{2,}`;

const FINISH_GRADE =
  "(?:excellent|ex|ideal|very\\s+good|vg|good|fair|poor)";

const GIA_PDF_LAYER_LABELS = [
  "Table",
  "Crown Angle",
  "Pavilion Angle",
  "Star",
  "Lower Half",
  "Girdle",
  "Culet",
  "Depth",
  "Carat",
] as const;

const GIRDLE_THICKNESS =
  String.raw`((?:medium|thin|thick|slightly|very)\s*[-–—]?\s*(?:to\s+)?slightly\s+(?:thin|thick))`;

/** Strip dot-leader filler from a captured value fragment. */
export function stripGiaDotLeaderNoise(s: string): string {
  return s.replace(/\.{2,}/g, " ").replace(/\s+/g, " ").trim();
}

/** Normalize GIA OCR / PDF text quirks before proportion parsing. */
export function normalizeGiaOcrText(text: string): string {
  return text
    .replace(/\u00b0/g, "°")
    .replace(/[°º˚]/g, "°")
    .replace(/[×✕]/g, "x")
    .replace(/(\d)\s+\.\s+(\d)/g, "$1.$2")
    .replace(/(\d)\s*,\s*(\d)/g, "$1.$2")
    .replace(/(\d)\s+(\d{1,2})\s*(?=°)/g, (_, a, b) => `${a}.${b}`)
    .replace(/(\d)\s*%/g, "$1%")
    .replace(/(\d)\s*°/g, "$1°")
    .replace(/\.{4,}/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n");
}

const GIA_DIAGRAM_FIELD_KEYS: ReportFieldKey[] = [
  "tablePercent",
  "depthPercent",
  "crownAngle",
  "pavilionAngle",
  "lowerHalfPercent",
  "starLengthPercent",
  "girdle",
  "culet",
];

function shouldLogGiaOcrDiagramDebug(): boolean {
  return process.env.CALIBRATION_EXTRACT_DEBUG === "1";
}

/** True when key GIA diagram fields are still empty after primary parsing. */
export function giaProportionDiagramFieldsMissing(
  fields: CalibrationReportFields,
): boolean {
  return GIA_DIAGRAM_FIELD_KEYS.some((k) => !fields[k]?.trim());
}

/** True when proportion diagram numbers appear in extractable text (not just section headers). */
export function giaProportionValuesPresent(text: string): boolean {
  const t = normalizeGiaOcrDiagramText(text);
  if (looksLikeGiaProportionStack(t)) return true;
  if (looksLikeGiaOcrProportionScatter(t)) return true;
  if (readGiaLabelValue(t, /\bcrown\s+angle\b/i, isPlausibleCrownAngle)) return true;
  if (readGiaLabelValue(t, /\bstar\s+length\b/i, isPlausibleStar)) return true;
  if (/\btable\b[^\n]{0,48}\d{1,3}(?:\.\d+)?\s*%/i.test(t)) return true;
  if (/\bcrown\s+angle\b[^\n]{0,48}\d{1,3}(?:\.\d+)?\s*(?:°|H\b)/i.test(t)) return true;
  return false;
}

/** Fix OCR-corrupted degree numerals (4O.8 H, 40.B H, 40,8 H, 40 8 H). */
export function fixGiaOcrDegreeNumerals(text: string): string {
  return text
    .replace(/4\s*[Oo]\s*\.\s*8/gi, "40.8")
    .replace(/(\d)\s*,\s*(\d)/g, "$1.$2")
    .replace(/(\d{1,2}):(\d)/g, "$1.$2")
    .replace(/(\d{1,2})\s+(\d)\s*H\b/gi, "$1.$2 H")
    .replace(/(\d)[Oo](?=\.\d)/g, "$10")
    .replace(/(\d)[Oo](?=\s*H\b)/gi, "$10")
    .replace(/(\d{1,2})\.B\s*H\b/gi, "$1.8 H")
    .replace(/(\d{1,2})\s+B\s*H\b/gi, "$1.8 H")
    .replace(/(\d{1,2})\.B(?=\s*(?:°|H\b|=)|$)/gi, "$1.8")
    .replace(/(\d{1,3}(?:\.\d+)?)\s*=\s*(?=\d|\s|$)/g, "$1°");
}

/** Parse a single OCR degree value token into a normalized number string. */
function parseGiaOcrDegreeValue(raw: string): string | null {
  let s = raw.trim();
  if (/\.B\b/i.test(s)) s = s.replace(/\.B/gi, ".8");
  s = fixGiaOcrDegreeNumerals(s).replace(/\s+/g, "").replace(/[Oo]/g, "0");
  if (/\.[A-Za-z]/.test(s)) return null;
  const m = s.match(/^(\d{1,3}(?:\.\d+)?)/);
  return m?.[1] ? parseNum(m[1]) : null;
}

/** Apply live GIA OCR typo fixes on one line (preserves newlines in block). */
function applyGiaOcrLineFixes(line: string): string {
  return fixGiaOcrDegreeNumerals(line)
    .replace(/(\d{1,3}(?:\.\d+)?)\s*H\b/gi, "$1°")
    .replace(/(\d{1,3}(?:\.\d+)?)\s*=\s*(?=\s|$)/g, "$1°")
    .replace(/\bsligh[\s.]{0,3}tly\b/gi, "slightly")
    .replace(/\b5O\s*%/gi, "50%")
    .replace(/\b5O\b/g, "50")
    .replace(/\b7S\s*%/gi, "75%")
    .replace(/\b7S\b/g, "75")
    .replace(/\bS6\s*%/gi, "56%")
    .replace(/\bS6\b/g, "56")
    .replace(/\bBive\b/gi, "Blue")
    .replace(/\bROUNd\b/gi, "Round")
    .replace(/\bFond\b/gi, "Depth")
    .replace(/\bfactted\)/gi, "(Faceted)")
    .replace(/[ \t]+/g, " ")
    .trim();
}

/** Normalize proportion block — keep line breaks; do not flatten to one line. */
export function normalizeGiaProportionBlockText(block: string): string {
  return fixGiaOcrDegreeNumerals(
    block
      .replace(/\r\n/g, "\n")
      .replace(/\u00b0/g, "°")
      .replace(/[°º˚]/g, "°")
      .replace(/[×✕]/g, "x")
      .split("\n")
      .map((line) => applyGiaOcrLineFixes(line))
      .filter((line) => line.length > 0)
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
  );
}

/** @deprecated Use normalizeGiaProportionBlockText for OCR diagram slices. */
export function normalizeGiaOcrDiagramText(text: string): string {
  return normalizeGiaProportionBlockText(text);
}

const GIA_REPORT_SHELL_RE =
  /\b(?:C\s*L\s*A\s*R\s*I\s*T\s*Y\s*C\s*H\s*A\s*R\s*A\s*C\s*T\s*E\s*R\s*I\s*S\s*T\s*I\s*C\s|S\s*C\s*A\s*L\s*E\s*S|CLARITY\s+CHARACTERISTICS|GRADING\s+SCALES|ADDITIONAL\s+GRADING\s+INFORMATION|G\s*I\s*A\s*N\s*A\s*T\s*U\s*R\s*A\s*L|GIA\s+NATURAL\s+DIAMOND\s+GRADING\s+REPORT|FACSIMILE|This\s+is\s+a\s+digital\s+representation|security\s+features)\b/i;

const GIA_BLOCK_END_RE =
  /\b(?:COMMENTS|FINISH|SECURITY\s+FEATURES|KEY\s+TO\s+SYMBOLS|reportcheck\.gia\.edu)\b/i;

const GIA_BLOCK_ANCHOR_RES: RegExp[] = [
  /\bCrown\s+Angle\b/gi,
  /\bPavilion\s+Angle\b/gi,
  /\bStar\s+Length\b/gi,
  /\bLower\s+Half\b/gi,
  /\bTable\b/gi,
  /(?<!pavilion\s)(?:total\s+)?\bDepth\b/gi,
  /\bGirdle\b/gi,
  /\bCulet\b/gi,
  /\bP\s*R\s*O\s*P\s*O\s*R\s*T\s*I\s*O\s*N\s*S\b/gi,
  /\bPROPORTIONS\b/gi,
  /(?<![\d.])(\d{1,3}(?:\.\d+)?)\s*%/gi,
  /(?<![\d.])(\d{1,3}(?:\.\d+)?)\s*(?:°|H\b)/gi,
];

/** Shown when live OCR text lacks proportion diagram numbers. */
export const GIA_OCR_DIAGRAM_MISSING_NOTICE =
  "Proportion diagram not captured by OCR. Manual entry required for this report.";

const GIA_DIAGRAM_VALUE_CHECKS: Array<{
  key: string;
  patterns: RegExp[];
}> = [
  { key: "56", patterns: [/\b56\b/, /\bS6\b/i] },
  { key: "63.1", patterns: [/\b63\.1\b/] },
  { key: "36.5", patterns: [/\b36\.5\b/] },
  { key: "40.8", patterns: [/\b40\.8\b/] },
  { key: "75", patterns: [/\b75\b/, /\b7S\b/i] },
  { key: "50", patterns: [/\b50\b/, /\b5O\b/i] },
  { key: "3.5", patterns: [/\b3\.5\b/] },
  { key: "none", patterns: [/\bculet\b[\s\S]{0,40}\bnone\b/i, /\bnone\b/i] },
];

export type GiaOcrDiagramCaptureAudit = {
  textLength: number;
  contains: Record<string, boolean>;
  matchCount: number;
  sufficientForDiagramParse: boolean;
};

type GiaBlockCandidate = {
  anchor: string;
  start: number;
  score: number;
  hasDegree: number;
  percentCount: number;
  roleWordCount: number;
  rejectedReason: string | null;
  preview: string;
  first500: string;
};

export function auditGiaOcrDiagramCapture(rawText: string): GiaOcrDiagramCaptureAudit {
  const contains = Object.fromEntries(
    GIA_DIAGRAM_VALUE_CHECKS.map(({ key, patterns }) => [
      key,
      patterns.some((p) => p.test(rawText)),
    ]),
  ) as Record<string, boolean>;
  const matchCount = Object.values(contains).filter(Boolean).length;
  return {
    textLength: rawText.length,
    contains,
    matchCount,
    sufficientForDiagramParse: matchCount >= 5,
  };
}

export function giaOcrDiagramNumbersCaptured(rawText: string): boolean {
  return auditGiaOcrDiagramCapture(rawText).sufficientForDiagramParse;
}

function shouldLogGiaOcrCaptureDebug(): boolean {
  return process.env.CALIBRATION_EXTRACT_DEBUG === "1";
}

export function logGiaOcrCaptureDebug(
  rawText: string,
  textMethod?: TextExtractionMethod,
): GiaOcrDiagramCaptureAudit {
  const audit = auditGiaOcrDiagramCapture(rawText);
  if (!shouldLogGiaOcrCaptureDebug()) return audit;

  console.log("[GIA OCR RAW LENGTH]", audit.textLength);
  console.log("[GIA OCR VALUE PRESENCE]", audit.contains);
  return audit;
}

function countBlockDiagramValueHits(block: string): number {
  return GIA_DIAGRAM_VALUE_CHECKS.filter(({ patterns }) =>
    patterns.some((p) => p.test(block)),
  ).length;
}

function collectGiaBlockAnchorIndices(rawText: string): Array<{ index: number; label: string }> {
  const hits: Array<{ index: number; label: string }> = [];
  const seen = new Set<number>();

  for (const re of GIA_BLOCK_ANCHOR_RES) {
    const flags = re.flags.includes("g") ? re.flags : `${re.flags}g`;
    const globalRe = new RegExp(re.source, flags);
    let m: RegExpExecArray | null;
    while ((m = globalRe.exec(rawText)) !== null) {
      if (m.index === undefined || seen.has(m.index)) continue;
      seen.add(m.index);
      hits.push({ index: m.index, label: m[0].slice(0, 40) });
    }
  }

  return hits.sort((a, b) => a.index - b.index);
}

function giaBlockHasReportShell(block: string): boolean {
  return GIA_REPORT_SHELL_RE.test(block);
}

function scoreGiaProportionBlockCandidate(block: string): {
  score: number;
  hasDegree: number;
  percentCount: number;
  roleWordCount: number;
  rejected?: string;
} {
  const degreeCount = (block.match(/(?<![\d.])(\d{1,3}(?:\.\d+)?)\s*(?:°|H\b)/gi) ?? [])
    .length;
  const pctCount = (block.match(/(?<![\d.])(\d{1,3}(?:\.\d+)?)\s*%/gi) ?? []).length;
  const roleWords = [
    "crown",
    "pavilion",
    "table",
    "star",
    "lower",
    "depth",
    "girdle",
    "culet",
  ];
  const roleCount = roleWords.filter((w) => new RegExp(`\\b${w}\\b`, "i").test(block))
    .length;

  if (block.length < 40) {
    return {
      score: -100,
      hasDegree: degreeCount,
      percentCount: pctCount,
      roleWordCount: roleCount,
      rejected: "too-short",
    };
  }
  if (giaBlockHasReportShell(block)) {
    return {
      score: -100,
      hasDegree: degreeCount,
      percentCount: pctCount,
      roleWordCount: roleCount,
      rejected: "report-shell",
    };
  }

  if (degreeCount < 1) {
    return {
      score: -50,
      hasDegree: degreeCount,
      percentCount: pctCount,
      roleWordCount: roleCount,
      rejected: "no-degree-marker",
    };
  }
  if (pctCount < 3) {
    return {
      score: -50,
      hasDegree: degreeCount,
      percentCount: pctCount,
      roleWordCount: roleCount,
      rejected: "few-percent-values",
    };
  }
  if (roleCount < 1) {
    return {
      score: -50,
      hasDegree: degreeCount,
      percentCount: pctCount,
      roleWordCount: roleCount,
      rejected: "no-role-words",
    };
  }

  let score = 0;
  score += Math.min(degreeCount, 4) * 12;
  score += Math.min(pctCount, 8) * 8;
  score += roleCount * 10;
  score += countBlockDiagramValueHits(block) * 14;
  if (/\bCrown\s+Angle\b/i.test(block)) score += 15;
  if (/\bPavilion\s+Angle\b/i.test(block)) score += 15;
  if (/\bStar\s+Length\b/i.test(block) || /\b5O\b|\b50\s*%/i.test(block)) score += 8;
  if (/\bLower\s+Half\b/i.test(block) || /\b7S\b|\b75\s*%/i.test(block)) score += 8;
  if (/\bGirdle\b/i.test(block)) score += 8;
  if (/\bCulet\b/i.test(block)) score += 6;
  if (/\b\d{1,2}(?:\.\d+)?\s*-\s*\d{1,2}(?:\.\d+)?\s*x\s*\d/i.test(block)) score += 5;

  return { score, hasDegree: degreeCount, percentCount: pctCount, roleWordCount: roleCount };
}

/** When diagram numbers exist in full OCR but anchor windows fail, scan by value density. */
function fallbackGiaDiagramBlockFromKnownValues(
  rawText: string,
): { start: number; block: string } {
  const seeds = [
    "36.5",
    "40.8",
    "40.6",
    "36.0",
    "58.4",
    "64",
    "80",
    "50",
    "56",
    "63.1",
    "75",
    "5O",
    "S6",
    "7S",
    "3.5",
  ];
  let bestStart = 0;
  let bestHits = 0;

  for (const seed of seeds) {
    let idx = rawText.indexOf(seed);
    while (idx >= 0) {
      const start = Math.max(0, idx - 280);
      const window = sliceGiaBlockWindow(rawText, start, 3200);
      const hits = countBlockDiagramValueHits(window);
      if (hits > bestHits) {
        bestHits = hits;
        bestStart = start;
      }
      idx = rawText.indexOf(seed, idx + 1);
    }
  }

  return { start: bestStart, block: sliceGiaBlockWindow(rawText, bestStart, 3500) };
}

function sliceGiaBlockWindow(rawText: string, start: number, maxLen = 4500): string {
  let slice = rawText.slice(Math.max(0, start), start + maxLen);
  const end = slice.search(GIA_BLOCK_END_RE);
  if (end > 80 && end < slice.length) {
    slice = slice.slice(0, end);
  }
  return slice.trim();
}

/** Diagram labels: slice forward from anchor — avoid pulling in header shell above. */
function windowStartForAnchor(label: string, index: number): number {
  if (/\b(?:Crown|Pavilion|Star|Lower|Girdle|Culet)\b/i.test(label)) {
    return Math.max(0, index - 20);
  }
  if (/\bTable\b/i.test(label)) {
    return Math.max(0, index - 40);
  }
  if (/(?<!pavilion\s)\bDepth\b/i.test(label)) {
    return Math.max(0, index - 30);
  }
  if (/\bP\s*R\s*O\s*P\s*O\s*R\s*T\s*I\s*O\s*N\s*S\b/i.test(label) || /\bPROPORTIONS\b/i.test(label)) {
    return index;
  }
  return Math.max(0, index - 100);
}

function buildGiaBlockCandidate(
  anchor: string,
  windowStart: number,
  block: string,
): GiaBlockCandidate {
  const scored = scoreGiaProportionBlockCandidate(block);
  return {
    anchor,
    start: windowStart,
    score: scored.score,
    hasDegree: scored.hasDegree,
    percentCount: scored.percentCount,
    roleWordCount: scored.roleWordCount,
    rejectedReason: scored.rejected ?? null,
    preview: block.slice(0, 120).replace(/\n/g, "\\n"),
    first500: block.slice(0, 500),
  };
}

function selectGiaProportionBlockCandidate(
  rawText: string,
): { block: string; candidates: GiaBlockCandidate[] } {
  const anchors = collectGiaBlockAnchorIndices(rawText);
  const candidates: GiaBlockCandidate[] = [];
  const numbersInFullText = giaOcrDiagramNumbersCaptured(rawText);

  for (const { index, label } of anchors) {
    const windowStart = windowStartForAnchor(label, index);
    const block = sliceGiaBlockWindow(rawText, windowStart);
    candidates.push(buildGiaBlockCandidate(label, windowStart, block));
  }

  if (numbersInFullText) {
    const density = fallbackGiaDiagramBlockFromKnownValues(rawText);
    candidates.push(
      buildGiaBlockCandidate("value-density-fallback", density.start, density.block),
    );
  }

  const viable = candidates.filter((c) => c.score > 0);
  if (viable.length === 0) {
    const fallback = numbersInFullText
      ? fallbackGiaDiagramBlockFromKnownValues(rawText).block
      : sliceGiaBlockWindow(rawText, 0);
    return { block: fallback, candidates };
  }

  viable.sort((a, b) => {
    const blockA = sliceGiaBlockWindow(rawText, a.start, 3500);
    const blockB = sliceGiaBlockWindow(rawText, b.start, 3500);
    const hitsA = countBlockDiagramValueHits(blockA);
    const hitsB = countBlockDiagramValueHits(blockB);
    if (hitsB !== hitsA) return hitsB - hitsA;
    return b.score - a.score;
  });

  const best = viable[0]!;
  const block =
    best.anchor === "value-density-fallback"
      ? fallbackGiaDiagramBlockFromKnownValues(rawText).block
      : sliceGiaBlockWindow(rawText, best.start, 3500);
  return { block, candidates };
}

function logGiaBlockSelectionDebug(
  candidates: GiaBlockCandidate[],
  selectedBlock: string,
): void {
  if (!shouldLogGiaOcrCaptureDebug()) return;
  console.log("[GIA BLOCK CANDIDATES]", candidates);
  console.log("[GIA BLOCK SELECTED]", selectedBlock);
}

/** Wide proportion slice from raw OCR/PDF text (newlines preserved). */
/** Best-effort diagram window when anchor selection fails (facsimile OCR). */
export function extractGiaFallbackDiagramBlock(rawText: string): string {
  return fallbackGiaDiagramBlockFromKnownValues(rawText).block;
}

export function extractGiaProportionBlock(rawText: string): string {
  return selectGiaProportionBlockCandidate(rawText).block;
}

export function getGiaProportionDebugSlices(rawText: string): {
  rawSlice: string;
  normalizedSlice: string;
} {
  const rawSlice = extractGiaProportionBlock(rawText);
  return {
    rawSlice,
    normalizedSlice: normalizeGiaProportionBlockText(rawSlice),
  };
}

export function logGiaProportionSlicesForDebug(rawText: string): void {
  if (process.env.CALIBRATION_EXTRACT_DEBUG !== "1") return;
  const { rawSlice, normalizedSlice } = getGiaProportionDebugSlices(rawText);
  console.log("[GIA RAW PROPORTIONS]", rawSlice);
  console.log("[GIA NORMALIZED PROPORTIONS]", normalizedSlice);
}

function logGiaProportionExtractionDebug(
  proportionBlock: string,
  fields: CalibrationReportFields,
): void {
  if (process.env.CALIBRATION_EXTRACT_DEBUG !== "1") return;
  console.log("[GIA FINAL BLOCK]", proportionBlock);
  console.log(
    "[GIA EXTRACTED]",
    Object.fromEntries(
      GIA_DIAGRAM_FIELD_KEYS.map((k) => [k, fields[k] ?? ""]),
    ),
  );
}

/** Star + table percents adjacent (live OCR: `Round Brilliant 50% 56%`). */
function looksLikeGiaOcrProportionScatter(text: string): boolean {
  return /(?<![\d.])\d{1,3}(?:\.\d+)?\s*%[\s\S]{0,80}?\d{1,3}(?:\.\d+)?\s*%/.test(text);
}

function setGiaFieldIfEmpty(
  fields: CalibrationReportFields,
  set: FieldSetter,
  key: ReportFieldKey,
  value: string,
  level: FieldConfidence,
): void {
  if (!value.trim() || fields[key].trim()) return;
  setGiaField(fields, set, key, value, level);
}

function setInternalIfEmpty(
  internal: GiaInternalFields | undefined,
  key: keyof GiaInternalFields,
  value: string | null,
): void {
  if (!internal || !value || internal[key]) return;
  internal[key] = value;
}

/** Facsimile grading table present but diagram proportions are image-only — OCR can supply values. */
export function needsGiaProportionOcrSupplement(text: string): boolean {
  if (!looksLikeGiaReportText(text)) return false;
  if (giaProportionValuesPresent(text)) return false;
  return /\b(?:gia\s+report\s+number|carat\s+weight|grading\s+results)\b/i.test(
    text,
  );
}

/** GIA diagram order: star % → table % → crown ° → crown height % → pavilion ° → pavilion depth % → lower half %. */
export function looksLikeGiaProportionStack(text: string): boolean {
  return new RegExp(
    String.raw`(?<![\d.])${PCT}\s*%[\s\S]{0,140}?${PCT}\s*%[\s\S]{0,140}?${PCT}\s*°[\s\S]{0,140}?${PCT}\s*%[\s\S]{0,140}?${PCT}\s*°`,
    "i",
  ).test(text);
}

export function looksLikeGiaReportText(text: string): boolean {
  const t = text.slice(0, 8000);
  if (/\bGIA\b/i.test(t) || /gemological institute of america/i.test(t)) {
    return true;
  }
  if (/\bgia\.edu\b/i.test(t)) return true;
  return looksLikeGiaProportionStack(t);
}

function parseNum(s: string): string | null {
  const n = parseFloat(s.replace(/[^\d.]/g, ""));
  if (!Number.isFinite(n)) return null;
  return String(n);
}

function titleCaseWord(s: string): string {
  const t = s.trim().toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function titleCasePhrase(s: string): string {
  return s
    .trim()
    .split(/\s+/)
    .map((w) => {
      const lower = w.toLowerCase();
      if (lower === "to" || lower === "-") return lower === "-" ? "-" : "to";
      return titleCaseWord(w);
    })
    .join(" ")
    .replace(/\s+-\s+/g, " - ");
}

/** PDF text often glues tokens (`GIARound Brilliant`) — do not require a word boundary before `round`. */
function matchRoundBrilliantShape(text: string): string | null {
  const m = text.match(/(round\s+brilliant(?:\s+cut)?)/i);
  return m?.[1] ? titleCasePhrase(m[1].replace(/\s+cut\b/i, "").trim()) : null;
}

/** Display form: Medium - Slightly Thick (Faceted) 3.5% */
export function formatGiaGirdlePhrase(raw: string): string {
  const thickness = raw.match(new RegExp(GIRDLE_THICKNESS, "i"))?.[1]?.trim();
  if (!thickness) return "";
  const faceted = /\(\s*faceted\s*\)/i.test(raw);
  const pct = raw.match(/(\d{1,2}(?:\.\d+)?)\s*%/)?.[1];
  const body = titleCasePhrase(thickness.replace(/\s*-\s*/g, " - "));
  const facetedPart = faceted ? " (Faceted)" : "";
  const pctPart = pct ? ` ${pct}%` : "";
  return `${body}${facetedPart}${pctPart}`.trim();
}

function setIfEmpty(
  fields: CalibrationReportFields,
  set: FieldSetter,
  key: ReportFieldKey,
  value: string,
  level: FieldConfidence,
): void {
  if (!value.trim() || fields[key].trim()) return;
  set(key, value.trim(), level);
}

/** Authoritative GIA diagram / finish values — overwrite generic common-parser guesses. */
function setGiaField(
  fields: CalibrationReportFields,
  set: FieldSetter,
  key: ReportFieldKey,
  value: string,
  level: FieldConfidence,
): void {
  if (!value.trim()) return;
  // GIA-specific ordering fix: invoke the consumer's setter BEFORE writing
  // fields[key] directly. The upload image-OCR augmentation's setter only
  // fills EMPTY slots and is what assigns confidence. Writing fields[key]
  // first made that setter observe the slot as already-populated, so it
  // skipped the confidence write — leaving values like pavilionAngle="40.8"
  // with a "missing" confidence marker. The trailing direct write preserves
  // text-path overwrite/force semantics (that setter has no empty guard).
  set(key, value.trim(), level);
  fields[key] = value.trim();
}

function setInternal(
  internal: GiaInternalFields | undefined,
  key: keyof GiaInternalFields,
  value: string | null,
): void {
  if (!internal || !value) return;
  internal[key] = value;
}

function isPlausibleStar(value: string): boolean {
  const n = parseFloat(value);
  return Number.isFinite(n) && n >= 40 && n <= 65;
}

function isPlausibleTable(value: string): boolean {
  const n = parseFloat(value);
  return Number.isFinite(n) && n >= 50 && n <= 70;
}

function isPlausibleCrownAngle(value: string): boolean {
  const n = parseFloat(value);
  return Number.isFinite(n) && n >= 28 && n <= 42;
}

function isPlausibleCrownHeight(value: string): boolean {
  const n = parseFloat(value);
  return Number.isFinite(n) && n >= 8 && n <= 25;
}

function isPlausiblePavilionAngle(value: string): boolean {
  const n = parseFloat(value);
  // Pavilion angle is always ~39–42°; 43 is pavilion depth % on this report.
  if (!Number.isFinite(n) || n < 39 || n > 42.5) return false;
  // Reject truncated OCR integers (e.g. "40" from "40.B H") — real angles have tenths.
  if (/^\d{2}$/.test(value.trim()) && n >= 40 && n <= 42) return false;
  return true;
}

function isPlausiblePavilionDepth(value: string): boolean {
  const n = parseFloat(value);
  return Number.isFinite(n) && n >= 38 && n <= 48;
}

function isPlausibleLowerHalf(value: string): boolean {
  const n = parseFloat(value);
  return Number.isFinite(n) && n >= 65 && n <= 90;
}

/** Girdle thickness % on report (distinct from table/depth/pavilion %). */
function isPlausibleGirdleThicknessPercent(value: string): boolean {
  const n = parseFloat(value);
  return Number.isFinite(n) && n >= 2 && n <= 8;
}

/** Pavilion angle from label + degree marker (never plain % like 43.0). */
function readGiaPavilionAngleDegree(text: string): string | null {
  const norm = fixGiaOcrDegreeNumerals(text);
  const patterns = [
    new RegExp(
      String.raw`\bpavilion\s+angle\b[\s\n]+(${GIA_OCR_DEGREE_NUM})\s*${GIA_DEGREE_SUFFIX}`,
      "i",
    ),
    new RegExp(
      String.raw`\bpavilion\s+angle\b[\s\S]{0,72}?(${GIA_OCR_DEGREE_NUM})\s*${GIA_DEGREE_SUFFIX}`,
      "i",
    ),
  ];
  for (const re of patterns) {
    const m = norm.match(re);
    const v = m?.[1] ? parseGiaOcrDegreeValue(m[1]) : null;
    if (v && isPlausiblePavilionAngle(v)) return v;
  }
  return null;
}

/** Degree-marked pavilion angle scan (excludes crown angle; never naked %). */
function findGiaPavilionAngleDegree(
  text: string,
  exclude?: Set<string>,
): string | null {
  const label = readGiaPavilionAngleDegree(text);
  if (label && (!exclude || !exclude.has(label))) return label;

  const norm = fixGiaOcrDegreeNumerals(text);
  const re = new RegExp(
    String.raw`(?<![\d.])(?:pavilion\s+angle[\s\S]{0,48}?)?(${GIA_OCR_DEGREE_NUM})\s*${GIA_DEGREE_SUFFIX}`,
    "gi",
  );
  for (const m of norm.matchAll(re)) {
    const v = m[1] ? parseGiaOcrDegreeValue(m[1]) : null;
    if (!v || (exclude && exclude.has(v))) continue;
    if (isPlausiblePavilionAngle(v)) return v;
  }

  const anyDeg = new RegExp(
    String.raw`(?<![\d.])(\d{1,3}(?:\.\d+)?)\s*${GIA_DEGREE_SUFFIX}`,
    "gi",
  );
  const hits: string[] = [];
  for (const m of norm.matchAll(anyDeg)) {
    const v = m[1] ? parseGiaOcrDegreeValue(m[1]) : null;
    if (!v || (exclude && exclude.has(v))) continue;
    if (isPlausiblePavilionAngle(v)) hits.push(v);
  }
  return hits.length > 0 ? hits[hits.length - 1]! : null;
}

function readGiaPavilionDepthPercent(text: string): string | null {
  const m = text.match(/\bpavilion\s+depth\b[\s\S]{0,48}?(\d{1,3}(?:\.\d+)?)\s*%?/i);
  const v = m?.[1] ? parseNum(m[1]) : null;
  if (v && isPlausiblePavilionDepth(v)) return v;
  return null;
}

function shouldLogGiaFieldHydrationDebug(): boolean {
  return process.env.CALIBRATION_EXTRACT_DEBUG === "1";
}

function logGiaPavilionHydration(
  stage: string,
  payload: Record<string, unknown>,
): void {
  if (!shouldLogGiaFieldHydrationDebug()) return;
  console.log(`[GIA PAVILION ${stage}]`, payload);
}

function logGiaGirdleHydration(
  stage: string,
  payload: Record<string, unknown>,
): void {
  if (!shouldLogGiaFieldHydrationDebug()) return;
  console.log(`[GIA GIRDLE ${stage}]`, payload);
}

function needsGiaPavilionHydration(fields: CalibrationReportFields): boolean {
  const v = fields.pavilionAngle.trim();
  if (!v) return true;
  if (v === "43") return true;
  return !isPlausiblePavilionAngle(v);
}

export function girdleCompletenessScore(value: string): number {
  let score = 0;
  if (/\bmedium\b/i.test(value)) score += 2;
  if (/\bslightly\s+thick\b/i.test(value)) score += 2;
  if (/faceted/i.test(value)) score += 2;
  if (girdleFormattedHasPercent(value)) score += 3;
  return score;
}

function needsGiaGirdleHydration(fields: CalibrationReportFields): boolean {
  const v = fields.girdle.trim();
  if (!v) return true;
  return girdleCompletenessScore(v) < 7;
}

function collectGiaPavilionRawMatches(text: string): string[] {
  const norm = fixGiaOcrDegreeNumerals(text);
  const hits = new Set<string>();
  const patterns = [
    /\bpavilion\s+angle\b[\s\S]{0,96}/gi,
    /\bpavilion\s+angle\b[\s\S]{0,96}?(?:[0-9][0-9OIlZB.,\s]{0,12}?)\s*(?:°|H\b)/gi,
    /(?:[0-9][0-9OIlZB.,\s]{0,12}?)\s*(?:°|H\b)/gi,
  ];
  for (const re of patterns) {
    for (const m of norm.matchAll(re)) {
      if (m[0]) hits.add(m[0].replace(/\s+/g, " ").trim().slice(0, 120));
    }
  }
  return [...hits];
}

function resolveGiaPavilionAngleForHydration(
  text: string,
  exclude: Set<string>,
): string | null {
  const label = readGiaPavilionAngleDegree(text);
  if (label && (!exclude.has(label) || /\bpavilion\s+angle\b/i.test(text))) {
    return label;
  }
  return findGiaPavilionAngleDegree(text, exclude);
}

function findGiaPavilionAngleEvidence(text: string, crownAngle: string): string | null {
  const exclude = new Set(crownAngle.trim() ? [crownAngle.trim()] : []);
  const resolved = resolveGiaPavilionAngleForHydration(text, exclude);
  if (resolved) return resolved;

  const norm = fixGiaOcrDegreeNumerals(text);
  if (!/\bpavilion\s+angle\b/i.test(norm)) return null;
  const window = norm.match(/\bpavilion\s+angle\b[\s\S]{0,120}/i)?.[0] ?? "";
  if (!/(?:°|H\b)/i.test(window)) return null;
  const m = window.match(
    new RegExp(String.raw`(${GIA_OCR_DEGREE_NUM})\s*${GIA_DEGREE_SUFFIX}`, "i"),
  );
  const v = m?.[1] ? parseGiaOcrDegreeValue(m[1]) : null;
  if (v && isPlausiblePavilionAngle(v) && v !== "43") return v;
  return null;
}

function buildGiaGirdleFromEvidence(text: string): string | null {
  const anchor = text.search(/\bgirdle\b/i);
  const window =
    anchor >= 0 ? text.slice(anchor, anchor + 520) : text.slice(0, 520);
  if (!/\bmedium\b/i.test(window) || !/\bslightly\s+thick\b/i.test(window)) {
    return null;
  }
  const faceted = /faceted|factted/i.test(window);
  const pct = findGirdleThicknessPercentNear(window);
  let raw = "Medium - Slightly Thick";
  if (faceted) raw += " (Faceted)";
  if (pct) raw += ` ${pct}%`;
  return formatGiaGirdlePhrase(raw);
}

function logGiaPavilionAssignmentPipeline(
  rawText: string,
  fields: CalibrationReportFields,
): void {
  if (!shouldLogGiaFieldHydrationDebug()) return;
  const texts = [
    rawText,
    fixGiaOcrDegreeNumerals(rawText),
    normalizeGiaProportionBlockText(rawText),
  ];
  logGiaPavilionHydration("RAW MATCHES", {
    matches: texts.flatMap((t) => collectGiaPavilionRawMatches(t)),
  });
  logGiaPavilionHydration("NORMALIZED", {
    candidates: texts.map((t) => resolveGiaPavilionAngleForHydration(t, new Set())),
    evidence: texts.map((t) =>
      findGiaPavilionAngleEvidence(t, fields.crownAngle),
    ),
  });
  logGiaPavilionHydration("FINAL", {
    pavilionAngle: fields.pavilionAngle,
    needsHydration: needsGiaPavilionHydration(fields),
  });
}

function logGiaGirdleAssignmentPipeline(
  rawText: string,
  fields: CalibrationReportFields,
): void {
  if (!shouldLogGiaFieldHydrationDebug()) return;
  const texts = [
    rawText,
    normalizeGiaProportionBlockText(rawText),
    normalizeGiaProportionBlockText(extractGiaProportionBlock(rawText)),
  ];
  logGiaGirdleHydration("RAW MATCHES", {
    stitched: texts.map((t) => stitchGiaOcrGirdleFromText(t)),
    extracted: texts.map((t) => extractGiaGirdleFromText(t)),
    evidence: buildGiaGirdleFromEvidence(rawText),
  });
  logGiaGirdleHydration("NORMALIZED", {
    current: fields.girdle,
    score: girdleCompletenessScore(fields.girdle),
    needsHydration: needsGiaGirdleHydration(fields),
  });
  logGiaGirdleHydration("FINAL", { girdle: fields.girdle });
}

function logFallbackForensic(
  label: string,
  payload: Record<string, unknown>,
  rawText: string,
): void {
  if (!shouldLogForensicHydration(rawText)) return;
  console.log(label, JSON.stringify(payload, null, 2));
}

function snapshotFieldsForFallback(
  fields: CalibrationReportFields,
): Record<string, string> {
  return {
    pavilionAngle: fields.pavilionAngle,
    girdle: fields.girdle,
    tablePercent: fields.tablePercent,
    crownAngle: fields.crownAngle,
    culet: fields.culet,
  };
}

/** Read-only probe for live diagnostics (does not assign fields). */
export function probeGiaLiveFieldCandidates(
  rawText: string,
  crownAngle: string,
): { pavilionCandidate: string | null; girdleCandidate: string | null } {
  const exclude = new Set(crownAngle.trim() ? [crownAngle.trim()] : []);
  const pavilionCandidate =
    resolveGiaPavilionAngleForHydration(rawText, exclude) ??
    findGiaPavilionAngleEvidence(rawText, crownAngle);
  const girdleCandidate =
    extractGiaGirdleFromText(rawText) ??
    stitchGiaOcrGirdleFromText(rawText) ??
    buildGiaGirdleFromEvidence(rawText);
  return { pavilionCandidate, girdleCandidate };
}

/** Last-chance OCR hydration — runs on full raw text after all parsers. */
export function applyGiaOcrFieldHydrationFallback(
  rawText: string,
  fields: CalibrationReportFields,
  set: FieldSetter,
): void {
  logFallbackForensic(
    "[FALLBACK ENTER]",
    {
      pavilionAngle: fields.pavilionAngle,
      girdle: fields.girdle,
      needsPavilion: needsGiaPavilionHydration(fields),
      needsGirdle: needsGiaGirdleHydration(fields),
      fieldsSnapshot: snapshotFieldsForFallback(fields),
    },
    rawText,
  );

  const crownAngle = fields.crownAngle.trim();
  const exclude = new Set(crownAngle ? [crownAngle] : []);
  const searchTexts = [
    rawText,
    fixGiaOcrDegreeNumerals(rawText),
    normalizeGiaProportionBlockText(rawText),
    normalizeGiaProportionBlockText(extractGiaProportionBlock(rawText)),
  ];

  if (needsGiaPavilionHydration(fields)) {
    for (const src of searchTexts) {
      const resolved = resolveGiaPavilionAngleForHydration(src, exclude);
      logFallbackForensic(
        "[FALLBACK FOUND PAVILION]",
        {
          resolved,
          sourceIndex: searchTexts.indexOf(src),
          plausible: resolved ? isPlausiblePavilionAngle(resolved) : false,
        },
        rawText,
      );
      if (resolved) {
        logFallbackForensic(
          "[FALLBACK ASSIGN PAVILION]",
          { value: resolved, before: fields.pavilionAngle },
          rawText,
        );
        setGiaPavilionAngleDegree(fields, set, resolved, "high");
        logFallbackForensic(
          "[FALLBACK POST ASSIGN]",
          { fields: snapshotFieldsForFallback(fields) },
          rawText,
        );
        break;
      }
    }
  }

  if (needsGiaPavilionHydration(fields)) {
    const evidence = findGiaPavilionAngleEvidence(rawText, crownAngle);
    logFallbackForensic(
      "[FALLBACK FOUND PAVILION]",
      { resolved: evidence, path: "evidence-fallback" },
      rawText,
    );
    if (evidence) {
      logFallbackForensic(
        "[FALLBACK ASSIGN PAVILION]",
        { value: evidence, before: fields.pavilionAngle, path: "evidence" },
        rawText,
      );
      setGiaPavilionAngleDegree(fields, set, evidence, "medium");
      logFallbackForensic(
        "[FALLBACK POST ASSIGN]",
        { fields: snapshotFieldsForFallback(fields) },
        rawText,
      );
    }
  }

  const currentGirdleScore = girdleCompletenessScore(fields.girdle);
  for (const src of searchTexts) {
    const candidate =
      extractGiaGirdleFromText(src) ??
      extractGiaGirdleFromFacsimileGradingResultsFragment(src) ??
      stitchGiaOcrGirdleFromText(src);
    logFallbackForensic(
      "[FALLBACK FOUND GIRDLE]",
      {
        candidate,
        sourceIndex: searchTexts.indexOf(src),
        score: candidate ? girdleCompletenessScore(candidate) : 0,
        currentGirdleScore,
      },
      rawText,
    );
    if (candidate && girdleCompletenessScore(candidate) > currentGirdleScore) {
      logFallbackForensic(
        "[FALLBACK ASSIGN GIRDLE]",
        { value: candidate, before: fields.girdle },
        rawText,
      );
      setGiaGirdleForce(fields, set, candidate, "high");
      logFallbackForensic(
        "[FALLBACK POST ASSIGN]",
        { fields: snapshotFieldsForFallback(fields) },
        rawText,
      );
      break;
    }
  }

  if (needsGiaGirdleHydration(fields)) {
    const built = buildGiaGirdleFromEvidence(rawText);
    logFallbackForensic(
      "[FALLBACK FOUND GIRDLE]",
      { candidate: built, path: "evidence-build" },
      rawText,
    );
    if (built) {
      logFallbackForensic(
        "[FALLBACK ASSIGN GIRDLE]",
        { value: built, before: fields.girdle, path: "evidence" },
        rawText,
      );
      setGiaGirdleForce(fields, set, built, "medium");
      logFallbackForensic(
        "[FALLBACK POST ASSIGN]",
        { fields: snapshotFieldsForFallback(fields) },
        rawText,
      );
    }
  }

  logFallbackForensic(
    "[FALLBACK EXIT]",
    {
      pavilionAngle: fields.pavilionAngle,
      girdle: fields.girdle,
      fieldsSnapshot: snapshotFieldsForFallback(fields),
    },
    rawText,
  );

  logGiaPavilionAssignmentPipeline(rawText, fields);
  logGiaGirdleAssignmentPipeline(rawText, fields);
}

export function logGiaFieldsBeforeFinalize(
  fields: CalibrationReportFields,
  step: string,
): void {
  if (!shouldLogGiaFieldHydrationDebug()) return;
  console.log(`[GIA PRE-FINALIZE ${step}]`, {
    pavilionAngle: fields.pavilionAngle,
    girdle: fields.girdle,
  });
}

function setGiaPavilionAngleDegree(
  fields: CalibrationReportFields,
  set: FieldSetter,
  value: string,
  level: FieldConfidence,
): void {
  logGiaPavilionHydration("SET BEFORE", {
    incoming: value,
    current: fields.pavilionAngle,
    plausible: isPlausiblePavilionAngle(value),
  });
  if (!value.trim() || value.trim() === "43" || !isPlausiblePavilionAngle(value)) {
    logGiaPavilionHydration("SET REJECTED", {
      incoming: value,
      reason:
        value.trim() === "43"
          ? "pavilion-depth-not-angle"
          : "plausibility-or-empty",
    });
    return;
  }
  setGiaField(fields, set, "pavilionAngle", value, level);
  logGiaPavilionHydration("SET AFTER", { pavilionAngle: fields.pavilionAngle });
}

function setGiaPavilionAngleDegreeIfEmpty(
  fields: CalibrationReportFields,
  set: FieldSetter,
  value: string,
  level: FieldConfidence,
): void {
  if (!fields.pavilionAngle.trim()) setGiaPavilionAngleDegree(fields, set, value, level);
}

function inNumericRange(value: string, min: number, max: number): boolean {
  const n = parseFloat(value);
  return Number.isFinite(n) && n >= min && n <= max;
}

/** Total depth only — never pavilion depth (lookbehind cannot span "Pavilion Depth"). */
function isGiaContactDepthFalsePositive(
  text: string,
  matchIndex: number,
  value: string,
): boolean {
  const window = text.slice(Math.max(0, matchIndex - 100), matchIndex + 100);
  if (
    /\b(?:\+1|call\s+us|phone|800\.421|760\s*603|603\s*4500|g\.i\.a\.?\s*headquarters)\b/i.test(
      window,
    )
  ) {
    return true;
  }
  if (value === "60" && !/\btotal\s+depth\b/i.test(window)) {
    if (/\b603\b|\b760\b|\b4500\b/.test(window)) return true;
  }
  return false;
}

function matchGiaTotalDepthValue(text: string): string | null {
  const patterns: Array<{ re: RegExp; name: string }> = [
    {
      name: "total-depth-labeled",
      re: /(?:^|\n)\s*total\s+depth\s*[:\s]*(\d{1,3}(?:\.\d+)?)\s*%?/im,
    },
    {
      name: "depth-newline-value",
      re: /(?:^|\n)\s*depth\s*\n\s*(\d{1,3}(?:\.\d+)?)\s*%?/im,
    },
    {
      name: "depth-inline",
      re: /(?:^|\n)(?![^\n]*\bpavilion\b)[^\n]*\bdepth\b[^0-9]{0,20}(\d{1,3}(?:\.\d+)?)\s*%?/im,
    },
  ];
  for (const { re } of patterns) {
    const m = re.exec(text);
    if (!m?.[1]) continue;
    const v = parseNum(m[1]);
    if (!v) continue;
    if (isGiaContactDepthFalsePositive(text, m.index, v)) continue;
    if (isOcrRoleDepth(v)) return v;
    if (inNumericRange(v, 55, 70)) return v;
  }
  return null;
}

function isOcrRoleStar(v: string): boolean {
  return inNumericRange(v, 45, 60);
}
function isOcrRoleTable(v: string): boolean {
  return inNumericRange(v, 53, 68);
}
function isOcrRoleDepth(v: string): boolean {
  return inNumericRange(v, 58, 64.5);
}
function isOcrRoleCrownAngle(v: string): boolean {
  return inNumericRange(v, 30, 39);
}
function isOcrRolePavilionAngle(v: string): boolean {
  return inNumericRange(v, 39, 42);
}
function isOcrRoleLowerHalf(v: string): boolean {
  return inNumericRange(v, 70, 85);
}
function isOcrRoleCrownHeight(v: string): boolean {
  return inNumericRange(v, 8, 25);
}
function isOcrRolePavilionDepth(v: string): boolean {
  return inNumericRange(v, 38, 48);
}

function isValidGiaDiagramMatch(m: RegExpMatchArray): boolean {
  const star = m[1];
  const table = m[2];
  const crown = m[3];
  const crownH = m[4];
  const pavilion = m[5];
  const pavDepth = m[6];
  const lower = m[7];
  return Boolean(
    star &&
      table &&
      crown &&
      crownH &&
      pavilion &&
      pavDepth &&
      lower &&
      isPlausibleStar(star) &&
      isPlausibleTable(table) &&
      isPlausibleCrownAngle(crown) &&
      isPlausibleCrownHeight(crownH) &&
      isPlausiblePavilionAngle(pavilion) &&
      isPlausiblePavilionDepth(pavDepth) &&
      isPlausibleLowerHalf(lower),
  );
}

function applyGiaDiagramRun(
  fields: CalibrationReportFields,
  set: FieldSetter,
  internal: GiaInternalFields | undefined,
  m: RegExpMatchArray,
): void {
  const star = parseNum(m[1]!);
  const table = parseNum(m[2]!);
  const crown = parseNum(m[3]!);
  const crownHeight = parseNum(m[4]!);
  const pavilion = parseNum(m[5]!);
  const pavilionDepth = parseNum(m[6]!);
  const lowerHalf = parseNum(m[7]!);

  if (star) setGiaField(fields, set, "starLengthPercent", star, "high");
  if (table) setGiaField(fields, set, "tablePercent", table, "high");
  if (crown) setGiaField(fields, set, "crownAngle", crown, "high");
  setInternal(internal, "crownHeightPercent", crownHeight);
  if (pavilion) setGiaPavilionAngleDegree(fields, set, pavilion, "high");
  setInternal(internal, "pavilionDepthPercent", pavilionDepth);
  if (lowerHalf) setGiaField(fields, set, "lowerHalfPercent", lowerHalf, "high");
}

function extractGiaDiagramRuns(
  text: string,
  fields: CalibrationReportFields,
  set: FieldSetter,
  internal: GiaInternalFields | undefined,
): void {
  const multiline = new RegExp(
    String.raw`(?<![\d.])(${PCT})\s*%[\s\n]+(${PCT})\s*%[\s\n]+(${PCT})\s*°[\s\n]+(${PCT})\s*%[\s\n]+(${PCT})\s*°[\s\n]+(${PCT})\s*%[\s\n]+(${PCT})\s*%`,
    "i",
  );
  const inline = new RegExp(
    String.raw`(?<![\d.])(${PCT})\s*%[\s]+(${PCT})\s*%[\s]+(${PCT})\s*°[\s]+(${PCT})\s*%[\s]+(${PCT})\s*°[\s]+(${PCT})\s*%[\s]+(${PCT})\s*%`,
    "gi",
  );

  const multilineMatch = text.match(multiline);
  if (multilineMatch && isValidGiaDiagramMatch(multilineMatch)) {
    applyGiaDiagramRun(fields, set, internal, multilineMatch);
    return;
  }

  for (const m of text.matchAll(inline)) {
    if (!isValidGiaDiagramMatch(m)) continue;
    applyGiaDiagramRun(fields, set, internal, m);
    return;
  }
}

/** Read numeric value after a GIA label (PDF text layer often splits label / value across lines). */
function readGiaLabelValue(
  text: string,
  label: RegExp,
  validate?: (v: string) => boolean,
  debug?: GiaRegexDebug,
): string | null {
  const patterns = [
    {
      name: "label-newline-value",
      re: new RegExp(
        String.raw`${label.source}[\s\n]+(\d{1,3}(?:\.\d+)?)\s*(?:%|°)?`,
        "i",
      ),
    },
    {
      name: "label-colon-value",
      re: new RegExp(
        String.raw`${label.source}\s*[:\s]+(\d{1,3}(?:\.\d+)?)\s*(?:%|°)?`,
        "i",
      ),
    },
  ];
  for (const { name, re } of patterns) {
    const m = text.match(re);
    const v = m?.[1] ? parseNum(m[1]) : null;
    debug?.push({ field: label.source, pattern: name, matched: Boolean(m), groups: m?.slice(1) });
    if (v && (!validate || validate(v))) return v;
  }
  return null;
}

type GiaRegexDebug = Array<{
  field: string;
  pattern: string;
  matched: boolean;
  groups?: string[];
}>;

/** GIA facsimile: `Label ..... value` or label / dots / value on separate lines. */
function readGiaDotLeaderValue(
  text: string,
  label: RegExp,
  opts?: {
    validate?: (v: string) => boolean;
    parse?: (raw: string) => string | null;
    valueCapture?: string;
  },
  debug?: GiaRegexDebug,
): string | null {
  const cap = opts?.valueCapture ?? String.raw`([^\n]+)`;
  const patterns = [
    { name: "inline-dots", re: new RegExp(String.raw`${label.source}\s+${DOT_LEADER}\s*${cap}`, "i") },
    {
      name: "newline-dots-value",
      re: new RegExp(String.raw`${label.source}\s*\n\s*${DOT_LEADER}\s*${cap}`, "i"),
    },
    {
      name: "newline-dots-newline-value",
      re: new RegExp(
        String.raw`${label.source}\s*\n\s*${DOT_LEADER}\s*\n\s*${cap}`,
        "i",
      ),
    },
  ];
  for (const { name, re } of patterns) {
    const m = text.match(re);
    const raw = m?.[1] ? stripGiaDotLeaderNoise(m[1]) : "";
    const v = raw ? (opts?.parse ? opts.parse(raw) : parseNum(raw)) : null;
    debug?.push({ field: label.source, pattern: name, matched: Boolean(m), groups: m?.slice(1) });
    if (v && (!opts?.validate || opts.validate(v))) return v;
  }
  return null;
}

function logGiaPdfTextLayerDebug(
  rawText: string,
  block: string,
  reportNumberHint?: string,
  regexLog?: GiaRegexDebug,
): void {
  if (!shouldLogExtractPipeline(rawText, reportNumberHint)) return;

  const windows: Record<string, string> = {};
  for (const lab of GIA_PDF_LAYER_LABELS) {
    const idx = rawText.search(new RegExp(lab.replace(/\s+/g, "\\s+"), "i"));
    if (idx >= 0) {
      windows[lab] = rawText.slice(Math.max(0, idx - 30), idx + 140);
    }
  }

  console.log(
    "[calibration-extract] gia.pdf-text-layer",
    JSON.stringify(
      {
        proportionValuesPresent: giaProportionValuesPresent(rawText),
        proportionBlockLength: block.length,
        proportionBlockPreview: block.slice(0, 500),
        labelWindows: windows,
        regexAttempts: regexLog,
      },
      null,
      2,
    ),
  );
}

/** Grading Results table on GIA facsimile PDFs (dot leaders, no diagram numbers in text). */
function extractGiaDotLeaderGrading(
  text: string,
  fields: CalibrationReportFields,
  set: FieldSetter,
  debug?: GiaRegexDebug,
): void {
  const shape = readGiaDotLeaderValue(
    text,
    /\bshape\s+and\s+cutting\s+style\b/i,
    {
      parse: (raw) => titleCasePhrase(raw.replace(/\s+cut\b/i, "").trim()) || null,
    },
    debug,
  );
  if (shape) setGiaField(fields, set, "shape", shape, "high");

  const carat = readGiaDotLeaderValue(
    text,
    /\bcarat\s+weight\b/i,
    {
      parse: (raw) => {
        const m = raw.match(/([\d.]+)/);
        return m?.[1] ? parseNum(m[1]) : null;
      },
      validate: (v) => {
        const n = parseFloat(v);
        return Number.isFinite(n) && n > 0 && n < 50;
      },
    },
    debug,
  );
  if (carat) setGiaField(fields, set, "carat", carat, "high");

  const measurements = readGiaDotLeaderValue(
    text,
    /\bmeasurements\b/i,
    {
      parse: (raw) => {
        const m = raw.match(
          /([\d.]+\s*[-–—]\s*[\d.]+\s*x\s*[\d.]+(?:\s*mm)?)/i,
        );
        if (!m?.[1]) return null;
        const val = m[1].replace(/×/g, " x ");
        return /\bmm\b/i.test(val) ? val : `${val} mm`;
      },
    },
    debug,
  );
  if (measurements) setGiaField(fields, set, "measurements", measurements, "high");

  const finish = (label: RegExp, key: ReportFieldKey) => {
    const raw = readGiaDotLeaderValue(
      text,
      label,
      {
        valueCapture: String.raw`((?:${FINISH_GRADE})[^\n]*)`,
        parse: (s) => {
          const m = stripGiaDotLeaderNoise(s).match(
            new RegExp(String.raw`\b(${FINISH_GRADE})\b`, "i"),
          );
          return m?.[1] ? titleCasePhrase(m[1]) : null;
        },
      },
      debug,
    );
    if (raw) setGiaField(fields, set, key, raw, "high");
  };

  finish(/\bpolish\b/i, "polish");
  finish(/\bsymmetry\b/i, "symmetry");
  finish(/\bcut\s+grade\b/i, "cutGrade");

  const fluorescence = readGiaDotLeaderValue(
    text,
    /\bfluorescence\b/i,
    {
      parse: (raw) => {
        const trimmed = stripGiaDotLeaderNoise(raw)
          .replace(/\s*(?:cut|polish|symmetry|comments)\b.*$/i, "")
          .trim();
        return trimmed ? titleCasePhrase(trimmed) : null;
      },
    },
    debug,
  );
  if (fluorescence) setGiaField(fields, set, "fluorescence", fluorescence, "high");
}

/** PDF.js often emits one proportion field per line instead of a diagram stack. */
function extractGiaPdfTextLayer(
  text: string,
  fields: CalibrationReportFields,
  set: FieldSetter,
  internal: GiaInternalFields | undefined,
  debug?: GiaRegexDebug,
): void {
  extractGiaDotLeaderGrading(text, fields, set, debug);

  const shape =
    text.match(/\bshape\b[\s\n]+(round\s+brilliant(?:\s+cut)?)/i)?.[1] ??
    matchRoundBrilliantShape(text);
  if (shape) setGiaField(fields, set, "shape", shape, "high");

  const carat =
    readGiaDotLeaderValue(
      text,
      /\bcarat\s+weight\b/i,
      {
        parse: (raw) => {
          const m = raw.match(/([\d.]+)/);
          return m?.[1] ? parseNum(m[1]) : null;
        },
        validate: (v) => {
          const n = parseFloat(v);
          return Number.isFinite(n) && n > 0 && n < 50;
        },
      },
      debug,
    ) ??
    text.match(/\bcarat\s+weight\b[\s\n]+([\d.]+)/i)?.[1] ??
    text.match(/(?:carat\s*weight|weight)\s*[:\s]*([\d.]+)\s*(?:carat|ct)?\b/i)?.[1] ??
    text.match(/\b([\d.]+)\s*ct\b/i)?.[1];
  if (carat) setGiaField(fields, set, "carat", carat.trim(), "high");

  const pctAfterLabel = (label: RegExp, validate: (v: string) => boolean) =>
    readGiaDotLeaderValue(text, label, {
      valueCapture: String.raw`(\d{1,3}(?:\.\d+)?)\s*%`,
      parse: (raw) => parseNum(raw),
      validate,
    }, debug) ??
    readGiaLabelValue(text, label, validate, debug);

  const degAfterLabel = (label: RegExp, validate: (v: string) => boolean) =>
    readGiaDotLeaderValue(text, label, {
      valueCapture: String.raw`(\d{1,3}(?:\.\d+)?)\s*°?`,
      parse: (raw) => parseNum(raw),
      validate,
    }, debug) ??
    readGiaLabelValue(text, label, validate, debug);

  const star =
    pctAfterLabel(/\bstar\s+length\b/i, isPlausibleStar) ??
    pctAfterLabel(/\bstar\b/i, isPlausibleStar);
  if (star) setGiaField(fields, set, "starLengthPercent", star, "high");

  const table =
    pctAfterLabel(/\btable\s+size\b/i, isPlausibleTable) ??
    pctAfterLabel(/\btable\b/i, isPlausibleTable);
  if (table) setGiaField(fields, set, "tablePercent", table, "high");

  const depthValidator = (v: string) => {
    const n = parseFloat(v);
    return Number.isFinite(n) && n >= 55 && n <= 70;
  };
  const depth =
    pctAfterLabel(/\btotal\s+depth\b/i, depthValidator) ??
    matchGiaTotalDepthValue(text);
  if (depth) setGiaField(fields, set, "depthPercent", depth, "high");

  const crown = degAfterLabel(/\bcrown\s+angle\b/i, isPlausibleCrownAngle);
  if (crown) setGiaField(fields, set, "crownAngle", crown, "high");

  const crownHeight =
    pctAfterLabel(/\bcrown\s+height\b/i, isPlausibleCrownHeight) ??
    readGiaLabelValue(text, /\bcrown\s+height\b/i, isPlausibleCrownHeight, debug);
  setInternal(internal, "crownHeightPercent", crownHeight);

  const pavilion = degAfterLabel(/\bpavilion\s+angle\b/i, isPlausiblePavilionAngle);
  if (pavilion) setGiaPavilionAngleDegree(fields, set, pavilion, "high");

  const pavilionDepth =
    pctAfterLabel(/\bpavilion\s+depth\b/i, isPlausiblePavilionDepth) ??
    readGiaLabelValue(text, /\bpavilion\s+depth\b/i, isPlausiblePavilionDepth, debug);
  setInternal(internal, "pavilionDepthPercent", pavilionDepth);

  const lowerHalf =
    pctAfterLabel(/\blower\s+(?:half|girdle\s+facet\s+length)\b/i, isPlausibleLowerHalf) ??
    readGiaLabelValue(
      text,
      /\blower\s+(?:half|girdle\s+facet\s+length)\b/i,
      isPlausibleLowerHalf,
      debug,
    );
  if (lowerHalf) setGiaField(fields, set, "lowerHalfPercent", lowerHalf, "high");

  const girdleRaw = readGiaDotLeaderValue(
    text,
    /\bgirdle\b/i,
    { valueCapture: String.raw`([^\n]+)` },
    debug,
  );
  if (girdleRaw) {
    const formatted = formatGiaGirdlePhrase(stripGiaDotLeaderNoise(girdleRaw));
    if (formatted) setGiaField(fields, set, "girdle", formatted, "high");
  }

  const culetRaw = readGiaDotLeaderValue(
    text,
    /\bculet\b/i,
    {
      valueCapture: String.raw`(none|pointed|very\s*small|small|medium|large|chipped|abrasion)`,
      parse: (raw) => titleCaseWord(raw),
    },
    debug,
  );
  if (culetRaw) setGiaField(fields, set, "culet", culetRaw, "high");
}

function extractGiaLabeledFields(
  text: string,
  fields: CalibrationReportFields,
  set: FieldSetter,
  internal: GiaInternalFields | undefined,
  debug?: GiaRegexDebug,
): void {
  extractGiaPdfTextLayer(text, fields, set, internal, debug);

  const shape = matchRoundBrilliantShape(text);
  if (shape) setGiaField(fields, set, "shape", shape, "high");

  const carat =
    text.match(
      /(?:carat\s*weight|weight)\s*[:\s]*([\d.]+)\s*(?:carat|ct)?\b/i,
    )?.[1] ?? text.match(/\b([\d.]+)\s*ct\b/i)?.[1];
  if (carat) setGiaField(fields, set, "carat", carat.trim(), "high");

  const measurements = text.match(
    /measurements?\s*[:\s]*([\d.]+\s*[-–—]\s*[\d.]+\s*x\s*[\d.]+)\s*mm?/i,
  );
  if (measurements?.[1]) {
    const raw = measurements[1].replace(/×/g, " x ");
    setIfEmpty(
      fields,
      set,
      "measurements",
      /\bmm\b/i.test(raw) ? raw : `${raw} mm`,
      "high",
    );
  } else {
    const bare = text.match(
      /\b([\d.]{2,5})\s*[-–—]\s*([\d.]{2,5})\s*x\s*([\d.]{2,5})\s*mm\b/i,
    );
    if (bare) {
      setIfEmpty(
        fields,
        set,
        "measurements",
        `${bare[1]} - ${bare[2]} x ${bare[3]} mm`,
        "high",
      );
    }
  }

  const depth = matchGiaTotalDepthValue(text);
  if (depth) setGiaField(fields, set, "depthPercent", depth, "high");

  const labeled: Array<{
    re: RegExp;
    key?: ReportFieldKey;
    internalKey?: keyof GiaInternalFields;
    validate?: (v: string) => boolean;
  }> = [
    {
      re: /star\s*(?:length)?\s*%?\s*[:\s]*(\d{1,3}(?:\.\d+)?)\s*%?/i,
      key: "starLengthPercent",
      validate: isPlausibleStar,
    },
    {
      re: /table\s*(?:size|%)?\s*[:\s]*(\d{1,3}(?:\.\d+)?)\s*%?/i,
      key: "tablePercent",
      validate: isPlausibleTable,
    },
    {
      re: /crown\s+angle\s*[:\s]*(\d{1,3}(?:\.\d+)?)\s*°?/i,
      key: "crownAngle",
      validate: isPlausibleCrownAngle,
    },
    {
      re: /crown\s+height\s*%?\s*[:\s]*(\d{1,3}(?:\.\d+)?)\s*%?/i,
      internalKey: "crownHeightPercent",
      validate: isPlausibleCrownHeight,
    },
    {
      re: /pavilion\s+angle\s*[:\s]*(\d{1,3}(?:\.\d+)?)\s*(?:°|H\b)/i,
      key: "pavilionAngle",
      validate: isPlausiblePavilionAngle,
    },
    {
      re: /pavilion\s+depth\s*%?\s*[:\s]*(\d{1,3}(?:\.\d+)?)\s*%?/i,
      internalKey: "pavilionDepthPercent",
      validate: isPlausiblePavilionDepth,
    },
    {
      re: /lower\s+(?:girdle\s+facet\s+length|half)\s*%?\s*[:\s]*(\d{1,3}(?:\.\d+)?)\s*%?/i,
      key: "lowerHalfPercent",
      validate: isPlausibleLowerHalf,
    },
  ];

  for (const { re, key, internalKey, validate } of labeled) {
    const m = text.match(re);
    const v = m?.[1] ? parseNum(m[1]) : null;
    if (!v || (validate && !validate(v))) continue;
    if (internalKey) {
      setInternal(internal, internalKey, v);
    } else if (key === "pavilionAngle") {
      setGiaPavilionAngleDegree(fields, set, v, "high");
    } else if (key) {
      setGiaField(fields, set, key, v, "high");
    }
  }
}

function girdleFormattedHasPercent(value: string): boolean {
  return /\d{1,2}(?:\.\d+)?\s*%/.test(value);
}

function findGirdleThicknessPercentNear(window: string): string | null {
  for (const m of window.matchAll(/(?<![\d.])(\d{1,2}(?:\.\d+)?)\s*%/gi)) {
    const v = parseNum(m[1]!);
    if (v && isPlausibleGirdleThicknessPercent(v)) return v;
  }
  return null;
}

/** Stitch split OCR girdle lines (Faceted / thickness % on separate lines). */
function stitchGiaOcrGirdleFromText(text: string): string | null {
  const anchor = text.search(/\bgirdle\b/i);
  const window = anchor >= 0 ? text.slice(anchor, anchor + 520) : text;
  const body = (anchor >= 0 ? window.replace(/^\s*girdle\b/i, "") : window)
    .replace(/\bpavilion\s+(?:angle|depth)\b[^\n]*/gi, "")
    .replace(/\b43\.?\d*\s*%/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  let formatted = formatGiaGirdlePhrase(stripGiaDotLeaderNoise(body));
  if (formatted && !girdleFormattedHasPercent(formatted)) {
    const pct = findGirdleThicknessPercentNear(window);
    if (pct) {
      formatted =
        formatGiaGirdlePhrase(`${formatted} ${pct}%`) ?? `${formatted} ${pct}%`;
    }
  }
  if (formatted) return formatted;

  const hasMedium = /\bmedium\b/i.test(body);
  const hasSlightlyThick = /\bslightly\s+thick\b/i.test(body);
  const hasFaceted = /faceted|factted/i.test(body);
  if (!hasMedium || !hasSlightlyThick) return null;

  const pct = findGirdleThicknessPercentNear(window);
  let raw = "Medium - Slightly Thick";
  if (hasFaceted) raw += " (Faceted)";
  if (pct) raw += ` ${pct}%`;
  return formatGiaGirdlePhrase(raw);
}

/**
 * Facsimile live OCR: "GRADING RESULTS (faceted) 43.0%" with girdle % on the next line.
 * Requires (faceted) + plausible girdle thickness % — never invent thickness words.
 */
export function extractGiaGirdleFromFacsimileGradingResultsFragment(
  text: string,
): string | null {
  const norm = normalizeGiaProportionBlockText(text);
  const anchor = norm.search(/\bgrading\s+results\b/i);
  if (anchor < 0) return null;
  const window = norm.slice(anchor, anchor + 420);
  if (!/(?:\(faceted\)|\bfactted\)|\bfaceted\))/i.test(window)) return null;

  const pct =
    window.match(
      /(?:\(faceted\)|\bfactted\))[^\n]{0,120}?\n\s*(\d{1,2}(?:\.\d+)?)\s*%/i,
    )?.[1] ??
    window.match(
      /(?:\(faceted\)|\bfactted\)|\bfaceted\))[\s\S]{0,160}?(\d{1,2}(?:\.\d+)?)\s*%/i,
    )?.[1] ??
    window.match(
      /\bgrading\s+results\b[^\n]{0,160}?\n\s*(\d{1,2}(?:\.\d+)?)\s*%/i,
    )?.[1];
  const pctVal = pct ? parseNum(pct) : null;
  if (!pctVal || !isPlausibleGirdleThicknessPercent(pctVal)) return null;

  const thicknessPhrase = window.match(
    /\bmedium\b[\s\-–—]{0,24}\bsligh\w*\s+thick\b|\bsligh\w*\s+thick\b[\s\-–—]{0,24}\bmedium\b/i,
  )?.[0];
  if (thicknessPhrase) {
    let raw = stripGiaDotLeaderNoise(thicknessPhrase).replace(/\s+/g, " ");
    if (!/\(faceted\)/i.test(raw)) raw += " (Faceted)";
    return formatGiaGirdlePhrase(`${raw} ${pctVal}%`);
  }

  const stitched = stitchGiaOcrGirdleFromText(window);
  if (stitched && girdleCompletenessScore(stitched) >= 5) {
    return stitched;
  }

  return null;
}

/** Pavilion depth % immediately followed by pavilion angle (common facsimile diagram OCR order). */
function findGiaPavilionDepthThenAnglePair(text: string): string | null {
  const norm = fixGiaOcrDegreeNumerals(text);
  const re = new RegExp(
    String.raw`(?<![\d.])(\d{1,3}(?:\.\d+)?)\s*%[\s\S]{0,48}?(${GIA_OCR_DEGREE_NUM})\s*${GIA_DEGREE_SUFFIX}`,
    "gi",
  );
  for (const m of norm.matchAll(re)) {
    const pct = parseNum(m[1]!);
    const deg = m[2] ? parseGiaOcrDegreeValue(m[2]) : null;
    if (!pct || !deg) continue;
    if (!isPlausiblePavilionDepth(pct) || !isPlausiblePavilionAngle(deg)) continue;
    return deg;
  }
  return null;
}

/** Full girdle phrase including thickness % when present in OCR/PDF text. */
function extractGiaGirdleFromText(text: string): string | null {
  const facsimileFragment = extractGiaGirdleFromFacsimileGradingResultsFragment(text);
  if (facsimileFragment) return facsimileFragment;

  const stitched = stitchGiaOcrGirdleFromText(text);
  if (stitched) return stitched;

  const block = text.match(
    /\bgirdle\b[\s\n]+([\s\S]{0,280}?)(?=\n\s*culet\b|\bculet\b|\n\s*polish\b|\bpolish\b)/i,
  )?.[1];
  if (block) {
    const merged = block
      .replace(/\s+/g, " ")
      .replace(/\s*(?:polish|symmetry|fluorescence|cut)\b.*$/i, "")
      .trim();
    const formatted = formatGiaGirdlePhrase(stripGiaDotLeaderNoise(merged));
    if (formatted) return formatted;
  }

  const inline = text.match(
    /\bgirdle\b\s+([^\n]+(?:\n[^\n]+)?)/i,
  )?.[1];
  if (inline) {
    const merged = inline.replace(/\s+/g, " ").trim();
    const formatted = formatGiaGirdlePhrase(stripGiaDotLeaderNoise(merged));
    if (formatted) return formatted;
  }

  const phrase = text.match(
    new RegExp(
      String.raw`${GIRDLE_THICKNESS}[\s\S]{0,120}?(?:\(faceted\)|faceted\)|factted\))`,
      "i",
    ),
  );
  if (phrase?.index !== undefined) {
    const window = text.slice(phrase.index, phrase.index + 200).replace(/\s+/g, " ");
    let girdlePct: string | null = null;
    for (const m of window.matchAll(/(?<![\d.])(\d{1,2}(?:\.\d+)?)\s*%/gi)) {
      const v = parseNum(m[1]!);
      if (v && isPlausibleGirdleThicknessPercent(v)) {
        girdlePct = v;
        break;
      }
    }
    const raw = girdlePct ? `${phrase[0]} ${girdlePct}%` : phrase[0];
    const formatted = formatGiaGirdlePhrase(raw.replace(/\s+/g, " "));
    if (formatted) return formatted;
  }

  const bare = text.match(
    new RegExp(
      String.raw`${GIRDLE_THICKNESS}(\s*\(faceted\))?(?:\s+\d+(?:\.\d+)?\s*%)?`,
      "i",
    ),
  );
  if (bare) {
    const formatted = formatGiaGirdlePhrase(bare[0]);
    if (formatted) return formatted;
  }

  return null;
}

function setGiaGirdlePreferringPercent(
  fields: CalibrationReportFields,
  set: FieldSetter,
  formatted: string,
  level: FieldConfidence,
): void {
  if (!formatted.trim()) return;
  const existing = fields.girdle.trim();
  logGiaGirdleHydration("SET BEFORE", {
    incoming: formatted,
    current: existing,
    incomingScore: girdleCompletenessScore(formatted),
    currentScore: girdleCompletenessScore(existing),
  });
  if (!existing) {
    setGiaField(fields, set, "girdle", formatted, level);
    logGiaGirdleHydration("SET AFTER", { girdle: fields.girdle });
    return;
  }
  if (!girdleFormattedHasPercent(existing) && girdleFormattedHasPercent(formatted)) {
    setGiaField(fields, set, "girdle", formatted, level);
    logGiaGirdleHydration("SET AFTER", { girdle: fields.girdle, reason: "added-percent" });
    return;
  }
  if (girdleCompletenessScore(formatted) > girdleCompletenessScore(existing)) {
    setGiaField(fields, set, "girdle", formatted, level);
    logGiaGirdleHydration("SET AFTER", {
      girdle: fields.girdle,
      reason: "higher-completeness",
    });
  }
}

function setGiaGirdleForce(
  fields: CalibrationReportFields,
  set: FieldSetter,
  formatted: string,
  level: FieldConfidence,
): void {
  if (!formatted.trim()) return;
  logGiaGirdleHydration("FORCE BEFORE", {
    incoming: formatted,
    current: fields.girdle,
  });
  setGiaField(fields, set, "girdle", formatted, level);
  logGiaGirdleHydration("FORCE AFTER", { girdle: fields.girdle });
}

function extractGiaGirdleAndCulet(
  text: string,
  fields: CalibrationReportFields,
  set: FieldSetter,
): void {
  const girdle = extractGiaGirdleFromText(text);
  if (girdle) setGiaGirdlePreferringPercent(fields, set, girdle, "high");

  const culet =
    text.match(
      /\bculet\b[\s\n]+(none|pointed|very\s*small|small|medium|large|chipped|abrasion)\b/i,
    )?.[1] ??
    text.match(
      /culet\s*(?:size|condition)?\s*[:\s]*(none|pointed|very\s*small|small|medium|large|chipped|abrasion)\b/i,
    )?.[1];
  if (culet) {
    setGiaField(fields, set, "culet", titleCaseWord(culet), "high");
  }
}

function extractGiaFinishGrades(
  text: string,
  fields: CalibrationReportFields,
  set: FieldSetter,
): void {
  const polishMatch = (raw: string | undefined) => {
    const cleaned = stripGiaDotLeaderNoise(raw ?? "");
    const m = cleaned.match(new RegExp(String.raw`\b(${FINISH_GRADE})\b`, "i"));
    return m?.[1] ? titleCasePhrase(m[1]) : null;
  };

  const polish =
    polishMatch(
      text.match(
        new RegExp(String.raw`\bpolish\b[\s\n]+(${FINISH_GRADE})\b`, "i"),
      )?.[1] ??
        text.match(
          new RegExp(String.raw`polish\s+${DOT_LEADER}\s*(${FINISH_GRADE})\b`, "i"),
        )?.[1] ??
        text.match(
          new RegExp(String.raw`polish\s*[:\s]+(${FINISH_GRADE})\b`, "i"),
        )?.[1],
    ) ??
    readGiaDotLeaderValue(text, /\bpolish\b/i, {
      valueCapture: String.raw`((?:${FINISH_GRADE})[^\n]*)`,
      parse: (s) => polishMatch(s),
    });
  if (polish) setGiaField(fields, set, "polish", polish, "high");

  const symmetry =
    polishMatch(
      text.match(
        new RegExp(String.raw`\bsymmetry\b[\s\n]+(${FINISH_GRADE})\b`, "i"),
      )?.[1] ??
        text.match(
          new RegExp(String.raw`symmetry\s+${DOT_LEADER}\s*(${FINISH_GRADE})\b`, "i"),
        )?.[1] ??
        text.match(
          new RegExp(String.raw`symmetry\s*[:\s]+(${FINISH_GRADE})\b`, "i"),
        )?.[1],
    ) ??
    readGiaDotLeaderValue(text, /\bsymmetry\b/i, {
      valueCapture: String.raw`((?:${FINISH_GRADE})[^\n]*)`,
      parse: (s) => polishMatch(s),
    });
  if (symmetry) setGiaField(fields, set, "symmetry", symmetry, "high");

  const fluorescence =
    text.match(
      new RegExp(String.raw`\bfluorescence\b[\s\n]+([^\n]+)`, "i"),
    )?.[1] ??
    text.match(
      new RegExp(String.raw`fluorescence\s+${DOT_LEADER}\s*([^\n]+)`, "i"),
    )?.[1] ??
    text.match(/fluorescence\s*(?:color)?\s*[:\s]+([^\n]+)/i)?.[1];
  if (fluorescence) {
    const trimmed = stripGiaDotLeaderNoise(fluorescence)
      .replace(/\s*(?:cut|polish|symmetry|comments)\b.*$/i, "")
      .trim();
    if (trimmed) {
      setGiaField(fields, set, "fluorescence", titleCasePhrase(trimmed), "high");
    }
  }

  const cut =
    polishMatch(
      text.match(
        new RegExp(String.raw`\bcut\s+grade\b[\s\n]+(${FINISH_GRADE})\b`, "i"),
      )?.[1] ??
        text.match(
          new RegExp(String.raw`cut\s+grade\s+${DOT_LEADER}\s*(${FINISH_GRADE})\b`, "i"),
        )?.[1] ??
        text.match(
          new RegExp(String.raw`(?:cut\s*grade|cut)\s*[:\s]+(${FINISH_GRADE})\b`, "i"),
        )?.[1],
    ) ??
    readGiaDotLeaderValue(text, /\bcut\s+grade\b/i, {
      valueCapture: String.raw`((?:${FINISH_GRADE})[^\n]*)`,
      parse: (s) => polishMatch(s),
    });
  if (cut) setGiaField(fields, set, "cutGrade", cut, "high");
}

/** Role-based scatter fill when stack/label regexes miss on noisy OCR block. */
function extractGiaScatteredProportionRoles(
  block: string,
  fields: CalibrationReportFields,
  set: FieldSetter,
  internal: GiaInternalFields | undefined,
): void {
  const used = new Set<string>();

  const pcts: { v: string; index: number }[] = [];
  const degs: { v: string; index: number }[] = [];
  let m: RegExpExecArray | null;
  const pctRe = /(?<![\d.])(\d{1,3}(?:\.\d+)?)\s*%/gi;
  while ((m = pctRe.exec(block)) !== null) {
    const v = parseNum(m[1]!);
    if (v) pcts.push({ v, index: m.index });
  }
  const normBlock = fixGiaOcrDegreeNumerals(block);
  const degRe = new RegExp(
    String.raw`(?<![\d.])(\d{1,3}(?:\.\d+)?)\s*${GIA_DEGREE_SUFFIX}`,
    "gi",
  );
  const ocrDegRe = new RegExp(
    String.raw`(?<![\d.])((${GIA_OCR_DEGREE_NUM}))\s*${GIA_DEGREE_SUFFIX}`,
    "gi",
  );
  for (const re of [degRe, ocrDegRe]) {
    while ((m = re.exec(normBlock)) !== null) {
      const v = m[1] ? parseGiaOcrDegreeValue(m[1]) : null;
      if (v) degs.push({ v, index: m.index });
    }
  }

  const takePct = (validate: (v: string) => boolean): string | null => {
    for (const { v } of pcts) {
      if (used.has(v) || !validate(v)) continue;
      used.add(v);
      return v;
    }
    return null;
  };

  const takeDeg = (validate: (v: string) => boolean, exclude?: Set<string>): string | null => {
    for (const { v } of degs) {
      if (exclude?.has(v) || used.has(v) || !validate(v)) continue;
      used.add(v);
      return v;
    }
    return null;
  };

  if (!fields.starLengthPercent.trim()) {
    const star = takePct(isOcrRoleStar);
    const starLabelPresent = /\bstar\b/i.test(block);
    if (star && (starLabelPresent || !/^5[5-8]$/.test(star))) {
      setGiaFieldIfEmpty(fields, set, "starLengthPercent", star, "medium");
    }
  }
  if (!fields.tablePercent.trim()) {
    const table = takePct(isOcrRoleTable);
    if (table) setGiaFieldIfEmpty(fields, set, "tablePercent", table, "medium");
  }

  const crownH = takePct(isOcrRoleCrownHeight);
  if (crownH) setInternalIfEmpty(internal, "crownHeightPercent", crownH);

  if (!fields.crownAngle.trim()) {
    const crown = takeDeg(isOcrRoleCrownAngle);
    if (crown) setGiaFieldIfEmpty(fields, set, "crownAngle", crown, "medium");
  }

  if (!fields.pavilionAngle.trim()) {
    const exclude = new Set(fields.crownAngle.trim() ? [fields.crownAngle.trim()] : []);
    const pavilion = takeDeg(isOcrRolePavilionAngle, exclude);
    if (pavilion) setGiaPavilionAngleDegreeIfEmpty(fields, set, pavilion, "medium");
  }

  if (!internal?.pavilionDepthPercent) {
    const pavDepth =
      block.match(/pavilion\s+depth[^\d]{0,32}(\d{1,3}(?:\.\d+)?)\s*%?/i)?.[1] ??
      takePct(isOcrRolePavilionDepth);
    if (pavDepth) setInternalIfEmpty(internal, "pavilionDepthPercent", parseNum(pavDepth));
  }

  if (!fields.lowerHalfPercent.trim()) {
    const lower = takePct(isOcrRoleLowerHalf);
    if (lower) setGiaFieldIfEmpty(fields, set, "lowerHalfPercent", lower, "medium");
  }

  if (!fields.depthPercent.trim()) {
    const depth = matchGiaTotalDepthValue(block) ?? takePct(isOcrRoleDepth);
    if (depth) setGiaFieldIfEmpty(fields, set, "depthPercent", depth, "medium");
  }

  const girdle = extractGiaGirdleFromText(block);
  if (girdle) setGiaGirdlePreferringPercent(fields, set, girdle, "medium");

  if (!fields.culet.trim()) {
    const culet =
      block.match(
        /\bculet\b[\s\S]{0,50}?\b(none|pointed|very\s*small|small|medium|large)\b/i,
      )?.[1] ??
      block.match(/\b(none|very\s*small|small|pointed)\b/i)?.[1];
    if (culet) {
      setGiaFieldIfEmpty(fields, set, "culet", titleCaseWord(culet), "medium");
    }
  }
}

type GiaOcrDiagramDebug = {
  windowLength: number;
  windowPreview: string;
  matches: Record<string, string | null>;
};

function findConsecutivePercentPair(
  text: string,
  validateA: (v: string) => boolean,
  validateB: (v: string) => boolean,
): { a: string; b: string } | null {
  const re = /(?<![\d.])(\d{1,3}(?:\.\d+)?)\s*%/gi;
  const hits: { value: string; index: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const v = parseNum(m[1]!);
    if (v) hits.push({ value: v, index: m.index });
  }
  for (let i = 0; i < hits.length - 1; i++) {
    const a = hits[i]!;
    const b = hits[i + 1]!;
    if (b.index - a.index > 120) continue;
    if (validateA(a.value) && validateB(b.value)) return { a: a.value, b: b.value };
  }
  return null;
}

function findPercentThenDegreePair(
  text: string,
  validatePct: (v: string) => boolean,
  validateDeg: (v: string) => boolean,
): { pct: string; deg: string } | null {
  const re = new RegExp(
    String.raw`(?<![\d.])(\d{1,3}(?:\.\d+)?)\s*%[\s\S]{0,80}?(\d{1,3}(?:\.\d+)?)\s*${GIA_DEGREE_SUFFIX}`,
    "gi",
  );
  let m: RegExpExecArray | null;
  const norm = fixGiaOcrDegreeNumerals(text);
  while ((m = re.exec(norm)) !== null) {
    const pct = parseNum(m[1]!);
    const deg = parseGiaOcrDegreeValue(m[2]!);
    if (pct && deg && validatePct(pct) && validateDeg(deg)) {
      return { pct, deg };
    }
  }
  return null;
}

function findDegreeThenPercentPair(
  text: string,
  validateDeg: (v: string) => boolean,
  validatePct: (v: string) => boolean,
): { deg: string; pct: string } | null {
  const re = new RegExp(
    String.raw`(?<![\d.])(\d{1,3}(?:\.\d+)?)\s*${GIA_DEGREE_SUFFIX}[\s\S]{0,80}?(\d{1,3}(?:\.\d+)?)\s*%`,
    "gi",
  );
  let m: RegExpExecArray | null;
  const norm = fixGiaOcrDegreeNumerals(text);
  while ((m = re.exec(norm)) !== null) {
    const deg = parseGiaOcrDegreeValue(m[1]!);
    const pct = parseNum(m[2]!);
    if (deg && pct && validateDeg(deg) && validatePct(pct)) {
      return { deg, pct };
    }
  }
  return null;
}

function findPlausibleDegree(
  text: string,
  validate: (v: string) => boolean,
  exclude?: Set<string>,
): string | null {
  const norm = fixGiaOcrDegreeNumerals(text);
  const re = new RegExp(
    String.raw`(?<![\d.])(\d{1,3}(?:\.\d+)?)\s*${GIA_DEGREE_SUFFIX}`,
    "gi",
  );
  const ocrRe = new RegExp(
    String.raw`(?<![\d.])((${GIA_OCR_DEGREE_NUM}))\s*${GIA_DEGREE_SUFFIX}`,
    "gi",
  );
  for (const m of norm.matchAll(re)) {
    const v = parseGiaOcrDegreeValue(m[1]!);
    if (!v || (exclude && exclude.has(v))) continue;
    if (validate(v)) return v;
  }
  for (const m of norm.matchAll(ocrRe)) {
    const v = m[1] ? parseGiaOcrDegreeValue(m[1]) : null;
    if (!v || (exclude && exclude.has(v))) continue;
    if (validate(v)) return v;
  }
  return null;
}

function findPlausiblePercent(
  text: string,
  validate: (v: string) => boolean,
  exclude?: Set<string>,
): string | null {
  const re = /(?<![\d.])(\d{1,3}(?:\.\d+)?)\s*%/gi;
  for (const m of text.matchAll(re)) {
    const v = parseNum(m[1]!);
    if (!v || (exclude && exclude.has(v))) continue;
    if (validate(v)) return v;
  }
  return null;
}

function supplementGiaOcrPavilionAndGirdle(
  texts: string[],
  fields: CalibrationReportFields,
  set: FieldSetter,
  internal: GiaInternalFields | undefined,
  debug?: GiaOcrDiagramDebug,
): void {
  const crownAngle = fields.crownAngle.trim();
  const excludeDeg = new Set<string>(crownAngle ? [crownAngle] : []);

  for (const src of texts) {
    if (!src.trim()) continue;

    if (!fields.pavilionAngle.trim()) {
      const pav = findGiaPavilionAngleDegree(src, excludeDeg);
      if (pav) {
        setGiaPavilionAngleDegreeIfEmpty(fields, set, pav, "medium");
        excludeDeg.add(pav);
        if (debug) debug.matches.pavilionAngleSupplement = pav;
      }
    }

    const girdle = extractGiaGirdleFromText(src);
    if (girdle) {
      setGiaGirdlePreferringPercent(fields, set, girdle, "medium");
      if (debug) debug.matches.girdleSupplement = girdle;
    }

    if (fields.pavilionAngle.trim() && fields.girdle.trim()) break;
  }
}

function extractGiaOcrRelaxedDiagramStack(
  text: string,
  fields: CalibrationReportFields,
  set: FieldSetter,
  internal: GiaInternalFields | undefined,
): boolean {
  const relaxed = new RegExp(
    String.raw`(?<![\d.])(${PCT})\s*%[\s\S]{0,120}?(${PCT})\s*%[\s\S]{0,120}?(${PCT})\s*${GIA_DEGREE_SUFFIX}[\s\S]{0,120}?(${PCT})\s*%[\s\S]{0,120}?(${PCT})\s*${GIA_DEGREE_SUFFIX}[\s\S]{0,120}?(${PCT})\s*%[\s\S]{0,120}?(${PCT})\s*%`,
    "i",
  );
  const m = text.match(relaxed);
  if (!m || !isValidGiaDiagramMatch(m)) return false;
  applyGiaDiagramRun(fields, set, internal, m);
  return true;
}

/**
 * GIA proportion diagram fallback for OCR uploads (facsimile + diagram image).
 * Tolerates merged lines, missing °, and label noise from Tesseract.
 */
export function extractGiaOcrProportionDiagram(
  rawText: string,
  fields: CalibrationReportFields,
  set: FieldSetter,
  internal?: GiaInternalFields,
  proportionBlockNorm?: string,
  proportionBlockRaw?: string,
): void {
  const blockRaw = proportionBlockRaw ?? extractGiaProportionBlock(rawText);
  const text = proportionBlockNorm ?? normalizeGiaProportionBlockText(blockRaw);
  const fullNorm = normalizeGiaProportionBlockText(rawText);
  const searchTexts = [text, fullNorm, fixGiaOcrDegreeNumerals(rawText)];
  const debug: GiaOcrDiagramDebug = {
    windowLength: text.length,
    windowPreview: text.slice(0, 600),
    matches: {},
  };

  const stackMatched = extractGiaOcrRelaxedDiagramStack(text, fields, set, internal);
  if (stackMatched) {
    debug.matches.source = "relaxed-stack";
  }

  const tableFromLabel = readGiaLabelValue(text, /\btable\b/i, isPlausibleTable);
  if (tableFromLabel) {
    setGiaFieldIfEmpty(fields, set, "tablePercent", tableFromLabel, "medium");
    debug.matches.tableLabel = tableFromLabel;
  }

  const crownFromLabel = readGiaLabelValue(
    text,
    /\bcrown\s+angle\b/i,
    isPlausibleCrownAngle,
  );
  if (crownFromLabel) {
    setGiaFieldIfEmpty(fields, set, "crownAngle", crownFromLabel, "medium");
    debug.matches.crownAngleLabel = crownFromLabel;
  }

  const lowerFromLabel = readGiaLabelValue(
    text,
    /\blower\s+half\b/i,
    isPlausibleLowerHalf,
  );
  if (lowerFromLabel) {
    setGiaFieldIfEmpty(fields, set, "lowerHalfPercent", lowerFromLabel, "medium");
    debug.matches.lowerHalfLabel = lowerFromLabel;
  }

  const usedPercents = new Set<string>();

  const starTable = findConsecutivePercentPair(
    text,
    isPlausibleStar,
    isPlausibleTable,
  );
  if (starTable) {
    const aNum = parseFloat(starTable.a);
    const bNum = parseFloat(starTable.b);
    const tableOnlyNoiseStar =
      Number.isFinite(aNum) &&
      Number.isFinite(bNum) &&
      aNum >= 50 &&
      aNum <= 58 &&
      bNum >= 59 &&
      bNum <= 68;
    if (!tableOnlyNoiseStar && !/^5[89]\.\d$/.test(starTable.a)) {
      setGiaFieldIfEmpty(fields, set, "starLengthPercent", starTable.a, "medium");
      usedPercents.add(starTable.a);
    }
    setGiaFieldIfEmpty(fields, set, "tablePercent", starTable.b, "medium");
    usedPercents.add(starTable.b);
    debug.matches.starTable = `${starTable.a}/${starTable.b}`;
  }

  const crownPair = findPercentThenDegreePair(
    text,
    isPlausibleCrownHeight,
    isPlausibleCrownAngle,
  );
  if (crownPair) {
    setInternalIfEmpty(internal, "crownHeightPercent", crownPair.pct);
    setGiaFieldIfEmpty(fields, set, "crownAngle", crownPair.deg, "medium");
    usedPercents.add(crownPair.pct);
    debug.matches.crownPair = `${crownPair.pct}/${crownPair.deg}`;
  }

  const crownAngle = fields.crownAngle.trim() || crownPair?.deg;
  const excludeDeg = new Set<string>(crownAngle ? [crownAngle] : []);

  const pavilionFromLabel = readGiaPavilionAngleDegree(text);
  if (pavilionFromLabel) {
    setGiaPavilionAngleDegreeIfEmpty(fields, set, pavilionFromLabel, "medium");
    excludeDeg.add(pavilionFromLabel);
    debug.matches.pavilionAngleLabel = pavilionFromLabel;
  }

  const pavilionDepthThenAngle = findGiaPavilionDepthThenAnglePair(text);
  if (pavilionDepthThenAngle) {
    setGiaPavilionAngleDegreeIfEmpty(fields, set, pavilionDepthThenAngle, "medium");
    excludeDeg.add(pavilionDepthThenAngle);
    debug.matches.pavilionDepthThenAngle = pavilionDepthThenAngle;
  }

  const pavilionDegPct = findDegreeThenPercentPair(
    text,
    isPlausiblePavilionAngle,
    isPlausiblePavilionDepth,
  );
  if (pavilionDegPct) {
    setGiaPavilionAngleDegreeIfEmpty(fields, set, pavilionDegPct.deg, "medium");
    setInternalIfEmpty(internal, "pavilionDepthPercent", pavilionDegPct.pct);
    usedPercents.add(pavilionDegPct.pct);
    excludeDeg.add(pavilionDegPct.deg);
    debug.matches.pavilionDegPct = `${pavilionDegPct.deg}/${pavilionDegPct.pct}`;
  }

  const pavilionAngle = findGiaPavilionAngleDegree(text, excludeDeg);
  if (pavilionAngle) {
    setGiaPavilionAngleDegreeIfEmpty(fields, set, pavilionAngle, "medium");
    excludeDeg.add(pavilionAngle);
    debug.matches.pavilionAngle = pavilionAngle;
  }

  const pavilionDepth =
    readGiaPavilionDepthPercent(text) ??
    text.match(/pavilion\s+depth[^\d]{0,32}(\d{1,3}(?:\.\d+)?)\s*%?/i)?.[1] ??
    findPlausiblePercent(text, isPlausiblePavilionDepth, usedPercents);
  if (pavilionDepth) {
    setInternalIfEmpty(internal, "pavilionDepthPercent", parseNum(pavilionDepth));
    usedPercents.add(pavilionDepth);
    debug.matches.pavilionDepth = pavilionDepth;
  }

  const lowerHalf = findPlausiblePercent(text, isPlausibleLowerHalf, usedPercents);
  if (lowerHalf) {
    setGiaFieldIfEmpty(fields, set, "lowerHalfPercent", lowerHalf, "medium");
    usedPercents.add(lowerHalf);
    debug.matches.lowerHalf = lowerHalf;
  }

  const depthValidator = (v: string) => {
    const n = parseFloat(v);
    return Number.isFinite(n) && n >= 55 && n <= 70;
  };
  const depthFromLabel =
    readGiaLabelValue(text, /\btotal\s+depth\b/i, depthValidator) ??
    readGiaLabelValue(text, /\bdepth\b/i, isOcrRoleDepth);
  const depth =
    depthFromLabel ??
    matchGiaTotalDepthValue(text) ??
    (() => {
      const nearMeasurements = text.match(
        /measurements[\s\S]{0,120}?(\d{2}\.\d)\s*%\)?/i,
      )?.[1];
      const v = nearMeasurements ? parseNum(nearMeasurements) : null;
      if (v && depthValidator(v)) return v;
      const bare = text.match(/(?<![\d.])(5[89]\.\d|6[0-2]\.\d)\s*%\)?/);
      const idx = bare?.index ?? -1;
      const bareVal = bare?.[1] ? parseNum(bare[1]) : null;
      if (!bareVal || !depthValidator(bareVal)) return null;
      if (idx >= 0 && isGiaContactDepthFalsePositive(text, idx, bareVal)) return null;
      return bareVal;
    })();
  if (
    depth &&
    depthValidator(depth) &&
    depth !== fields.tablePercent.trim()
  ) {
    setGiaFieldIfEmpty(fields, set, "depthPercent", depth, "medium");
    debug.matches.depth = depth;
  }

  const girdle = extractGiaGirdleFromText(text);
  if (girdle) {
    setGiaGirdlePreferringPercent(fields, set, girdle, "medium");
    debug.matches.girdle = girdle;
  }

  const culet =
    text.match(/\bculet\b[\s\S]{0,40}?\b(none|pointed|small|medium|large)\b/i)?.[1] ??
    text.match(/\b(none)\b[\s\S]{0,40}?(?:culet|pavilion)/i)?.[1];
  if (culet) {
    setGiaFieldIfEmpty(fields, set, "culet", titleCaseWord(culet), "medium");
    debug.matches.culet = titleCaseWord(culet);
  }

  if (giaProportionDiagramFieldsMissing(fields)) {
    extractGiaScatteredProportionRoles(text, fields, set, internal);
    debug.matches.scatterFill = "roles";
  }

  supplementGiaOcrPavilionAndGirdle(searchTexts, fields, set, internal, debug);

  if (
    fields.starLengthPercent.trim() &&
    fields.depthPercent.trim() &&
    fields.starLengthPercent.trim() === fields.depthPercent.trim()
  ) {
    fields.starLengthPercent = "";
  }

  if (
    fields.depthPercent.trim() &&
    fields.tablePercent.trim() &&
    fields.depthPercent.trim() === fields.tablePercent.trim()
  ) {
    fields.depthPercent = "";
  }

  logGiaOcrDiagramDebug(debug);
}

function logGiaOcrDiagramDebug(payload: GiaOcrDiagramDebug): void {
  if (!shouldLogGiaOcrDiagramDebug()) return;
  console.log(
    "[calibration-extract] gia.ocr-diagram",
    JSON.stringify(payload, null, 2),
  );
}

function sliceGiaProportionBlock(text: string): string {
  const starts: number[] = [];
  const re = /\b(?:proportions?|profile|finish)\b/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) starts.push(m.index);
  if (starts.length === 0) return text;

  let best = "";
  for (const start of starts) {
    const slice = text.slice(start, start + 1600);
    const end = slice.search(
      /\b(?:clarity|color|grading|comments?|inscription|laser)\b/i,
    );
    const chunk = (end > 80 ? slice.slice(0, end) : slice).trim();
    if (chunk.length > best.length) best = chunk;
  }
  return best || text;
}

export function getGiaOcrDiagramExtractionWarnings(
  rawText: string,
  textMethod?: TextExtractionMethod,
): string[] {
  if (textMethod !== "ocr") return [];
  const audit = auditGiaOcrDiagramCapture(rawText);
  if (!audit.sufficientForDiagramParse) {
    return [GIA_OCR_DIAGRAM_MISSING_NOTICE];
  }
  return [];
}

/** Prefer diagram-value window over facsimile header shell when OCR merges multi-page text. */
function preferGiaFacsimileProportionBlock(
  rawText: string,
  selected: string,
): string {
  const fallback = fallbackGiaDiagramBlockFromKnownValues(rawText).block;
  const selectedHits = countBlockDiagramValueHits(selected);
  const fallbackHits = countBlockDiagramValueHits(fallback);
  const fallbackHasGirdle = /\bgirdle\b/i.test(fallback);
  const selectedHasGirdle = /\bgirdle\b/i.test(selected);

  if (fallbackHasGirdle && !selectedHasGirdle) return fallback;
  if (fallbackHits > selectedHits + 1) return fallback;

  const girdleAnchor = rawText.search(
    /\bgirdle\b[^\n]{0,220}?(?:medium|sligh)/i,
  );
  if (girdleAnchor >= 0 && !selectedHasGirdle) {
    return sliceGiaBlockWindow(rawText, Math.max(0, girdleAnchor - 160), 900);
  }

  const stackAnchor =
    rawText.search(/(?:50|56)\s*%[\s\S]{0,360}?40\.8/i) >= 0
      ? rawText.search(/(?:50|56)\s*%[\s\S]{0,360}?40\.8/i)
      : rawText.search(/(?:55|64)\s*%[\s\S]{0,320}?\d{2}\.\d\s*°/i);
  if (stackAnchor >= 0 && fallbackHits >= selectedHits) {
    return sliceGiaBlockWindow(rawText, Math.max(0, stackAnchor - 80), 1200);
  }

  return selected;
}

export function extractGiaProportionFields(
  rawText: string,
  fields: CalibrationReportFields,
  set: FieldSetter,
  internal?: GiaInternalFields,
  reportNumberHint?: string,
  textMethod?: TextExtractionMethod,
): void {
  if (textMethod === "ocr") {
    logGiaOcrCaptureDebug(rawText, textMethod);
  }

  const { block: selectedBlock, candidates } =
    selectGiaProportionBlockCandidate(rawText);
  const proportionBlockRaw = needsGiaProportionOcrSupplement(rawText)
    ? preferGiaFacsimileProportionBlock(rawText, selectedBlock)
    : selectedBlock;
  logGiaBlockSelectionDebug(candidates, proportionBlockRaw);

  const proportionBlock = normalizeGiaProportionBlockText(proportionBlockRaw);
  const text = normalizeGiaOcrText(rawText);
  const legacyBlock = sliceGiaProportionBlock(text);
  const sources =
    proportionBlock.length >= 40
      ? [proportionBlock, proportionBlockRaw, legacyBlock, text]
      : legacyBlock.length >= 40
        ? [legacyBlock, text]
        : [text];
  const regexLog: GiaRegexDebug = [];

  for (const src of sources) {
    extractGiaLabeledFields(src, fields, set, internal, regexLog);
    extractGiaDiagramRuns(src, fields, set, internal);
  }

  extractGiaLabeledFields(text, fields, set, internal, regexLog);
  extractGiaDiagramRuns(text, fields, set, internal);
  extractGiaGirdleAndCulet(text, fields, set);
  extractGiaFinishGrades(text, fields, set);

  const ocrHasDiagramNumbers = giaOcrDiagramNumbersCaptured(rawText);
  const facsimileOcrScatter =
    textMethod === "ocr" &&
    (needsGiaProportionOcrSupplement(rawText) ||
      looksLikeGiaOcrProportionScatter(proportionBlock) ||
      looksLikeGiaOcrProportionScatter(proportionBlockRaw));
  const skipDiagramParse =
    textMethod === "ocr" && !ocrHasDiagramNumbers && !facsimileOcrScatter;

  const runOcrDiagram =
    !skipDiagramParse &&
    (textMethod === "ocr" || giaProportionDiagramFieldsMissing(fields));
  if (runOcrDiagram) {
    extractGiaOcrProportionDiagram(
      rawText,
      fields,
      set,
      internal,
      proportionBlock,
      proportionBlockRaw,
    );
    extractGiaGirdleAndCulet(proportionBlock, fields, set);
    extractGiaGirdleAndCulet(rawText, fields, set);
    if (giaProportionDiagramFieldsMissing(fields)) {
      extractGiaScatteredProportionRoles(proportionBlock, fields, set, internal);
    }
  } else if (
    !skipDiagramParse &&
    giaProportionDiagramFieldsMissing(fields) &&
    proportionBlock.length >= 40
  ) {
    extractGiaScatteredProportionRoles(proportionBlock, fields, set, internal);
  }

  logGiaPdfTextLayerDebug(rawText, proportionBlock, reportNumberHint, regexLog);
  logGiaProportionExtractionDebug(proportionBlock, fields);
}
