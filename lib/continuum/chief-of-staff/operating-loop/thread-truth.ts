/**
 * Thread truth-state reconciliation for Today composition.
 * Latest founder outbound can satisfy an earlier inbound-derived reply/recap
 * without deleting candidates or writing Person/Project/Open Job state.
 */

import type { ContinuumCandidate } from "@/lib/continuum/candidates/types";
import {
  candidateText,
  hasRule,
  isClientDesignAnswer,
  payloadOf,
  sourceMessageId,
  type TodayGmailIndexedMessage,
  type TodayGmailThreadContext,
} from "@/lib/continuum/candidates/founder-attention";
import { isUnresolvedOpenJobState } from "@/lib/continuum/client-memory/project-jobs/validate";
import type { ProjectJob } from "@/lib/continuum/client-memory/project-jobs/types";
import {
  collectExactGmailIds,
  exactGmailIdsFromCandidate,
} from "@/lib/continuum/candidates/exact-gmail-ids";
import type { CosProjectContext } from "./types";

export type ThreadWaitingKind = "client" | "shop" | "cad" | "production";

export type RemainingFounderCommitment = {
  headline: string;
  explanation: string;
  recommended: string;
  matchedText: string;
};

export type ThreadTruthState = {
  latestInboundAt: string | null;
  latestOutboundAt: string | null;
  founderRepliedAfterInbound: boolean;
  clientRepliedAfterOutbound: boolean;
  staleInboundSatisfied: boolean;
  remainingCommitment: RemainingFounderCommitment | null;
  waiting: ThreadWaitingKind | null;
};

const PRODUCTION_STAGES = new Set([
  "production",
  "in_production",
  "manufacturing",
  "bench",
]);

const IMMEDIATE_COMMITMENT =
  /\bI(?:'ll| will) (?:send|get|show|check|look(?:\s+into)?|do|follow up|call|email)[^.!?\n]{0,160}/gi;
const GET_BACK = /\bI(?:'ll| will) get back\b/i;
const DATED_FOLLOW_UP =
  /\bI(?:'ll| will) follow up\b[^.!?\n]{0,80}\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow)\b/i;
const DEFERRED_PRODUCTION =
  /\b(?:keep you posted|as we get (?:a little )?closer|give an exact)\b/i;
const CAD_WAIT =
  /\b(?:CAD comes? back|updated CAD|what the CAD|waiting on (?:the )?(?:CAD|render)|let(?:'s| us) see what the CAD)\b/i;
const SHOP_WAIT =
  /\b(?:waiting on (?:the )?shop|in (?:the )?shop|on the bench)\b/i;
const FOUNDER_OUTBOUND_HINT =
  /\b(i(?:'|’)ll send|i am sending|i(?:'|’)m sending|moving forward|please proceed|just sent|i(?:'|’)ll get|i(?:'|’)ll check|i(?:'|’)ll show|i(?:'|’)ll keep you posted)\b/i;

function parseMs(iso: string | null | undefined): number {
  if (!iso) return 0;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : 0;
}

function haystackOf(row: ContinuumCandidate): string {
  return `${candidateText(row)} ${row.evidenceBasis.matchedText ?? ""}`.trim();
}

export function candidateDirection(
  row: ContinuumCandidate,
  thread?: TodayGmailThreadContext | null,
): "inbound" | "outbound" | "unknown" {
  const messageId = sourceMessageId(row);
  const indexed = thread?.messages?.find((item) => item.messageId === messageId);
  if (indexed?.direction === "inbound" || indexed?.direction === "outbound") {
    return indexed.direction;
  }
  if (hasRule(row, "explicit_founder_commitment") || FOUNDER_OUTBOUND_HINT.test(haystackOf(row))) {
    return "outbound";
  }
  if (
    hasRule(row, "explicit_client_request") ||
    hasRule(row, "explicit_cad_feedback") ||
    hasRule(row, "explicit_client_approval") ||
    hasRule(row, "explicit_change_request") ||
    hasRule(row, "explicit_production_question") ||
    hasRule(row, "explicit_design_refinement") ||
    isClientDesignAnswer(row)
  ) {
    return "inbound";
  }
  return "unknown";
}

function latestIndexed(
  messages: readonly TodayGmailIndexedMessage[] | undefined,
  direction: "inbound" | "outbound",
): TodayGmailIndexedMessage | null {
  if (!messages?.length) return null;
  return (
    [...messages]
      .filter((row) => row.direction === direction)
      .sort((a, b) => parseMs(a.sentAt) - parseMs(b.sentAt))
      .at(-1) ?? null
  );
}

function latestCandidateStamp(
  rows: readonly ContinuumCandidate[],
  thread: TodayGmailThreadContext | null | undefined,
  direction: "inbound" | "outbound",
): string | null {
  const stamps = rows
    .filter((row) => candidateDirection(row, thread) === direction)
    .map((row) => row.sourceTimestamp)
    .sort((a, b) => parseMs(a) - parseMs(b));
  return stamps.at(-1) ?? null;
}

function isImmediateCommitmentText(text: string): boolean {
  const hay = text.trim();
  if (!hay) return false;
  if (DEFERRED_PRODUCTION.test(hay) && !/\b(?:send|get|show|check)\b/i.test(hay)) {
    return false;
  }
  if (GET_BACK.test(hay) && !/\bvideo|chain|pricing|availability\b/i.test(hay)) {
    return false;
  }
  if (DATED_FOLLOW_UP.test(hay)) return true;
  return new RegExp(IMMEDIATE_COMMITMENT.source, "gi").test(hay);
}

function chainTaskHeadline(text: string): string | null {
  const hay = text.toLowerCase();
  const chain = /\bchain\b/.test(hay);
  const video = /\bvideo\b/.test(hay);
  const pricing = /\bpric(?:e|ing)|availability\b/.test(hay);
  if (
    (chain || video || pricing) &&
    /\bI(?:'ll| will) (?:send|get|show|check)\b/i.test(text)
  ) {
    return "Send chain video, options, and pricing.";
  }
  return null;
}

function commitmentFromText(text: string): RemainingFounderCommitment | null {
  const hay = text.trim();
  if (!hay || !isImmediateCommitmentText(hay)) return null;
  const recommended = chainTaskHeadline(hay) ?? clipCommitment(hay);
  return {
    headline: recommended.replace(/\.$/, ""),
    explanation: "You already replied, and this specific commitment is still open.",
    recommended,
    matchedText: clipCommitment(hay, 220),
  };
}

function clipCommitment(text: string, max = 72): string {
  const clean = text.replace(/\s+/g, " ").trim();
  const finished = /[.!?]$/.test(clean) ? clean : `${clean}.`;
  if (finished.length <= max) return finished;
  return `${finished.slice(0, max - 1).trimEnd()}…`;
}

function outboundHaystack(
  rows: readonly ContinuumCandidate[],
  thread: TodayGmailThreadContext | null | undefined,
  latestOutboundAt: string | null,
): string {
  const outboundMs = parseMs(latestOutboundAt);
  return rows
    .filter((row) => {
      if (candidateDirection(row, thread) === "outbound") return true;
      return outboundMs > 0 && parseMs(row.sourceTimestamp) >= outboundMs;
    })
    .map(haystackOf)
    .join("\n");
}

function waitingFromText(
  text: string,
  project: CosProjectContext | null | undefined,
): ThreadWaitingKind | null {
  if (CAD_WAIT.test(text)) return "cad";
  if (SHOP_WAIT.test(text)) return "shop";
  if (/\?/.test(text) || /\b(?:or|would you|let me know|prefer|rather)\b/i.test(text)) {
    return "client";
  }
  if (DEFERRED_PRODUCTION.test(text)) return "production";
  if (!text.trim()) return "client";
  const stage = project?.lifecycleStage ?? null;
  if (stage === "cad" || stage === "design") return "cad";
  if (stage && PRODUCTION_STAGES.has(stage)) return "production";
  return "client";
}

function isInboundReplyObligation(row: ContinuumCandidate): boolean {
  if (
    row.candidateType === "person_association" ||
    row.candidateType === "project_association"
  ) {
    return false;
  }
  if (hasRule(row, "explicit_founder_commitment")) return false;
  const payload = payloadOf(row);
  if (payload.kind === "open_job" && payload.jobKind === "request") return true;
  return (
    hasRule(row, "explicit_client_request") ||
    hasRule(row, "explicit_cad_feedback") ||
    hasRule(row, "explicit_design_refinement") ||
    hasRule(row, "explicit_client_approval") ||
    hasRule(row, "explicit_change_request") ||
    hasRule(row, "explicit_follow_up") ||
    hasRule(row, "explicit_production_question") ||
    isClientDesignAnswer(row)
  );
}

export function isStaleInboundReplyCandidate(
  row: ContinuumCandidate,
  truth: ThreadTruthState,
  thread?: TodayGmailThreadContext | null,
): boolean {
  if (!truth.staleInboundSatisfied) return false;
  const direction = candidateDirection(row, thread);
  if (direction === "outbound") return false;
  if (!isInboundReplyObligation(row)) return false;
  const ts = parseMs(row.sourceTimestamp);
  if (truth.latestOutboundAt && ts >= parseMs(truth.latestOutboundAt)) return false;
  return true;
}

function contentTokens(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 4);
}

function textsOverlap(left: string, right: string): boolean {
  const a = new Set(contentTokens(left));
  if (a.size === 0) return false;
  return contentTokens(right).some((token) => a.has(token));
}

function representedByOpenJob(
  remaining: RemainingFounderCommitment,
  jobs: readonly ProjectJob[] | null | undefined,
): boolean {
  if (!jobs?.length) return false;
  const needle = `${remaining.matchedText} ${remaining.recommended}`;
  return jobs.some((job) => {
    if (!isUnresolvedOpenJobState(job.state)) return false;
    return textsOverlap(needle, `${job.subject} ${job.detail ?? ""}`);
  });
}

export function reconcileThreadTruthState(input: {
  rows: readonly ContinuumCandidate[];
  thread?: TodayGmailThreadContext | null;
  project?: CosProjectContext | null;
  jobs?: readonly ProjectJob[] | null;
}): ThreadTruthState {
  const thread = input.thread ?? null;
  const indexedInbound = latestIndexed(thread?.messages, "inbound");
  const indexedOutbound = latestIndexed(thread?.messages, "outbound");
  const latestInboundAt =
    indexedInbound?.sentAt ?? latestCandidateStamp(input.rows, thread, "inbound");
  const latestOutboundAt =
    indexedOutbound?.sentAt ?? latestCandidateStamp(input.rows, thread, "outbound");
  const inboundMs = parseMs(latestInboundAt);
  const outboundMs = parseMs(latestOutboundAt);
  const founderRepliedAfterInbound =
    inboundMs > 0 && outboundMs > inboundMs;
  const clientRepliedAfterOutbound =
    inboundMs > 0 && outboundMs > 0 && inboundMs > outboundMs;
  const staleInboundSatisfied =
    founderRepliedAfterInbound && !clientRepliedAfterOutbound;
  const outboundText = outboundHaystack(input.rows, thread, latestOutboundAt);
  const extracted = staleInboundSatisfied
    ? commitmentFromText(outboundText)
    : null;
  const remainingCommitment =
    extracted && !representedByOpenJob(extracted, input.jobs) ? extracted : null;
  const waiting =
    staleInboundSatisfied && !remainingCommitment
      ? waitingFromText(outboundText, input.project)
      : null;
  return {
    latestInboundAt,
    latestOutboundAt,
    founderRepliedAfterInbound,
    clientRepliedAfterOutbound,
    staleInboundSatisfied,
    remainingCommitment,
    waiting,
  };
}

export function threadIdForGroup(
  key: string,
  rows: readonly ContinuumCandidate[],
  threadContext?: ReadonlyMap<string, TodayGmailThreadContext> | null,
): string | null {
  return gmailThreadIdsForGroup(key, rows, threadContext)[0] ?? null;
}

export function gmailThreadIdsForGroup(
  key: string,
  rows: readonly ContinuumCandidate[],
  threadContext?: ReadonlyMap<string, TodayGmailThreadContext> | null,
): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  const add = (value: string | null | undefined) => {
    const id = value?.trim() ?? "";
    if (!id || seen.has(id)) return;
    seen.add(id);
    ids.push(id);
  };
  if (key.startsWith("thread:")) add(key.slice("thread:".length));
  const collected = collectExactGmailIds(rows);
  for (const threadId of collected.threadIds) add(threadId);
  const messageIds = new Set(collected.messageIds);
  if (threadContext && messageIds.size > 0) {
    for (const [threadId, thread] of threadContext) {
      if ((thread.messages ?? []).some((row) => messageIds.has(row.messageId))) {
        add(threadId);
      }
    }
  }
  return ids;
}

function mergeIndexedThreads(
  threads: readonly TodayGmailThreadContext[],
): TodayGmailThreadContext | null {
  if (threads.length === 0) return null;
  if (threads.length === 1) return threads[0]!;
  const messages = [...threads.flatMap((thread) => thread.messages ?? [])].sort(
    (a, b) => parseMs(a.sentAt) - parseMs(b.sentAt),
  );
  const latestInbound = [...messages].reverse().find((row) => row.direction === "inbound");
  const identity =
    threads.find((thread) =>
      (thread.messages ?? []).some((row) => row.messageId === latestInbound?.messageId),
    ) ??
    threads.find((thread) => thread.fromEmail || thread.fromDisplayName) ??
    threads[0]!;
  return {
    subject: identity.subject ?? threads.find((thread) => thread.subject)?.subject ?? null,
    fromDisplayName: identity.fromDisplayName ?? null,
    fromEmail: identity.fromEmail ?? null,
    liveIdentityLoaded: threads.some((thread) => thread.liveIdentityLoaded === true),
    messages,
  };
}

export function indexedThreadForGroup(
  key: string,
  rows: readonly ContinuumCandidate[],
  threadContext?: ReadonlyMap<string, TodayGmailThreadContext> | null,
): TodayGmailThreadContext | null {
  const threadIds = gmailThreadIdsForGroup(key, rows, threadContext);
  const threads = threadIds
    .map((id) => threadContext?.get(id) ?? null)
    .filter((row): row is TodayGmailThreadContext => Boolean(row));
  return mergeIndexedThreads(threads);
}

function rowBelongsToThread(
  row: ContinuumCandidate,
  threadId: string,
  thread: TodayGmailThreadContext | null,
): boolean {
  const ids = exactGmailIdsFromCandidate(row);
  if (ids.threadIds.includes(threadId)) return true;
  if ((thread?.messages ?? []).some((item) => ids.messageIds.includes(item.messageId))) {
    return true;
  }
  return false;
}

function mergeThreadTruths(truths: readonly ThreadTruthState[]): ThreadTruthState {
  const withInbound = truths.filter((row) => row.latestInboundAt);
  const staleInboundSatisfied =
    withInbound.length > 0
      ? withInbound.every((row) => row.staleInboundSatisfied)
      : truths.every((row) => row.staleInboundSatisfied);
  const remainingCommitment =
    truths.find((row) => row.remainingCommitment)?.remainingCommitment ?? null;
  const latestInboundAt =
    withInbound
      .map((row) => row.latestInboundAt)
      .sort((a, b) => parseMs(a) - parseMs(b))
      .at(-1) ?? null;
  const latestOutboundAt =
    truths
      .map((row) => row.latestOutboundAt)
      .filter((row): row is string => Boolean(row))
      .sort((a, b) => parseMs(a) - parseMs(b))
      .at(-1) ?? null;
  return {
    latestInboundAt,
    latestOutboundAt,
    founderRepliedAfterInbound: staleInboundSatisfied,
    clientRepliedAfterOutbound: truths.some((row) => row.clientRepliedAfterOutbound),
    staleInboundSatisfied,
    remainingCommitment,
    waiting:
      staleInboundSatisfied && !remainingCommitment
        ? (truths.find((row) => row.waiting)?.waiting ?? "client")
        : null,
  };
}

export function reconcileGroupTruthState(input: {
  key: string;
  rows: readonly ContinuumCandidate[];
  threadContext?: ReadonlyMap<string, TodayGmailThreadContext> | null;
  project?: CosProjectContext | null;
  jobs?: readonly ProjectJob[] | null;
}): ThreadTruthState {
  const threadIds = gmailThreadIdsForGroup(input.key, input.rows, input.threadContext);
  if (threadIds.length <= 1) {
    return reconcileThreadTruthState({
      rows: input.rows,
      thread: indexedThreadForGroup(input.key, input.rows, input.threadContext),
      project: input.project,
      jobs: input.jobs,
    });
  }
  const truths = threadIds.map((threadId) => {
    const thread = input.threadContext?.get(threadId) ?? null;
    const rows = input.rows.filter((row) => rowBelongsToThread(row, threadId, thread));
    return reconcileThreadTruthState({
      rows,
      thread,
      project: input.project,
      jobs: input.jobs,
    });
  });
  return mergeThreadTruths(truths);
}
