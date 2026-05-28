import { mkdir, readFile, writeFile } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";
import { finalizeExtractionFields } from "./fields";
import { listMissingFieldKeys, normalizeCalibrationFields } from "./field-normalization";
import { assessCalibrationSafety } from "./calibration-safety";
import { normalizeCalibrationLab } from "./lab-parsers";
import type {
  CalibrationReportFields,
  CalibrationReportMetadata,
  CalibrationWorkbookEntry,
  FieldConfidence,
  ReportFieldKey,
  ReportSource,
  RoundBrilliantScoreResult,
  StoneType,
} from "./types";
import { REPORT_FIELD_KEYS, REPORT_SOURCES, STONE_TYPES } from "./types";

const DATA_DIR = join(process.cwd(), "data", "light-performance-calibration");
const WORKBOOK_PATH = join(DATA_DIR, "workbook.json");
const UPLOADS_DIR = join(DATA_DIR, "uploads");

export const CALIBRATION_SCHEMA_VERSION = 1;

export function getCalibrationDataDir(): string {
  return DATA_DIR;
}

async function ensureDataDir(): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await mkdir(UPLOADS_DIR, { recursive: true });
}

function isReportSource(v: unknown): v is ReportSource {
  return typeof v === "string" && (REPORT_SOURCES as readonly string[]).includes(v);
}

function isStoneType(v: unknown): v is StoneType {
  return typeof v === "string" && (STONE_TYPES as readonly string[]).includes(v);
}

/** Migrate legacy workbook rows to v1 persisted shape. */
export function normalizeWorkbookEntry(raw: Record<string, unknown>): CalibrationWorkbookEntry {
  const legacyFields = (raw.fields ?? {}) as Record<string, string>;
  const existingMeta = raw.metadata as CalibrationReportMetadata | undefined;

  const metadata: CalibrationReportMetadata = existingMeta ?? {
    lab: normalizeCalibrationLab(legacyFields.lab ?? "OTHER"),
    reportNumber: legacyFields.reportNumber ?? "",
    reportUrl: typeof raw.reportUrl === "string" ? raw.reportUrl : undefined,
    reportSource: isReportSource(raw.reportSource) ? raw.reportSource : "manual",
    stoneType: isStoneType(raw.stoneType) ? raw.stoneType : "unknown",
  };

  const fields = finalizeExtractionFields(
    Object.fromEntries(REPORT_FIELD_KEYS.map((k) => [k, legacyFields[k] ?? ""])) as CalibrationReportFields,
  );
  const fieldsNormalized = normalizeCalibrationFields(
    (raw.fieldsNormalized as CalibrationReportFields | undefined) ?? fields,
  );

  const confidence = (raw.confidence ?? Object.fromEntries(
    REPORT_FIELD_KEYS.map((k) => [k, "manual"]),
  )) as Record<ReportFieldKey, FieldConfidence>;

  const extractedFieldsRaw = finalizeExtractionFields(
    (raw.extractedFieldsRaw as CalibrationReportFields | undefined) ?? fields,
  );
  const extractedConfidence = (raw.extractedConfidence ?? confidence) as Record<
    ReportFieldKey,
    FieldConfidence
  >;

  const entry: CalibrationWorkbookEntry = {
    id: String(raw.id ?? randomUUID()),
    savedAt: String(raw.savedAt ?? new Date().toISOString()),
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : undefined,
    sourceFilename:
      typeof raw.sourceFilename === "string" ? raw.sourceFilename : undefined,
    metadata,
    fields,
    fieldsNormalized,
    confidence,
    extractedFieldsRaw,
    extractedConfidence,
    parserType: raw.parserType as CalibrationWorkbookEntry["parserType"],
    parserConfidence: raw.parserConfidence as CalibrationWorkbookEntry["parserConfidence"],
    textMethod: raw.textMethod as CalibrationWorkbookEntry["textMethod"],
    warnings: Array.isArray(raw.warnings) ? (raw.warnings as string[]) : [],
    missingFields: Array.isArray(raw.missingFields)
      ? (raw.missingFields as ReportFieldKey[])
      : listMissingFieldKeys(fields),
    parserMetadata: raw.parserMetadata as CalibrationWorkbookEntry["parserMetadata"],
    roundBrilliantScore:
      (raw.roundBrilliantScore as RoundBrilliantScoreResult | null) ?? null,
    reviewerNote:
      typeof raw.reviewerNote === "string" ? raw.reviewerNote : undefined,
    recordVersion: typeof raw.recordVersion === "number" ? raw.recordVersion : 1,
    schemaVersion:
      typeof raw.schemaVersion === "number" ? raw.schemaVersion : CALIBRATION_SCHEMA_VERSION,
    seeded: Boolean(raw.seeded),
    syntheticCalibration: Boolean(
      raw.syntheticCalibration ??
        (raw.parserMetadata as { syntheticCalibration?: boolean } | undefined)
          ?.syntheticCalibration,
    ),
    calibrationTier:
      typeof raw.calibrationTier === "string"
        ? raw.calibrationTier
        : typeof (raw.parserMetadata as { calibrationTier?: string } | undefined)
              ?.calibrationTier === "string"
          ? (raw.parserMetadata as { calibrationTier: string }).calibrationTier
          : undefined,
    fieldProvenance:
      (raw.fieldProvenance as CalibrationWorkbookEntry["fieldProvenance"]) ??
      (raw.parserMetadata as { fieldProvenance?: CalibrationWorkbookEntry["fieldProvenance"] })
        ?.fieldProvenance,
    valueProvenance:
      (raw.valueProvenance as CalibrationWorkbookEntry["valueProvenance"]) ??
      (raw.parserMetadata as { valueProvenance?: CalibrationWorkbookEntry["valueProvenance"] })
        ?.valueProvenance,
    calibrationEligible:
      typeof raw.calibrationEligible === "boolean"
        ? raw.calibrationEligible
        : undefined,
    excludedFromCalibrationStats:
      typeof raw.excludedFromCalibrationStats === "boolean"
        ? raw.excludedFromCalibrationStats
        : typeof (raw.parserMetadata as { excludedFromCalibrationStats?: boolean })
              ?.excludedFromCalibrationStats === "boolean"
          ? (raw.parserMetadata as { excludedFromCalibrationStats: boolean })
              .excludedFromCalibrationStats
          : undefined,
    corpusStatus:
      raw.corpusStatus === "quarantined" || raw.corpusStatus === "active"
        ? raw.corpusStatus
        : (raw.parserMetadata as { corpusStatus?: "active" | "quarantined" })
              ?.corpusStatus,
    quarantineReason:
      typeof raw.quarantineReason === "string"
        ? raw.quarantineReason
        : typeof (raw.parserMetadata as { quarantineReason?: string })
              ?.quarantineReason === "string"
          ? (raw.parserMetadata as { quarantineReason: string }).quarantineReason
          : undefined,
    corpusReviewFlags: Array.isArray(raw.corpusReviewFlags)
      ? (raw.corpusReviewFlags as string[])
      : Array.isArray(
            (raw.parserMetadata as { corpusReviewFlags?: string[] })
              ?.corpusReviewFlags,
          )
        ? (raw.parserMetadata as { corpusReviewFlags: string[] }).corpusReviewFlags
        : undefined,
  };
  if (entry.calibrationEligible === undefined) {
    entry.calibrationEligible = assessCalibrationSafety(entry).calibrationEligible;
  }
  if (!entry.corpusStatus) entry.corpusStatus = "active";
  return entry;
}

export async function readWorkbookFile(): Promise<CalibrationWorkbookEntry[]> {
  await ensureDataDir();
  try {
    const raw = await readFile(WORKBOOK_PATH, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((e) =>
      normalizeWorkbookEntry(e as Record<string, unknown>),
    );
  } catch {
    return [];
  }
}

export async function writeWorkbookFile(
  entries: CalibrationWorkbookEntry[],
): Promise<void> {
  await ensureDataDir();
  await writeFile(WORKBOOK_PATH, JSON.stringify(entries, null, 2), "utf8");
}

export async function findWorkbookEntryFile(
  metadata: Pick<CalibrationReportMetadata, "lab" | "reportNumber" | "reportSource">,
): Promise<CalibrationWorkbookEntry | null> {
  const { normalizeReportNumber } = await import("./field-normalization");
  const norm = normalizeReportNumber(metadata.reportNumber);
  const entries = await readWorkbookFile();
  return (
    entries.find(
      (e) =>
        e.metadata.lab === metadata.lab &&
        normalizeReportNumber(e.metadata.reportNumber) === norm &&
        e.metadata.reportSource === metadata.reportSource,
    ) ?? null
  );
}

export async function appendWorkbookEntryFile(
  entry: CalibrationWorkbookEntry,
): Promise<void> {
  const entries = await readWorkbookFile();
  entries.push(entry);
  await writeWorkbookFile(entries);
}

export async function updateWorkbookEntryFile(
  entry: CalibrationWorkbookEntry,
): Promise<void> {
  const entries = await readWorkbookFile();
  const idx = entries.findIndex((e) => e.id === entry.id);
  if (idx >= 0) {
    entries[idx] = entry;
  } else {
    entries.push(entry);
  }
  await writeWorkbookFile(entries);
}

export async function saveUpload(
  filename: string,
  bytes: Buffer,
): Promise<string> {
  await ensureDataDir();
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
  const stored = `${Date.now()}-${safe}`;
  const path = join(UPLOADS_DIR, stored);
  await writeFile(path, bytes);
  return stored;
}

/** @deprecated Use saveCalibrationEntry from ./storage */
export async function readWorkbook(): Promise<CalibrationWorkbookEntry[]> {
  return readWorkbookFile();
}

/** @deprecated Use saveCalibrationEntry from ./storage */
export async function appendWorkbookEntry(input: {
  metadata: CalibrationReportMetadata;
  fields: CalibrationReportFields;
  confidence: Record<ReportFieldKey, FieldConfidence>;
  sourceFilename?: string;
  reviewerNote?: string;
  roundBrilliantScore?: RoundBrilliantScoreResult | null;
  extractionSnapshot?: import("./types").CalibrationExtractionSnapshot;
}): Promise<CalibrationWorkbookEntry> {
  const { saveCalibrationEntry } = await import("./storage");
  const snapshot =
    input.extractionSnapshot ??
    ({
      fields: input.fields,
      confidence: input.confidence,
      warnings: [],
    } satisfies import("./types").CalibrationExtractionSnapshot);

  const result = await saveCalibrationEntry({
    metadata: input.metadata,
    fields: input.fields,
    confidence: input.confidence,
    extractionSnapshot: snapshot,
    sourceFilename: input.sourceFilename,
    reviewerNote: input.reviewerNote,
    roundBrilliantScore: input.roundBrilliantScore,
  });

  if (!result.ok) {
    throw new Error(result.message);
  }
  return result.entry;
}
