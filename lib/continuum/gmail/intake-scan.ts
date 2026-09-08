/**
 * Founder-triggered Gmail new-project intake scan.
 * Uses already-indexed thread identities + a transient read-only body fetch.
 * Ingests Candidates only. Does not persist mailbox bodies or write Projects.
 */

import type { CandidateStore, ContinuumCandidate } from "@/lib/continuum/candidates/types";
import type { GmailIndexStore } from "@/lib/continuum/client-memory/gmail/store";
import { ingestGmailCandidates } from "./candidates/ingest";
import { isNewProjectContextPayload } from "./candidates/new-project";
import { parseGmailCandidateSourceRef } from "./candidates/source-ref";
import type { GmailCandidateWorld } from "./candidates/types";
import type { GmailConnectionStore } from "./connection";
import { runIndexedThreadEvidenceFetch } from "./indexed-thread-evidence";
import type { GmailApi } from "./adapter";
import type { GmailAccessTokenRefresh } from "./oauth";
import type { GmailTokenCiphertext } from "./types";

export const GMAIL_INTAKE_MAX_THREADS = 30 as const;
export const GMAIL_INTAKE_SELECTION_LOOKBACK = 50 as const;

export type GmailIntakeScanFailure = {
  ok: false;
  safeErrorCode: string;
};

export type GmailIntakeScanSummary = {
  threadCount: number;
  threadReadCount: number;
  unreadThreadCount: number;
  newProjectProposalCount: number;
  otherReviewItemCount: number;
};

export type GmailIntakeScanSuccess = {
  ok: true;
  insertedIds: string[];
  duplicateIds: string[];
  threadCount: number;
  threadReadCount: number;
  unreadThreadCount: number;
  evidenceCount: number;
  newProjectProposalCount: number;
  otherReviewItemCount: number;
  plaintextPersisted: false;
  gmailMutation: false;
  cursorUnchanged: true;
};

export type GmailIntakeScanResult = GmailIntakeScanFailure | GmailIntakeScanSuccess;

function sentMs(iso: string): number {
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : 0;
}

export async function recentIndexedThreadIds(
  index: Pick<GmailIndexStore, "listLatestByDirection">,
  cap = GMAIL_INTAKE_MAX_THREADS,
): Promise<string[]> {
  const limit = Number.isInteger(cap) && cap > 0 ? cap : GMAIL_INTAKE_MAX_THREADS;
  const lookback = GMAIL_INTAKE_SELECTION_LOOKBACK;
  const [inbound, outbound] = await Promise.all([
    index.listLatestByDirection("inbound", lookback),
    index.listLatestByDirection("outbound", lookback),
  ]);
  const newest = new Map<string, { sentAt: string; messageId: string }>();
  for (const row of [...inbound, ...outbound]) {
    const threadId = row.threadId.trim();
    if (!threadId) continue;
    const prev = newest.get(threadId);
    const sent = sentMs(row.sentAt);
    const prevSent = prev ? sentMs(prev.sentAt) : -1;
    if (
      !prev ||
      sent > prevSent ||
      (sent === prevSent && row.messageId < prev.messageId)
    ) {
      newest.set(threadId, { sentAt: row.sentAt, messageId: row.messageId });
    }
  }
  return [...newest.entries()]
    .sort((a, b) => {
      const sent = sentMs(b[1].sentAt) - sentMs(a[1].sentAt);
      if (sent !== 0) return sent;
      if (a[1].messageId !== b[1].messageId) {
        return a[1].messageId < b[1].messageId ? -1 : 1;
      }
      return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0;
    })
    .slice(0, limit)
    .map(([threadId]) => threadId);
}

export function summarizeGmailIntakeScan(input: {
  threadCount: number;
  unreadThreadCount: number;
  proposed: readonly ContinuumCandidate[];
}): GmailIntakeScanSummary {
  const unread =
    Number.isInteger(input.unreadThreadCount) && input.unreadThreadCount > 0
      ? input.unreadThreadCount
      : 0;
  const threadCount = Number.isInteger(input.threadCount) && input.threadCount > 0
    ? input.threadCount
    : 0;
  const newProjectThreads = new Set<string>();
  let otherReviewItemCount = 0;
  for (const row of input.proposed) {
    if (isNewProjectContextPayload(row.payload)) {
      const threadId = parseGmailCandidateSourceRef(row.sourceRef)?.threadId;
      if (threadId) newProjectThreads.add(threadId);
      continue;
    }
    otherReviewItemCount += 1;
  }
  return {
    threadCount,
    threadReadCount: Math.max(0, threadCount - unread),
    unreadThreadCount: unread,
    newProjectProposalCount: newProjectThreads.size,
    otherReviewItemCount,
  };
}

export function formatGmailIntakeScanNotice(summary: GmailIntakeScanSummary): string {
  const threads = `Scanned ${summary.threadCount} indexed thread${
    summary.threadCount === 1 ? "" : "s"
  }.`;
  const projects =
    summary.newProjectProposalCount > 0
      ? ` ${summary.newProjectProposalCount} new project proposal${
          summary.newProjectProposalCount === 1 ? "" : "s"
        }.`
      : " No new-project proposals from this scan.";
  const others =
    summary.otherReviewItemCount > 0
      ? ` ${summary.otherReviewItemCount} other review item${
          summary.otherReviewItemCount === 1 ? "" : "s"
        }.`
      : "";
  const unread =
    summary.unreadThreadCount > 0
      ? ` ${summary.unreadThreadCount} thread${
          summary.unreadThreadCount === 1 ? "" : "s"
        } could not be read.`
      : "";
  return `${threads}${projects}${others}${unread}`;
}

function emptyScanSuccess(): GmailIntakeScanSuccess {
  return {
    ok: true,
    insertedIds: [],
    duplicateIds: [],
    threadCount: 0,
    threadReadCount: 0,
    unreadThreadCount: 0,
    evidenceCount: 0,
    newProjectProposalCount: 0,
    otherReviewItemCount: 0,
    plaintextPersisted: false,
    gmailMutation: false,
    cursorUnchanged: true,
  };
}

export async function runGmailNewProjectIntakeScan(input: {
  founderSessionOk: boolean;
  index: GmailIndexStore;
  connections: GmailConnectionStore;
  decryptRefreshToken: (wrapped: GmailTokenCiphertext) => string;
  refreshAccessToken: (refreshToken: string) => Promise<GmailAccessTokenRefresh>;
  createApi: (accessToken: string) => GmailApi;
  world: GmailCandidateWorld;
  store: CandidateStore;
  nowIso: string;
  threadIds?: readonly string[];
}): Promise<GmailIntakeScanResult> {
  const threadIds =
    input.threadIds ??
    (await recentIndexedThreadIds(input.index, GMAIL_INTAKE_MAX_THREADS));
  if (threadIds.length === 0) {
    return emptyScanSuccess();
  }
  const fetched = await runIndexedThreadEvidenceFetch({
    founderSessionOk: input.founderSessionOk,
    threadIds,
    index: input.index,
    connections: input.connections,
    decryptRefreshToken: input.decryptRefreshToken,
    refreshAccessToken: input.refreshAccessToken,
    createApi: input.createApi,
  });
  if (!fetched.ok) {
    return { ok: false, safeErrorCode: fetched.safeErrorCode };
  }
  let ingested;
  try {
    ingested = await ingestGmailCandidates(input.store, {
      evidence: fetched.evidence,
      world: input.world,
      createdAt: input.nowIso,
    });
  } catch {
    return { ok: false, safeErrorCode: "candidate-store-unavailable" };
  }
  const scannedIds = new Set([...ingested.insertedIds, ...ingested.duplicateIds]);
  const proposed = ingested.candidates.filter((row) => scannedIds.has(row.candidateId));
  const summary = summarizeGmailIntakeScan({
    threadCount: threadIds.length,
    unreadThreadCount: fetched.unreadThreads.length,
    proposed,
  });
  return {
    ok: true,
    insertedIds: ingested.insertedIds,
    duplicateIds: ingested.duplicateIds,
    threadCount: summary.threadCount,
    threadReadCount: summary.threadReadCount,
    unreadThreadCount: summary.unreadThreadCount,
    evidenceCount: fetched.evidence.length,
    newProjectProposalCount: summary.newProjectProposalCount,
    otherReviewItemCount: summary.otherReviewItemCount,
    plaintextPersisted: false,
    gmailMutation: false,
    cursorUnchanged: true,
  };
}
