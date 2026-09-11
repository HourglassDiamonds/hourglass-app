/**
 * Bounded, resumable historical Gmail → Candidate reconstruction.
 * Walks already-indexed threads, proposes review candidates, does not mint
 * People/Projects, and does not run a whole-mailbox migration.
 *
 * Cursor persistence reuses gmail-historical.historyId only after index
 * backfill has completed. Does not add a SQL job key.
 */

import type { CandidateStore } from "@/lib/continuum/candidates/types";
import type {
  GmailCheckpoint,
  GmailIndexedMessage,
} from "@/lib/continuum/client-memory/gmail/types";
import type { GmailIndexStore } from "@/lib/continuum/client-memory/gmail/store";
import { knownGmailProjectThreadIds } from "@/lib/continuum/client-memory/founder-project/gmail-project-link";
import { ingestGmailCandidates } from "./candidates/ingest";
import type {
  GmailCandidateEvidence,
  GmailCandidateWorld,
} from "./candidates/types";
import { GMAIL_HISTORICAL_JOB_KEY } from "./types";

export const GMAIL_RECONSTRUCTION_CURSOR_VERSION = "gr1" as const;
export const GMAIL_RECONSTRUCTION_MAX_THREADS = 5 as const;
export const GMAIL_RECONSTRUCTION_SAMPLE_PER_DIRECTION = 50 as const;
export const GMAIL_RECONSTRUCTION_CURSOR_PREFIX = "gr1|" as const;

export type GmailReconstructionCursor =
  | { version: typeof GMAIL_RECONSTRUCTION_CURSOR_VERSION; done: true }
  | {
      version: typeof GMAIL_RECONSTRUCTION_CURSOR_VERSION;
      done?: never;
      sentAt: string;
      threadId: string;
    };

export type GmailReconstructionChunkFailure = {
  ok: false;
  safeErrorCode: string;
};

export type GmailReconstructionChunkSuccess = {
  ok: true;
  cursor: string;
  completed: boolean;
  threadCount: number;
  evidenceCount: number;
  insertedCount: number;
  duplicateCount: number;
  persistedCursor: boolean;
  plaintextPersisted: false;
  gmailMutation: false;
  mintedPeople: false;
  mintedProjects: false;
};

export type GmailReconstructionChunkResult =
  | GmailReconstructionChunkFailure
  | GmailReconstructionChunkSuccess;

function sentMs(iso: string): number {
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : 0;
}

function compareThreadHeads(
  a: { sentAt: string; threadId: string },
  b: { sentAt: string; threadId: string },
): number {
  const sent = sentMs(a.sentAt) - sentMs(b.sentAt);
  if (sent !== 0) return sent;
  return a.threadId.localeCompare(b.threadId);
}

export function packGmailReconstructionCursor(
  cursor: GmailReconstructionCursor,
): string {
  if (cursor.done) return `${GMAIL_RECONSTRUCTION_CURSOR_PREFIX}done`;
  return `${GMAIL_RECONSTRUCTION_CURSOR_PREFIX}${cursor.sentAt}|${cursor.threadId}`;
}

export function parseGmailReconstructionCursor(
  raw: string | null | undefined,
): GmailReconstructionCursor | null {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed.startsWith(GMAIL_RECONSTRUCTION_CURSOR_VERSION + "|")) return null;
  const rest = trimmed.slice(GMAIL_RECONSTRUCTION_CURSOR_VERSION.length + 1);
  if (rest === "done") {
    return { version: GMAIL_RECONSTRUCTION_CURSOR_VERSION, done: true };
  }
  const split = rest.indexOf("|");
  if (split <= 0) return null;
  const sentAt = rest.slice(0, split).trim();
  const threadId = rest.slice(split + 1).trim();
  if (!sentAt || !threadId) return null;
  if (!/^\d{4}-\d{2}-\d{2}T/.test(sentAt)) return null;
  if (threadId.includes("@") || threadId.includes(" ")) return null;
  return {
    version: GMAIL_RECONSTRUCTION_CURSOR_VERSION,
    sentAt,
    threadId,
  };
}

export function reconstructionCursorFromCheckpoint(
  row: GmailCheckpoint | null,
): string | null {
  if (!row || row.status !== "completed") return null;
  const parsed = parseGmailReconstructionCursor(row.historyId);
  return parsed ? packGmailReconstructionCursor(parsed) : null;
}

export function threadHeadsFromIndexedMessages(
  messages: readonly GmailIndexedMessage[],
): { threadId: string; sentAt: string }[] {
  const heads = new Map<string, string>();
  for (const row of messages) {
    const threadId = row.threadId.trim();
    if (!threadId) continue;
    const prev = heads.get(threadId);
    if (!prev || sentMs(row.sentAt) < sentMs(prev)) {
      heads.set(threadId, row.sentAt);
    }
  }
  return [...heads.entries()]
    .map(([threadId, sentAt]) => ({ threadId, sentAt }))
    .sort(compareThreadHeads);
}

export function selectHistoricalReconstructionThreads(input: {
  messages: readonly GmailIndexedMessage[];
  cursor?: string | null;
  limit?: number;
}): {
  threadIds: string[];
  heads: { threadId: string; sentAt: string }[];
  nextCursor: string;
  completed: boolean;
} {
  const limit =
    Number.isInteger(input.limit) && (input.limit ?? 0) > 0
      ? Math.min(input.limit ?? GMAIL_RECONSTRUCTION_MAX_THREADS, GMAIL_RECONSTRUCTION_MAX_THREADS)
      : GMAIL_RECONSTRUCTION_MAX_THREADS;
  const parsed = parseGmailReconstructionCursor(input.cursor);
  if (parsed?.done) {
    return {
      threadIds: [],
      heads: [],
      nextCursor: packGmailReconstructionCursor(parsed),
      completed: true,
    };
  }
  const heads = threadHeadsFromIndexedMessages(input.messages);
  const start = parsed
    ? heads.findIndex((head) => compareThreadHeads(head, parsed) > 0)
    : 0;
  const slice = start < 0 ? [] : heads.slice(start, start + limit);
  if (slice.length === 0) {
    return {
      threadIds: [],
      heads: [],
      nextCursor: packGmailReconstructionCursor({
        version: GMAIL_RECONSTRUCTION_CURSOR_VERSION,
        done: true,
      }),
      completed: true,
    };
  }
  const last = slice[slice.length - 1]!;
  const exhausted = start + slice.length >= heads.length;
  return {
    threadIds: slice.map((row) => row.threadId),
    heads: slice,
    nextCursor: packGmailReconstructionCursor(
      exhausted
        ? { version: GMAIL_RECONSTRUCTION_CURSOR_VERSION, done: true }
        : {
            version: GMAIL_RECONSTRUCTION_CURSOR_VERSION,
            sentAt: last.sentAt,
            threadId: last.threadId,
          },
    ),
    completed: exhausted,
  };
}

export async function sampleIndexedMessagesForReconstruction(
  index: Pick<GmailIndexStore, "listLatestByDirection">,
): Promise<GmailIndexedMessage[]> {
  const cap = GMAIL_RECONSTRUCTION_SAMPLE_PER_DIRECTION;
  const [inbound, outbound, unknown] = await Promise.all([
    index.listLatestByDirection("inbound", cap),
    index.listLatestByDirection("outbound", cap),
    index.listLatestByDirection("unknown", cap),
  ]);
  const byId = new Map<string, GmailIndexedMessage>();
  for (const row of [...inbound, ...outbound, ...unknown]) {
    byId.set(row.messageId, row);
  }
  return [...byId.values()];
}

async function persistReconstructionCursor(
  index: Pick<GmailIndexStore, "getCheckpoint" | "putCheckpoint">,
  cursor: string,
  nowIso: string,
): Promise<boolean> {
  const existing = await index.getCheckpoint(GMAIL_HISTORICAL_JOB_KEY);
  if (!existing || existing.status !== "completed") return false;
  await index.putCheckpoint({
    ...existing,
    historyId: cursor,
    updatedAt: nowIso,
  });
  return true;
}

export async function runHistoricalGmailReconstructionChunk(input: {
  founderSessionOk: boolean;
  secretProtectedOk?: boolean;
  index: GmailIndexStore;
  store: CandidateStore;
  world: GmailCandidateWorld;
  nowIso: string;
  fetchEvidence: (
    threadIds: readonly string[],
  ) => Promise<
    | { ok: true; evidence: GmailCandidateEvidence[] }
    | { ok: false; safeErrorCode: string }
  >;
  cursor?: string | null;
  persistCursor?: boolean;
  maxThreads?: number;
}): Promise<GmailReconstructionChunkResult> {
  if (!input.founderSessionOk && !input.secretProtectedOk) {
    return { ok: false, safeErrorCode: "unauthorized" };
  }
  const storedCursor =
    input.cursor ??
    reconstructionCursorFromCheckpoint(await input.index.getCheckpoint(GMAIL_HISTORICAL_JOB_KEY));
  const messages = await sampleIndexedMessagesForReconstruction(input.index);
  const selected = selectHistoricalReconstructionThreads({
    messages,
    cursor: storedCursor,
    limit: input.maxThreads,
  });
  if (selected.threadIds.length === 0) {
    const persisted =
      input.persistCursor === false
        ? false
        : await persistReconstructionCursor(input.index, selected.nextCursor, input.nowIso);
    return {
      ok: true,
      cursor: selected.nextCursor,
      completed: true,
      threadCount: 0,
      evidenceCount: 0,
      insertedCount: 0,
      duplicateCount: 0,
      persistedCursor: persisted,
      plaintextPersisted: false,
      gmailMutation: false,
      mintedPeople: false,
      mintedProjects: false,
    };
  }
  const fetched = await input.fetchEvidence(selected.threadIds);
  if (!fetched.ok) return { ok: false, safeErrorCode: fetched.safeErrorCode };

  let linkedGmailThreadIds: string[] = [];
  try {
    linkedGmailThreadIds = knownGmailProjectThreadIds(
      await input.store.list(),
      input.world.projects,
    );
  } catch {
    linkedGmailThreadIds = [];
  }

  let ingested;
  try {
    ingested = await ingestGmailCandidates(input.store, {
      evidence: fetched.evidence,
      world: {
        ...input.world,
        linkedGmailThreadIds,
      },
      createdAt: input.nowIso,
    });
  } catch {
    return { ok: false, safeErrorCode: "candidate-store-unavailable" };
  }

  const persisted =
    input.persistCursor === false
      ? false
      : await persistReconstructionCursor(input.index, selected.nextCursor, input.nowIso);

  return {
    ok: true,
    cursor: selected.nextCursor,
    completed: selected.completed,
    threadCount: selected.threadIds.length,
    evidenceCount: fetched.evidence.length,
    insertedCount: ingested.insertedIds.length,
    duplicateCount: ingested.duplicateIds.length,
    persistedCursor: persisted,
    plaintextPersisted: false,
    gmailMutation: false,
    mintedPeople: false,
    mintedProjects: false,
  };
}
