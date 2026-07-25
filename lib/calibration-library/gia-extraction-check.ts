import type { CalibrationReportFields } from "./types";
import { REPORT_FIELD_KEYS } from "./types";
import {
  logSafeDiagnostic,
  populatedFieldKeysFromRecord,
} from "./safe-diagnostic-log";

export type GiaExtractionCheckPayload = {
  reportNumber?: string;
  parserPathUsed?: string;
  headerTextPreview: string;
  proportionTextPreview: string;
  assignedFields: Record<string, string>;
  missingFields: string[];
  warnings: string[];
};

function sliceGiaHeaderPreview(text: string): string {
  const end = text.search(/\b(?:table|depth|crown|pavilion)\b/i);
  const slice = end > 40 ? text.slice(0, end) : text.slice(0, 480);
  return slice.trim().slice(0, 320);
}

function sliceGiaProportionPreview(text: string): string {
  const start = text.search(/\b(?:table|depth|crown|pavilion|proportion)\b/i);
  if (start < 0) return text.trim().slice(0, 320);
  return text.slice(start, start + 420).trim().slice(0, 320);
}

export function buildGiaExtractionCheck(
  rawText: string,
  fields: CalibrationReportFields,
  opts?: {
    reportNumber?: string;
    parserPathUsed?: string;
    warnings?: string[];
  },
): GiaExtractionCheckPayload {
  const assignedFields: Record<string, string> = {};
  const missingFields: string[] = [];
  for (const key of REPORT_FIELD_KEYS) {
    if (fields[key].trim()) assignedFields[key] = fields[key].trim();
    else missingFields.push(key);
  }
  return {
    reportNumber: opts?.reportNumber?.trim(),
    parserPathUsed: opts?.parserPathUsed,
    headerTextPreview: sliceGiaHeaderPreview(rawText),
    proportionTextPreview: sliceGiaProportionPreview(rawText),
    assignedFields,
    missingFields,
    warnings: opts?.warnings ?? [],
  };
}

export function logGiaExtractionCheck(payload: GiaExtractionCheckPayload): void {
  logSafeDiagnostic("[GIA EXTRACTION CHECK]", {
    parserPathUsed: payload.parserPathUsed ?? null,
    assignedFieldKeys: populatedFieldKeysFromRecord(payload.assignedFields),
    missingFieldKeys: payload.missingFields,
    warningCount: payload.warnings.length,
  });
}
