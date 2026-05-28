import type { CalibrationReportFields, ReportFieldKey } from "../../types";
import type { ParserType } from "../types";

export type GcalRoutingCheckPayload = {
  reportNumber: string;
  detectedFormat: ParserType | "generic" | undefined;
  sarineColumnListSignature: boolean;
  sarineMarkers: boolean;
  gcal8xMarkers: boolean;
  parserPathUsed: ParserType | "generic";
  fallbackParserUsed?: ParserType;
  fieldsRecoveredByPath: Record<string, string>;
  fieldsRejectedWithReason?: Array<{ field: string; reason: string }>;
};

const ROUTING_FIELD_KEYS: ReportFieldKey[] = [
  "shape",
  "carat",
  "measurements",
  "tablePercent",
  "depthPercent",
  "crownAngle",
  "pavilionAngle",
  "lowerHalfPercent",
  "starLengthPercent",
  "girdle",
  "culet",
  "polish",
  "symmetry",
  "fluorescence",
  "cutGrade",
];

export function snapshotGcalRoutingFields(
  fields: CalibrationReportFields,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of ROUTING_FIELD_KEYS) {
    if (fields[key].trim()) out[key] = fields[key].trim();
  }
  return out;
}

export function logGcalRoutingCheck(payload: GcalRoutingCheckPayload): void {
  console.log("[GCAL ROUTING CHECK]", payload);
}
