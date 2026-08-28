/**
 * Founder-only one-page historical Gmail chunk runner.
 * Calls existing runHistoricalSync with a hard-coded maxPages of 1.
 * Does not accept q, window, or page count from the caller.
 */

import type { GmailIndexStore } from "@/lib/continuum/client-memory/gmail/store";
import {
  GMAIL_SYNC_ALREADY_RUNNING,
  type GmailCheckpoint,
  type GmailCheckpointStatus,
} from "@/lib/continuum/client-memory/gmail/types";
import type { GmailApi } from "./adapter";
import type { GmailAttachmentStore } from "./attachments";
import type { GmailConnectionStore } from "./connection";
import { isSyncEligible } from "./connection";
import type { GmailAccessTokenRefresh } from "./oauth";
import { runHistoricalSync, type SyncClock } from "./sync";
import {
  GMAIL_HISTORICAL_JOB_KEY,
  GMAIL_SYNC_PAGE_SIZE,
  type GmailConnection,
  type GmailTokenCiphertext,
} from "./types";

export const GMAIL_HISTORY_CHUNK_MAX_PAGES = 1 as const;
export const GMAIL_HISTORY_CHUNK_LEASE_MS = 5 * 60 * 1000;

export const GMAIL_HISTORY_CHUNK_ERROR_CODES = [
  "unauthorized",
  "unavailable",
  "gmail-not-connected",
  "decrypt-failed",
  "token-refresh-failed",
  "refresh-token-rotated",
  "invalid_grant",
  "gmail-sync-already-running",
  "gmail-sync-failed",
  "connection-inactive",
] as const;

export type GmailHistoryChunkErrorCode =
  (typeof GMAIL_HISTORY_CHUNK_ERROR_CODES)[number];

export const GMAIL_HISTORY_CHUNK_RESULT_KEYS = [
  "attachmentsThisChunk",
  "checkpointStatus",
  "chunkSucceeded",
  "completed",
  "indexedCount",
  "indexedThisChunk",
  "morePagesRemain",
  "safeErrorCode",
  "windowEnd",
  "windowStart",
] as const;

export type GmailHistoryChunkResult = {
  chunkSucceeded: boolean;
  checkpointStatus: GmailCheckpointStatus;
  indexedCount: number;
  indexedThisChunk: number;
  attachmentsThisChunk: number;
  morePagesRemain: boolean;
  completed: boolean;
  windowStart: string | null;
  windowEnd: string | null;
  safeErrorCode: string | null;
};

export type GmailHistoryChunkInput = {
  founderSessionOk: boolean;
  connections: GmailConnectionStore;
  index: GmailIndexStore;
  attachments: GmailAttachmentStore;
  decryptRefreshToken: (wrapped: GmailTokenCiphertext) => string;
  refreshAccessToken: (refreshToken: string) => Promise<GmailAccessTokenRefresh>;
  createApi: (accessToken: string) => GmailApi;
  clock?: SyncClock;
};

function isHistoryErrorCode(value: string | null): value is GmailHistoryChunkErrorCode {
  return (
    typeof value === "string" &&
    (GMAIL_HISTORY_CHUNK_ERROR_CODES as readonly string[]).includes(value)
  );
}

function isCheckpointStatus(value: string | null): value is GmailCheckpointStatus {
  return (
    value === "idle" ||
    value === "running" ||
    value === "failed" ||
    value === "completed"
  );
}

export function dateOnly(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const match = iso.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

export function gmailHistoryChunkResultKeys(
  result: GmailHistoryChunkResult,
): readonly string[] {
  return Object.keys(result).sort();
}

export function sanitizeGmailHistoryChunkResult(
  raw: GmailHistoryChunkResult,
): GmailHistoryChunkResult {
  const checkpointStatus = isCheckpointStatus(raw.checkpointStatus)
    ? raw.checkpointStatus
    : "idle";
  const indexedCount =
    Number.isFinite(raw.indexedCount) && raw.indexedCount >= 0
      ? Math.trunc(raw.indexedCount)
      : 0;
  const indexedThisChunk =
    Number.isFinite(raw.indexedThisChunk) && raw.indexedThisChunk >= 0
      ? Math.trunc(raw.indexedThisChunk)
      : 0;
  const attachmentsThisChunk =
    Number.isFinite(raw.attachmentsThisChunk) && raw.attachmentsThisChunk >= 0
      ? Math.trunc(raw.attachmentsThisChunk)
      : 0;
  const safeErrorCode =
    typeof raw.safeErrorCode === "string" && isHistoryErrorCode(raw.safeErrorCode)
      ? raw.safeErrorCode
      : raw.safeErrorCode
        ? "gmail-sync-failed"
        : null;
  return {
    chunkSucceeded: Boolean(raw.chunkSucceeded),
    checkpointStatus,
    indexedCount,
    indexedThisChunk,
    attachmentsThisChunk,
    morePagesRemain: Boolean(raw.morePagesRemain),
    completed: Boolean(raw.completed),
    windowStart: dateOnly(raw.windowStart),
    windowEnd: dateOnly(raw.windowEnd),
    safeErrorCode,
  };
}

export function failedGmailHistoryChunk(
  code: GmailHistoryChunkErrorCode,
  extras: Partial<GmailHistoryChunkResult> = {},
): GmailHistoryChunkResult {
  return sanitizeGmailHistoryChunkResult({
    chunkSucceeded: false,
    checkpointStatus: extras.checkpointStatus ?? "failed",
    indexedCount: extras.indexedCount ?? 0,
    indexedThisChunk: extras.indexedThisChunk ?? 0,
    attachmentsThisChunk: extras.attachmentsThisChunk ?? 0,
    morePagesRemain: extras.morePagesRemain ?? false,
    completed: false,
    windowStart: extras.windowStart ?? null,
    windowEnd: extras.windowEnd ?? null,
    safeErrorCode: code,
  });
}

export function snapshotFromCheckpoint(
  row: GmailCheckpoint | null,
): GmailHistoryChunkResult {
  if (!row) {
    return sanitizeGmailHistoryChunkResult({
      chunkSucceeded: false,
      checkpointStatus: "idle",
      indexedCount: 0,
      indexedThisChunk: 0,
      attachmentsThisChunk: 0,
      morePagesRemain: false,
      completed: false,
      windowStart: null,
      windowEnd: null,
      safeErrorCode: null,
    });
  }
  const completed = row.status === "completed" && row.pageToken == null;
  const morePagesRemain = row.status === "running" && Boolean(row.pageToken);
  return sanitizeGmailHistoryChunkResult({
    chunkSucceeded: row.status !== "failed",
    checkpointStatus: row.status,
    indexedCount: row.indexedCount,
    indexedThisChunk: 0,
    attachmentsThisChunk: 0,
    morePagesRemain,
    completed,
    windowStart: row.windowStart,
    windowEnd: row.windowEnd,
    safeErrorCode:
      row.errorCode && row.errorCode !== GMAIL_SYNC_ALREADY_RUNNING
        ? row.errorCode
        : null,
  });
}

function boundApi(api: GmailApi): GmailApi {
  return {
    getProfile: () => api.getProfile(),
    listMessages: (query) => api.listMessages(query),
    getMessage: (messageId) => api.getMessage(messageId),
    getThread: async () => {
      throw new Error("threads.get-forbidden");
    },
  };
}

function isConnectedCredential(
  row: GmailConnection | null,
): row is GmailConnection & { refreshToken: GmailTokenCiphertext } {
  return Boolean(row && row.status === "connected" && row.refreshToken);
}

export async function runGmailHistoryChunk(
  input: GmailHistoryChunkInput,
): Promise<GmailHistoryChunkResult> {
  if (!input.founderSessionOk) {
    return failedGmailHistoryChunk("unauthorized", { checkpointStatus: "idle" });
  }

  let connection: GmailConnection | null;
  try {
    connection = await input.connections.getFounderConnection();
  } catch {
    return failedGmailHistoryChunk("unavailable", { checkpointStatus: "idle" });
  }
  if (!isConnectedCredential(connection) || !isSyncEligible(connection)) {
    return failedGmailHistoryChunk("gmail-not-connected", {
      checkpointStatus: "idle",
    });
  }

  const before = await input.index.getCheckpoint(GMAIL_HISTORICAL_JOB_KEY);
  if (before?.status === "completed" && before.pageToken == null) {
    return snapshotFromCheckpoint(before);
  }

  const nowIso = (input.clock?.now() ?? new Date()).toISOString();
  const claimed = await input.index.tryClaimHistoricalChunk(
    nowIso,
    GMAIL_HISTORY_CHUNK_LEASE_MS,
  );
  if (!claimed) {
    return failedGmailHistoryChunk("gmail-sync-already-running", {
      checkpointStatus: before?.status ?? "running",
      indexedCount: before?.indexedCount ?? 0,
      morePagesRemain: Boolean(before?.pageToken),
      windowStart: before?.windowStart,
      windowEnd: before?.windowEnd,
    });
  }

  let attachmentsThisChunk = 0;
  const attachments: GmailAttachmentStore = {
    putAttachment: async (row) => {
      attachmentsThisChunk += 1;
      return input.attachments.putAttachment(row);
    },
    listByMessage: (messageId) => input.attachments.listByMessage(messageId),
  };

  try {
    let refreshToken: string;
    try {
      refreshToken = input.decryptRefreshToken(connection.refreshToken);
    } catch {
      return failedGmailHistoryChunk("decrypt-failed", snapshotFromCheckpoint(before));
    }
    if (!refreshToken) {
      return failedGmailHistoryChunk("decrypt-failed", snapshotFromCheckpoint(before));
    }

    const refreshed = await input.refreshAccessToken(refreshToken);
    if (!refreshed.ok) {
      const code =
        refreshed.error === "refresh-token-rotated"
          ? "refresh-token-rotated"
          : refreshed.error === "oauth-not-configured"
            ? "unavailable"
            : "token-refresh-failed";
      return failedGmailHistoryChunk(code, snapshotFromCheckpoint(before));
    }

    const sync = await runHistoricalSync({
      api: boundApi(input.createApi(refreshed.accessToken)),
      index: input.index,
      attachments,
      connections: input.connections,
      founderMailboxHash: connection.mailboxEmailHash,
      clock: input.clock,
      pageSize: GMAIL_SYNC_PAGE_SIZE,
      maxPages: GMAIL_HISTORY_CHUNK_MAX_PAGES,
    });

    const after = await input.index.getCheckpoint(GMAIL_HISTORICAL_JOB_KEY);
    const indexedThisChunk = Math.max(
      0,
      (after?.indexedCount ?? 0) - (before?.indexedCount ?? 0),
    );
    if (sync.errorCode === "invalid_grant" || sync.status === "revoked") {
      return failedGmailHistoryChunk("invalid_grant", {
        ...snapshotFromCheckpoint(after),
        indexedThisChunk,
        attachmentsThisChunk,
      });
    }
    if (sync.status === "paused") {
      return failedGmailHistoryChunk("connection-inactive", {
        ...snapshotFromCheckpoint(after ?? before),
        indexedThisChunk,
        attachmentsThisChunk,
      });
    }
    if (sync.status === "failed" || after?.status === "failed") {
      const code = isHistoryErrorCode(sync.errorCode)
        ? sync.errorCode
        : "gmail-sync-failed";
      return failedGmailHistoryChunk(code, {
        ...snapshotFromCheckpoint(after),
        indexedThisChunk,
        attachmentsThisChunk,
      });
    }

    const snapshot = snapshotFromCheckpoint(after);
    return sanitizeGmailHistoryChunkResult({
      ...snapshot,
      chunkSucceeded: true,
      indexedThisChunk,
      attachmentsThisChunk,
    });
  } finally {
    await input.index.releaseHistoricalChunk(
      (input.clock?.now() ?? new Date()).toISOString(),
    );
  }
}
