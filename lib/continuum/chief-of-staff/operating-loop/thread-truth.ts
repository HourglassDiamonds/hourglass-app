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
  stripFooterTemplateNoise,
  type TodayGmailIndexedMessage,
  type TodayGmailThreadContext,
} from "@/lib/continuum/candidates/founder-attention";
import { isUnresolvedOpenJobState } from "@/lib/continuum/client-memory/project-jobs/validate";
import type { ProjectJob } from "@/lib/continuum/client-memory/project-jobs/types";
import { collectExactGmailIds } from "@/lib/continuum/candidates/exact-gmail-ids";
import { authorOwnedText } from "@/lib/continuum/gmail/candidates/spec-provenance";
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
  declinedCurrentBeat: boolean;
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
  /\b(here is the updated|let me know what you think|i(?:'|’)ll send|i am sending|i(?:'|’)m sending|moving forward|please proceed|just sent|i(?:'|’)ll get|i(?:'|’)ll check|i(?:'|’)ll show|i(?:'|’)ll keep you posted)\b/i;
const CLIENT_ASK =
  /\b(?:can you|could you|please) (?:send|make|revise|update|do|change|confirm|fix|show|get)\b/i;
const DECLINE_PROPOSAL =
  /^(?:no[,.]?\s+(?:thank you|thanks)\.?|no thanks\.?|not interested\.?|please (?:do not|don't) (?:send|contact|email|call)\b.*|i(?:'m| am) not interested\.?|we(?:'re| are) not interested\.?|i(?:'?ll| will) pass(?: for now)?\.?|thanks[,.]? but no(?: thanks)?\.?)$/i;

function parseMs(iso: string | null | undefined): number {
  if (!iso) return 0;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : 0;
}

function haystackOf(row: ContinuumCandidate): string {
  return `${candidateText(row)} ${row.evidenceBasis.matchedText ?? ""}`.trim();
}

function authorOwnedHaystackOf(row: ContinuumCandidate): string {
  return stripFooterTemplateNoise(authorOwnedText(haystackOf(row)));
}

function commitmentSpans(text: string): string[] {
  const spans: string[] = [];
  for (const match of text.matchAll(new RegExp(IMMEDIATE_COMMITMENT.source, "gi"))) {
    const span = (match[0] ?? "").replace(/\s+/g, " ").trim().toLowerCase();
    if (span) spans.push(span);
  }
  return spans;
}

function sameCommitmentSpan(left: string, right: string): boolean {
  const a = commitmentSpans(left);
  const b = commitmentSpans(right);
  if (a.length === 0 || b.length === 0) return false;
  return a.some((one) =>
    b.some((two) => one === two || one.includes(two) || two.includes(one)),
  );
}

function isDeclineOfPrecedingProposal(text: string): boolean {
  const cleaned = stripFooterTemplateNoise(text).replace(/\s+/g, " ").trim();
  if (!cleaned || cleaned.length > 240) return false;
  if (isImmediateCommitmentText(cleaned)) return false;
  const decline =
    /(?:^|[.!?]\s+)?(?:no[,.]?\s+(?:thank you|thanks)|no thanks|not interested|please (?:do not|don't) (?:send|contact|email|call)\b.*|i(?:'m| am) not interested|we(?:'re| are) not interested|i(?:'?ll| will) pass(?: for now)?|thanks[,.]? but no(?: thanks)?)\.?$/i;
  if (!decline.test(cleaned) && !DECLINE_PROPOSAL.test(cleaned)) return false;
  const leftover = cleaned
    .replace(
      /\b(?:no[,.]?\s+(?:thank you|thanks)|no thanks|not interested|i(?:'m| am) not interested|we(?:'re| are) not interested|i(?:'?ll| will) pass(?: for now)?|thanks[,.]? but no(?: thanks)?)\.?/gi,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();
  const leftoverWords = leftover.split(/\s+/).filter((word) => word.length > 2);
  return leftoverWords.length <= 6;
}

function founderHashesFromThread(
  thread: TodayGmailThreadContext | null | undefined,
  extra?: ReadonlySet<string> | readonly string[] | null,
): Set<string> {
  const hashes = new Set<string>();
  const add = (value: string | null | undefined) => {
    const hash = value?.trim().toLowerCase() ?? "";
    if (hash) hashes.add(hash);
  };
  for (const message of thread?.messages ?? []) {
    if (message.direction === "outbound") add(message.fromEmailHash);
  }
  if (extra) {
    for (const hash of extra) add(hash);
  }
  return hashes;
}

export function inferIndexedMessageDirection(
  message: TodayGmailIndexedMessage,
  founderHashes?: ReadonlySet<string> | null,
  inboundHash?: string | null,
): "inbound" | "outbound" | "unknown" {
  if (message.direction === "inbound" || message.direction === "outbound") {
    return message.direction;
  }
  const hash = message.fromEmailHash?.trim().toLowerCase() || null;
  if (hash && founderHashes?.has(hash)) return "outbound";
  if (hash && inboundHash && hash === inboundHash) return "inbound";
  if (hash && inboundHash && hash !== inboundHash) return "outbound";
  if (hash) return "inbound";
  return "unknown";
}

export function indexedMessagesWithInferredDirection(
  messages: readonly TodayGmailIndexedMessage[] | undefined,
  founderHashes?: ReadonlySet<string> | null,
): TodayGmailIndexedMessage[] {
  if (!messages?.length) return [];
  const founders = new Set(
    [...(founderHashes ?? [])].map((value) => value.trim().toLowerCase()).filter(Boolean),
  );
  const withFounder = messages.map((message) => {
    if (message.direction === "inbound" || message.direction === "outbound") return message;
    const hash = message.fromEmailHash?.trim().toLowerCase() || null;
    if (hash && founders.has(hash)) return { ...message, direction: "outbound" as const };
    return message;
  });
  const inboundHash =
    [...withFounder]
      .filter((row) => row.direction === "inbound")
      .sort((a, b) => parseMs(a.sentAt) - parseMs(b.sentAt))
      .at(-1)
      ?.fromEmailHash?.trim()
      .toLowerCase() ??
    [...withFounder]
      .map((row) => row.fromEmailHash?.trim().toLowerCase() ?? "")
      .filter((hash): hash is string => hash.length > 0 && !founders.has(hash))
      .at(-1) ??
    null;
  return withFounder.map((message) => {
    const direction = inferIndexedMessageDirection(message, founders, inboundHash);
    return direction === message.direction ? message : { ...message, direction };
  });
}

export function candidateDirection(
  row: ContinuumCandidate,
  thread?: TodayGmailThreadContext | null,
  founderHashes?: ReadonlySet<string> | null,
): "inbound" | "outbound" | "unknown" {
  const messageId = sourceMessageId(row);
  const hashes = founderHashesFromThread(thread, founderHashes);
  const indexed = thread?.messages?.find((item) => item.messageId === messageId);
  if (indexed) {
    const inboundHash =
      [...(thread?.messages ?? [])]
        .filter((item) => item.direction === "inbound")
        .sort((a, b) => parseMs(a.sentAt) - parseMs(b.sentAt))
        .at(-1)
        ?.fromEmailHash?.trim()
        .toLowerCase() ?? null;
    const inferred = inferIndexedMessageDirection(indexed, hashes, inboundHash);
    if (inferred === "inbound" || inferred === "outbound") return inferred;
  }
  if (
    hasRule(row, "explicit_founder_commitment") ||
    FOUNDER_OUTBOUND_HINT.test(authorOwnedHaystackOf(row))
  ) {
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

export function isImmediateCommitmentText(text: string): boolean {
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

function outboundOwnText(
  rows: readonly ContinuumCandidate[],
  thread: TodayGmailThreadContext | null | undefined,
  latestOutboundAt: string | null,
  latestOutboundMessageId: string | null,
): string {
  const outboundMs = parseMs(latestOutboundAt);
  return rows
    .filter((row) => {
      if (candidateDirection(row, thread) !== "outbound") return false;
      const messageId = sourceMessageId(row);
      if (latestOutboundMessageId && messageId) {
        return messageId === latestOutboundMessageId;
      }
      if (outboundMs > 0) return parseMs(row.sourceTimestamp) >= outboundMs;
      return true;
    })
    .map(authorOwnedHaystackOf)
    .join("\n");
}

function inboundOwnText(
  rows: readonly ContinuumCandidate[],
  thread: TodayGmailThreadContext | null | undefined,
): string {
  return rows
    .filter((row) => candidateDirection(row, thread) === "inbound")
    .map(authorOwnedHaystackOf)
    .join("\n");
}

function founderOwnsCommitment(outboundOwn: string, inboundOwn: string): boolean {
  if (!isImmediateCommitmentText(outboundOwn)) return false;
  if (sameCommitmentSpan(outboundOwn, inboundOwn)) return false;
  if (isImmediateCommitmentText(inboundOwn) && isMatchOnlyCommitment(outboundOwn)) {
    return false;
  }
  if (isMatchOnlyCommitment(outboundOwn) && !CLIENT_ASK.test(inboundOwn)) {
    return false;
  }
  return true;
}

function isMatchOnlyCommitment(text: string): boolean {
  const cleaned = stripFooterTemplateNoise(text).replace(/\s+/g, " ").trim();
  if (!cleaned) return false;
  const spans = commitmentSpans(cleaned);
  if (spans.length === 0) return false;
  let leftover = cleaned.toLowerCase();
  for (const span of spans) {
    leftover = leftover.replace(span, " ");
  }
  const words = leftover.replace(/\s+/g, " ").trim().split(/\s+/).filter((word) => word.length > 2);
  return words.length <= 2;
}

function hasUnresolvedCanonicalObligation(
  jobs: readonly ProjectJob[] | null | undefined,
  project: CosProjectContext | null | undefined,
): boolean {
  if (!project?.projectId || !jobs?.length) return false;
  return jobs.some(
    (job) =>
      job.projectId === project.projectId && isUnresolvedOpenJobState(job.state),
  );
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
  founderEmailHashes?: ReadonlySet<string> | readonly string[] | null;
}): ThreadTruthState {
  const hashes = founderHashesFromThread(input.thread, input.founderEmailHashes);
  const messages = indexedMessagesWithInferredDirection(input.thread?.messages, hashes);
  const thread = input.thread ? { ...input.thread, messages } : null;
  const indexedInbound = latestIndexed(messages, "inbound");
  const indexedOutbound = latestIndexed(messages, "outbound");
  const hasIndexedChronology = messages.length > 0;
  const latestInboundAt = hasIndexedChronology
    ? indexedInbound?.sentAt ?? null
    : latestCandidateStamp(input.rows, thread, "inbound");
  const latestOutboundAt = hasIndexedChronology
    ? indexedOutbound?.sentAt ?? null
    : latestCandidateStamp(input.rows, thread, "outbound");
  const inboundMs = parseMs(latestInboundAt);
  const outboundMs = parseMs(latestOutboundAt);
  const founderRepliedAfterInbound =
    inboundMs > 0 && outboundMs > inboundMs;
  const clientRepliedAfterOutbound =
    inboundMs > 0 && outboundMs > 0 && inboundMs > outboundMs;
  const staleInboundSatisfied =
    founderRepliedAfterInbound && !clientRepliedAfterOutbound;
  const outboundText = outboundOwnText(
    input.rows,
    thread,
    latestOutboundAt,
    indexedOutbound?.messageId ?? null,
  );
  const inboundText = inboundOwnText(input.rows, thread);
  const extracted =
    staleInboundSatisfied && founderOwnsCommitment(outboundText, inboundText)
      ? commitmentFromText(outboundText)
      : null;
  const remainingCommitment =
    extracted && !representedByOpenJob(extracted, input.jobs) ? extracted : null;
  const declinedCurrentBeat =
    staleInboundSatisfied &&
    !remainingCommitment &&
    isDeclineOfPrecedingProposal(outboundText) &&
    !hasUnresolvedCanonicalObligation(input.jobs, input.project);
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
    declinedCurrentBeat,
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
  if (key.startsWith("thread:")) {
    add(key.slice("thread:".length));
  }
  const latestRow = [...rows].sort(
    (a, b) => parseMs(a.sourceTimestamp) - parseMs(b.sourceTimestamp),
  ).at(-1);
  if (latestRow) {
    for (const threadId of collectExactGmailIds([latestRow]).threadIds) add(threadId);
  }
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

export function indexedThreadForGroup(
  key: string,
  rows: readonly ContinuumCandidate[],
  threadContext?: ReadonlyMap<string, TodayGmailThreadContext> | null,
): TodayGmailThreadContext | null {
  const threadIds = gmailThreadIdsForGroup(key, rows, threadContext);
  if (threadIds.length === 0) return null;
  const primary = threadContext?.get(threadIds[0]!) ?? null;
  if (key.startsWith("thread:") || threadIds.length === 1) return primary;
  const latestRow = [...rows].sort(
    (a, b) => parseMs(a.sourceTimestamp) - parseMs(b.sourceTimestamp),
  ).at(-1);
  const latestIds = latestRow ? collectExactGmailIds([latestRow]) : { threadIds: [] as string[] };
  const latestThreadId = latestIds.threadIds[0] ?? threadIds[0]!;
  return threadContext?.get(latestThreadId) ?? primary;
}

function rowsForThread(
  rows: readonly ContinuumCandidate[],
  threadId: string,
  threadContext?: ReadonlyMap<string, TodayGmailThreadContext> | null,
): ContinuumCandidate[] {
  const messageIds = new Set(
    (threadContext?.get(threadId)?.messages ?? []).map((row) => row.messageId),
  );
  return rows.filter((row) => {
    const ids = collectExactGmailIds([row]).threadIds;
    if (ids.includes(threadId)) return true;
    const messageId = sourceMessageId(row);
    return Boolean(messageId && messageIds.has(messageId));
  });
}

function laterAssociatedOutboundSatisfies(
  inboundAt: string | null,
  truths: readonly ThreadTruthState[],
): boolean {
  const inboundMs = parseMs(inboundAt);
  if (inboundMs <= 0) return false;
  return truths.some((truth) => parseMs(truth.latestOutboundAt) > inboundMs);
}

export function reconcileGroupTruthState(input: {
  key: string;
  rows: readonly ContinuumCandidate[];
  threadContext?: ReadonlyMap<string, TodayGmailThreadContext> | null;
  project?: CosProjectContext | null;
  jobs?: readonly ProjectJob[] | null;
  founderEmailHashes?: ReadonlySet<string> | readonly string[] | null;
  associatedThreadIds?: readonly string[] | null;
}): ThreadTruthState {
  const memberThreadIds = gmailThreadIdsForGroup(
    input.key,
    input.rows,
    input.threadContext,
  );
  const associatedIds = [
    ...new Set(
      [...memberThreadIds, ...(input.associatedThreadIds ?? [])].filter(Boolean),
    ),
  ];
  const primary = reconcileThreadTruthState({
    rows: input.rows,
    thread: indexedThreadForGroup(input.key, input.rows, input.threadContext),
    project: input.project,
    jobs: input.jobs,
    founderEmailHashes: input.founderEmailHashes,
  });
  if (associatedIds.length <= 1) return primary;

  const perThread = associatedIds.map((threadId) =>
    reconcileThreadTruthState({
      rows: rowsForThread(input.rows, threadId, input.threadContext),
      thread: input.threadContext?.get(threadId) ?? null,
      project: input.project,
      jobs: input.jobs,
      founderEmailHashes: input.founderEmailHashes,
    }),
  );
  const recapSourceThreads = [
    ...new Set(
      input.rows
        .filter(isInboundReplyObligation)
        .flatMap((row) => collectExactGmailIds([row]).threadIds),
    ),
  ];
  const recapStillOpen =
    recapSourceThreads.length > 0 &&
    recapSourceThreads.some((threadId) => {
      const index = associatedIds.indexOf(threadId);
      const truth = index >= 0 ? perThread[index]! : primary;
      if (truth.staleInboundSatisfied) return false;
      if (!truth.latestInboundAt) return false;
      return !laterAssociatedOutboundSatisfies(truth.latestInboundAt, perThread);
    });
  const staleInboundSatisfied =
    recapSourceThreads.length > 0
      ? !recapStillOpen
      : primary.staleInboundSatisfied ||
        laterAssociatedOutboundSatisfies(primary.latestInboundAt, perThread);
  const latestOutbound = [...perThread].sort(
    (a, b) => parseMs(a.latestOutboundAt) - parseMs(b.latestOutboundAt),
  ).at(-1);
  const remainingCommitment = staleInboundSatisfied
    ? (latestOutbound?.remainingCommitment ?? primary.remainingCommitment)
    : primary.remainingCommitment;
  const declinedCurrentBeat =
    staleInboundSatisfied &&
    (latestOutbound?.declinedCurrentBeat || primary.declinedCurrentBeat) &&
    !remainingCommitment;
  const waiting =
    staleInboundSatisfied && !remainingCommitment
      ? (latestOutbound?.waiting ?? primary.waiting)
      : null;
  const latestInbound = [...perThread].sort(
    (a, b) => parseMs(a.latestInboundAt) - parseMs(b.latestInboundAt),
  ).at(-1);
  return {
    latestInboundAt: latestInbound?.latestInboundAt ?? primary.latestInboundAt,
    latestOutboundAt: latestOutbound?.latestOutboundAt ?? primary.latestOutboundAt,
    founderRepliedAfterInbound: staleInboundSatisfied,
    clientRepliedAfterOutbound: !staleInboundSatisfied && recapStillOpen,
    staleInboundSatisfied,
    remainingCommitment,
    declinedCurrentBeat,
    waiting,
  };
}
