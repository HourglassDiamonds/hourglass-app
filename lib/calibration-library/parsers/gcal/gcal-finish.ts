import { normalizeOcrText } from "../shared/normalization";
import type { CalibrationReportFields, FieldConfidence, ReportFieldKey } from "../../types";
import {
  logSafeDiagnostic,
  populatedFieldKeysFromRecord,
} from "../../safe-diagnostic-log";

const GCAL_FINISH_GRADE_WHITELIST = new Set([
  "Excellent",
  "Very Good",
  "Good",
  "Fair",
  "Poor",
  "Ideal",
]);

const GENERIC_SCALE_MARKERS =
  /\b(?:grading\s+scale|proportion\s+grading\s+scale|clarity\s+scale|color\s+scale)\b/i;

const GCAL_FINISH_GRADE_TOKENS: Record<string, string> = {
  ex: "Excellent",
  excellent: "Excellent",
  vg: "Very Good",
  "very good": "Very Good",
  g: "Good",
  good: "Good",
  f: "Fair",
  fair: "Fair",
  p: "Poor",
  poor: "Poor",
  ideal: "Ideal",
};

export type Gcal8xFinishGrades = {
  polish?: string;
  symmetry?: string;
  cutGrade?: string;
};

function mapGcalFinishGradeToken(raw: string): string | undefined {
  const mapped = GCAL_FINISH_GRADE_TOKENS[raw.trim().toLowerCase()];
  if (!mapped || !GCAL_FINISH_GRADE_WHITELIST.has(mapped)) return undefined;
  return mapped;
}

function isGenericGcalScaleSegment(segment: string): boolean {
  if (GENERIC_SCALE_MARKERS.test(segment)) return true;
  if (/\b\d+\.\s*(?:polish|symmetry|proportions)\b/i.test(segment)) {
    return false;
  }
  const scaleRow = segment.match(
    /\b\d+\.\s+(?:poor|fair|good|very\s+good|excellent|ideal)\b/gi,
  );
  if (scaleRow && scaleRow.length >= 2) return true;
  return false;
}

/** Row label in finish crop → rightmost grade token (GCAL 8X table: P…EX, selected grade on the right). */
function gradeAfterRowLabel(
  text: string,
  rowRe: RegExp,
  opts?: { rejectGenericScale?: boolean },
): string | undefined {
  const windowMatch = text.match(
    // Wider window: finish table rows can be wide (grade pill on far right).
    new RegExp(`${rowRe.source}(?:.|\\n){0,520}`, `${rowRe.flags}i`),
  );
  if (!windowMatch) return undefined;

  let segment = windowMatch[0];
  const nextRow = segment.search(/\s\d+\.\s/);
  if (nextRow > 0) segment = segment.slice(0, nextRow);

  if (opts?.rejectGenericScale !== false && isGenericGcalScaleSegment(segment)) {
    return undefined;
  }

  const tokens = [
    ...segment.matchAll(
      /\b(EXCELLENT|VERY\s+GOOD|GOOD|FAIR|POOR|IDEAL|EX|VG)\b/gi,
    ),
  ];

  // If OCR only captured a single weak token (e.g. "P" → Poor), treat as unreadable.
  // This prevents generic grading-scale columns (or partial OCR) from populating report fields.
  if (tokens.length === 1) {
    const mapped = mapGcalFinishGradeToken(tokens[0]![1]!);
    if (mapped === "Poor" || mapped === "Fair" || mapped === "Good") {
      return undefined;
    }
  }

  for (let i = tokens.length - 1; i >= 0; i--) {
    const mapped = mapGcalFinishGradeToken(tokens[i]![1]!);
    if (mapped) return mapped;
  }
  return undefined;
}

/**
 * GCAL 8X finish crop only — Polish / External Symmetry / Proportions rows.
 */
export type Gcal8xFinishExtractionAudit = {
  polish?: string;
  symmetry?: string;
  cutGrade?: string;
  rejected: Array<{ field: string; candidate: string; reason: string }>;
};

export function extractGcal8xFinishGradesWithAudit(
  finishRegionText: string | undefined,
): Gcal8xFinishExtractionAudit {
  const rejected: Gcal8xFinishExtractionAudit["rejected"] = [];
  if (!finishRegionText?.trim()) {
    return { rejected };
  }

  const norm = normalizeOcrText(finishRegionText);
  const out: Gcal8xFinishGrades = {};

  const polish = gradeAfterRowLabel(norm, /\bpolish\b/);
  if (polish) out.polish = polish;
  else if (/\bpolish\b/i.test(norm)) {
    rejected.push({
      field: "polish",
      candidate: "(row present, no whitelisted grade)",
      reason: "generic-scale or unreadable finish row",
    });
  }

  const symmetry =
    gradeAfterRowLabel(norm, /\bexternal\s+symmetry\b/) ??
    gradeAfterRowLabel(norm, /\bsymmetry\b/);
  if (symmetry) out.symmetry = symmetry;

  const cutGrade = gradeAfterRowLabel(norm, /\bproportions\b/);
  const scaleContext = GENERIC_SCALE_MARKERS.test(norm);
  const weakScaleGrade =
    cutGrade === "Fair" || cutGrade === "Poor" || cutGrade === "Good";
  if (cutGrade && !(scaleContext && weakScaleGrade)) {
    out.cutGrade = cutGrade;
  } else if (cutGrade && scaleContext && weakScaleGrade) {
    rejected.push({
      field: "cutGrade",
      candidate: cutGrade,
      reason: "rejected generic grading-scale grade — not report 8X row",
    });
  } else if (/\bproportions\b/i.test(norm) && /\bfair\b/i.test(norm)) {
    rejected.push({
      field: "cutGrade",
      candidate: "Fair",
      reason: "rejected generic grading-scale Fair — not report 8X row",
    });
  }

  // Heuristic: if OCR missed the rightmost "EX Excellent" for Polish but the same crop
  // clearly contains Excellent (and other rows landed on Excellent), prefer Excellent.
  // This prevents a common partial-read where only the "VG" column is captured on the first row.
  if (
    out.polish === "Very Good" &&
    /excellent/i.test(norm) &&
    (out.symmetry === "Excellent" || out.cutGrade === "Excellent")
  ) {
    out.polish = "Excellent";
  }

  return { ...out, rejected };
}

export function extractGcal8xFinishGrades(
  finishRegionText: string | undefined,
): Gcal8xFinishGrades {
  const { rejected: _r, ...grades } = extractGcal8xFinishGradesWithAudit(
    finishRegionText,
  );
  return grades;
}

type FinishFieldSetter = (
  key: ReportFieldKey,
  value: string,
  level: FieldConfidence,
) => void;

const SCALE_MISREAD_CUT_GRADES = new Set(["Fair", "Poor", "Good"]);

/** Apply finish grades — never overwrites populated fields unless scale misread reconcile applies. */
export function applyGcal8xFinishGrades(
  grades: Gcal8xFinishGrades,
  fields: CalibrationReportFields,
  set: FinishFieldSetter,
): void {
  if (grades.polish && !fields.polish.trim()) {
    set("polish", grades.polish, "high");
  }
  if (grades.symmetry && !fields.symmetry.trim()) {
    set("symmetry", grades.symmetry, "high");
  }
  if (grades.cutGrade && !fields.cutGrade.trim()) {
    set("cutGrade", grades.cutGrade, "high");
  } else if (
    grades.cutGrade &&
    fields.cutGrade.trim() &&
    SCALE_MISREAD_CUT_GRADES.has(fields.cutGrade.trim()) &&
    (grades.cutGrade === "Excellent" || grades.cutGrade === "Ideal")
  ) {
    fields.cutGrade = grades.cutGrade;
    set("cutGrade", grades.cutGrade, "high");
  }
}

export function logGcal8xFinishOcrCheck(payload: {
  cropRegion: { left: number; top: number; width: number; height: number };
  ocrPreview: string;
  finishCandidates: Gcal8xFinishGrades;
  rejectedGenericScale: Gcal8xFinishExtractionAudit["rejected"];
  assigned: Gcal8xFinishGrades;
  confidence: Record<string, string>;
}): void {
  logSafeDiagnostic("[GCAL 8X FINISH OCR CHECK]", {
    cropWidth: payload.cropRegion.width,
    cropHeight: payload.cropRegion.height,
    ocrCharCount: payload.ocrPreview?.length ?? null,
    assignedFieldKeys: populatedFieldKeysFromRecord(
      payload.assigned as unknown as Record<string, string>,
    ),
    rejectedCandidateCount: payload.rejectedGenericScale?.length ?? 0,
  });
}
