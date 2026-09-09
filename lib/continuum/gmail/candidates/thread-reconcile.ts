/**
 * Thread-level Gmail candidate reconciliation.
 * Distinguishes inbound new-project request vs founder already replied.
 * Does not write canonical lifecycle.
 */

import type { ContinuumCandidate, ContinuumCandidateDraft } from "@/lib/continuum/candidates/types";
import { parseGmailCandidateSourceRef } from "./source-ref";
import {
  extractCustomerEmails,
  extractPaymentReceivedAmount,
  extractWaitingOnClient,
  hasJewelryWorkContext,
  looksConsequentialBuyerIntent,
  looksProposalCommitmentIntent,
  looksTransactionalCustomerNotice,
  NEW_PROJECT_CONTEXT_TOPIC,
  proposeNewProjectTitle,
  REACTIVATED_COMMERCIAL_WORK_RULE,
  RELATED_CUSTOMER_JEWELRY_THREAD_RULE,
  TRANSACTIONAL_CUSTOMER_NOTICE_RULE,
  WAITING_ON_CLIENT_TOPIC,
} from "./new-project";
import type { GmailCandidateEvidence } from "./types";
import { hashEmail } from "@/lib/continuum/client-memory/hashes";
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

export function threadHasExactProjectAssociation(
  drafts: readonly ContinuumCandidateDraft[],
  threadId: string,
): boolean {
  return drafts.some(
    (row) =>
      threadIdOf(row) === threadId &&
      row.candidateType === "project_association" &&
      row.evidenceBasis.ruleIds.includes("exact_gmail_thread"),
  );
}

function threadHaystack(rows: readonly GmailCandidateEvidence[]): string {
  return rows
    .map((row) => haystackOf(row.indexed.subject, row.plaintext ?? null))
    .join("\n");
}

function threadTouchesCustomer(
  rows: readonly GmailCandidateEvidence[],
  customerHashes: ReadonlySet<string>,
): boolean {
  return rows.some((row) => {
    const hashes = [
      row.fromEmailHash ?? row.indexed.fromEmailHash,
      ...row.indexed.toEmailHashes,
      ...row.indexed.ccEmailHashes,
    ];
    return hashes.some((hash) => Boolean(hash && customerHashes.has(hash)));
  });
}

function commercialWorkDraft(input: {
  evidence: GmailCandidateEvidence;
  createdAt: string;
  title: string;
  ruleIds: readonly string[];
  matchedText: string;
}): ContinuumCandidateDraft | null {
  const packed = packGmailCandidateSourceRef({
    threadId: input.evidence.indexed.threadId,
    messageId: input.evidence.indexed.messageId,
  });
  if (!packed.ok) return null;
  return {
    candidateId: "",
    sourceSystem: GMAIL_SOURCE_SYSTEM,
    sourceRef: packed.sourceRef,
    sourceTimestamp: input.evidence.indexed.sentAt,
    createdAt: input.createdAt,
    canonical: false,
    automaticApply: false,
    parserVersion: CANDIDATE_PARSER_GMAIL_V1,
    candidateType: "project_context",
    proposedTarget: { kind: "project", projectId: null },
    payload: {
      kind: "project_context",
      topic: NEW_PROJECT_CONTEXT_TOPIC,
      value: input.title,
    },
    confidence: "medium",
    evidenceBasis: {
      ruleIds: input.ruleIds,
      matchedText: input.matchedText,
    },
    candidateState: "active",
  };
}

export function reconcileThreadCandidates(input: {
  drafts: ContinuumCandidateDraft[];
  evidence: readonly GmailCandidateEvidence[];
  createdAt: string;
  linkedGmailThreadIds?: readonly string[];
  supportingThreadIds?: readonly string[];
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

  const jewelryThreadIds = new Set<string>();
  const transactionalByThread = new Map<string, GmailCandidateEvidence[]>();
  for (const [threadId, rows] of byThread) {
    const hay = threadHaystack(rows);
    if (hasJewelryWorkContext(hay) && !looksTransactionalCustomerNotice(hay)) {
      jewelryThreadIds.add(threadId);
    }
    if (looksTransactionalCustomerNotice(hay)) {
      transactionalByThread.set(threadId, rows);
    }
  }

  const linkedThreads = new Set(input.linkedGmailThreadIds ?? []);
  const supportingThreads = new Set(input.supportingThreadIds ?? []);

  for (const [threadId, rows] of byThread) {
    if (linkedThreads.has(threadId)) continue;
    if (supportingThreads.has(threadId)) continue;
    if (threadHasNewProject(kept, threadId) || threadHasNewProject(input.drafts, threadId)) {
      continue;
    }
    if (threadHasExactProjectAssociation(kept, threadId)) continue;
    const inbound = [...rows]
      .filter((row) => row.indexed.direction === "inbound")
      .sort((a, b) => sentMs(a.indexed.sentAt) - sentMs(b.indexed.sentAt));
    if (inbound.length === 0) continue;
    const hay = threadHaystack(rows);
    const intent = [...inbound]
      .reverse()
      .find((row) => {
        const text = haystackOf(row.indexed.subject, row.plaintext ?? null);
        return (
          looksConsequentialBuyerIntent(text) ||
          looksProposalCommitmentIntent(text)
        );
      });
    if (intent && hasJewelryWorkContext(hay)) {
      const draft = commercialWorkDraft({
        evidence: intent,
        createdAt: input.createdAt,
        title: proposeNewProjectTitle(hay),
        ruleIds: [REACTIVATED_COMMERCIAL_WORK_RULE],
        matchedText: "price, timeline, or next steps",
      });
      if (draft) extra.push(draft);
      continue;
    }
    const transactional = transactionalByThread.get(threadId);
    if (!transactional) continue;
    const customerHashes = new Set(
      extractCustomerEmails(hay)
        .map((email) => hashEmail(email))
        .filter((row): row is string => Boolean(row)),
    );
    if (customerHashes.size === 0) continue;
    const customerJewelryIds = [...jewelryThreadIds].filter((otherId) => {
      if (otherId === threadId) return false;
      return threadTouchesCustomer(byThread.get(otherId) ?? [], customerHashes);
    });
    if (customerJewelryIds.length === 0) continue;
    const notice = [...inbound].reverse()[0]!;
    const relatedHay = customerJewelryIds
      .flatMap((id) => byThread.get(id) ?? [])
      .map((row) => haystackOf(row.indexed.subject, row.plaintext ?? null))
      .join("\n");
    const relatedExact = customerJewelryIds.flatMap((otherId) =>
      [...input.drafts, ...kept].filter(
        (row) =>
          threadIdOf(row) === otherId &&
          row.candidateType === "project_association" &&
          row.evidenceBasis.ruleIds.includes("exact_gmail_thread") &&
          row.proposedTarget.kind === "project" &&
          Boolean(row.proposedTarget.projectId),
      ),
    );
    const linkedProject =
      relatedExact[0]?.proposedTarget.kind === "project"
        ? relatedExact[0]
        : null;
    const amount = extractPaymentReceivedAmount(hay);
    const amountPrefix = amount ? `${amount} received; ` : "";
    const draft = commercialWorkDraft({
      evidence: notice,
      createdAt: input.createdAt,
      title: proposeNewProjectTitle(`${relatedHay}\n${hay}`),
      ruleIds: [TRANSACTIONAL_CUSTOMER_NOTICE_RULE],
      matchedText: linkedProject
        ? `${amountPrefix}payment received; related jewelry work; canonical Project found`
        : `${amountPrefix}payment received; related jewelry work; no canonical Project`,
    });
    if (draft) extra.push(draft);
    if (
      linkedProject &&
      linkedProject.proposedTarget.kind === "project" &&
      linkedProject.proposedTarget.projectId &&
      linkedProject.payload.kind === "project_association"
    ) {
      const packed = packGmailCandidateSourceRef({
        threadId,
        messageId: notice.indexed.messageId,
      });
      if (packed.ok) {
        extra.push({
          candidateId: "",
          sourceSystem: GMAIL_SOURCE_SYSTEM,
          sourceRef: packed.sourceRef,
          sourceTimestamp: notice.indexed.sentAt,
          createdAt: input.createdAt,
          canonical: false,
          automaticApply: false,
          parserVersion: CANDIDATE_PARSER_GMAIL_V1,
          candidateType: "project_association",
          proposedTarget: {
            kind: "project",
            projectId: linkedProject.proposedTarget.projectId,
          },
          payload: {
            kind: "project_association",
            title: linkedProject.payload.title,
            token: linkedProject.payload.token,
            match: "exact",
          },
          confidence: "high",
          evidenceBasis: {
            ruleIds: ["exact_gmail_thread", RELATED_CUSTOMER_JEWELRY_THREAD_RULE],
            matchedText: linkedProject.payload.token,
          },
          candidateState: "active",
        });
      }
    }
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
