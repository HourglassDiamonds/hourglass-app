/**
 * Read-only historical Gmail sync against a mockable adapter.
 * Messages first. Checkpoint second. Never checkpoint ahead of durable writes.
 * Does not execute production sync. Does not call attachments.get.
 */

import type { GmailIndexStore } from "@/lib/continuum/client-memory/gmail/store";
import { hashEmail } from "@/lib/continuum/client-memory/hashes";
import {
  GMAIL_HISTORICAL_JOB_KEY,
  GMAIL_SYNC_MAX_GETS_PER_SEC,
  GMAIL_SYNC_PAGE_SIZE,
} from "./types";
import type { GmailApi } from "./adapter";
import { isRetryableGmailError, retryDelayMs } from "./adapter";
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
import type { GmailCheckpoint } from "@/lib/continuum/client-memory/gmail/types";
import { GMAIL_SYNC_ALREADY_RUNNING } from "@/lib/continuum/client-memory/gmail/types";

export const HISTORICAL_LOOKBACK_MONTHS = 24;

export type SyncClock = {
  now(): Date;
  sleep(ms: number): Promise<void>;
};

export const defaultSyncClock: SyncClock = {
  now: () => new Date(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

export function historicalWindowStart(
  now: Date,
  months = HISTORICAL_LOOKBACK_MONTHS,
): Date {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  start.setUTCMonth(start.getUTCMonth() - months);
  return start;
}

export function formatGmailAfterDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}/${m}/${d}`;
}

export function historicalGmailQuery(windowStart: Date): string {
  return `(in:inbox OR in:sent) -in:spam -in:trash after:${formatGmailAfterDate(windowStart)}`;
}

export type HistoricalSyncDeps = {
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

export type HistoricalSyncResult = {
  status: "completed" | "running" | "failed" | "paused" | "revoked" | "disconnected";
  indexedCount: number;
  errorCode: string | null;
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

export async function runHistoricalSync(
  deps: HistoricalSyncDeps,
): Promise<HistoricalSyncResult> {
  const clock = deps.clock ?? defaultSyncClock;
  const telemetry = deps.telemetry ?? noopGmailTelemetry;
  const pageSize = deps.pageSize ?? GMAIL_SYNC_PAGE_SIZE;
  const maxGetsPerSec = deps.maxGetsPerSec ?? GMAIL_SYNC_MAX_GETS_PER_SEC;
  const maxRetries = deps.maxRetries ?? 3;
  const minInterval = getMinIntervalMs(maxGetsPerSec);
  const now = clock.now();
  const nowIso = now.toISOString();

  const connection = await deps.connections.getFounderConnection();
  if (!connection) {
    return { status: "paused", indexedCount: 0, errorCode: "connection-inactive" };
  }
  if (connection.status === "paused") {
    return { status: "paused", indexedCount: connection.statusErrorCode ? 0 : 0, errorCode: null };
  }
  if (connection.status === "revoked" || connection.status === "disconnected") {
    return { status: connection.status, indexedCount: 0, errorCode: connection.statusErrorCode };
  }
  if (!isSyncEligible(connection)) {
    return { status: "paused", indexedCount: 0, errorCode: "connection-inactive" };
  }

  const existing =
    (await deps.index.getCheckpoint(GMAIL_HISTORICAL_JOB_KEY)) ??
    ({
      jobKey: GMAIL_HISTORICAL_JOB_KEY,
      status: "idle",
      windowStart: null,
      windowEnd: null,
      pageToken: null,
      historyId: null,
      cursorMessageId: null,
      indexedCount: 0,
      updatedAt: nowIso,
      errorCode: null,
    } satisfies GmailCheckpoint);

  if (existing.status === "completed" && existing.pageToken == null) {
    return { status: "completed", indexedCount: existing.indexedCount, errorCode: null };
  }

  const windowStart = existing.windowStart
    ? new Date(existing.windowStart)
    : historicalWindowStart(now);
  const windowEndIso = existing.windowEnd ?? nowIso;
  const query = historicalGmailQuery(windowStart);
  let pageToken = existing.pageToken;
  let indexedCount = existing.indexedCount;
  let cursorMessageId = existing.cursorMessageId;

  await deps.index.putCheckpoint({
    ...existing,
    status: "running",
    windowStart: windowStart.toISOString(),
    windowEnd: windowEndIso,
    pageToken,
    indexedCount,
    updatedAt: nowIso,
    errorCode:
      existing.errorCode === GMAIL_SYNC_ALREADY_RUNNING
        ? GMAIL_SYNC_ALREADY_RUNNING
        : null,
  });

  try {
    let pages = 0;
    let lastGetAt = 0;
    while (true) {
      if (deps.maxPages != null && pages >= deps.maxPages) break;
      const page = await withRetry(clock, maxRetries, () =>
        deps.api.listMessages({
          q: query,
          pageToken,
          maxResults: pageSize,
        }),
      );
      for (const listed of page.messages) {
        const wait = minInterval - (clock.now().getTime() - lastGetAt);
        if (lastGetAt > 0 && wait > 0) await clock.sleep(wait);
        const message = await withRetry(clock, maxRetries, () =>
          deps.api.getMessage(listed.id),
        );
        lastGetAt = clock.now().getTime();
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
        if (indexed.status === "inserted") indexedCount += 1;
        cursorMessageId = message.id;
      }

      // Durable messages for this page are written. Checkpoint now.
      pageToken = page.nextPageToken;
      await deps.index.putCheckpoint({
        jobKey: GMAIL_HISTORICAL_JOB_KEY,
        status: pageToken ? "running" : "completed",
        windowStart: windowStart.toISOString(),
        windowEnd: windowEndIso,
        pageToken,
        historyId: existing.historyId,
        cursorMessageId,
        indexedCount,
        updatedAt: clock.now().toISOString(),
        errorCode: null,
      });
      emitGmailTelemetry(telemetry, {
        event: "gmail-sync-page-ok",
        indexed_count: indexedCount,
        status: pageToken ? "running" : "completed",
        job_key: GMAIL_HISTORICAL_JOB_KEY,
      });
      pages += 1;
      if (!pageToken) break;
    }

    return {
      status: pageToken ? "running" : "completed",
      indexedCount,
      errorCode: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "gmail-sync-failed";
    if (message === "invalid_grant" || message.includes("invalid_grant")) {
      await applyInvalidGrant(deps.connections, clock.now().toISOString());
      await deps.index.putCheckpoint({
        jobKey: GMAIL_HISTORICAL_JOB_KEY,
        status: "failed",
        windowStart: windowStart.toISOString(),
        windowEnd: windowEndIso,
        pageToken,
        historyId: existing.historyId,
        cursorMessageId,
        indexedCount,
        updatedAt: clock.now().toISOString(),
        errorCode: "invalid_grant",
      });
      emitGmailTelemetry(telemetry, {
        event: "gmail-sync-failed",
        indexed_count: indexedCount,
        status: "failed",
        job_key: GMAIL_HISTORICAL_JOB_KEY,
        error_code: "invalid_grant",
      });
      return { status: "revoked", indexedCount, errorCode: "invalid_grant" };
    }
    await deps.index.putCheckpoint({
      jobKey: GMAIL_HISTORICAL_JOB_KEY,
      status: "failed",
      windowStart: windowStart.toISOString(),
      windowEnd: windowEndIso,
      pageToken,
      historyId: existing.historyId,
      cursorMessageId,
      indexedCount,
      updatedAt: clock.now().toISOString(),
      errorCode: "gmail-sync-failed",
    });
    emitGmailTelemetry(telemetry, {
      event: "gmail-sync-failed",
      indexed_count: indexedCount,
      status: "failed",
      job_key: GMAIL_HISTORICAL_JOB_KEY,
      error_code: "gmail-sync-failed",
    });
    return { status: "failed", indexedCount, errorCode: "gmail-sync-failed" };
  }
}

export function founderMailboxHashFromEmail(email: string): string {
  const hash = hashEmail(email);
  if (!hash) throw new Error("gmail-mailbox-unconfigured");
  return hash;
}
