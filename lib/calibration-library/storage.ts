import {
  findCalibrationRecord,
  insertCalibrationRecord,
  isCalibrationDatabaseAvailable,
  listCalibrationRecords,
  updateCalibrationRecord,
} from "@/lib/supabase/calibration";
import { applyCorpusSaveGuardrails } from "./corpus-save-guardrails";
import { assessCalibrationSafety } from "./calibration-safety";
import { finalizeExtractionFields } from "./fields";
import {
  mergeValueProvenanceOnSave,
  type FieldProvenanceMap,
  type ValueProvenanceMap,
} from "./extraction-provenance";
import {
  listMissingFieldKeys,
  normalizeCalibrationFields,
  normalizeReportNumber,
} from "./field-normalization";
import { scoreRoundBrilliant } from "./scoring/round-brilliant";
import type {
  CalibrationExtractionSnapshot,
  CalibrationReportFields,
  CalibrationReportMetadata,
  CalibrationSaveInput,
  CalibrationSaveResult,
  CalibrationWorkbookEntry,
  FieldConfidence,
  ReportFieldKey,
} from "./types";
import { REPORT_FIELD_KEYS } from "./types";
import { randomUUID } from "node:crypto";
import {
  appendWorkbookEntryFile,
  findWorkbookEntryFile,
  readWorkbookFile,
  updateWorkbookEntryFile,
} from "./workbook-file";

export { getCalibrationDataDir, saveUpload } from "./workbook-file";

function buildParserMetadata(
  snapshot: CalibrationExtractionSnapshot,
  extras?: Pick<CalibrationSaveInput, "syntheticCalibration" | "calibrationTier">,
): Record<string, unknown> {
  const meta = snapshot.parserMetadata ?? {};
  return {
    parserType: snapshot.parserType ?? meta.parserType,
    parserConfidence: snapshot.parserConfidence ?? meta.parserConfidence,
    textMethod: snapshot.textMethod ?? meta.textMethod,
    extractionMeta: meta.extractionMeta,
    igiInternal: meta.igiInternal,
    giaInternal: meta.giaInternal,
    gcalInternal: meta.gcalInternal,
    fallbackParserUsed: meta.fallbackParserUsed,
    ...(extras?.syntheticCalibration
      ? { syntheticCalibration: true, calibrationTier: extras.calibrationTier }
      : {}),
  };
}

function resolveSaveProvenance(input: {
  fields: CalibrationReportFields;
  extractedFieldsRaw: CalibrationReportFields;
  snapshot: CalibrationExtractionSnapshot;
  existing?: CalibrationWorkbookEntry | null;
  preserveSnapshot: boolean;
  inputFieldProvenance?: FieldProvenanceMap;
  inputValueProvenance?: ValueProvenanceMap;
  syntheticCalibration?: boolean;
}): {
  fieldProvenance: FieldProvenanceMap | undefined;
  valueProvenance: ValueProvenanceMap;
  parserMetadata: Record<string, unknown>;
} {
  const snapshotMeta = input.snapshot.parserMetadata ?? {};
  const fieldProvenance =
    input.inputFieldProvenance ??
    (snapshotMeta.fieldProvenance as FieldProvenanceMap | undefined) ??
    (input.preserveSnapshot ? input.existing?.fieldProvenance : undefined);

  const valueProvenance = mergeValueProvenanceOnSave({
    approvedFields: input.fields,
    extractedFields: input.extractedFieldsRaw,
    prior: input.preserveSnapshot
      ? (input.inputValueProvenance ?? input.existing?.valueProvenance)
      : input.inputValueProvenance,
    actor: "manual-user",
  });

  if (input.syntheticCalibration) {
    for (const key of REPORT_FIELD_KEYS) {
      valueProvenance[key] = "synthetic-fixture";
    }
  }

  const parserMetadata = {
    ...snapshotMeta,
    fieldProvenance,
    valueProvenance,
    ...(input.syntheticCalibration
      ? { syntheticCalibration: true }
      : {}),
  };

  return { fieldProvenance, valueProvenance, parserMetadata };
}

function buildEntryFromSaveInput(
  input: CalibrationSaveInput,
  id: string,
  savedAt: string,
  updatedAt: string,
  recordVersion: number,
  extractedFieldsRaw: CalibrationReportFields,
  extractedConfidence: Record<ReportFieldKey, FieldConfidence>,
  provenance: {
    fieldProvenance?: FieldProvenanceMap;
    valueProvenance: ValueProvenanceMap;
    parserMetadata: Record<string, unknown>;
  },
): CalibrationWorkbookEntry {
  const fields = finalizeExtractionFields(input.fields);
  const fieldsNormalized = normalizeCalibrationFields(fields);
  const snapshot = input.extractionSnapshot;
  const roundBrilliantScore =
    input.roundBrilliantScore ?? scoreRoundBrilliant(fieldsNormalized);

  const entry: CalibrationWorkbookEntry = {
    id,
    savedAt,
    updatedAt,
    sourceFilename: input.sourceFilename,
    metadata: input.metadata,
    fields,
    fieldsNormalized,
    confidence: input.confidence,
    extractedFieldsRaw,
    extractedConfidence,
    parserType: snapshot.parserType,
    parserConfidence: snapshot.parserConfidence,
    textMethod: snapshot.textMethod,
    warnings: snapshot.warnings,
    missingFields: listMissingFieldKeys(fields),
    parserMetadata: {
      ...provenance.parserMetadata,
      ...(input.syntheticCalibration
        ? {
            syntheticCalibration: true,
            calibrationTier: input.calibrationTier,
          }
        : {}),
    },
    roundBrilliantScore,
    reviewerNote: input.reviewerNote,
    recordVersion,
    schemaVersion: 1,
    seeded: input.seeded,
    syntheticCalibration: input.syntheticCalibration,
    calibrationTier: input.calibrationTier,
    fieldProvenance: provenance.fieldProvenance,
    valueProvenance: provenance.valueProvenance,
    calibrationEligible: false,
  };
  const guarded = applyCorpusSaveGuardrails(entry);
  guarded.calibrationEligible =
    guarded.calibrationEligible ??
    assessCalibrationSafety(guarded).calibrationEligible;
  return guarded;
}

function duplicateKey(metadata: CalibrationReportMetadata): string {
  return `${metadata.lab}|${normalizeReportNumber(metadata.reportNumber)}|${metadata.reportSource}`;
}

export async function listCalibrationEntries(
  limit = 200,
): Promise<CalibrationWorkbookEntry[]> {
  if (isCalibrationDatabaseAvailable()) {
    return listCalibrationRecords(limit);
  }
  const entries = await readWorkbookFile();
  return entries.slice(-Math.min(Math.max(limit, 1), 500)).reverse();
}

export async function findCalibrationEntry(
  metadata: Pick<CalibrationReportMetadata, "lab" | "reportNumber" | "reportSource">,
): Promise<CalibrationWorkbookEntry | null> {
  if (isCalibrationDatabaseAvailable()) {
    return findCalibrationRecord(metadata);
  }
  return findWorkbookEntryFile(metadata);
}

export async function saveCalibrationEntry(
  input: CalibrationSaveInput,
): Promise<CalibrationSaveResult> {
  if (!input.metadata.reportNumber.trim() || !input.metadata.lab) {
    throw new Error("metadata.lab and metadata.reportNumber are required");
  }

  const snapshot = input.extractionSnapshot;
  const extractedFieldsRaw = finalizeExtractionFields(snapshot.fields);
  const extractedConfidence = snapshot.confidence;
  const fields = finalizeExtractionFields(input.fields);
  const fieldsNormalized = normalizeCalibrationFields(fields);
  const roundBrilliantScore =
    input.roundBrilliantScore ?? scoreRoundBrilliant(fieldsNormalized);
  const missingFields = listMissingFieldKeys(fields);
  const saveMode = input.saveMode ?? "create";

  const existing = await findCalibrationEntry(input.metadata);

  if (existing && saveMode === "create") {
    return {
      ok: false,
      code: "duplicate",
      message: `Record already exists for ${input.metadata.lab} ${input.metadata.reportNumber} (${input.metadata.reportSource}). Pass saveMode "update" to replace approved fields while preserving original extraction.`,
      existing: {
        id: existing.id,
        savedAt: existing.savedAt,
        metadata: existing.metadata,
        recordVersion: existing.recordVersion,
      },
    };
  }

  const preserveSnapshot =
    existing &&
    saveMode === "update" &&
    !input.replaceExtractionSnapshot;
  const preservedExtractedRaw = preserveSnapshot
    ? existing.extractedFieldsRaw
    : extractedFieldsRaw;
  const preservedExtractedConfidence = preserveSnapshot
    ? existing.extractedConfidence
    : extractedConfidence;

  const provenance = resolveSaveProvenance({
    fields,
    extractedFieldsRaw: preservedExtractedRaw,
    snapshot,
    existing,
    preserveSnapshot: Boolean(preserveSnapshot),
    inputFieldProvenance: input.fieldProvenance,
    inputValueProvenance: input.valueProvenance,
    syntheticCalibration: input.syntheticCalibration,
  });
  const parserMetadata = buildParserMetadata(snapshot, {
    syntheticCalibration: input.syntheticCalibration,
    calibrationTier: input.calibrationTier,
  });
  Object.assign(parserMetadata, provenance.parserMetadata);

  if (isCalibrationDatabaseAvailable()) {
    try {
      if (existing && saveMode === "update") {
        const entry = await updateCalibrationRecord(existing.id, {
          metadata: input.metadata,
          fields,
          fieldsNormalized,
          confidence: input.confidence,
          extractedFieldsRaw: preservedExtractedRaw,
          extractedConfidence: preservedExtractedConfidence,
          parserType: snapshot.parserType,
          parserConfidence: snapshot.parserConfidence,
          textMethod: snapshot.textMethod,
          warnings: snapshot.warnings,
          missingFields,
          parserMetadata,
          roundBrilliantScore,
          sourceFilename: input.sourceFilename,
          reviewerNote: input.reviewerNote,
          recordVersion: existing.recordVersion,
          seeded: input.seeded,
        });
        return { ok: true, entry, created: false };
      }

      const entry = await insertCalibrationRecord({
        metadata: input.metadata,
        fields,
        fieldsNormalized,
        confidence: input.confidence,
        extractedFieldsRaw: preservedExtractedRaw,
        extractedConfidence: preservedExtractedConfidence,
        parserType: snapshot.parserType,
        parserConfidence: snapshot.parserConfidence,
        textMethod: snapshot.textMethod,
        warnings: snapshot.warnings,
        missingFields,
        parserMetadata,
        roundBrilliantScore,
        sourceFilename: input.sourceFilename,
        reviewerNote: input.reviewerNote,
        seeded: input.seeded,
      });
      return { ok: true, entry, created: true };
    } catch (e) {
      if (
        e instanceof Error &&
        "code" in e &&
        (e as { code?: string }).code === "duplicate"
      ) {
        const dup = await findCalibrationEntry(input.metadata);
        if (dup) {
          return {
            ok: false,
            code: "duplicate",
            message: `Record already exists for ${input.metadata.lab} ${input.metadata.reportNumber} (${input.metadata.reportSource}).`,
            existing: {
              id: dup.id,
              savedAt: dup.savedAt,
              metadata: dup.metadata,
              recordVersion: dup.recordVersion,
            },
          };
        }
      }
      throw e;
    }
  }

  if (existing && saveMode === "update") {
    const entry = buildEntryFromSaveInput(
      input,
      existing.id,
      existing.savedAt,
      new Date().toISOString(),
      existing.recordVersion + 1,
      preservedExtractedRaw,
      preservedExtractedConfidence,
      provenance,
    );
    await updateWorkbookEntryFile(entry);
    return { ok: true, entry, created: false };
  }

  if (existing) {
    return {
      ok: false,
      code: "duplicate",
      message: `Record already exists for ${input.metadata.lab} ${input.metadata.reportNumber} (${input.metadata.reportSource}).`,
      existing: {
        id: existing.id,
        savedAt: existing.savedAt,
        metadata: existing.metadata,
        recordVersion: existing.recordVersion,
      },
    };
  }

  const entry = buildEntryFromSaveInput(
    input,
    randomUUID(),
    new Date().toISOString(),
    new Date().toISOString(),
    1,
    preservedExtractedRaw,
    preservedExtractedConfidence,
    provenance,
  );
  await appendWorkbookEntryFile(entry);
  return { ok: true, entry, created: true };
}

export function extractionResultToSnapshot(
  result: import("./types").ExtractionResult,
): CalibrationExtractionSnapshot {
  return {
    fields: finalizeExtractionFields(result.fields),
    confidence: result.confidence,
    parserType: result.parserType,
    parserConfidence: result.parserConfidence,
    textMethod: result.textMethod,
    warnings: result.warnings,
    parserMetadata: {
      parserType: result.parserType,
      parserConfidence: result.parserConfidence,
      textMethod: result.textMethod,
      extractionMeta: result.extractionMeta,
      igiInternal: result.igiInternal,
      giaInternal: result.giaInternal,
      gcalInternal: result.gcalInternal,
      fieldProvenance: result.fieldProvenance,
    },
  };
}

function manualFieldConfidence(): Record<ReportFieldKey, FieldConfidence> {
  return Object.fromEntries(
    REPORT_FIELD_KEYS.map((k) => [k, "manual"]),
  ) as Record<ReportFieldKey, FieldConfidence>;
}

/** Persist internal-only synthetic round brilliant for distribution calibration. */
export async function saveSyntheticCalibrationRecord(
  fixture: import("./synthetic-calibration-fixtures").SyntheticCalibrationFixture,
  opts?: { saveMode?: "create" | "update"; force?: boolean },
): Promise<CalibrationSaveResult> {
  const { fixtureToFields } = await import("./synthetic-calibration-fixtures");
  const fields = fixtureToFields(fixture);
  const confidence = manualFieldConfidence();
  const snapshot: CalibrationExtractionSnapshot = {
    fields,
    confidence,
    parserType: "generic",
    parserConfidence: "high",
    textMethod: "manual",
    warnings: [
      "synthetic-calibration: controlled normalized fields — no parser extraction",
    ],
    parserMetadata: {
      parserType: "generic",
      textMethod: "manual",
      syntheticCalibration: true,
      calibrationTier: fixture.tier,
      fieldProvenance: undefined,
    },
  };

  const metadata: CalibrationReportMetadata = {
    lab: fixture.lab,
    reportNumber: fixture.reportNumber,
    reportSource: "manual",
    stoneType: "lab-grown",
  };

  const existing = await findCalibrationEntry(metadata);
  if (existing?.seeded && !opts?.force) {
    return {
      ok: true,
      entry: existing,
      created: false,
    };
  }

  return saveCalibrationEntry({
    metadata,
    fields,
    confidence,
    extractionSnapshot: snapshot,
    reviewerNote: `synthetic:${fixture.id}:${fixture.tierLabel} — ${fixture.designNote}`,
    saveMode: existing ? (opts?.saveMode ?? "update") : "create",
    seeded: true,
    syntheticCalibration: true,
    calibrationTier: fixture.tier,
    replaceExtractionSnapshot: opts?.force ?? !existing?.seeded,
  });
}

export async function seedSyntheticCalibrationFixtures(opts?: {
  force?: boolean;
}): Promise<{ created: number; updated: number; skipped: number; errors: string[] }> {
  const { buildSyntheticCalibrationFixtures } = await import(
    "./synthetic-calibration-fixtures"
  );
  const fixtures = buildSyntheticCalibrationFixtures();
  let created = 0;
  let updated = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const fixture of fixtures) {
    const existing = await findCalibrationEntry({
      lab: fixture.lab,
      reportNumber: fixture.reportNumber,
      reportSource: "manual",
    });
    if (existing?.seeded && !opts?.force) {
      skipped++;
      continue;
    }
    const result = await saveSyntheticCalibrationRecord(fixture, {
      force: opts?.force,
      saveMode: existing ? "update" : "create",
    });
    if (!result.ok) {
      errors.push(`${fixture.id}: ${result.message}`);
      continue;
    }
    if (result.created) created++;
    else updated++;
  }

  return { created, updated, skipped, errors };
}

export { duplicateKey, normalizeReportNumber };
