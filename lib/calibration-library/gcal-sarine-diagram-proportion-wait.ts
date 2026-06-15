import type { CalibrationReportFields } from "./types";
import { emptyReportFields } from "./fields";
import {
  hasSarineColumnListSignature,
  looksLikeGcalSarine4csReportText,
} from "./parsers/gcal/gcal-sarine-4cs";
import { needsGcalSarineProportionImageOcr } from "./parsers/gcal/gcal-sarine-image-ocr";
import { SCORE_ELIGIBLE_CORE_KEYS } from "@/lib/diamond-intelligence/extraction-completeness";
import { parseReportGradeHints } from "@/lib/diamond-intelligence/report-grade-hints";

export type GcalSarineDiagramProportionWaitInput = {
  fields: Partial<CalibrationReportFields>;
  combinedText: string;
  parserType?: string;
  lab?: string;
  gradeHintText?: string;
};

/** Text-layer grades present — Sarine diagram proportions expected from image OCR only. */
function hasUsableTextLayerGrades(
  fields: Partial<CalibrationReportFields>,
  combinedText: string,
  gradeHintText?: string,
): boolean {
  const hasIdentity =
    Boolean(fields.shape?.trim() && fields.carat?.trim()) ||
    /\bGCAL\s+LG?\d{6,12}\b/i.test(combinedText);
  if (!hasIdentity) return false;

  const hints = parseReportGradeHints(
    [gradeHintText, combinedText].filter(Boolean).join("\n\n"),
  );
  if (hints.color?.trim() || hints.clarity?.trim()) return true;

  return Boolean(
    fields.cutGrade?.trim() ||
      fields.polish?.trim() ||
      fields.symmetry?.trim(),
  );
}

function isGcalSarineDiagramOnlyReport(
  combinedText: string,
  opts: { parserType?: string; lab?: string },
): boolean {
  if (opts.parserType === "gcal-sarine-4cs") return true;
  if (opts.lab !== "GCAL") return false;
  return (
    hasSarineColumnListSignature(combinedText) ||
    looksLikeGcalSarine4csReportText(combinedText)
  );
}

/**
 * GCAL BY SARINE PDFs: 4Cs grading in text layer, proportions only on diagram image.
 * Client pipeline must wait for region OCR — not return textParse-only snapshot.
 */
export function needsGcalSarineDiagramProportionOcrWait(
  input: GcalSarineDiagramProportionWaitInput,
): boolean {
  const fields: CalibrationReportFields = {
    ...emptyReportFields(),
    ...input.fields,
  };
  if (!needsGcalSarineProportionImageOcr(fields)) return false;
  const coreComplete = SCORE_ELIGIBLE_CORE_KEYS.every((k) =>
    Boolean(fields[k]?.trim()),
  );
  if (coreComplete) return false;
  if (!isGcalSarineDiagramOnlyReport(input.combinedText, input)) return false;
  return hasUsableTextLayerGrades(
    input.fields,
    input.combinedText,
    input.gradeHintText,
  );
}
