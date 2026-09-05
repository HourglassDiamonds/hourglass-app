/**
 * Read-only incremental Gmail sync via users.history.list.
 * Messages first. Checkpoint second. Never advance historyId past unindexed
 * provider history. Does not create Persons, projects, Open Jobs, or CoS.
 * Does not call attachments.get, send, draft, or modify.
 */

import type { GmailIndexStore } from "@/lib/continuum/client-memory/gmail/store";
import type { GmailCheckpoint } from "@/lib/continuum/client-memory/gmail/types";
import { GMAIL_SYNC_ALREADY_RUNNING } from "@/lib/continuum/client-memory/gmail/types";
import type { GmailApi } from "./adapter";
import {
  isGmailNotFoundError,
  isHistoryTooOldError,
  isRetryableGmailError,
  retryDelayMs,
} from "./adapter";
import type { GmailAttachmentStore } from "./attachments";
import type { GmailConnectionStore } from "./connection";
import { applyInvalidGrant, isSyncEligible } from "./connection";
import { gmailMessageDirection } from "./direction";
import { emitGmailTelemetry, type GmailTelemetrySink, noopGmailTelemetry } from "./logging";
import {
  extractAttachmentMetadata,
  parseGmailAddresses,
  parseGmailSubject,
  sentAtFromInternalDate,
} from "./payload";
import { defaultSyncClock, historicalGmailQuery, type SyncClock } from "./sync";
import {
  GMAIL_HISTORICAL_JOB_KEY,
  GMAIL_HISTORY_TYPES,
  GMAIL_INCREMENTAL_HISTORY_PAGE_SIZE,
  GMAIL_INCREMENTAL_JOB_KEY,
  GMAIL_SYNC_MAX_GETS_PER_SEC,
  type GmailApiMessage,
  type GmailHistoryMessageRef,
  type GmailHistoryRecord,
} from "./types";

export const GMAIL_INCREMENTAL_CHUNK_MAX_PAGES = 1 as const;
export const HISTORY_TOO_OLD = "history-too-old" as const;
export const HISTORICAL_INCOMPLETE = "historical-incomplete" as const;

/**
 * Catch-up holds a captured profile historyId in cursorMessageId until every
 * overlap list page is indexed. historyId stays the last *active* cursor
 * (null on init, expired id during recovery). Prefix is not a Gmail message id,
 * so normal History API drains remain unambiguous.
 */
export const PENDING_HISTORY_CURSOR_PREFIX = "pending-history:" as const;

export function encodePendingHistoryCursor(historyId: string): string {
  return `${PENDING_HISTORY_CURSOR_PREFIX}${historyId}`;
}

export function parsePendingHistoryCursor(
  cursorMessageId: string | null,
): string | null {
  if (!cursorMessageId?.startsWith(PENDING_HISTORY_CURSOR_PREFIX)) return null;
  const id = cursorMessageId.slice(PENDING_HISTORY_CURSOR_PREFIX.length).trim();
  return id || null;
}

export type IncrementalSyncDeps = {
  api: GmailApi;
  index: GmailIndexStore;
  attachments: GmailAttachmentStore;
  connections: GmailConnectionStore;
  founderMailboxHash: string;
  telemetry?: GmailTelemetrySink;
  clock?: SyncClock;
  maxGetsPerSec?: number;
  pageSize?: number;
  maxRetries?: number;
  maxPages?: number;
};

export type IncrementalSyncResult = {
  status:
    | "completed"
    | "running"
    | "failed"
    | "paused"
    | "revoked"
    | "disconnected"
    | "blocked";
  indexedCount: number;
  insertedCount: number;
  deletedCount: number;
  labelUpdateCount: number;
  initialized: boolean;
  recovery: boolean;
  errorCode: string | null;
};

type PageCounts = {
  inserted: number;
  deleted: number;
  labelUpdates: number;
};

function getMinIntervalMs(maxGetsPerSec: number): number {
  return Math.ceil(1000 / maxGetsPerSec);
}

async function withRetry<T>(
  clock: SyncClock,
  maxRetries: number,
  work: () => Promise<T>,
): Promise<T> {
  let attempt = 0;
  for (;;) {
    try {
      return await work();
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message === "invalid_grant" || error.message.includes("invalid_grant"))
      ) {
        throw error;
      }
      if (!isRetryableGmailError(error) || attempt >= maxRetries) throw error;
      await clock.sleep(retryDelayMs(error, attempt));
      attempt += 1;
    }
  }
}

function leaseError(existing: GmailCheckpoint): string | null {
  return existing.errorCode === GMAIL_SYNC_ALREADY_RUNNING
    ? GMAIL_SYNC_ALREADY_RUNNING
    : null;
}

function emptyIncremental(nowIso: string): GmailCheckpoint {
  return {
    jobKey: GMAIL_INCREMENTAL_JOB_KEY,
    status: "idle",
    windowStart: null,
    windowEnd: null,
    pageToken: null,
    historyId: null,
    cursorMessageId: null,
    indexedCount: 0,
    updatedAt: nowIso,
    errorCode: null,
  };
}

export function isMailboxIndexedView(labelIds: readonly string[] | undefined): boolean {
  const labels = new Set((labelIds ?? []).map((label) => label.trim().toUpperCase()));
  if (labels.has("TRASH") || labels.has("SPAM")) return false;
  return labels.has("INBOX") || labels.has("SENT");
}

function needsCatchUp(row: GmailCheckpoint): boolean {
  if (parsePendingHistoryCursor(row.cursorMessageId)) return true;
  if (row.errorCode === HISTORY_TOO_OLD) return true;
  return !row.historyId;
}

/**
 * Index represents currently observed Inbox/Sent metadata for the founder
 * mailbox, not a Gmail replica. Spam/trash is dropped. Deleted source mail
 * is removed from the index (no tombstone column).
 */
export function catchUpAfterDate(historical: GmailCheckpoint | null, now: Date): Date {
  if (historical?.updatedAt) {
    const done = new Date(historical.updatedAt);
    if (!Number.isNaN(done.getTime())) return done;
  }
  if (historical?.windowEnd) {
    const end = new Date(historical.windowEnd);
    if (!Number.isNaN(end.getTime())) return end;
  }
  return now;
}

async function dropFromIndex(
  index: GmailIndexStore,
  attachments: GmailAttachmentStore,
  messageId: string,
): Promise<"deleted" | "already-absent"> {
  const result = await index.deleteMessage(messageId);
  await attachments.deleteByMessage(messageId);
  return result;
}

async function persistFetchedMessage(
  deps: IncrementalSyncDeps,
  message: GmailApiMessage,
  nowIso: string,
): Promise<"inserted" | "updated" | "already-present" | "dropped"> {
  if (!isMailboxIndexedView(message.labelIds)) {
    await dropFromIndex(deps.index, deps.attachments, message.id);
    return "dropped";
  }
  const addresses = parseGmailAddresses(message);
  const sentAt = sentAtFromInternalDate(message);
  const indexed = await deps.index.indexMessage(
    {
      messageId: message.id,
      threadId: message.threadId,
      sentAt,
      subject: parseGmailSubject(message),
      fromEmail: addresses.fromEmail,
      toEmails: addresses.toEmails,
      ccEmails: addresses.ccEmails,
      bccEmails: addresses.bccEmails,
      direction: gmailMessageDirection({
        labelIds: message.labelIds ?? [],
        fromEmail: addresses.fromEmail,
        founderMailboxHash: deps.founderMailboxHash,
      }),
      labelIds: [...(message.labelIds ?? [])],
      hasAttachments: extractAttachmentMetadata(message, nowIso).length > 0,
    },
    nowIso,
  );
  for (const attachment of extractAttachmentMetadata(message, nowIso)) {
    await deps.attachments.putAttachment(attachment);
  }
  if (indexed.status === "conflict") return "already-present";
  return indexed.status;
}

type FetchGate = {
  lastGetAt: number;
};

async function fetchAndPersist(
  deps: IncrementalSyncDeps,
  clock: SyncClock,
  maxRetries: number,
  minInterval: number,
  gate: FetchGate,
  messageId: string,
  nowIso: string,
): Promise<"inserted" | "updated" | "already-present" | "dropped"> {
  const wait = minInterval - (clock.now().getTime() - gate.lastGetAt);
  if (gate.lastGetAt > 0 && wait > 0) await clock.sleep(wait);
  try {
    const message = await withRetry(clock, maxRetries, () =>
      deps.api.getMessage(messageId),
    );
    gate.lastGetAt = clock.now().getTime();
    return persistFetchedMessage(deps, message, nowIso);
  } catch (error) {
    if (isGmailNotFoundError(error)) {
      gate.lastGetAt = clock.now().getTime();
      await dropFromIndex(deps.index, deps.attachments, messageId);
      return "dropped";
    }
    throw error;
  }
}

function refsFrom(
  rec: GmailHistoryRecord,
  key: "messagesAdded" | "messagesDeleted" | "labelsAdded" | "labelsRemoved",
): GmailHistoryMessageRef[] {
  const rows = rec[key] ?? [];
  return rows.map((row) => row.message);
}

async function applyHistoryRecord(
  deps: IncrementalSyncDeps,
  clock: SyncClock,
  maxRetries: number,
  minInterval: number,
  gate: FetchGate,
  rec: GmailHistoryRecord,
  nowIso: string,
  counts: PageCounts,
  indexedCount: { value: number },
): Promise<string | null> {
  let cursor: string | null = null;

  for (const added of refsFrom(rec, "messagesAdded")) {
    cursor = added.id;
    if (!isMailboxIndexedView(added.labelIds)) {
      const dropped = await dropFromIndex(deps.index, deps.attachments, added.id);
      if (dropped === "deleted") {
        counts.deleted += 1;
        indexedCount.value = Math.max(0, indexedCount.value - 1);
      }
      continue;
    }
    const status = await fetchAndPersist(
      deps,
      clock,
      maxRetries,
      minInterval,
      gate,
      added.id,
      nowIso,
    );
    if (status === "inserted") {
      counts.inserted += 1;
      indexedCount.value += 1;
    } else if (status === "updated") {
      counts.labelUpdates += 1;
    } else if (status === "dropped") {
      counts.deleted += 1;
      indexedCount.value = Math.max(0, indexedCount.value - 1);
    }
  }

  for (const changed of [...refsFrom(rec, "labelsAdded"), ...refsFrom(rec, "labelsRemoved")]) {
    cursor = changed.id;
    const inView = isMailboxIndexedView(changed.labelIds);
    if (!inView) {
      const dropped = await dropFromIndex(deps.index, deps.attachments, changed.id);
      if (dropped === "deleted") {
        counts.deleted += 1;
        indexedCount.value = Math.max(0, indexedCount.value - 1);
      }
      continue;
    }
    const status = await fetchAndPersist(
      deps,
      clock,
      maxRetries,
      minInterval,
      gate,
      changed.id,
      nowIso,
    );
    if (status === "inserted") {
      counts.inserted += 1;
      indexedCount.value += 1;
    } else if (status === "updated") {
      counts.labelUpdates += 1;
    } else if (status === "dropped") {
      counts.deleted += 1;
      indexedCount.value = Math.max(0, indexedCount.value - 1);
    }
  }

  for (const deleted of refsFrom(rec, "messagesDeleted")) {
    cursor = deleted.id;
    const dropped = await dropFromIndex(deps.index, deps.attachments, deleted.id);
    if (dropped === "deleted") {
      counts.deleted += 1;
      indexedCount.value = Math.max(0, indexedCount.value - 1);
    }
  }

  return cursor;
}

async function failSync(
  deps: IncrementalSyncDeps,
  clock: SyncClock,
  existing: GmailCheckpoint,
  pageToken: string | null,
  indexedCount: number,
  errorCode: string,
  telemetry: GmailTelemetrySink,
): Promise<IncrementalSyncResult> {
  await deps.index.putCheckpoint({
    ...existing,
    status: "failed",
    pageToken,
    indexedCount,
    updatedAt: clock.now().toISOString(),
    errorCode,
  });
  emitGmailTelemetry(telemetry, {
    event: "gmail-incremental-failed",
    indexed_count: indexedCount,
    status: "failed",
    job_key: GMAIL_INCREMENTAL_JOB_KEY,
    error_code: errorCode,
  });
  return {
    status: "failed",
    indexedCount,
    insertedCount: 0,
    deletedCount: 0,
    labelUpdateCount: 0,
    initialized: false,
    recovery: errorCode === HISTORY_TOO_OLD,
    errorCode,
  };
}

async function runCatchUpList(
  deps: IncrementalSyncDeps,
  clock: SyncClock,
  telemetry: GmailTelemetrySink,
  existing: GmailCheckpoint,
  windowStart: Date,
  pageSize: number,
  maxPages: number,
  maxRetries: number,
  minInterval: number,
): Promise<IncrementalSyncResult> {
  const query = historicalGmailQuery(windowStart);
  let pageToken = existing.pageToken;
  let indexedCount = existing.indexedCount;
  const counts: PageCounts = { inserted: 0, deleted: 0, labelUpdates: 0 };
  const gate: FetchGate = { lastGetAt: 0 };
  const recovery = existing.errorCode === HISTORY_TOO_OLD || Boolean(existing.historyId);
  const catchUpError = recovery ? HISTORY_TOO_OLD : leaseError(existing);
  const nowIso = clock.now().toISOString();

  let pendingId = parsePendingHistoryCursor(existing.cursorMessageId);
  let pendingCursor = pendingId
    ? encodePendingHistoryCursor(pendingId)
    : existing.cursorMessageId;

  try {
    if (!pendingId) {
      const profile = await withRetry(clock, maxRetries, () =>
        deps.api.getProfile(),
      );
      pendingId = profile.historyId?.trim() ?? "";
      if (!pendingId) {
        return failSync(
          deps,
          clock,
          {
            ...existing,
            windowStart: windowStart.toISOString(),
            historyId: existing.historyId,
          },
          pageToken,
          indexedCount,
          recovery ? HISTORY_TOO_OLD : "gmail-history-id-missing",
          telemetry,
        );
      }
      pendingCursor = encodePendingHistoryCursor(pendingId);
    }
    const held: GmailCheckpoint = {
      ...existing,
      status: "running",
      windowStart: windowStart.toISOString(),
      pageToken,
      historyId: existing.historyId,
      cursorMessageId: pendingCursor,
      indexedCount,
      updatedAt: nowIso,
      errorCode: catchUpError,
    };
    await deps.index.putCheckpoint(held);

    let pages = 0;
    while (true) {
      if (pages >= maxPages) break;
      const page = await withRetry(clock, maxRetries, () =>
        deps.api.listMessages({
          q: query,
          pageToken,
          maxResults: pageSize,
        }),
      );
      for (const listed of page.messages) {
        const status = await fetchAndPersist(
          deps,
          clock,
          maxRetries,
          minInterval,
          gate,
          listed.id,
          clock.now().toISOString(),
        );
        if (status === "inserted") {
          counts.inserted += 1;
          indexedCount += 1;
        } else if (status === "updated") {
          counts.labelUpdates += 1;
        } else if (status === "dropped") {
          counts.deleted += 1;
          indexedCount = Math.max(0, indexedCount - 1);
        }
      }
      pageToken = page.nextPageToken;
      pages += 1;
      if (!pageToken) break;
      await deps.index.putCheckpoint({
        ...held,
        status: "running",
        pageToken,
        cursorMessageId: pendingCursor,
        historyId: existing.historyId,
        indexedCount,
        updatedAt: clock.now().toISOString(),
        errorCode: catchUpError,
      });
      break;
    }

    if (pageToken) {
      await deps.index.putCheckpoint({
        ...held,
        status: "running",
        pageToken,
        cursorMessageId: pendingCursor,
        historyId: existing.historyId,
        indexedCount,
        updatedAt: clock.now().toISOString(),
        errorCode: catchUpError,
      });
      emitGmailTelemetry(telemetry, {
        event: "gmail-incremental-ok",
        indexed_count: indexedCount,
        status: "running",
        job_key: GMAIL_INCREMENTAL_JOB_KEY,
      });
      return {
        status: "running",
        indexedCount,
        insertedCount: counts.inserted,
        deletedCount: counts.deleted,
        labelUpdateCount: counts.labelUpdates,
        initialized: false,
        recovery,
        errorCode: recovery ? HISTORY_TOO_OLD : null,
      };
    }

    await deps.index.putCheckpoint({
      jobKey: GMAIL_INCREMENTAL_JOB_KEY,
      status: "completed",
      windowStart: windowStart.toISOString(),
      windowEnd: clock.now().toISOString(),
      pageToken: null,
      historyId: pendingId,
      cursorMessageId: null,
      indexedCount,
      updatedAt: clock.now().toISOString(),
      errorCode: null,
    });
    emitGmailTelemetry(telemetry, {
      event: "gmail-incremental-ok",
      indexed_count: indexedCount,
      status: "completed",
      job_key: GMAIL_INCREMENTAL_JOB_KEY,
    });
    return {
      status: "completed",
      indexedCount,
      insertedCount: counts.inserted,
      deletedCount: counts.deleted,
      labelUpdateCount: counts.labelUpdates,
      initialized: !recovery,
      recovery,
      errorCode: null,
    };
  } catch (error) {
    return handleSyncError(
      deps,
      clock,
      telemetry,
      {
        ...existing,
        windowStart: windowStart.toISOString(),
        cursorMessageId: pendingCursor,
        historyId: existing.historyId,
      },
      windowStart.toISOString(),
      pageToken,
      pendingCursor,
      indexedCount,
      error,
      recovery,
    );
  }
}

async function handleSyncError(
  deps: IncrementalSyncDeps,
  clock: SyncClock,
  telemetry: GmailTelemetrySink,
  existing: GmailCheckpoint,
  windowStart: string | null,
  pageToken: string | null,
  cursorMessageId: string | null,
  indexedCount: number,
  error: unknown,
  recovery: boolean,
): Promise<IncrementalSyncResult> {
  const message = error instanceof Error ? error.message : "gmail-sync-failed";
  if (message === "invalid_grant" || message.includes("invalid_grant")) {
    await applyInvalidGrant(deps.connections, clock.now().toISOString());
    await deps.index.putCheckpoint({
      ...existing,
      status: "failed",
      windowStart,
      pageToken,
      cursorMessageId,
      indexedCount,
      updatedAt: clock.now().toISOString(),
      errorCode: "invalid_grant",
    });
    emitGmailTelemetry(telemetry, {
      event: "gmail-incremental-failed",
      indexed_count: indexedCount,
      status: "failed",
      job_key: GMAIL_INCREMENTAL_JOB_KEY,
      error_code: "invalid_grant",
    });
    return {
      status: "revoked",
      indexedCount,
      insertedCount: 0,
      deletedCount: 0,
      labelUpdateCount: 0,
      initialized: false,
      recovery,
      errorCode: "invalid_grant",
    };
  }
  const failedCode = recovery ? HISTORY_TOO_OLD : "gmail-sync-failed";
  await deps.index.putCheckpoint({
    ...existing,
    status: "failed",
    windowStart,
    pageToken,
    historyId: existing.historyId,
    cursorMessageId,
    indexedCount,
    updatedAt: clock.now().toISOString(),
    errorCode: failedCode,
  });
  emitGmailTelemetry(telemetry, {
    event: "gmail-incremental-failed",
    indexed_count: indexedCount,
    status: "failed",
    job_key: GMAIL_INCREMENTAL_JOB_KEY,
    error_code: failedCode,
  });
  return {
    status: "failed",
    indexedCount,
    insertedCount: 0,
    deletedCount: 0,
    labelUpdateCount: 0,
    initialized: false,
    recovery,
    errorCode: "gmail-sync-failed",
  };
}

export async function runIncrementalSync(
  deps: IncrementalSyncDeps,
): Promise<IncrementalSyncResult> {
  const clock = deps.clock ?? defaultSyncClock;
  const telemetry = deps.telemetry ?? noopGmailTelemetry;
  const pageSize = deps.pageSize ?? GMAIL_INCREMENTAL_HISTORY_PAGE_SIZE;
  const maxGetsPerSec = deps.maxGetsPerSec ?? GMAIL_SYNC_MAX_GETS_PER_SEC;
  const maxRetries = deps.maxRetries ?? 3;
  const maxPages = deps.maxPages ?? GMAIL_INCREMENTAL_CHUNK_MAX_PAGES;
  const minInterval = getMinIntervalMs(maxGetsPerSec);
  const now = clock.now();
  const nowIso = now.toISOString();

  const connection = await deps.connections.getFounderConnection();
  if (!connection) {
    return {
      status: "paused",
      indexedCount: 0,
      insertedCount: 0,
      deletedCount: 0,
      labelUpdateCount: 0,
      initialized: false,
      recovery: false,
      errorCode: "connection-inactive",
    };
  }
  if (connection.status === "paused") {
    return {
      status: "paused",
      indexedCount: 0,
      insertedCount: 0,
      deletedCount: 0,
      labelUpdateCount: 0,
      initialized: false,
      recovery: false,
      errorCode: null,
    };
  }
  if (connection.status === "revoked" || connection.status === "disconnected") {
    return {
      status: connection.status,
      indexedCount: 0,
      insertedCount: 0,
      deletedCount: 0,
      labelUpdateCount: 0,
      initialized: false,
      recovery: false,
      errorCode: connection.statusErrorCode,
    };
  }
  if (!isSyncEligible(connection)) {
    return {
      status: "paused",
      indexedCount: 0,
      insertedCount: 0,
      deletedCount: 0,
      labelUpdateCount: 0,
      initialized: false,
      recovery: false,
      errorCode: "connection-inactive",
    };
  }

  const historical = await deps.index.getCheckpoint(GMAIL_HISTORICAL_JOB_KEY);
  if (!(historical?.status === "completed" && historical.pageToken == null)) {
    return {
      status: "blocked",
      indexedCount: 0,
      insertedCount: 0,
      deletedCount: 0,
      labelUpdateCount: 0,
      initialized: false,
      recovery: false,
      errorCode: HISTORICAL_INCOMPLETE,
    };
  }

  const existing =
    (await deps.index.getCheckpoint(GMAIL_INCREMENTAL_JOB_KEY)) ??
    emptyIncremental(nowIso);

  if (needsCatchUp(existing)) {
    const windowStart = existing.windowStart
      ? new Date(existing.windowStart)
      : catchUpAfterDate(historical, now);
    return runCatchUpList(
      deps,
      clock,
      telemetry,
      existing,
      windowStart,
      GMAIL_INCREMENTAL_HISTORY_PAGE_SIZE,
      maxPages,
      maxRetries,
      minInterval,
    );
  }

  const startHistoryId = existing.historyId!;
  let pageToken = existing.pageToken;
  let indexedCount = existing.indexedCount;
  let cursorMessageId = existing.cursorMessageId;
  const counts: PageCounts = { inserted: 0, deleted: 0, labelUpdates: 0 };
  const gate: FetchGate = { lastGetAt: 0 };
  const indexed = { value: indexedCount };

  await deps.index.putCheckpoint({
    ...existing,
    status: "running",
    pageToken,
    indexedCount,
    updatedAt: nowIso,
    errorCode: leaseError(existing),
  });

  try {
    let pages = 0;
    let nextHistoryId = startHistoryId;
    while (true) {
      if (pages >= maxPages) break;
      let page;
      try {
        page = await withRetry(clock, maxRetries, () =>
          deps.api.listHistory({
            startHistoryId,
            pageToken,
            maxResults: pageSize,
            historyTypes: GMAIL_HISTORY_TYPES,
          }),
        );
      } catch (error) {
        if (isHistoryTooOldError(error)) {
          const recoveryStart = catchUpAfterDate(
            {
              ...historical,
              updatedAt: existing.windowEnd ?? existing.updatedAt,
            },
            now,
          );
          await deps.index.putCheckpoint({
            ...existing,
            status: "failed",
            windowStart: recoveryStart.toISOString(),
            pageToken: null,
            historyId: existing.historyId,
            cursorMessageId: null,
            indexedCount,
            updatedAt: clock.now().toISOString(),
            errorCode: HISTORY_TOO_OLD,
          });
          const recovering =
            (await deps.index.getCheckpoint(GMAIL_INCREMENTAL_JOB_KEY)) ?? existing;
          return runCatchUpList(
            deps,
            clock,
            telemetry,
            recovering,
            recoveryStart,
            GMAIL_INCREMENTAL_HISTORY_PAGE_SIZE,
            maxPages,
            maxRetries,
            minInterval,
          );
        }
        throw error;
      }

      for (const rec of page.history) {
        const cursor = await applyHistoryRecord(
          deps,
          clock,
          maxRetries,
          minInterval,
          gate,
          rec,
          clock.now().toISOString(),
          counts,
          indexed,
        );
        if (cursor) cursorMessageId = cursor;
      }

      indexedCount = indexed.value;
      pageToken = page.nextPageToken;
      nextHistoryId = page.historyId;
      pages += 1;

      if (pageToken) {
        await deps.index.putCheckpoint({
          jobKey: GMAIL_INCREMENTAL_JOB_KEY,
          status: "running",
          windowStart: existing.windowStart,
          windowEnd: existing.windowEnd,
          pageToken,
          historyId: startHistoryId,
          cursorMessageId,
          indexedCount,
          updatedAt: clock.now().toISOString(),
          errorCode: leaseError(existing),
        });
        emitGmailTelemetry(telemetry, {
          event: "gmail-incremental-ok",
          indexed_count: indexedCount,
          status: "running",
          job_key: GMAIL_INCREMENTAL_JOB_KEY,
        });
        return {
          status: "running",
          indexedCount,
          insertedCount: counts.inserted,
          deletedCount: counts.deleted,
          labelUpdateCount: counts.labelUpdates,
          initialized: false,
          recovery: false,
          errorCode: null,
        };
      }

      break;
    }

    const completed = !pageToken;
    await deps.index.putCheckpoint({
      jobKey: GMAIL_INCREMENTAL_JOB_KEY,
      status: completed ? "completed" : "running",
      windowStart: existing.windowStart,
      windowEnd: completed ? clock.now().toISOString() : existing.windowEnd,
      pageToken,
      historyId: completed ? nextHistoryId : startHistoryId,
      cursorMessageId,
      indexedCount,
      updatedAt: clock.now().toISOString(),
      errorCode: null,
    });
    emitGmailTelemetry(telemetry, {
      event: "gmail-incremental-ok",
      indexed_count: indexedCount,
      status: completed ? "completed" : "running",
      job_key: GMAIL_INCREMENTAL_JOB_KEY,
    });
    return {
      status: completed ? "completed" : "running",
      indexedCount,
      insertedCount: counts.inserted,
      deletedCount: counts.deleted,
      labelUpdateCount: counts.labelUpdates,
      initialized: false,
      recovery: false,
      errorCode: null,
    };
  } catch (error) {
    return handleSyncError(
      deps,
      clock,
      telemetry,
      existing,
      existing.windowStart,
      pageToken,
      cursorMessageId,
      indexedCount,
      error,
      false,
    );
  }
}
