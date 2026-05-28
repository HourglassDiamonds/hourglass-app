import type {
  CalibrationReportFields,
  FieldConfidence,
  IgiInternalFields,
  ReportFieldKey,
} from "./types";

type FieldSetter = (
  key: ReportFieldKey,
  value: string,
  level: FieldConfidence,
) => void;

const CULET_WORDS =
  "(?:pointed|very\\s*small|small|medium|large|none|chipped|abrasion)";

const ANGLE_SEP = String.raw`(?:\s*°\s*|\s+)`;
const PCT = String.raw`\d{1,3}(?:\.\d+)?`;
/** Table % on round brilliants — avoids matching digits inside report numbers (e.g. …228). */
const TABLE_PCT = String.raw`(?<![\d.])(${PCT})\s*%`;

const GIRDLE_PHRASE =
  /((?:medium|thin|thick|slightly|very)\s+to\s+slightly\s+(?:thin|thick))(\s*\(faceted\))?/i;

const GIRDLE_INCOMPLETE_FACETED = /\(\s*facete(?:d)?\s*\)?/i;

/** Expected display form: Medium to Slightly Thick (Faceted) */
export function formatIgiGirdlePhrase(raw: string, matchHasFaceted: boolean): string {
  const m = raw.match(GIRDLE_PHRASE);
  const incomplete = GIRDLE_INCOMPLETE_FACETED.test(raw);
  const thickness =
    m?.[1]?.trim() ??
    raw.match(
      /((?:medium|thin|thick|slightly|very)\s+to\s+slightly\s+(?:thin|thick))/i,
    )?.[1]?.trim();
  if (!thickness) return "";
  const words = thickness.split(/\s+/);
  const body = words
    .map((w) => (w.toLowerCase() === "to" ? "to" : titleCaseWord(w)))
    .join(" ");
  const faceted = matchHasFaceted || Boolean(m?.[2]) || incomplete;
  return faceted ? `${body} (Faceted)` : body;
}

/** Normalize IGI OCR quirks before proportion parsing. */
export function normalizeIgiOcrText(text: string): string {
  return text
    .replace(/\u00b0/g, "°")
    .replace(/[°º˚]/g, "°")
    .replace(/[×✕]/g, "x")
    .replace(/(\d)\s+\.\s+(\d)/g, "$1.$2")
    .replace(/(\d)\s*,\s*(\d)/g, "$1.$2")
    /** Only merge split angle decimals (e.g. "34 1°"), not report no. + table % */
    .replace(/(\d)\s+(\d{1,2})\s*(?=°)/g, (_, a, b) => `${a}.${b}`)
    .replace(/(\d)\s*%/g, "$1%")
    .replace(/(\d)\s*°/g, "$1°")
    .replace(/(\d{2,3}(?:\.\d+)?)\s+o\s+(?=\d)/gi, "$1° ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n");
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

function setCulet(
  fields: CalibrationReportFields,
  set: FieldSetter,
  value: string,
  level: FieldConfidence,
): void {
  const formatted = titleCaseWord(value);
  if (!formatted) return;
  const current = fields.culet.trim();
  const leaked =
    /\b(polish|symmetry|fluorescence|inscription|report|round\s+brilliant)\b/i.test(
      current,
    ) || current.length > 40;
  if (!current || leaked) {
    fields.culet = formatted;
    set("culet", formatted, level);
  } else {
    setIfEmpty(fields, set, "culet", formatted, level);
  }
}

function setGirdle(
  fields: CalibrationReportFields,
  set: FieldSetter,
  raw: string,
  matchHasFaceted: boolean,
): void {
  const formatted = formatIgiGirdlePhrase(raw, matchHasFaceted);
  if (!formatted) return;
  const current = fields.girdle.trim();
  const leaked =
    /\b(star\s*length|star|polish|symmetry|fluorescence)\b/i.test(current) ||
    /\d+\s*%/.test(current);
  const incompleteFaceted =
    GIRDLE_INCOMPLETE_FACETED.test(current) && !/\(faceted\)/i.test(current);
  if (!current || leaked || incompleteFaceted || formatted !== current) {
    fields.girdle = formatted;
    set("girdle", formatted, "medium");
  } else {
    setIfEmpty(fields, set, "girdle", formatted, "medium");
  }
}

function setInternalPercent(
  internal: IgiInternalFields | undefined,
  value: string | null,
): void {
  if (!internal || !value) return;
  internal.pavilionDepthPercent = value;
}

function parseNum(s: string): string | null {
  const n = parseFloat(s.replace(/[^\d.]/g, ""));
  if (!Number.isFinite(n)) return null;
  return String(n);
}

function isPlausibleTablePercent(value: string): boolean {
  const n = parseFloat(value);
  return Number.isFinite(n) && n >= 45 && n <= 70;
}

/** Star length on IGI diagrams; must not reuse table % (e.g. 59). */
function isPlausibleStarLength(value: string, tablePercent: string): boolean {
  const n = parseFloat(value);
  if (!Number.isFinite(n) || n < 8 || n > 70) return false;
  if (tablePercent.trim() && parseFloat(tablePercent) === n) return false;
  return true;
}

function isPlausiblePavilionDepth(value: string, tablePercent: string): boolean {
  const n = parseFloat(value);
  if (!Number.isFinite(n) || n < 38 || n > 55) return false;
  if (tablePercent.trim() && parseFloat(tablePercent) === n) return false;
  return true;
}

function isValidDiagramMatch(m: RegExpMatchArray): boolean {
  const table = m[1];
  return Boolean(table && isPlausibleTablePercent(table));
}

function setStarLength(
  fields: CalibrationReportFields,
  set: FieldSetter,
  value: string | null,
  tablePercent: string,
  level: FieldConfidence,
): void {
  if (!value || !isPlausibleStarLength(value, tablePercent)) return;
  const current = fields.starLengthPercent.trim();
  const table = tablePercent.trim();
  const shouldReplace =
    !current ||
    current === table ||
    !isPlausibleStarLength(current, table);
  if (shouldReplace) {
    fields.starLengthPercent = value;
    set("starLengthPercent", value, level);
    return;
  }
  setIfEmpty(fields, set, "starLengthPercent", value, level);
}

function titleCaseWord(s: string): string {
  const t = s.trim().toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function sliceIgiProportionBlock(text: string): string {
  const starts: number[] = [];
  const re = /\bproportions?\b/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) starts.push(m.index);
  if (starts.length === 0) return text;

  let best = "";
  for (const start of starts) {
    const slice = text.slice(start, start + 1400);
    const end = slice.search(
      /\b(?:polish|symmetry|fluorescence|characteristics|comments?|laser)\b/i,
    );
    const chunk = (end > 60 ? slice.slice(0, end) : slice).trim();
    if (chunk.length > best.length) best = chunk;
  }
  return best || text;
}

function extractIgiMeasurements(
  text: string,
  fields: CalibrationReportFields,
  set: FieldSetter,
): void {
  const patterns = [
    /measurements?\s*[:\s]*([\d.]+\s*[-–—]\s*[\d.]+\s*x\s*[\d.]+)\s*mm?/i,
    /dimensions?\s*[:\s]*([\d.]+\s*[-–—]\s*[\d.]+\s*x\s*[\d.]+)\s*mm?/i,
    /\b([\d.]{2,5})\s*[-–—]\s*([\d.]{2,5})\s*x\s*([\d.]{2,5})\s*mm\b/i,
    /\b([\d.]{2,5})\s*[-–—]\s*([\d.]{2,5})\s*x\s*([\d.]{2,5})\b/i,
  ];

  for (const re of patterns) {
    const m = text.match(re);
    if (!m) continue;
    if (m[3]) {
      setIfEmpty(
        fields,
        set,
        "measurements",
        `${m[1]} - ${m[2]} x ${m[3]} mm`,
        "high",
      );
      return;
    }
    if (m[1]) {
      const raw = m[1].replace(/×/g, " x ");
      setIfEmpty(
        fields,
        set,
        "measurements",
        /\bmm\b/i.test(raw) ? raw : `${raw} mm`,
        "high",
      );
      return;
    }
  }
}

function applyIgiDiagramRun(
  fields: CalibrationReportFields,
  set: FieldSetter,
  internal: IgiInternalFields | undefined,
  m: RegExpMatchArray,
  layout: "with-star" | "no-star",
): void {
  const table = parseNum(m[1]!);
  const crown = parseNum(m[2]!);
  const pavilion = parseNum(m[3]!);
  const pavilionDepth = parseNum(m[4]!);
  const culetWord = layout === "with-star" ? m[6]?.trim() : m[5]?.trim();
  const depth = parseNum(layout === "with-star" ? m[7]! : m[6]!);

  if (table) setIfEmpty(fields, set, "tablePercent", table, "high");
  if (crown) setIfEmpty(fields, set, "crownAngle", crown, "high");
  if (pavilion) setIfEmpty(fields, set, "pavilionAngle", pavilion, "high");
  setInternalPercent(internal, pavilionDepth);
  /** Star % only from stack slot (pavilion depth % then star %) — not diagram group 5. */
  if (depth) setIfEmpty(fields, set, "depthPercent", depth, "high");
  if (culetWord) setCulet(fields, set, culetWord, "high");
}

/**
 * After pavilion angles: pavilion depth % then star length % (IGI diagram order).
 * OCR may insert a duplicate table % between them — scan the full run, not the first pair.
 */
function extractIgiStarFromStack(
  text: string,
  fields: CalibrationReportFields,
  set: FieldSetter,
  internal: IgiInternalFields | undefined,
): void {
  const table = fields.tablePercent.trim();
  const segmentRe = new RegExp(
    String.raw`(${PCT})\s*°[\s\n]+(${PCT})\s*°[\s\n]+([\s\S]*?)(?:${CULET_WORDS})`,
    "i",
  );
  const segment = text.match(segmentRe)?.[3];
  if (!segment) return;

  const percents: string[] = [];
  const pctRe = new RegExp(String.raw`(?<![\d.])(${PCT})\s*%`, "gi");
  for (const m of segment.matchAll(pctRe)) {
    const v = parseNum(m[1]!);
    if (v) percents.push(v);
  }
  if (percents.length === 0) return;

  let pavilionDepth: string | null = null;
  let star: string | null = null;

  for (const p of percents) {
    if (!pavilionDepth && isPlausiblePavilionDepth(p, table)) {
      pavilionDepth = p;
      continue;
    }
    if (pavilionDepth && !star && isPlausibleStarLength(p, table)) {
      star = p;
      break;
    }
  }

  if (pavilionDepth) setInternalPercent(internal, pavilionDepth);
  setStarLength(fields, set, star, table, "high");
}

function extractIgiPostAnglePercents(
  text: string,
  fields: CalibrationReportFields,
  set: FieldSetter,
  internal: IgiInternalFields | undefined,
): void {
  extractIgiStarFromStack(text, fields, set, internal);
}

/** PDF text layer often places Star Length after culet / total depth — not in the angle→culet run. */
function extractIgiStarLabeled(text: string, tablePercent: string): string | null {
  const nearLabel = text.search(/\bstar\s*length\b/i);
  if (nearLabel >= 0) {
    const window = text.slice(nearLabel, nearLabel + 140);
    const pctRe = new RegExp(String.raw`(?<![\d.])(${PCT})\s*%`, "gi");
    for (const m of window.matchAll(pctRe)) {
      const v = parseNum(m[1]!);
      if (v && isPlausibleStarLength(v, tablePercent)) return v;
    }
  }

  const patterns = [
    /star\s*length\s*(?:\(%\))?[\s\n:]*(\d{1,3}(?:\.\d+)?)\s*%/i,
    /star\s*length[\s\S]{0,72}?(\d{1,3}(?:\.\d+)?)\s*%/i,
    /star\s*(?:length)?\s*%?\s*[:\s]*(\d{1,3}(?:\.\d+)?)\s*%?/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    const v = m?.[1] ? parseNum(m[1]) : null;
    if (v && isPlausibleStarLength(v, tablePercent)) return v;
  }
  return null;
}

function extractIgiStarLength(
  text: string,
  fields: CalibrationReportFields,
  set: FieldSetter,
  internal: IgiInternalFields | undefined,
): void {
  extractIgiStarFromStack(text, fields, set, internal);

  const table = fields.tablePercent.trim();
  const fromLabel = extractIgiStarLabeled(text, table);
  setStarLength(fields, set, fromLabel, table, "high");
}

function extractIgiDiagramRuns(
  text: string,
  fields: CalibrationReportFields,
  set: FieldSetter,
  internal: IgiInternalFields | undefined,
): void {
  const withStar = new RegExp(
    String.raw`${TABLE_PCT}[\s\n]+(${PCT})\s*°[\s\n]+(${PCT})\s*°[\s\n]+(${PCT})\s*%[\s\n]+(${PCT})\s*%[\s\n]+(${CULET_WORDS})[\s\n]+(${PCT})\s*%`,
    "i",
  );
  const withStarInline = new RegExp(
    String.raw`${TABLE_PCT}[\s\n]+(${PCT})${ANGLE_SEP}(${PCT})${ANGLE_SEP}(${PCT})\s*%?\s+(${PCT})\s*%?\s+(${CULET_WORDS})\s+(${PCT})\s*%`,
    "gi",
  );
  const noStar = new RegExp(
    String.raw`${TABLE_PCT}[\s\n]+(${PCT})\s*°[\s\n]+(${PCT})\s*°[\s\n]+(${PCT})\s*%[\s\n]+(${CULET_WORDS})[\s\n]+(${PCT})\s*%`,
    "i",
  );
  const noStarInline = new RegExp(
    String.raw`${TABLE_PCT}[\s\n]+(${PCT})${ANGLE_SEP}(${PCT})${ANGLE_SEP}(${PCT})\s*%?\s+(${CULET_WORDS})\s+(${PCT})\s*%`,
    "gi",
  );

  const withStarMatch =
    text.match(withStar) ??
    [...text.matchAll(withStarInline)].find(isValidDiagramMatch);
  if (withStarMatch && isValidDiagramMatch(withStarMatch)) {
    applyIgiDiagramRun(fields, set, internal, withStarMatch, "with-star");
  } else {
    const noStarMatch = text.match(noStar);
    if (noStarMatch && isValidDiagramMatch(noStarMatch)) {
      applyIgiDiagramRun(fields, set, internal, noStarMatch, "no-star");
    } else {
      for (const m of text.matchAll(noStarInline)) {
        if (!isValidDiagramMatch(m)) continue;
        applyIgiDiagramRun(fields, set, internal, m, "no-star");
      }
    }
    extractIgiPostAnglePercents(text, fields, set, internal);
  }

  if (!fields.depthPercent.trim()) {
    const depthTail = text.match(
      new RegExp(String.raw`(?:${CULET_WORDS})\s+(${PCT})\s*%`, "i"),
    );
    const val = depthTail?.[1] ? parseNum(depthTail[1]) : null;
    if (val) setIfEmpty(fields, set, "depthPercent", val, "high");
  }

  const partialRe = new RegExp(
    String.raw`${TABLE_PCT}[\s\n]+(${PCT})${ANGLE_SEP}(${PCT})${ANGLE_SEP}`,
    "gi",
  );
  for (const m of text.matchAll(partialRe)) {
    if (!isValidDiagramMatch(m)) continue;
    const table = parseNum(m[1]!);
    const crown = parseNum(m[2]!);
    const pavilion = parseNum(m[3]!);
    if (table) setIfEmpty(fields, set, "tablePercent", table, "high");
    if (crown) setIfEmpty(fields, set, "crownAngle", crown, "high");
    if (pavilion) setIfEmpty(fields, set, "pavilionAngle", pavilion, "high");
  }
}

function extractIgiLabeledProportions(
  text: string,
  fields: CalibrationReportFields,
  set: FieldSetter,
  internal: IgiInternalFields | undefined,
): void {
  const mTable = text.match(/table\s*%?\s*[:\s]*(\d{1,3}(?:\.\d+)?)\s*%?/i);
  if (mTable?.[1]) {
    const v = parseNum(mTable[1]);
    if (v) setIfEmpty(fields, set, "tablePercent", v, "high");
  }

  const mDepth = text.match(
    /(?:total\s+)?depth\s*%?\s*[:\s]*(\d{1,3}(?:\.\d+)?)\s*%?/i,
  );
  if (mDepth?.[1]) {
    const v = parseNum(mDepth[1]);
    if (v) setIfEmpty(fields, set, "depthPercent", v, "high");
  }

  const mCrown = text.match(
    /crown\s*(?:angle|height)\s*[:\s]*(\d{1,3}(?:\.\d+)?)\s*°?/i,
  );
  if (mCrown?.[1]) {
    const v = parseNum(mCrown[1]);
    if (v) setIfEmpty(fields, set, "crownAngle", v, "high");
  }

  const mPav = text.match(
    /pavilion\s+angle\s*[:\s]*(\d{1,3}(?:\.\d+)?)\s*°?/i,
  );
  if (mPav?.[1]) {
    const v = parseNum(mPav[1]);
    if (v) setIfEmpty(fields, set, "pavilionAngle", v, "high");
  }

  const mPavDepth = text.match(
    /pavilion\s+depth\s*%?\s*[:\s]*(\d{1,3}(?:\.\d+)?)\s*%?/i,
  );
  setInternalPercent(internal, mPavDepth?.[1] ? parseNum(mPavDepth[1]) : null);

  const fromLabel = extractIgiStarLabeled(text, fields.tablePercent.trim());
  setStarLength(fields, set, fromLabel, fields.tablePercent, "high");

  const mLh = text.match(
    /lower\s*(?:girdle|half)\s*(?:facet|length)?\s*%?\s*[:\s]*(\d{1,3}(?:\.\d+)?)\s*%?/i,
  );
  if (mLh?.[1]) {
    const v = parseNum(mLh[1]);
    if (v) setIfEmpty(fields, set, "lowerHalfPercent", v, "high");
  }
}

function extractIgiGirdleAndCulet(
  text: string,
  fields: CalibrationReportFields,
  set: FieldSetter,
): void {
  const girdleLine = text.match(
    /girdle\s*(?:thickness)?\s*[:\s]*([\s\S]{0,160}?)(?=\n\s*(?:star\s+length|polish|symmetry|fluorescence|measurements)\b|$)/i,
  )?.[1];
  if (girdleLine) {
    const trimmed = girdleLine
      .replace(/\s+/g, " ")
      .replace(/\s*star\s+length.*$/i, "")
      .trim();
    setGirdle(
      fields,
      set,
      trimmed,
      /\(\s*faceted\s*\)/i.test(trimmed) ||
        GIRDLE_INCOMPLETE_FACETED.test(trimmed),
    );
  } else {
    const girdlePhrase = text.match(GIRDLE_PHRASE);
    if (girdlePhrase) {
      setGirdle(
        fields,
        set,
        girdlePhrase[1]! + (girdlePhrase[2] ?? ""),
        Boolean(girdlePhrase[2]),
      );
    }
  }

  const culet =
    text.match(
      new RegExp(String.raw`culet\s*(?:size|condition)?\s*[:\s]*(${CULET_WORDS})`, "i"),
    )?.[1] ??
    text.match(
      new RegExp(String.raw`(?:${CULET_WORDS})(?=\s+${PCT}\s*%)`, "i"),
    )?.[0];

  if (culet) {
    setCulet(fields, set, culet, "high");
  }
}

const IGI_FINISH_GRADE_TOKEN =
  "(excellent|ex|ideal|very\\s+good|vg|good|fair|poor|none|nil|faint|medium|strong|negligible)";

function mapIgiFinishGrade(raw: string): string | null {
  const t = raw.trim().toLowerCase().replace(/\s+/g, " ");
  const map: Record<string, string> = {
    ex: "Excellent",
    excellent: "Excellent",
    ideal: "Ideal",
    vg: "Very Good",
    "very good": "Very Good",
    good: "Good",
    fair: "Fair",
    poor: "Poor",
    none: "None",
    nil: "None",
    faint: "Faint",
    medium: "Medium",
    strong: "Strong",
    negligible: "Negligible",
  };
  return map[t] ?? null;
}

function titleCaseIgiPhrase(phrase: string): string {
  return phrase
    .trim()
    .split(/\s+/)
    .map((w) => {
      const lower = w.toLowerCase();
      if (lower === "to") return "to";
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

function isRejectedIgiShapeValue(value: string): boolean {
  const v = value.trim();
  if (!v || v.length > 48) return true;
  return /\b(?:proportion|polish|symmetry|fluorescence|measurement|girdle|culet)\b/i.test(
    v,
  );
}

/** Grading / description fields — IGI proportion parser does not cover these. */
export function extractIgiGradingFields(
  rawText: string,
  fields: CalibrationReportFields,
  set: FieldSetter,
): void {
  const text = normalizeIgiOcrText(rawText);

  const round = text.match(/\b(round\s+brilliant(?:\s+cut)?)\b/i)?.[1];
  if (round) {
    setIfEmpty(fields, set, "shape", titleCaseIgiPhrase(round), "medium");
  }

  const cutStyle = text.match(
    /shape\s+and\s+cutting\s+style\s+([^\n]+)/i,
  )?.[1];
  if (cutStyle && !isRejectedIgiShapeValue(cutStyle)) {
    setIfEmpty(fields, set, "shape", titleCaseIgiPhrase(cutStyle), "medium");
  }

  const shapeLine = text.match(/\bshape\s*[:\s]+([^\n]+)/i)?.[1];
  if (
    shapeLine &&
    !isRejectedIgiShapeValue(shapeLine) &&
    !/and\s+cutting\s+style/i.test(shapeLine)
  ) {
    setIfEmpty(fields, set, "shape", titleCaseIgiPhrase(shapeLine), "medium");
  }

  const carat =
    text.match(/\bcarat\s*weight\s*[:\s]*([\d.]+)\b/i)?.[1] ??
    text.match(/\bweight\s*[:\s]*([\d.]+)\s*ct\b/i)?.[1] ??
    text.match(/\b([\d.]{1,2}\.[\d]{2})\s*(?:carats?|ct)\b/i)?.[1];
  if (carat) {
    const n = parseFloat(carat);
    if (Number.isFinite(n) && n >= 0.2 && n <= 15) {
      setIfEmpty(fields, set, "carat", carat, "medium");
    }
  }

  const polish = text.match(
    new RegExp(`\\bpolish\\s+(${IGI_FINISH_GRADE_TOKEN})\\b`, "i"),
  )?.[1];
  if (polish) {
    const mapped = mapIgiFinishGrade(polish);
    if (mapped) setIfEmpty(fields, set, "polish", mapped, "medium");
  }

  const symmetry = text.match(
    new RegExp(`\\bsymmetry\\s+(${IGI_FINISH_GRADE_TOKEN})\\b`, "i"),
  )?.[1];
  if (symmetry) {
    const mapped = mapIgiFinishGrade(symmetry);
    if (mapped) setIfEmpty(fields, set, "symmetry", mapped, "medium");
  }

  const fluorescence = text.match(
    new RegExp(`\\bfluorescence\\s+(${IGI_FINISH_GRADE_TOKEN})\\b`, "i"),
  )?.[1];
  if (fluorescence) {
    const mapped = mapIgiFinishGrade(fluorescence);
    if (mapped) setIfEmpty(fields, set, "fluorescence", mapped, "medium");
  }

  const cutGrade = text.match(
    new RegExp(`\\bcut\\s*grade\\s+(${IGI_FINISH_GRADE_TOKEN})\\b`, "i"),
  )?.[1];
  if (cutGrade) {
    const mapped = mapIgiFinishGrade(cutGrade);
    if (mapped) setIfEmpty(fields, set, "cutGrade", mapped, "medium");
  }
}

export type IgiExtractionCheckPayload = {
  reportNumber?: string;
  parserPathUsed?: string;
  headerTextPreview: string;
  proportionTextPreview: string;
  detectedCandidates: Record<string, string | undefined>;
  assignedFields: Record<string, string>;
  rejectedCandidates: Array<{ candidate: string; reason: string }>;
};

function sliceIgiHeaderPreview(text: string): string {
  const idx = text.search(/\b(?:59|table)\s*%|\bLG\d/i);
  const end = idx > 0 ? idx : Math.min(text.length, 480);
  return text.slice(0, end).trim().slice(0, 320);
}

function sliceIgiProportionPreview(text: string): string {
  const start = text.search(/\b(?:59|table)\s*%|\bLG\d/i);
  if (start < 0) return text.trim().slice(0, 320);
  return text.slice(start, start + 420).trim().slice(0, 320);
}

export function buildIgiExtractionCheck(
  rawText: string,
  fields: CalibrationReportFields,
  opts?: { reportNumber?: string; parserPathUsed?: string },
): IgiExtractionCheckPayload {
  const text = normalizeIgiOcrText(rawText);
  const detectedCandidates: Record<string, string | undefined> = {
    shape:
      text.match(/\b(round\s+brilliant(?:\s+cut)?)\b/i)?.[1] ??
      text.match(/(?:shape|cutting\s*style)[:\s]+([^\n]+)/i)?.[1],
    carat:
      text.match(/\bcarat\s*weight\s*[:\s]*([\d.]+)\b/i)?.[1] ??
      text.match(/\b([\d.]{1,2}\.[\d]{2})\s*ct\b/i)?.[1],
    polish: text.match(
      new RegExp(`\\bpolish\\s+(${IGI_FINISH_GRADE_TOKEN})\\b`, "i"),
    )?.[1],
    symmetry: text.match(
      new RegExp(`\\bsymmetry\\s+(${IGI_FINISH_GRADE_TOKEN})\\b`, "i"),
    )?.[1],
    fluorescence: text.match(
      new RegExp(`\\bfluorescence\\s+(${IGI_FINISH_GRADE_TOKEN})\\b`, "i"),
    )?.[1],
    cutGrade: text.match(
      new RegExp(`\\bcut\\s*grade\\s+(${IGI_FINISH_GRADE_TOKEN})\\b`, "i"),
    )?.[1],
    girdle: text.match(GIRDLE_PHRASE)?.[0],
    tablePercent: text.match(new RegExp(String.raw`${TABLE_PCT}`, "i"))?.[1],
  };

  const assignedFields: Record<string, string> = {};
  for (const key of [
    "shape",
    "carat",
    "measurements",
    "tablePercent",
    "depthPercent",
    "crownAngle",
    "pavilionAngle",
    "starLengthPercent",
    "lowerHalfPercent",
    "girdle",
    "culet",
    "polish",
    "symmetry",
    "fluorescence",
    "cutGrade",
  ] as const) {
    if (fields[key].trim()) assignedFields[key] = fields[key].trim();
  }

  const rejectedCandidates: Array<{ candidate: string; reason: string }> = [];
  for (const [field, candidate] of Object.entries(detectedCandidates)) {
    if (!candidate?.trim()) continue;
    if (assignedFields[field]) continue;
    rejectedCandidates.push({
      candidate: `${field}: ${candidate}`,
      reason: "candidate present in text but not assigned (validation or empty-only guard)",
    });
  }

  return {
    reportNumber: opts?.reportNumber?.trim(),
    parserPathUsed: opts?.parserPathUsed,
    headerTextPreview: sliceIgiHeaderPreview(text),
    proportionTextPreview: sliceIgiProportionPreview(text),
    detectedCandidates,
    assignedFields,
    rejectedCandidates,
  };
}

export function logIgiExtractionCheck(payload: IgiExtractionCheckPayload): void {
  console.log("[IGI EXTRACTION CHECK]", payload);
}

export function extractIgiProportionFields(
  rawText: string,
  fields: CalibrationReportFields,
  set: FieldSetter,
  internal?: IgiInternalFields,
): void {
  const text = normalizeIgiOcrText(rawText);
  const block = sliceIgiProportionBlock(text);
  const sources = block.length >= 40 ? [block, text] : [text];

  for (const src of sources) {
    extractIgiMeasurements(src, fields, set);
    extractIgiLabeledProportions(src, fields, set, internal);
    extractIgiDiagramRuns(src, fields, set, internal);
  }

  extractIgiMeasurements(text, fields, set);
  extractIgiDiagramRuns(text, fields, set, internal);
  extractIgiStarLength(text, fields, set, internal);
  extractIgiGirdleAndCulet(text, fields, set);
  extractIgiGradingFields(text, fields, set);

  if (!fields.tablePercent.trim()) {
    const beforeAngles = text.match(
      /(?:^|\s)(\d{1,3}(?:\.\d+)?)\s*%?\s+(\d{1,3}(?:\.\d+)?)\s*°/i,
    );
    if (beforeAngles?.[1]) {
      const t = parseNum(beforeAngles[1]);
      if (t) setIfEmpty(fields, set, "tablePercent", t, "medium");
    }
  }
}
