import { isRoundBrilliantShape } from "@/lib/calibration-library/fields";
import type { CalibrationReportFields } from "@/lib/calibration-library/types";
import type { ReportGradeHints } from "./report-grade-hints";

const FANCY_SHAPE_TOKEN_RE =
  /\b(princess(?:\s+cut)?|oval(?:\s+brilliant)?|cushion(?:\s+(?:modified\s+)?brilliant)?|emerald(?:\s+cut)?|pear(?:\s+shape)?|marquise|radiant(?:\s+cut)?|asscher(?:\s+cut)?|heart(?:\s+shape)?)\b/i;

function titleCaseShapePhrase(raw: string): string {
  return raw
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function fancyShapeFromHint(reportTextHint?: string | null): string | null {
  const text = reportTextHint?.trim();
  if (!text) return null;
  const match = text.match(FANCY_SHAPE_TOKEN_RE)?.[1];
  if (!match) return null;
  const normalized = titleCaseShapePhrase(match);
  if (isRoundBrilliantShape(normalized)) return null;
  return normalized;
}

/**
 * Resolve a non-round cut label — fields.shape first, reportTextHint only when shape is empty.
 */
export function resolveFancyCutShape(
  shape?: string | null,
  reportTextHint?: string | null,
): string | null {
  const fromField = shape?.trim();
  if (fromField) {
    return isRoundBrilliantShape(fromField) ? null : fromField;
  }
  return fancyShapeFromHint(reportTextHint);
}

function hasMeaningfulFancyShapeRead(
  fields: Partial<CalibrationReportFields> | null | undefined,
  reportTextHint?: string | null,
): boolean {
  const f = fields ?? {};
  if (f.carat?.trim() || f.measurements?.trim()) return true;

  const finishCount = [f.polish, f.symmetry, f.fluorescence].filter((v) =>
    Boolean(v?.trim()),
  ).length;
  if (finishCount >= 1) return true;

  if (f.shape?.trim()) return true;
  return Boolean(fancyShapeFromHint(reportTextHint));
}

/**
 * Presentation gate — non-round shape with a successful identity/finish read.
 * Must run before lowInterpretationConfidence → proportion-incomplete UI.
 */
export function shouldPresentFancyShapeResult(input: {
  fields: Partial<CalibrationReportFields> | null | undefined;
  reportTextHint?: string | null;
  gradeHints?: Pick<ReportGradeHints, "color" | "clarity"> | null;
}): boolean {
  const resolved = resolveFancyCutShape(
    input.fields?.shape,
    input.reportTextHint,
  );
  if (!resolved) return false;
  return hasMeaningfulFancyShapeRead(input.fields, input.reportTextHint);
}

export type FancyShapeReportDetailItem = {
  label: string;
  value: string;
};

/** Extracted report details for fancy-shape surfaces — identity and finish, not round diagram fields. */
export function buildFancyShapeReportDetailItems(input: {
  fields: Partial<CalibrationReportFields>;
  gradeHints?: Pick<ReportGradeHints, "color" | "clarity"> | null;
  displayShape: string;
  formatCarat?: (carat: string) => string;
}): FancyShapeReportDetailItem[] {
  const items: FancyShapeReportDetailItem[] = [];
  const push = (label: string, value?: string | null) => {
    const v = value?.trim();
    if (v) items.push({ label, value: v });
  };

  push("Shape", input.displayShape);
  const carat = input.fields.carat?.trim();
  if (carat) {
    push(
      "Carat",
      input.formatCarat ? input.formatCarat(carat) : `${carat} ct`,
    );
  }
  push("Measurements", input.fields.measurements);
  push(
    "Color",
    input.gradeHints?.color?.trim() || undefined,
  );
  push(
    "Clarity",
    input.gradeHints?.clarity?.trim() || undefined,
  );
  push("Polish", input.fields.polish);
  push("Symmetry", input.fields.symmetry);
  push("Fluorescence", input.fields.fluorescence);
  if (input.fields.cutGrade?.trim()) {
    push("Cut Grade", input.fields.cutGrade);
  }

  return items;
}

export function buildFancyShapeTraitLine(displayShape: string): string {
  const shape = displayShape.trim() || "Fancy Shape";
  return `${shape} · Shape-Specific Review · Manual Review Recommended`;
}
