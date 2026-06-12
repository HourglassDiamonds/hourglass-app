import { formatIgiGirdlePhrase } from "./igi-proportions";
import type {
  CalibrationLab,
  CalibrationReportFields,
  FieldConfidence,
  ReportFieldKey,
  StoneType,
} from "./types";
import { CALIBRATION_LABS } from "./types";

export function normalizeCalibrationLab(raw: string): CalibrationLab {
  const u = raw.trim().toUpperCase();
  if ((CALIBRATION_LABS as readonly string[]).includes(u)) {
    return u as CalibrationLab;
  }
  if (u.includes("GIA")) return "GIA";
  if (u.includes("GCAL")) return "GCAL";
  if (u.includes("AGS")) return "AGS";
  if (u.includes("IGI")) return "IGI";
  return "OTHER";
}

/** GCAL BY SARINE branding — wins over IGI/GIA heuristics on shared LG report IDs. */
export function hasExplicitGcalSarineReportHeader(text: string): boolean {
  const t = text.slice(0, 12000);
  if (!/\bGCAL\b/i.test(t)) return false;
  return (
    /\bGCAL\s+BY\s+SARINE\b/i.test(t) ||
    /\bGCAL\s+by\s+Sarine\b/i.test(t) ||
    (/\bBY\s+SARINE\b/i.test(t) && /\bGCAL\b/i.test(t)) ||
    /\bgcalusa\.com\/c\//i.test(t)
  );
}

/** Explicit IGI branding in PDF/OCR text — wins over GIA proportion-stack heuristics. */
export function hasExplicitIgiReportHeader(text: string): boolean {
  const t = text.slice(0, 8000);
  if (hasExplicitGcalSarineReportHeader(t)) return false;
  if (/international gemological institute/i.test(t)) return true;
  if (/\bBY\s+SARINE\b/i.test(t) && /\bGCAL\b/i.test(t)) return false;
  if (/\bIGI\b/i.test(t)) {
    // Sarine logo OCR often yields "_ GI —" — not International Gemological Institute.
    if (/[_—–-]\s*G\s+I\s*[_—–-\s]/i.test(t.slice(0, 500))) return false;
    return true;
  }
  return false;
}

export function isIgiExtractionContext(input: {
  lab?: string;
  parserType?: string;
  combinedText: string;
}): boolean {
  return (
    input.lab === "IGI" ||
    input.parserType === "igi-standard" ||
    hasExplicitIgiReportHeader(input.combinedText)
  );
}

/** IGI lab-grown reports often OCR without the IGI header but retain LG report IDs. */
export function looksLikeIgiReportText(text: string): boolean {
  const t = text.slice(0, 8000);
  if (hasExplicitGcalSarineReportHeader(t)) return false;
  if (hasExplicitIgiReportHeader(t)) return true;
  if (/\bLG\d{6,14}\b/i.test(t) && !/\bGCAL\b/i.test(t)) return true;
  if (looksLikeIgiProportionStack(t)) return true;
  return false;
}

/** IGI stack: table % then crown° then pavilion° (not GIA star % → table % → crown °). */
export function looksLikeIgiProportionStack(text: string): boolean {
  if (
    /(?<![\d.])\d{1,3}(?:\.\d+)?\s*%[\s\n]+\d{1,3}(?:\.\d+)?\s*%[\s\n]+\d{1,3}(?:\.\d+)?\s*°/i.test(
      text,
    )
  ) {
    return false;
  }
  return /(\d{1,3}(?:\.\d+)?)\s*%[\s\n]+(\d{1,3}(?:\.\d+)?)\s*°[\s\S]{0,160}?(\d{1,3}(?:\.\d+)?)\s*°/i.test(
    text,
  );
}

/** Detect laboratory from pasted PDF text (GIA, GCAL, AGS, IGI). */
export function detectLabFromText(text: string): CalibrationLab | null {
  const t = text.slice(0, 8000);
  if (/\bGCAL\b/i.test(t)) return "GCAL";
  if (
    /\bGIA\b/i.test(t) ||
    /gemological institute of america/i.test(t) ||
    /gia\.edu/i.test(t)
  ) {
    return "GIA";
  }
  if (looksLikeIgiReportText(t)) return "IGI";
  if (
    /\bAGS\b/i.test(t) ||
    /american gem society/i.test(t) ||
    /ags laboratories/i.test(t)
  ) {
    return "AGS";
  }
  return null;
}

type FieldSetter = (
  key: ReportFieldKey,
  value: string,
  level: FieldConfidence,
) => void;

type LabExtractionProfile = {
  reportNumberPatterns: RegExp[];
  reportUrlPatterns: RegExp[];
  stoneTypeFromText: (text: string) => StoneType | null;
  applyOverrides: (text: string, set: FieldSetter) => void;
};

function firstMatch(text: string, patterns: RegExp[]): string | null {
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1]) return m[1].trim();
  }
  return null;
}

function parsePercent(text: string, patterns: RegExp[]): string | null {
  const raw = firstMatch(text, patterns);
  if (!raw) return null;
  const n = parseFloat(raw.replace(/[^\d.]/g, ""));
  return Number.isNaN(n) ? null : String(n);
}

function parseAngle(text: string, patterns: RegExp[]): string | null {
  const raw = firstMatch(text, patterns);
  if (!raw) return null;
  const n = parseFloat(raw.replace(/[^\d.]/g, ""));
  return Number.isNaN(n) ? null : String(n);
}

const GIA_PROFILE: LabExtractionProfile = {
  reportNumberPatterns: [
    /report\s*(?:no\.?|number|#)[:\s]*([0-9]{6,12})/i,
    /\bGIA\s*[#:]?\s*([0-9]{6,12})/i,
    /\b([0-9]{10})\b/,
  ],
  reportUrlPatterns: [/https?:\/\/[^\s]*gia\.edu[^\s]*/i],
  stoneTypeFromText: (text) => {
    if (/laboratory[-\s]?grown|lab[-\s]?grown|\bLGD\b/i.test(text)) {
      return "lab-grown";
    }
    if (/\bnatural\b/i.test(text)) return "natural";
    return null;
  },
  applyOverrides: (_text, _set) => {
    /* Proportion fields: extractGiaProportionFields in extract-from-text.ts */
  },
};

const GCAL_PROFILE: LabExtractionProfile = {
  reportNumberPatterns: [
    /report\s*(?:id|no\.?|number|#)?[:\s]*([A-Z0-9-]{6,20})/i,
    /\bGCAL\s*[#:]?\s*([A-Z0-9-]{6,20})/i,
    /\b(LG\d{6,14})\b/i,
    /\b([0-9]{8,12})\b/,
  ],
  reportUrlPatterns: [/https?:\/\/[^\s]*gcalusa\.com[^\s]*/i],
  stoneTypeFromText: GIA_PROFILE.stoneTypeFromText,
  applyOverrides: (text, set) => {
    const star = parsePercent(text, [/star[:\s]+([\d.]+)\s*%?/i]);
    if (star) set("starLengthPercent", star, "high");
    GIA_PROFILE.applyOverrides(text, set);
  },
};

const AGS_PROFILE: LabExtractionProfile = {
  reportNumberPatterns: [
    /AGS\s*(?:#|no\.?|report)?[:\s]*([0-9]{8,12})/i,
    /report\s*(?:no\.?|number|#)[:\s]*([0-9]{8,12})/i,
  ],
  reportUrlPatterns: [/https?:\/\/[^\s]*agslab\.com[^\s]*/i],
  stoneTypeFromText: GIA_PROFILE.stoneTypeFromText,
  applyOverrides: (text, set) => {
    const lh = parsePercent(text, [
      /lower\s+girdle\s+facet\s+length[:\s]+([\d.]+)\s*%?/i,
      /lower\s+girdle[:\s]+([\d.]+)\s*%?/i,
    ]);
    if (lh) set("lowerHalfPercent", lh, "high");
  },
};

/** IGI uses the same finish lines; report IDs differ — no scoring penalty. */
const IGI_PROFILE: LabExtractionProfile = {
  reportNumberPatterns: [
    /IGI\s*(?:report\s*)?(?:no\.?|number|#)?[:\s]*([A-Z0-9-]{6,20})/i,
    /report\s*(?:no\.?|number|#)[:\s]*([0-9]{6,14})/i,
    /\b(LG[A-Z0-9]{6,12})\b/i,
    /\b([0-9]{9,12})\b/,
  ],
  reportUrlPatterns: [/https?:\/\/[^\s]*igi\.org[^\s]*/i],
  stoneTypeFromText: (text) => {
    if (
      /laboratory[-\s]?grown|lab[-\s]?grown|labgrown|\bLG\b|\bCVD\b|\bHPHT\b/i.test(
        text,
      )
    ) {
      return "lab-grown";
    }
    if (/\bnatural\b/i.test(text)) return "natural";
    return null;
  },
  applyOverrides: (_text, _set) => {
    /* Proportion fields: extractIgiProportionFields in extract-from-text.ts */
  },
};

const OTHER_PROFILE: LabExtractionProfile = {
  reportNumberPatterns: [
    /report\s*(?:no\.?|number|#)[:\s]*([A-Z0-9-]+)/i,
    /\b([0-9]{8,12})\b/,
  ],
  reportUrlPatterns: [/https?:\/\/[^\s]+/i],
  stoneTypeFromText: GIA_PROFILE.stoneTypeFromText,
  applyOverrides: () => {},
};

const PROFILES: Record<CalibrationLab, LabExtractionProfile> = {
  GIA: GIA_PROFILE,
  GCAL: GCAL_PROFILE,
  AGS: AGS_PROFILE,
  IGI: IGI_PROFILE,
  OTHER: OTHER_PROFILE,
};

export function getLabProfile(lab: CalibrationLab): LabExtractionProfile {
  return PROFILES[lab];
}

export function extractLabMetadataFromText(
  text: string,
  lab: CalibrationLab,
  hints?: { reportNumber?: string; reportUrl?: string },
): { reportNumber?: string; reportUrl?: string; stoneType?: StoneType } {
  const profile = getLabProfile(lab);
  const out: {
    reportNumber?: string;
    reportUrl?: string;
    stoneType?: StoneType;
  } = {};

  if (!hints?.reportNumber) {
    const num = firstMatch(text, profile.reportNumberPatterns);
    if (num) out.reportNumber = num;
  }
  if (!hints?.reportUrl) {
    const url = firstMatch(text, profile.reportUrlPatterns);
    if (url) out.reportUrl = url;
  }
  const stone = profile.stoneTypeFromText(text);
  if (stone) out.stoneType = stone;

  return out;
}

export function applyLabFieldOverrides(
  text: string,
  lab: CalibrationLab,
  set: FieldSetter,
): void {
  getLabProfile(lab).applyOverrides(text, set);
}

const FINISH_GRADE =
  "(excellent|ex|ideal|very\\s+good|vg|good|fair|poor|none|nil|faint|medium|strong|negligible)";

const GIRDLE_PHRASE_FALLBACK =
  /\b((?:medium|thin|thick|slightly|very)\s+to\s+slightly\s+(?:thin|thick))(\s*\(faceted\))?/i;

export function extractCommonProportionFields(
  text: string,
  set: FieldSetter,
): void {
  const shape = firstMatch(text, [
    /(?:shape|cut type|cutting style|cut)[:\s]+([^\n]+)/i,
    /\b(round\s+brilliant(?:\s+cut)?)\b/i,
    /\b(ROUND\s+BRILLIANT)\b/,
    /\b(CUSHION|OVAL|PRINCESS|EMERALD|RADIANT|PEAR|MARQUISE|ASSCHER)\b/i,
  ]);
  if (shape) set("shape", shape, "medium");

  const carat = firstMatch(text, [
    /carat\s*weight[:\s]+([\d.]+)/i,
    /weight[:\s]+([\d.]+)\s*(?:carat|ct)\b/i,
    /\b([\d.]+)\s*(?:carat|ct)\b/i,
    /([\d.]+)\s*CTW?\b/i,
  ]);
  if (carat) set("carat", carat, "medium");

  const dashLabeled = firstMatch(text, [
    /measurements?[:\s]+([\d.]+\s*[-–—]\s*[\d.]+\s*x\s*[\d.]+)\s*mm?/i,
    /dimensions?[:\s]+([\d.]+\s*[-–—]\s*[\d.]+\s*x\s*[\d.]+)\s*mm?/i,
  ]);
  if (dashLabeled) {
    const norm = dashLabeled.replace(/×/g, " x ");
    set(
      "measurements",
      /\bmm\b/i.test(norm) ? norm : `${norm} mm`,
      "medium",
    );
  } else {
    const dashBare = text.match(
      /\b([\d.]{2,5})\s*[-–—]\s*([\d.]{2,5})\s*x\s*([\d.]{2,5})\s*mm\b/i,
    );
    if (dashBare) {
      set(
        "measurements",
        `${dashBare[1]} - ${dashBare[2]} x ${dashBare[3]} mm`,
        "medium",
      );
    } else {
      const measurements = firstMatch(text, [
        /measurements?[:\s]+([\d.]+\s*[x×]\s*[\d.]+\s*[x×]\s*[\d.]+)\s*mm?/i,
        /dimensions?[:\s]+([\d.]+\s*[x×]\s*[\d.]+\s*[x×]\s*[\d.]+)/i,
        /\b([\d.]{3,5}\s*[x×]\s*[\d.]{3,5}\s*[x×]\s*[\d.]{3,5})\s*mm?\b/i,
        /([\d.]+\s*[x×]\s*[\d.]+\s*[x×]\s*[\d.]+)\s*mm/i,
      ]);
      if (measurements) {
        const norm = measurements.replace(/×/g, " x ");
        set(
          "measurements",
          /\bmm\b/i.test(norm) ? norm : `${norm} mm`,
          "medium",
        );
      }
    }
  }

  const tablePercent = parsePercent(text, [
    /table\s*(?:size|%)?[:\s]+([\d.]+)\s*%?/i,
    /table[:\s]+([\d.]+)\s*%/i,
    /table\s*%[:\s]+([\d.]+)/i,
    /(?:^|\n)\s*table[^\n]{0,20}?([\d.]{2,3})\s*%/im,
  ]);
  if (tablePercent) set("tablePercent", tablePercent, "high");

  const depthPercent = parsePercent(text, [
    /total\s+depth[:\s]+([\d.]+)\s*%?/i,
    /depth\s*\(%\)[:\s]+([\d.]+)/i,
    /depth[:\s]+([\d.]+)\s*%/i,
    /depth\s*%[:\s]+([\d.]+)/i,
    /(?:^|\n)\s*depth[^\n]{0,24}?([\d.]{2,3})\s*%/im,
  ]);
  if (depthPercent) set("depthPercent", depthPercent, "high");

  const crownAngle = parseAngle(text, [
    /crown\s+angle[:\s]+([\d.]+)\s*°?/i,
    /crown\s*\(angle\)[:\s]+([\d.]+)/i,
    /crown[:\s]+([\d.]+)\s*°/i,
  ]);
  if (crownAngle) set("crownAngle", crownAngle, "high");

  const pavilionAngle = parseAngle(text, [
    /pavilion\s+angle[:\s]+([\d.]+)\s*°?/i,
    /pavilion\s*\(angle\)[:\s]+([\d.]+)/i,
    /pavilion[:\s]+([\d.]+)\s*°/i,
  ]);
  if (pavilionAngle) set("pavilionAngle", pavilionAngle, "high");

  const lowerHalf = parsePercent(text, [
    /lower\s+girdle\s+facet(?:\s+length)?[:\s]+([\d.]+)\s*%?/i,
    /lower\s+(?:girdle|half)\s*(?:facet)?[:\s]+([\d.]+)\s*%?/i,
    /lower\s+half[:\s]+([\d.]+)\s*%?/i,
    /lghf[:\s]+([\d.]+)/i,
  ]);
  if (lowerHalf) set("lowerHalfPercent", lowerHalf, "high");

  const starLength = parsePercent(text, [
    /star\s+length[:\s]+([\d.]+)\s*%?/i,
    /star\s*%[:\s]+([\d.]+)/i,
  ]);
  if (starLength) set("starLengthPercent", starLength, "high");

  const girdleMatch =
    text.match(
      /girdle\s*(?:thickness)?\s*[:\s]*((?:medium|thin|thick|slightly|very)\s+to\s+slightly\s+(?:thin|thick))(\s*\(faceted\))?/i,
    ) ?? text.match(GIRDLE_PHRASE_FALLBACK);
  if (girdleMatch) {
    const formatted = formatIgiGirdlePhrase(
      girdleMatch[1]! + (girdleMatch[2] ?? ""),
      Boolean(girdleMatch[2]),
    );
    if (formatted) set("girdle", formatted, "medium");
  }

  const culet = firstMatch(text, [
    new RegExp(`culet[:\\s]+(${FINISH_GRADE}|[^\\n]+)`, "i"),
    /culet\s+size[:\s]+([^\n]+)/i,
  ]);
  if (culet) set("culet", culet.split(/\s{2,}/)[0]!.trim(), "medium");

  const polish = firstMatch(text, [
    new RegExp(`polish[:\\s]+(${FINISH_GRADE})`, "i"),
    /polish[:\s]+([^\n]+)/i,
  ]);
  if (polish) set("polish", polish.split(/\s{2,}/)[0]!.trim(), "medium");

  const symmetry = firstMatch(text, [
    new RegExp(`symmetry[:\\s]+(${FINISH_GRADE})`, "i"),
    /symmetry[:\s]+([^\n]+)/i,
  ]);
  if (symmetry) set("symmetry", symmetry.split(/\s{2,}/)[0]!.trim(), "medium");

  const fluorescence = firstMatch(text, [
    new RegExp(`fluorescence[:\\s]+(${FINISH_GRADE})`, "i"),
    /fluorescence[:\s]+([^\n]+)/i,
    /fluorescence\s+color[:\s]+([^\n]+)/i,
  ]);
  if (fluorescence) {
    set("fluorescence", fluorescence.split(/\s{2,}/)[0]!.trim(), "medium");
  }

  const cutGrade = firstMatch(text, [
    new RegExp(`cut\\s*(?:grade)?[:\\s]+(${FINISH_GRADE})`, "i"),
    /cut\s*grade[:\s]+([^\n]+)/i,
    /(?:^|\n)\s*cut[:\s]+(excellent|very\s+good|good|fair|poor|ideal)/im,
  ]);
  if (cutGrade) set("cutGrade", cutGrade.split(/\s{2,}/)[0]!.trim(), "medium");
}
