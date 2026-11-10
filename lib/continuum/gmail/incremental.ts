/**
 * Founder/secret-protected incremental Gmail current-state runner.
 * Bounded History API chunk. Kill-switched. Not registered as a cron.
 * Does not create Persons, projects, Open Jobs, memory facts, or CoS.
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
import {
  HISTORICAL_INCOMPLETE,
  HISTORY_TOO_OLD,
  GMAIL_DATABASE_FAILED,
  GMAIL_INVALID_PAGE_TOKEN,
  GMAIL_PROVIDER_FORBIDDEN,
  GMAIL_PROVIDER_TEMPORARY,
  GMAIL_PROVIDER_TIMEOUT,
  GMAIL_PROVIDER_UNAUTHORIZED,
  GMAIL_RATE_LIMITED,
  parsePendingHistoryCursor,
  runIncrementalSync,
} from "./incremental-sync";
import type { GmailAccessTokenRefresh } from "./oauth";
import type { SyncClock } from "./sync";
import type {
  ManualPreviewDiagnosticOutcome,
  ManualPreviewDiagnosticStage,
} from "./manual-preview-diagnostics";
import {
  GMAIL_INCREMENTAL_JOB_KEY,
  type GmailConnection,
  type GmailTokenCiphertext,
} from "./types";

export const GMAIL_INCREMENTAL_CHUNK_LEASE_MS = 5 * 60 * 1000;

export const GMAIL_INCREMENTAL_CHUNK_ERROR_CODES = [
  "unauthorized",
  "unavailable",
  "gmail-not-connected",
  "decrypt-failed",
  "token-refresh-failed",
  "refresh-token-rotated",
  "invalid_grant",
  "gmail-sync-already-running",
  "gmail-sync-failed",
  GMAIL_RATE_LIMITED,
  GMAIL_PROVIDER_TEMPORARY,
  GMAIL_INVALID_PAGE_TOKEN,
  GMAIL_DATABASE_FAILED,
  GMAIL_PROVIDER_TIMEOUT,
  GMAIL_PROVIDER_FORBIDDEN,
  GMAIL_PROVIDER_UNAUTHORIZED,
  "connection-inactive",
  "sync-disabled",
  HISTORICAL_INCOMPLETE,
  HISTORY_TOO_OLD,
  "gmail-history-id-missing",
] as const;

export type GmailIncrementalChunkErrorCode =
  (typeof GMAIL_INCREMENTAL_CHUNK_ERROR_CODES)[number];

export const GMAIL_INCREMENTAL_CHUNK_RESULT_KEYS = [
  "attachmentsThisChunk",
  "checkpointStatus",
  "chunkSucceeded",
  "completed",
  "deletedThisChunk",
  "historyIdPresent",
  "indexedCount",
  "indexedThisChunk",
  "initialized",
  "labelUpdatesThisChunk",
  "morePagesRemain",
  "recovery",
  "safeErrorCode",
] as const;

export type GmailIncrementalChunkResult = {
  chunkSucceeded: boolean;
  checkpointStatus: GmailCheckpointStatus;
  indexedCount: number;
  indexedThisChunk: number;
  deletedThisChunk: number;
  labelUpdatesThisChunk: number;
  attachmentsThisChunk: number;
  morePagesRemain: boolean;
  completed: boolean;
  initialized: boolean;
  recovery: boolean;
  historyIdPresent: boolean;
  safeErrorCode: string | null;
};

export type GmailIncrementalChunkInput = {
  founderSessionOk: boolean;
  secretProtectedOk?: boolean;
  enabled: boolean;
  connections: GmailConnectionStore;
  index: GmailIndexStore;
  attachments: GmailAttachmentStore;
  decryptRefreshToken: (wrapped: GmailTokenCiphertext) => string;
  refreshAccessToken: (refreshToken: string) => Promise<GmailAccessTokenRefresh>;
  createApi: (accessToken: string) => GmailApi;
  clock?: SyncClock;
  maxGetsPerSec?: number;
  maxRetries?: number;
  retryJitterRatio?: number;
  maxRetryDelayMs?: number;
  retryRandom?: () => number;
  diagnostic?: (record: {
    stage: ManualPreviewDiagnosticStage;
    outcome: ManualPreviewDiagnosticOutcome;
    code: string | null;
  }) => void;
};

function reportIncrementalDiagnostic(
  input: GmailIncrementalChunkInput,
  stage: ManualPreviewDiagnosticStage,
  outcome: ManualPreviewDiagnosticOutcome,
  code: string | null = null,
): void {
  try {
    input.diagnostic?.({ stage, outcome, code });
  } catch {
    // Diagnostics must never change ingestion behavior.
  }
}

function isIncrementalErrorCode(
  value: string | null,
): value is GmailIncrementalChunkErrorCode {
  return (
    typeof value === "string" &&
    (GMAIL_INCREMENTAL_CHUNK_ERROR_CODES as readonly string[]).includes(value)
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

export function gmailIncrementalChunkResultKeys(
  result: GmailIncrementalChunkResult,
): readonly string[] {
  return Object.keys(result).sort();
}

export function sanitizeGmailIncrementalChunkResult(
  raw: GmailIncrementalChunkResult,
): GmailIncrementalChunkResult {
  const checkpointStatus = isCheckpointStatus(raw.checkpointStatus)
    ? raw.checkpointStatus
    : "idle";
  const nonNeg = (value: number) =>
    Number.isFinite(value) && value >= 0 ? Math.trunc(value) : 0;
  const safeErrorCode =
    typeof raw.safeErrorCode === "string" && isIncrementalErrorCode(raw.safeErrorCode)
      ? raw.safeErrorCode
      : raw.safeErrorCode
        ? "gmail-sync-failed"
        : null;
  return {
    chunkSucceeded: Boolean(raw.chunkSucceeded),
    checkpointStatus,
    indexedCount: nonNeg(raw.indexedCount),
    indexedThisChunk: nonNeg(raw.indexedThisChunk),
    deletedThisChunk: nonNeg(raw.deletedThisChunk),
    labelUpdatesThisChunk: nonNeg(raw.labelUpdatesThisChunk),
    attachmentsThisChunk: nonNeg(raw.attachmentsThisChunk),
    morePagesRemain: Boolean(raw.morePagesRemain),
    completed: Boolean(raw.completed),
    initialized: Boolean(raw.initialized),
    recovery: Boolean(raw.recovery),
    historyIdPresent: Boolean(raw.historyIdPresent),
    safeErrorCode,
  };
}

export function failedGmailIncrementalChunk(
  code: GmailIncrementalChunkErrorCode,
  extras: Partial<GmailIncrementalChunkResult> = {},
): GmailIncrementalChunkResult {
  return sanitizeGmailIncrementalChunkResult({
    chunkSucceeded: false,
    checkpointStatus: extras.checkpointStatus ?? "failed",
    indexedCount: extras.indexedCount ?? 0,
    indexedThisChunk: extras.indexedThisChunk ?? 0,
    deletedThisChunk: extras.deletedThisChunk ?? 0,
    labelUpdatesThisChunk: extras.labelUpdatesThisChunk ?? 0,
    attachmentsThisChunk: extras.attachmentsThisChunk ?? 0,
    morePagesRemain: extras.morePagesRemain ?? false,
    completed: false,
    initialized: extras.initialized ?? false,
    recovery: extras.recovery ?? code === HISTORY_TOO_OLD,
    historyIdPresent: extras.historyIdPresent ?? false,
    safeErrorCode: code,
  });
}

export function snapshotFromIncrementalCheckpoint(
  row: GmailCheckpoint | null,
): GmailIncrementalChunkResult {
  if (!row) {
    return sanitizeGmailIncrementalChunkResult({
      chunkSucceeded: false,
      checkpointStatus: "idle",
      indexedCount: 0,
      indexedThisChunk: 0,
      deletedThisChunk: 0,
      labelUpdatesThisChunk: 0,
      attachmentsThisChunk: 0,
      morePagesRemain: false,
      completed: false,
      initialized: false,
      recovery: false,
      historyIdPresent: false,
      safeErrorCode: null,
    });
  }
  const completed = row.status === "completed" && row.pageToken == null && Boolean(row.historyId);
  const morePagesRemain = Boolean(row.pageToken);
  const recovery =
    row.errorCode === HISTORY_TOO_OLD ||
    Boolean(parsePendingHistoryCursor(row.cursorMessageId));
  return sanitizeGmailIncrementalChunkResult({
    chunkSucceeded: row.status !== "failed",
    checkpointStatus: row.status,
    indexedCount: row.indexedCount,
    indexedThisChunk: 0,
    deletedThisChunk: 0,
    labelUpdatesThisChunk: 0,
    attachmentsThisChunk: 0,
    morePagesRemain,
    completed,
    initialized: Boolean(row.historyId) && row.status === "completed",
    recovery,
    historyIdPresent: Boolean(row.historyId),
    safeErrorCode:
      row.errorCode && row.errorCode !== GMAIL_SYNC_ALREADY_RUNNING
        ? row.errorCode
        : null,
  });
}

function boundIncrementalApi(api: GmailApi): GmailApi {
  return {
    getProfile: () => api.getProfile(),
    listHistory: (query) => api.listHistory(query),
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

export async function runGmailIncrementalChunk(
  input: GmailIncrementalChunkInput,
): Promise<GmailIncrementalChunkResult> {
  reportIncrementalDiagnostic(input, "preflight", "started");
  if (!input.founderSessionOk && !input.secretProtectedOk) {
    reportIncrementalDiagnostic(input, "preflight", "blocked", "unauthorized");
    return failedGmailIncrementalChunk("unauthorized", { checkpointStatus: "idle" });
  }
  if (!input.enabled) {
    reportIncrementalDiagnostic(input, "preflight", "blocked", "sync-disabled");
    return failedGmailIncrementalChunk("sync-disabled", { checkpointStatus: "idle" });
  }

  let connection: GmailConnection | null;
  try {
    connection = await input.connections.getFounderConnection();
  } catch {
    reportIncrementalDiagnostic(input, "preflight", "failed", "unavailable");
    return failedGmailIncrementalChunk("unavailable", { checkpointStatus: "idle" });
  }
  if (!isConnectedCredential(connection) || !isSyncEligible(connection)) {
    reportIncrementalDiagnostic(input, "preflight", "blocked", "gmail-not-connected");
    return failedGmailIncrementalChunk("gmail-not-connected", {
      checkpointStatus: "idle",
    });
  }
  reportIncrementalDiagnostic(input, "preflight", "succeeded", "ok");

  let before: GmailCheckpoint | null;
  try {
    before = await input.index.getCheckpoint(GMAIL_INCREMENTAL_JOB_KEY);
  } catch (error) {
    reportIncrementalDiagnostic(
      input,
      "checkpoint-persistence",
      "failed",
      GMAIL_DATABASE_FAILED,
    );
    throw error;
  }
  const nowIso = (input.clock?.now() ?? new Date()).toISOString();
  reportIncrementalDiagnostic(input, "lease-acquisition", "started");
  let claimed: boolean;
  try {
    claimed = await input.index.tryClaimIncrementalChunk(
      nowIso,
      GMAIL_INCREMENTAL_CHUNK_LEASE_MS,
    );
  } catch (error) {
    reportIncrementalDiagnostic(
      input,
      "checkpoint-persistence",
      "failed",
      GMAIL_DATABASE_FAILED,
    );
    throw error;
  }
  if (!claimed) {
    reportIncrementalDiagnostic(
      input,
      "lease-acquisition",
      "blocked",
      "gmail-sync-already-running",
    );
    return failedGmailIncrementalChunk("gmail-sync-already-running", {
      checkpointStatus: before?.status ?? "running",
      indexedCount: before?.indexedCount ?? 0,
      morePagesRemain: Boolean(before?.pageToken),
      historyIdPresent: Boolean(before?.historyId),
      recovery: before?.errorCode === HISTORY_TOO_OLD,
    });
  }
  reportIncrementalDiagnostic(input, "lease-acquisition", "succeeded", "ok");

  let attachmentsThisChunk = 0;
  const attachments: GmailAttachmentStore = {
    putAttachment: async (row) => {
      attachmentsThisChunk += 1;
      return input.attachments.putAttachment(row);
    },
    listByMessage: (messageId) => input.attachments.listByMessage(messageId),
    listByThread: (threadId) => input.attachments.listByThread(threadId),
    listByThreadIds: (threadIds) => input.attachments.listByThreadIds(threadIds),
    listByFilenameTokens: (tokens) =>
      input.attachments.listByFilenameTokens(tokens),
    deleteByMessage: (messageId) => input.attachments.deleteByMessage(messageId),
  };

  try {
    let refreshToken: string;
    try {
      refreshToken = input.decryptRefreshToken(connection.refreshToken);
    } catch {
      reportIncrementalDiagnostic(input, "preflight", "failed", "decrypt-failed");
      return failedGmailIncrementalChunk(
        "decrypt-failed",
        snapshotFromIncrementalCheckpoint(before),
      );
    }
    if (!refreshToken) {
      reportIncrementalDiagnostic(input, "preflight", "failed", "decrypt-failed");
      return failedGmailIncrementalChunk(
        "decrypt-failed",
        snapshotFromIncrementalCheckpoint(before),
      );
    }

    reportIncrementalDiagnostic(input, "provider-fetch", "started");
    let refreshed: GmailAccessTokenRefresh;
    try {
      refreshed = await input.refreshAccessToken(refreshToken);
    } catch (error) {
      reportIncrementalDiagnostic(
        input,
        "provider-fetch",
        "failed",
        GMAIL_PROVIDER_TEMPORARY,
      );
      throw error;
    }
    if (!refreshed.ok) {
      const code =
        refreshed.error === "refresh-token-rotated"
          ? "refresh-token-rotated"
          : refreshed.error === "oauth-not-configured"
            ? "unavailable"
            : "token-refresh-failed";
      reportIncrementalDiagnostic(input, "provider-fetch", "failed", code);
      return failedGmailIncrementalChunk(
        code,
        snapshotFromIncrementalCheckpoint(before),
      );
    }

    let sync: Awaited<ReturnType<typeof runIncrementalSync>>;
    try {
      sync = await runIncrementalSync({
        api: boundIncrementalApi(input.createApi(refreshed.accessToken)),
        index: input.index,
        attachments,
        connections: input.connections,
        founderMailboxHash: connection.mailboxEmailHash,
        clock: input.clock,
        maxGetsPerSec: input.maxGetsPerSec,
        maxRetries: input.maxRetries,
        retryJitterRatio: input.retryJitterRatio,
        maxRetryDelayMs: input.maxRetryDelayMs,
        retryRandom: input.retryRandom,
      });
    } catch (error) {
      reportIncrementalDiagnostic(input, "provider-fetch", "failed", "unexpected");
      throw error;
    }

    let after: GmailCheckpoint | null;
    try {
      after = await input.index.getCheckpoint(GMAIL_INCREMENTAL_JOB_KEY);
    } catch (error) {
      reportIncrementalDiagnostic(
        input,
        "checkpoint-persistence",
        "failed",
        GMAIL_DATABASE_FAILED,
      );
      throw error;
    }
    if (sync.errorCode === GMAIL_DATABASE_FAILED) {
      reportIncrementalDiagnostic(
        input,
        "checkpoint-persistence",
        "failed",
        GMAIL_DATABASE_FAILED,
      );
    } else if (sync.errorCode) {
      reportIncrementalDiagnostic(input, "provider-fetch", "failed", sync.errorCode);
    } else {
      reportIncrementalDiagnostic(input, "provider-fetch", "succeeded", "ok");
      reportIncrementalDiagnostic(
        input,
        "checkpoint-persistence",
        "succeeded",
        "ok",
      );
    }
    if (sync.errorCode === "invalid_grant" || sync.status === "revoked") {
      return failedGmailIncrementalChunk("invalid_grant", {
        ...snapshotFromIncrementalCheckpoint(after),
        indexedThisChunk: sync.insertedCount,
        deletedThisChunk: sync.deletedCount,
        labelUpdatesThisChunk: sync.labelUpdateCount,
        attachmentsThisChunk,
        recovery: sync.recovery,
      });
    }
    if (sync.status === "paused") {
      return failedGmailIncrementalChunk("connection-inactive", {
        ...snapshotFromIncrementalCheckpoint(after ?? before),
        indexedThisChunk: sync.insertedCount,
        deletedThisChunk: sync.deletedCount,
        labelUpdatesThisChunk: sync.labelUpdateCount,
        attachmentsThisChunk,
      });
    }
    if (sync.status === "blocked") {
      return failedGmailIncrementalChunk(HISTORICAL_INCOMPLETE, {
        ...snapshotFromIncrementalCheckpoint(after ?? before),
        checkpointStatus: after?.status ?? "idle",
      });
    }
    if (sync.status === "failed" || after?.status === "failed") {
      const code = isIncrementalErrorCode(sync.errorCode)
        ? sync.errorCode
        : "gmail-sync-failed";
      return failedGmailIncrementalChunk(code, {
        ...snapshotFromIncrementalCheckpoint(after),
        indexedThisChunk: sync.insertedCount,
        deletedThisChunk: sync.deletedCount,
        labelUpdatesThisChunk: sync.labelUpdateCount,
        attachmentsThisChunk,
        recovery: sync.recovery,
      });
    }

    const snapshot = snapshotFromIncrementalCheckpoint(after);
    return sanitizeGmailIncrementalChunkResult({
      ...snapshot,
      chunkSucceeded: true,
      indexedThisChunk: sync.insertedCount,
      deletedThisChunk: sync.deletedCount,
      labelUpdatesThisChunk: sync.labelUpdateCount,
      attachmentsThisChunk,
      initialized: sync.initialized,
      recovery: sync.recovery,
      morePagesRemain: sync.status === "running" || snapshot.morePagesRemain,
      completed: sync.status === "completed" && snapshot.completed,
    });
  } finally {
    try {
      await input.index.releaseIncrementalChunk(
        (input.clock?.now() ?? new Date()).toISOString(),
      );
    } catch (error) {
      reportIncrementalDiagnostic(
        input,
        "checkpoint-persistence",
        "failed",
        GMAIL_DATABASE_FAILED,
      );
      throw error;
    }
  }
}
