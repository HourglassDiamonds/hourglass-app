/**
 * Founder-triggered Gmail new-project intake scan.
 * Uses already-indexed thread identities + a transient read-only body fetch.
 * Ingests Candidates only. Does not persist mailbox bodies or write Projects.
 */

import type { CandidateStore, ContinuumCandidate } from "@/lib/continuum/candidates/types";
import type { GmailIndexStore } from "@/lib/continuum/client-memory/gmail/store";
import { hashEmail } from "@/lib/continuum/client-memory/hashes";
import { ingestGmailCandidates } from "./candidates/ingest";
import { knownGmailProjectThreadIds } from "@/lib/continuum/client-memory/founder-project/gmail-project-link";
import {
  extractCustomerEmails,
  hasJewelryWorkContext,
  isNewProjectContextPayload,
  looksTransactionalCustomerNotice,
} from "./candidates/new-project";
import { haystackOf } from "./candidates/parse";
import { parseGmailCandidateSourceRef } from "./candidates/source-ref";
import type { GmailCandidateEvidence, GmailCandidateWorld } from "./candidates/types";
import type { GmailConnectionStore } from "./connection";
import { runIndexedThreadEvidenceFetch } from "./indexed-thread-evidence";
import type { GmailApi } from "./adapter";
import type { GmailAccessTokenRefresh } from "./oauth";
import type { GmailTokenCiphertext } from "./types";

export const GMAIL_INTAKE_MAX_THREADS = 30 as const;
export const GMAIL_INTAKE_SELECTION_LOOKBACK = 50 as const;
export const GMAIL_INTAKE_RELATED_THREAD_CAP = 8 as const;

export type GmailIntakeScanFailure = {
  ok: false;
  safeErrorCode: string;
};

export type GmailIntakeScanSummary = {
  threadCount: number;
  threadReadCount: number;
  unreadThreadCount: number;
  newProjectProposalCount: number;
  actionReviewCount: number;
  relationshipUpdateCount: number;
  backgroundObservationCount: number;
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
  actionReviewCount: number;
  relationshipUpdateCount: number;
  backgroundObservationCount: number;
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

export async function relatedCommercialThreadIds(
  index: Pick<GmailIndexStore, "listMessagesTouchingEmailHash">,
  evidence: readonly GmailCandidateEvidence[],
  already: ReadonlySet<string>,
): Promise<string[]> {
  const extra = new Set<string>();
  for (const row of evidence) {
    const hay = haystackOf(row.indexed.subject, row.plaintext ?? null);
    if (!looksTransactionalCustomerNotice(hay)) continue;
    for (const email of extractCustomerEmails(hay)) {
      const hash = hashEmail(email);
      if (!hash) continue;
      let related;
      try {
        related = await index.listMessagesTouchingEmailHash(hash);
      } catch {
        continue;
      }
      for (const msg of related) {
        const threadId = msg.threadId.trim();
        if (!threadId || already.has(threadId) || extra.has(threadId)) continue;
        if (!hasJewelryWorkContext(msg.subject ?? "")) continue;
        extra.add(threadId);
        if (extra.size >= GMAIL_INTAKE_RELATED_THREAD_CAP) return [...extra];
      }
    }
  }
  return [...extra];
}

export function classifyGmailIntakeAttention(
  row: ContinuumCandidate,
  newProjectThreadIds: ReadonlySet<string>,
): "new_project" | "action" | "relationship" | "background" {
  const threadId = parseGmailCandidateSourceRef(row.sourceRef)?.threadId ?? null;
  const onNewProject = Boolean(threadId && newProjectThreadIds.has(threadId));
  if (isNewProjectContextPayload(row.payload)) return "new_project";
  if (row.candidateState === "conflict") return "action";
  if (onNewProject) return "background";
  if (row.candidateType === "open_job") return "action";
  if (row.candidateType === "person_association") return "relationship";
  return "background";
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
  for (const row of input.proposed) {
    if (isNewProjectContextPayload(row.payload)) {
      const threadId = parseGmailCandidateSourceRef(row.sourceRef)?.threadId;
      if (threadId) newProjectThreads.add(threadId);
    }
  }
  let actionReviewCount = 0;
  let relationshipUpdateCount = 0;
  let backgroundObservationCount = 0;
  for (const row of input.proposed) {
    const bucket = classifyGmailIntakeAttention(row, newProjectThreads);
    if (bucket === "new_project") continue;
    if (bucket === "action") actionReviewCount += 1;
    else if (bucket === "relationship") relationshipUpdateCount += 1;
    else backgroundObservationCount += 1;
  }
  return {
    threadCount,
    threadReadCount: Math.max(0, threadCount - unread),
    unreadThreadCount: unread,
    newProjectProposalCount: newProjectThreads.size,
    actionReviewCount,
    relationshipUpdateCount,
    backgroundObservationCount,
  };
}

export function formatGmailIntakeScanNotice(summary: GmailIntakeScanSummary): string {
  const threads = `Scanned ${summary.threadCount} indexed thread${
    summary.threadCount === 1 ? "" : "s"
  }.`;
  const projects =
    summary.newProjectProposalCount > 0
      ? ` ${summary.newProjectProposalCount} new project${
          summary.newProjectProposalCount === 1 ? "" : "s"
        } detected.`
      : " No new-project proposals from this scan.";
  const actions =
    summary.actionReviewCount > 0
      ? ` ${summary.actionReviewCount} action${
          summary.actionReviewCount === 1 ? "" : "s"
        } need review.`
      : "";
  const relationships =
    summary.relationshipUpdateCount > 0
      ? ` ${summary.relationshipUpdateCount} relationship update${
          summary.relationshipUpdateCount === 1 ? "" : "s"
        }.`
      : "";
  const background =
    summary.backgroundObservationCount > 0
      ? ` ${summary.backgroundObservationCount} background observation${
          summary.backgroundObservationCount === 1 ? "" : "s"
        } processed.`
      : "";
  const unread =
    summary.unreadThreadCount > 0
      ? ` ${summary.unreadThreadCount} thread${
          summary.unreadThreadCount === 1 ? "" : "s"
        } could not be read.`
      : "";
  return `${threads}${projects}${actions}${relationships}${background}${unread}`;
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
    actionReviewCount: 0,
    relationshipUpdateCount: 0,
    backgroundObservationCount: 0,
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
  let evidence = fetched.evidence;
  const unreadThreads = [...fetched.unreadThreads];
  const relatedIds = await relatedCommercialThreadIds(
    input.index,
    fetched.evidence,
    new Set(threadIds),
  );
  if (relatedIds.length > 0) {
    const related = await runIndexedThreadEvidenceFetch({
      founderSessionOk: input.founderSessionOk,
      threadIds: relatedIds,
      index: input.index,
      connections: input.connections,
      decryptRefreshToken: input.decryptRefreshToken,
      refreshAccessToken: input.refreshAccessToken,
      createApi: input.createApi,
    });
    if (related.ok) {
      evidence = [...evidence, ...related.evidence];
      unreadThreads.push(...related.unreadThreads);
    }
  }
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
      evidence,
      world: {
        ...input.world,
        linkedGmailThreadIds,
      },
      createdAt: input.nowIso,
    });
  } catch {
    return { ok: false, safeErrorCode: "candidate-store-unavailable" };
  }
  const scannedIds = new Set([...ingested.insertedIds, ...ingested.duplicateIds]);
  const proposed = ingested.candidates.filter((row) => scannedIds.has(row.candidateId));
  const summary = summarizeGmailIntakeScan({
    threadCount: threadIds.length,
    unreadThreadCount: unreadThreads.length,
    proposed,
  });
  return {
    ok: true,
    insertedIds: ingested.insertedIds,
    duplicateIds: ingested.duplicateIds,
    threadCount: summary.threadCount,
    threadReadCount: summary.threadReadCount,
    unreadThreadCount: summary.unreadThreadCount,
    evidenceCount: evidence.length,
    newProjectProposalCount: summary.newProjectProposalCount,
    actionReviewCount: summary.actionReviewCount,
    relationshipUpdateCount: summary.relationshipUpdateCount,
    backgroundObservationCount: summary.backgroundObservationCount,
    plaintextPersisted: false,
    gmailMutation: false,
    cursorUnchanged: true,
  };
}
