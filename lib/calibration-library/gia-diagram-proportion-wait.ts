import type { CalibrationReportFields } from "./types";
import { emptyReportFields } from "./fields";
import { detectGiaReportStyle } from "./parsers/gia/gia-report-style";
import {
  giaProportionDiagramFieldsMissing,
  looksLikeGiaReportText,
  needsGiaProportionOcrSupplement,
} from "./gia-proportions";
import { shouldRunGiaFacsimileDiagramImageOcr } from "./parsers/gia/gia-facsimile-image-ocr";
import { SCORE_ELIGIBLE_CORE_KEYS } from "@/lib/diamond-intelligence/extraction-completeness";
import { parseReportGradeHints } from "@/lib/diamond-intelligence/report-grade-hints";

export type GiaDiagramProportionWaitInput = {
  fields: Partial<CalibrationReportFields>;
  combinedText: string;
  parserType?: string;
  lab?: string;
  gradeHintText?: string;
};

/** Text-layer grades present — proportions expected from diagram OCR only. */
function hasUsableTextLayerGrades(
  fields: Partial<CalibrationReportFields>,
  combinedText: string,
  gradeHintText?: string,
): boolean {
  const hasIdentity =
    Boolean(fields.shape?.trim() && fields.carat?.trim()) ||
    /\bgia\s+report\s+number\b/i.test(combinedText);
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

function isGiaDiagramOnlyReport(
  combinedText: string,
  opts: { parserType?: string; lab?: string },
): boolean {
  const isGia =
    opts.lab === "GIA" ||
    Boolean(opts.parserType?.startsWith("gia")) ||
    looksLikeGiaReportText(combinedText);
  if (!isGia) return false;

  const style = detectGiaReportStyle(combinedText);
  if (style.layout === "lgdr-dossier" || style.layout === "facsimile") {
    return true;
  }
  if (/\bLGDR\b/i.test(combinedText)) return true;
  if (/laboratory[-\s]*grown\s+diamond\s+report/i.test(combinedText)) {
    return true;
  }
  if (needsGiaProportionOcrSupplement(combinedText)) return true;
  if (/\bfacsimile\b/i.test(combinedText) && /\bcut\s+grade\b/i.test(combinedText)) {
    return true;
  }
  if (
    /\bgia\s+report\s+number\b/i.test(combinedText) &&
    /\bcarat\s+weight\b/i.test(combinedText) &&
    /\bcut\s+grade\b/i.test(combinedText)
  ) {
    return true;
  }
  return false;
}

/**
 * GIA facsimile / LGDR PDFs: grading table in text layer, proportions only on diagram.
 * Client pipeline must wait for region OCR — not return textParse-only snapshot.
 */
export function needsGiaDiagramProportionOcrWait(
  input: GiaDiagramProportionWaitInput,
): boolean {
  const fields: CalibrationReportFields = {
    ...emptyReportFields(),
    ...input.fields,
  };
  if (!giaProportionDiagramFieldsMissing(fields)) return false;
  const coreComplete = SCORE_ELIGIBLE_CORE_KEYS.every((k) =>
    Boolean(fields[k]?.trim()),
  );
  if (coreComplete) return false;
  if (!isGiaDiagramOnlyReport(input.combinedText, input)) return false;
  if (
    !hasUsableTextLayerGrades(
      input.fields,
      input.combinedText,
      input.gradeHintText,
    )
  ) {
    return false;
  }

  const facsimileGate = shouldRunGiaFacsimileDiagramImageOcr(
    fields,
    input.combinedText,
    { parserType: input.parserType, lab: input.lab },
  );
  if (facsimileGate.run) return true;

  const style = detectGiaReportStyle(input.combinedText);
  if (style.layout === "lgdr-dossier" || /\bLGDR\b/i.test(input.combinedText)) {
    return true;
  }

  return needsGiaProportionOcrSupplement(input.combinedText);
}
