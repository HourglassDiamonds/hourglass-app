import { getSupabaseAdmin } from "./client";
import { normalizeReportNumber } from "@/lib/calibration-library/field-normalization";
import type {
  CalibrationReportFields,
  CalibrationReportMetadata,
  CalibrationWorkbookEntry,
  FieldConfidence,
  ReportFieldKey,
  RoundBrilliantScoreResult,
} from "@/lib/calibration-library/types";
import { REPORT_FIELD_KEYS } from "@/lib/calibration-library/types";

export const CALIBRATION_SCHEMA_VERSION = 1;

type CalibrationRow = {
  id: string;
  lab: string;
  report_number: string;
  report_number_norm: string;
  report_url: string | null;
  report_source: string;
  stone_type: string;
  fields: CalibrationReportFields;
  fields_normalized: CalibrationReportFields;
  confidence: Record<ReportFieldKey, FieldConfidence>;
  extracted_fields_raw: CalibrationReportFields;
  extracted_confidence: Record<ReportFieldKey, FieldConfidence>;
  parser_type: string | null;
  parser_confidence: string | null;
  text_method: string | null;
  warnings: string[];
  missing_fields: string[];
  parser_metadata: Record<string, unknown>;
  round_brilliant_score: RoundBrilliantScoreResult | null;
  source_filename: string | null;
  reviewer_note: string | null;
  record_version: number;
  schema_version: number;
  seeded: boolean;
  created_at: string;
  updated_at: string;
};

function rowToEntry(row: CalibrationRow): CalibrationWorkbookEntry {
  return {
    id: row.id,
    savedAt: row.created_at,
    updatedAt: row.updated_at,
    sourceFilename: row.source_filename ?? undefined,
    metadata: {
      lab: row.lab as CalibrationReportMetadata["lab"],
      reportNumber: row.report_number,
      reportUrl: row.report_url ?? undefined,
      reportSource: row.report_source as CalibrationReportMetadata["reportSource"],
      stoneType: row.stone_type as CalibrationReportMetadata["stoneType"],
    },
    fields: row.fields,
    fieldsNormalized: row.fields_normalized,
    confidence: row.confidence,
    extractedFieldsRaw: row.extracted_fields_raw,
    extractedConfidence: row.extracted_confidence,
    parserType: (row.parser_type ?? undefined) as CalibrationWorkbookEntry["parserType"],
    parserConfidence: (row.parser_confidence ?? undefined) as CalibrationWorkbookEntry["parserConfidence"],
    textMethod: (row.text_method ?? undefined) as CalibrationWorkbookEntry["textMethod"],
    warnings: row.warnings ?? [],
    missingFields: (row.missing_fields ?? []) as ReportFieldKey[],
    parserMetadata: row.parser_metadata as CalibrationWorkbookEntry["parserMetadata"],
    roundBrilliantScore: row.round_brilliant_score,
    reviewerNote: row.reviewer_note ?? undefined,
    recordVersion: row.record_version,
    schemaVersion: row.schema_version,
    seeded: row.seeded,
    syntheticCalibration: Boolean(
      (row.parser_metadata as { syntheticCalibration?: boolean } | null)
        ?.syntheticCalibration,
    ),
    calibrationTier:
      typeof (row.parser_metadata as { calibrationTier?: string } | null)
        ?.calibrationTier === "string"
        ? (row.parser_metadata as { calibrationTier: string }).calibrationTier
        : undefined,
    fieldProvenance: (row.parser_metadata as { fieldProvenance?: CalibrationWorkbookEntry["fieldProvenance"] })
      ?.fieldProvenance,
    valueProvenance: (row.parser_metadata as { valueProvenance?: CalibrationWorkbookEntry["valueProvenance"] })
      ?.valueProvenance,
    calibrationEligible: undefined,
  };
}

export function isCalibrationDatabaseAvailable(): boolean {
  return getSupabaseAdmin() !== null;
}

export async function findCalibrationRecord(
  metadata: Pick<CalibrationReportMetadata, "lab" | "reportNumber" | "reportSource">,
): Promise<CalibrationWorkbookEntry | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  const reportNumberNorm = normalizeReportNumber(metadata.reportNumber);
  const { data, error } = await supabase
    .from("calibration_records")
    .select("*")
    .eq("lab", metadata.lab)
    .eq("report_number_norm", reportNumberNorm)
    .eq("report_source", metadata.reportSource)
    .maybeSingle();

  if (error || !data) return null;
  return rowToEntry(data as CalibrationRow);
}

export async function listCalibrationRecords(limit = 200): Promise<CalibrationWorkbookEntry[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("calibration_records")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 500));

  if (error || !data) return [];
  return (data as CalibrationRow[]).map(rowToEntry);
}

export async function insertCalibrationRecord(input: {
  metadata: CalibrationReportMetadata;
  fields: CalibrationReportFields;
  fieldsNormalized: CalibrationReportFields;
  confidence: Record<ReportFieldKey, FieldConfidence>;
  extractedFieldsRaw: CalibrationReportFields;
  extractedConfidence: Record<ReportFieldKey, FieldConfidence>;
  parserType?: string;
  parserConfidence?: string;
  textMethod?: string;
  warnings: string[];
  missingFields: ReportFieldKey[];
  parserMetadata: Record<string, unknown>;
  roundBrilliantScore: RoundBrilliantScoreResult | null;
  sourceFilename?: string;
  reviewerNote?: string;
  seeded?: boolean;
}): Promise<CalibrationWorkbookEntry> {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    throw new Error("Supabase is not configured");
  }

  const reportNumberNorm = normalizeReportNumber(input.metadata.reportNumber);
  const now = new Date().toISOString();

  const row = {
    lab: input.metadata.lab,
    report_number: input.metadata.reportNumber.trim(),
    report_number_norm: reportNumberNorm,
    report_url: input.metadata.reportUrl ?? null,
    report_source: input.metadata.reportSource,
    stone_type: input.metadata.stoneType,
    fields: input.fields,
    fields_normalized: input.fieldsNormalized,
    confidence: input.confidence,
    extracted_fields_raw: input.extractedFieldsRaw,
    extracted_confidence: input.extractedConfidence,
    parser_type: input.parserType ?? null,
    parser_confidence: input.parserConfidence ?? null,
    text_method: input.textMethod ?? null,
    warnings: input.warnings,
    missing_fields: input.missingFields,
    parser_metadata: input.parserMetadata,
    round_brilliant_score: input.roundBrilliantScore,
    source_filename: input.sourceFilename ?? null,
    reviewer_note: input.reviewerNote ?? null,
    record_version: 1,
    schema_version: CALIBRATION_SCHEMA_VERSION,
    seeded: input.seeded ?? false,
    updated_at: now,
  };

  const { data, error } = await supabase
    .from("calibration_records")
    .insert(row)
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw Object.assign(new Error("duplicate"), { code: "duplicate" as const });
    }
    throw new Error(error.message);
  }

  return rowToEntry(data as CalibrationRow);
}

export async function updateCalibrationRecord(
  existingId: string,
  input: {
    metadata: CalibrationReportMetadata;
    fields: CalibrationReportFields;
    fieldsNormalized: CalibrationReportFields;
    confidence: Record<ReportFieldKey, FieldConfidence>;
    extractedFieldsRaw: CalibrationReportFields;
    extractedConfidence: Record<ReportFieldKey, FieldConfidence>;
    parserType?: string;
    parserConfidence?: string;
    textMethod?: string;
    warnings: string[];
    missingFields: ReportFieldKey[];
    parserMetadata: Record<string, unknown>;
    roundBrilliantScore: RoundBrilliantScoreResult | null;
    sourceFilename?: string;
    reviewerNote?: string;
    recordVersion: number;
    seeded?: boolean;
  },
): Promise<CalibrationWorkbookEntry> {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    throw new Error("Supabase is not configured");
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("calibration_records")
    .update({
      report_number: input.metadata.reportNumber.trim(),
      report_number_norm: normalizeReportNumber(input.metadata.reportNumber),
      report_url: input.metadata.reportUrl ?? null,
      stone_type: input.metadata.stoneType,
      fields: input.fields,
      fields_normalized: input.fieldsNormalized,
      confidence: input.confidence,
      extracted_fields_raw: input.extractedFieldsRaw,
      extracted_confidence: input.extractedConfidence,
      parser_type: input.parserType ?? null,
      parser_confidence: input.parserConfidence ?? null,
      text_method: input.textMethod ?? null,
      warnings: input.warnings,
      missing_fields: input.missingFields,
      parser_metadata: input.parserMetadata,
      round_brilliant_score: input.roundBrilliantScore,
      source_filename: input.sourceFilename ?? null,
      reviewer_note: input.reviewerNote ?? null,
      record_version: input.recordVersion + 1,
      seeded: input.seeded ?? false,
      updated_at: now,
    })
    .eq("id", existingId)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return rowToEntry(data as CalibrationRow);
}

export function emptyFieldsFromRow(): CalibrationReportFields {
  return Object.fromEntries(REPORT_FIELD_KEYS.map((k) => [k, ""])) as CalibrationReportFields;
}
