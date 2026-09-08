/**
 * Thread-level Gmail candidate reconciliation.
 * Distinguishes inbound new-project request vs founder already replied.
 * Does not write canonical lifecycle.
 */

import type { ContinuumCandidate, ContinuumCandidateDraft } from "@/lib/continuum/candidates/types";
import { parseGmailCandidateSourceRef } from "./source-ref";
import {
  extractWaitingOnClient,
  NEW_PROJECT_CONTEXT_TOPIC,
  WAITING_ON_CLIENT_TOPIC,
} from "./new-project";
import type { GmailCandidateEvidence } from "./types";
import { assignCandidateId } from "@/lib/continuum/candidates/identity";
import { CANDIDATE_PARSER_GMAIL_V1 } from "@/lib/continuum/candidates/types";
import { GMAIL_SOURCE_SYSTEM } from "@/lib/continuum/client-memory/gmail/types";
import { packGmailCandidateSourceRef } from "./source-ref";
import { haystackOf } from "./parse";

function threadIdOf(row: Pick<ContinuumCandidateDraft, "sourceRef">): string | null {
  return parseGmailCandidateSourceRef(row.sourceRef)?.threadId ?? null;
}

function sentMs(iso: string): number {
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : 0;
}

export function laterOutboundExists(
  evidence: readonly GmailCandidateEvidence[],
  threadId: string,
  afterIso: string,
): GmailCandidateEvidence | null {
  const after = sentMs(afterIso);
  const later = evidence
    .filter(
      (row) =>
        row.indexed.threadId === threadId &&
        row.indexed.direction === "outbound" &&
        sentMs(row.indexed.sentAt) > after,
    )
    .sort((a, b) => sentMs(a.indexed.sentAt) - sentMs(b.indexed.sentAt));
  return later[0] ?? null;
}

export function threadHasNewProject(
  drafts: readonly ContinuumCandidateDraft[],
  threadId: string,
): boolean {
  return drafts.some(
    (row) =>
      threadIdOf(row) === threadId &&
      row.payload.kind === "project_context" &&
      row.payload.topic === NEW_PROJECT_CONTEXT_TOPIC,
  );
}

export function reconcileThreadCandidates(input: {
  drafts: ContinuumCandidateDraft[];
  evidence: readonly GmailCandidateEvidence[];
  createdAt: string;
}): ContinuumCandidateDraft[] {
  const byThread = new Map<string, GmailCandidateEvidence[]>();
  for (const row of input.evidence) {
    const list = byThread.get(row.indexed.threadId) ?? [];
    list.push(row);
    byThread.set(row.indexed.threadId, list);
  }

  const extra: ContinuumCandidateDraft[] = [];
  const kept: ContinuumCandidateDraft[] = [];

  for (const draft of input.drafts) {
    const threadId = threadIdOf(draft);
    if (!threadId) {
      kept.push(draft);
      continue;
    }
    const threadEvidence = byThread.get(threadId) ?? [];
    const outbound = laterOutboundExists(
      threadEvidence,
      threadId,
      draft.sourceTimestamp,
    );
    const newProject = threadHasNewProject(input.drafts, threadId);

    if (
      draft.candidateType === "open_job" &&
      draft.payload.kind === "open_job" &&
      draft.payload.jobKind === "request" &&
      outbound
    ) {
      continue;
    }
    if (
      newProject &&
      draft.candidateType === "open_job" &&
      draft.payload.kind === "open_job" &&
      draft.payload.jobKind === "commitment" &&
      outbound
    ) {
      const waiting = extractWaitingOnClient(
        haystackOf(outbound.indexed.subject, outbound.plaintext ?? null),
      );
      if (waiting) continue;
    }
    kept.push(draft);
  }

  const seenWaiting = new Set<string>();
  for (const [threadId, rows] of byThread) {
    if (!threadHasNewProject(kept, threadId) && !threadHasNewProject(input.drafts, threadId)) {
      continue;
    }
    const inbound = [...rows]
      .filter((row) => row.indexed.direction === "inbound")
      .sort((a, b) => sentMs(a.indexed.sentAt) - sentMs(b.indexed.sentAt));
    const outboundQuestions = [...rows]
      .filter((row) => row.indexed.direction === "outbound")
      .sort((a, b) => sentMs(a.indexed.sentAt) - sentMs(b.indexed.sentAt))
      .filter((row) =>
        Boolean(
          extractWaitingOnClient(
            haystackOf(row.indexed.subject, row.plaintext ?? null),
          ),
        ),
      );
    const latest = [...rows].sort(
      (a, b) => sentMs(a.indexed.sentAt) - sentMs(b.indexed.sentAt),
    )[rows.length - 1];
    const outbound = outboundQuestions[outboundQuestions.length - 1] ?? null;
    if (!inbound.length || !outbound) continue;
    if (
      latest &&
      latest.indexed.direction === "inbound" &&
      sentMs(latest.indexed.sentAt) > sentMs(outbound.indexed.sentAt)
    ) {
      continue;
    }
    const waiting = extractWaitingOnClient(
      haystackOf(outbound.indexed.subject, outbound.plaintext ?? null),
    );
    if (!waiting) continue;
    const packed = packGmailCandidateSourceRef({
      threadId: outbound.indexed.threadId,
      messageId: outbound.indexed.messageId,
    });
    if (!packed.ok) continue;
    if (seenWaiting.has(threadId)) continue;
    seenWaiting.add(threadId);
    extra.push({
      candidateId: "",
      sourceSystem: GMAIL_SOURCE_SYSTEM,
      sourceRef: packed.sourceRef,
      sourceTimestamp: outbound.indexed.sentAt,
      createdAt: input.createdAt,
      canonical: false,
      automaticApply: false,
      parserVersion: CANDIDATE_PARSER_GMAIL_V1,
      candidateType: "project_context",
      proposedTarget: { kind: "project", projectId: null },
      payload: {
        kind: "project_context",
        topic: WAITING_ON_CLIENT_TOPIC,
        value: waiting.value,
      },
      confidence: "high",
      evidenceBasis: {
        ruleIds: waiting.ruleIds,
        matchedText: waiting.matchedText,
      },
      candidateState: "active",
    });
  }

  return [...kept, ...extra];
}

export function assignReconciledCandidates(
  drafts: ContinuumCandidateDraft[],
): ContinuumCandidate[] {
  const seen = new Set<string>();
  const out: ContinuumCandidate[] = [];
  for (const draft of drafts) {
    const row = assignCandidateId(draft);
    if (seen.has(row.candidateId)) continue;
    seen.add(row.candidateId);
    out.push(row);
  }
  return out;
}
