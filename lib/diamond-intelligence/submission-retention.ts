/**
 * Diamond Intelligence submission retention — single source of truth.
 * Cleanup eligibility is based on created_at age, not the textual policy field alone.
 */

export const DI_SUBMISSION_RETENTION_DAYS = 30;
export const DI_SUBMISSION_RETENTION_POLICY = "30_days" as const;
/** Bounded daily cleanup batch — prefer repeated runs over unbounded sweeps. */
export const DI_SUBMISSION_CLEANUP_BATCH_SIZE = 100;

export type DiSubmissionRetentionPolicy = typeof DI_SUBMISSION_RETENTION_POLICY;

export function diSubmissionRetentionMs(
  days: number = DI_SUBMISSION_RETENTION_DAYS,
): number {
  return days * 24 * 60 * 60 * 1000;
}

/** ISO expiry timestamp = createdAt + retention window. */
export function computeDiSubmissionExpiry(
  createdAt: Date | string | number = new Date(),
  nowMs?: number,
): string {
  const baseMs =
    typeof createdAt === "number"
      ? createdAt
      : typeof createdAt === "string"
        ? Date.parse(createdAt)
        : createdAt.getTime();
  const anchor = Number.isFinite(baseMs) ? baseMs : (nowMs ?? Date.now());
  return new Date(anchor + diSubmissionRetentionMs()).toISOString();
}

/** Cutoff ISO: rows with created_at strictly before this are expired. */
export function diSubmissionExpiryCutoff(nowMs = Date.now()): string {
  return new Date(nowMs - diSubmissionRetentionMs()).toISOString();
}

/**
 * True when the submission is older than the retention window.
 * Uses creation timestamp only — works for legacy `indefinite` rows too.
 */
export function isDiSubmissionExpired(
  createdAt: string,
  nowMs = Date.now(),
): boolean {
  const createdMs = Date.parse(createdAt);
  if (!Number.isFinite(createdMs)) return false;
  return createdMs <= nowMs - diSubmissionRetentionMs();
}

export type DiSubmissionCleanupCandidate = {
  id: string;
  filePath: string | null;
  createdAt: string;
};

export type DiSubmissionCleanupResult = {
  scanned: number;
  expired: number;
  storageDeleted: number;
  rowsDeleted: number;
  alreadyMissing: number;
  failed: number;
};

export type DiSubmissionCleanupDeps = {
  listExpired: (
    cutoffIso: string,
    limit: number,
  ) => Promise<DiSubmissionCleanupCandidate[]>;
  /** Delete storage object; treat already-absent as success. */
  deleteStorageObject: (
    objectPath: string,
  ) => Promise<"deleted" | "already_missing">;
  deleteRow: (id: string) => Promise<void>;
  nowMs?: number;
  batchSize?: number;
};

/**
 * Idempotent cleanup orchestration:
 * 1) list expired by created_at
 * 2) delete storage first (missing = ok)
 * 3) delete row only after storage is gone or was never present
 * 4) retain row when storage deletion fails
 */
export async function runDiSubmissionCleanup(
  deps: DiSubmissionCleanupDeps,
): Promise<DiSubmissionCleanupResult> {
  const result: DiSubmissionCleanupResult = {
    scanned: 0,
    expired: 0,
    storageDeleted: 0,
    rowsDeleted: 0,
    alreadyMissing: 0,
    failed: 0,
  };

  const nowMs = deps.nowMs ?? Date.now();
  const batchSize = deps.batchSize ?? DI_SUBMISSION_CLEANUP_BATCH_SIZE;
  const cutoff = diSubmissionExpiryCutoff(nowMs);

  let candidates: DiSubmissionCleanupCandidate[];
  try {
    candidates = await deps.listExpired(cutoff, batchSize);
  } catch {
    result.failed += 1;
    return result;
  }

  result.scanned = candidates.length;
  result.expired = candidates.length;

  for (const candidate of candidates) {
    try {
      if (candidate.filePath) {
        const storageOutcome = await deps.deleteStorageObject(candidate.filePath);
        if (storageOutcome === "already_missing") {
          result.alreadyMissing += 1;
        } else {
          result.storageDeleted += 1;
        }
      } else {
        result.alreadyMissing += 1;
      }

      await deps.deleteRow(candidate.id);
      result.rowsDeleted += 1;
    } catch {
      result.failed += 1;
    }
  }

  return result;
}

/** True when a storage remove error indicates the object is already gone. */
export function isMissingStorageObjectError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("not found") ||
    m.includes("does not exist") ||
    m.includes("no such file") ||
    m.includes("404") ||
    m.includes("object not found")
  );
}
