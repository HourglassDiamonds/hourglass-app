/**
 * Founder-triggered Gmail new-project intake scan.
 * Uses already-indexed thread identities + a transient read-only body fetch.
 * Ingests Candidates only. Does not persist mailbox bodies or write Projects.
 */

import type { CandidateStore } from "@/lib/continuum/candidates/types";
import type { GmailIndexStore } from "@/lib/continuum/client-memory/gmail/store";
import { ingestGmailCandidates } from "./candidates/ingest";
import type { GmailCandidateWorld } from "./candidates/types";
import type { GmailConnectionStore } from "./connection";
import { runIndexedThreadEvidenceFetch } from "./indexed-thread-evidence";
import type { GmailApi } from "./adapter";
import type { GmailAccessTokenRefresh } from "./oauth";
import type { GmailTokenCiphertext } from "./types";

export const GMAIL_INTAKE_MAX_THREADS = 30 as const;

export type GmailIntakeScanFailure = {
  ok: false;
  safeErrorCode: string;
};

export type GmailIntakeScanSuccess = {
  ok: true;
  insertedIds: string[];
  duplicateIds: string[];
  threadCount: number;
  threadReadCount: number;
  unreadThreadCount: number;
  evidenceCount: number;
  plaintextPersisted: false;
  gmailMutation: false;
  cursorUnchanged: true;
};

export type GmailIntakeScanResult = GmailIntakeScanFailure | GmailIntakeScanSuccess;

export async function recentIndexedThreadIds(
  index: Pick<GmailIndexStore, "listLatestByDirection">,
  cap = GMAIL_INTAKE_MAX_THREADS,
): Promise<string[]> {
  const limit = Number.isInteger(cap) && cap > 0 ? cap : GMAIL_INTAKE_MAX_THREADS;
  const [inbound, outbound] = await Promise.all([
    index.listLatestByDirection("inbound", limit),
    index.listLatestByDirection("outbound", limit),
  ]);
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const row of [...inbound, ...outbound]) {
    const threadId = row.threadId.trim();
    if (!threadId || seen.has(threadId)) continue;
    seen.add(threadId);
    ids.push(threadId);
    if (ids.length >= limit) break;
  }
  return ids;
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
    return {
      ok: true,
      insertedIds: [],
      duplicateIds: [],
      threadCount: 0,
      threadReadCount: 0,
      unreadThreadCount: 0,
      evidenceCount: 0,
      plaintextPersisted: false,
      gmailMutation: false,
      cursorUnchanged: true,
    };
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
  return {
    ok: true,
    insertedIds: ingested.insertedIds,
    duplicateIds: ingested.duplicateIds,
    threadCount: threadIds.length,
    threadReadCount: threadIds.length - fetched.unreadThreads.length,
    unreadThreadCount: fetched.unreadThreads.length,
    evidenceCount: fetched.evidence.length,
    plaintextPersisted: false,
    gmailMutation: false,
    cursorUnchanged: true,
  };
}
