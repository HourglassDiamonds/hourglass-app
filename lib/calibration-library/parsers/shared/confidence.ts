import type { CalibrationReportFields, FieldConfidence } from "../../types";
import type { ParserConfidence } from "../types";

export function capConfidenceForOcr(level: FieldConfidence): FieldConfidence {
  if (level === "high") return "medium";
  if (level === "medium") return "low";
  return level;
}

/** Core proportion + grading field count → parser confidence band. */
export function coreFieldConfidence(
  fields: CalibrationReportFields,
  coreKeys: (keyof CalibrationReportFields)[],
): ParserConfidence {
  const count = coreKeys.filter((k) => fields[k].trim()).length;
  if (count >= 10) return "high";
  if (count >= 6) return "medium";
  return "low";
}

export function lowConfidenceWarning(
  parserConfidence: ParserConfidence,
  parserType: string,
): string | undefined {
  if (parserConfidence !== "low") return undefined;
  if (parserType === "gcal-sarine-4cs") {
    return "GCAL Sarine (4Cs): parser confidence is low — proportion panel may need manual review.";
  }
  return `${parserType}: parser confidence is low — verify fields against the report.`;
}
