/**
 * Read-time current-action eligibility over persisted Candidates.
 * continuum_candidates is a proposal/evidence store. candidate_state = active
 * never means the obligation is currently active. Does not write rows.
 */

import type { ContinuumCandidate } from "@/lib/continuum/candidates/types";
import { collectExactGmailIds } from "@/lib/continuum/candidates/exact-gmail-ids";
import { currentCadTokensFromIdentityHay } from "@/lib/continuum/candidates/work-loop-identity";
import {
  candidateText,
  hasRule,
  payloadOf,
  type TodayGmailThreadContext,
} from "@/lib/continuum/candidates/founder-attention";
import { isQuotedHistoricalCandidate } from "@/lib/continuum/gmail/candidates/spec-provenance";
import { candidateDirection, type RemainingFounderCommitment } from "./thread-truth";

export const CURRENT_ACTION_ELIGIBILITY_REASONS = [
  "eligible",
  "quoted_historical",
  "duplicate_wrapper",
  "fulfilled_artifact",
  "superseded_by_later_state",
  "context_only",
] as const;

export type CurrentActionEligibilityReason =
  (typeof CURRENT_ACTION_ELIGIBILITY_REASONS)[number];

export type CurrentActionEligibility = {
  eligible: boolean;
  reason: CurrentActionEligibilityReason;
};

const ARTIFACT_REQUEST =
  /\b(?:can you|could you|please)\b[^.!?\n]{0,40}\bsend(?: me)?(?: the)? (?:stl(?:\s+file)?|cad(?:\s+file)?|updated cad)\b|\bsend me the stl\b|\bneed(?:s)? the (?:stl(?:\s+file)?|cad(?:\s+file)?)\b/i;
const ARTIFACT_DELIVERED =
  /\b(?:here is|attached|delivered|sent)\b[^.!?\n]{0,80}\b(?:mod\s*\d+\s+)?(?:stl|cad)\b|\b(?:mod\s*\d+\s+)?(?:stl|cad)\b[^.!?\n]{0,40}\b(?:attached|delivered|sent)\b/i;
const DESIGN_CHANGE_REQUEST =
  /\b(?:please (?:change|soften|revise)|can we change|change request|soften the (?:double[- ]?)?prong|(?:change|soften|revise) (?:the )?(?:double[- ]?)?(?:prongs?|shank|claws?)|shank width|rounded[- ]claws?)\b/i;
const LATER_LOOP_ADVANCE =
  /\b(?:workshop|going to (?:the )?workshop|stone is going|place (?:the |your )?order|order confirmation|final CAD|moving forward|please proceed|RN\d{4,}|size\s+\d|I'll update the CAD|updated CAD)\b/i;
const CONTEXT_TOPICS = new Set(["design_basis", "gift_context", "historical_quoted_note"]);

function parseMs(iso: string | null | undefined): number {
  const ms = Date.parse(iso ?? "");
  return Number.isFinite(ms) ? ms : 0;
}

function folded(text: string | null | undefined): string {
  return text?.replace(/\s+/g, " ").trim().toLowerCase() ?? "";
}

export function candidateObligationText(row: ContinuumCandidate): string {
  const payload = payloadOf(row);
  const extra =
    payload.kind === "open_job"
      ? `${payload.subject} ${payload.detail ?? ""}`
      : payload.kind === "project_context"
        ? payload.value
        : payload.kind === "note"
          ? payload.text
          : "";
  return `${row.evidenceBasis.matchedText ?? ""} ${extra} ${candidateText(row)}`;
}

export function isCurrentActionCopyText(text: string | null | undefined): boolean {
  const hay = folded(text);
  if (!hay) return false;
  return ARTIFACT_REQUEST.test(hay) || DESIGN_CHANGE_REQUEST.test(hay);
}

function laterPeers(
  row: ContinuumCandidate,
  peers: readonly ContinuumCandidate[],
): ContinuumCandidate[] {
  const ts = parseMs(row.sourceTimestamp);
  return peers.filter((peer) => {
    if (peer.candidateId === row.candidateId) return false;
    return parseMs(peer.sourceTimestamp) >= ts;
  });
}

function isRequestLike(row: ContinuumCandidate): boolean {
  const payload = payloadOf(row);
  const text = candidateObligationText(row);
  return (
    payload.kind === "open_job" ||
    (payload.kind === "project_context" &&
      (payload.topic === "design_basis" ||
        payload.topic === "change_request" ||
        payload.topic === "cad_feedback")) ||
    ARTIFACT_REQUEST.test(text) ||
    DESIGN_CHANGE_REQUEST.test(text)
  );
}

function isDuplicateWrapper(
  row: ContinuumCandidate,
  peers: readonly ContinuumCandidate[],
): boolean {
  if (!isRequestLike(row)) return false;
  const needle = folded(row.evidenceBasis.matchedText);
  if (needle.length < 12) return false;
  const refs = new Set<string>();
  for (const peer of peers) {
    if (folded(peer.evidenceBasis.matchedText) !== needle) continue;
    refs.add(peer.sourceRef);
  }
  return refs.size >= 2;
}

function isContextOnly(row: ContinuumCandidate): boolean {
  if (hasRule(row, "explicit_durability_discussion")) return true;
  const payload = payloadOf(row);
  if (payload.kind === "note") {
    return /\bdurability\b|\bprincess cut\b/i.test(payload.text);
  }
  if (payload.kind !== "project_context") return false;
  return CONTEXT_TOPICS.has(payload.topic) || payload.topic.startsWith("historical_");
}

function isFulfilledArtifactRequest(
  row: ContinuumCandidate,
  peers: readonly ContinuumCandidate[],
): boolean {
  const text = candidateObligationText(row);
  if (!ARTIFACT_REQUEST.test(text)) return false;
  return laterPeers(row, peers).some((peer) => ARTIFACT_DELIVERED.test(candidateObligationText(peer)));
}

function isSupersededDesignRequest(
  row: ContinuumCandidate,
  peers: readonly ContinuumCandidate[],
): boolean {
  const text = candidateObligationText(row);
  const change =
    DESIGN_CHANGE_REQUEST.test(text) ||
    hasRule(row, "explicit_change_request") ||
    hasRule(row, "explicit_cad_feedback");
  if (!change) return false;
  return laterPeers(row, peers).some((peer) => LATER_LOOP_ADVANCE.test(candidateObligationText(peer)));
}

type PreparedCandidate = {
  row: ContinuumCandidate;
  threadIds: string[];
  messageIds: string[];
  cads: string[];
};

type CandidateChronologyIndex = {
  byId: Map<string, PreparedCandidate>;
  rows: PreparedCandidate[];
};

type PreparedThread = {
  threadId: string;
  cads: string[];
  messageIds: string[];
};

const candidateIndexCache = new WeakMap<object, CandidateChronologyIndex>();
const threadIndexCache = new WeakMap<object, PreparedThread[]>();

function gmailIdsForRow(row: ContinuumCandidate): {
  threadIds: string[];
  messageIds: string[];
} {
  if (row.sourceSystem !== "gmail") return { threadIds: [], messageIds: [] };
  return collectExactGmailIds([row]);
}

function prepareCandidate(row: ContinuumCandidate): PreparedCandidate {
  const ids = gmailIdsForRow(row);
  return {
    row,
    threadIds: ids.threadIds,
    messageIds: ids.messageIds,
    cads: cadTokensFromHay([candidateObligationText(row)]),
  };
}

function candidateChronologyIndex(
  rows: readonly ContinuumCandidate[],
): CandidateChronologyIndex {
  const cached = candidateIndexCache.get(rows);
  if (cached) return cached;
  const byId = new Map<string, PreparedCandidate>();
  const prepared: PreparedCandidate[] = [];
  for (const row of rows) {
    const item = prepareCandidate(row);
    prepared.push(item);
    if (!byId.has(row.candidateId)) byId.set(row.candidateId, item);
  }
  const index = { byId, rows: prepared };
  candidateIndexCache.set(rows, index);
  return index;
}

function threadChronologyIndex(
  threadContext: ReadonlyMap<string, TodayGmailThreadContext>,
): PreparedThread[] {
  const cached = threadIndexCache.get(threadContext);
  if (cached) return cached;
  const prepared: PreparedThread[] = [];
  for (const [threadId, ctx] of threadContext) {
    const messageIds: string[] = [];
    for (const message of ctx.messages ?? []) {
      if (message.messageId) messageIds.push(message.messageId);
    }
    prepared.push({
      threadId,
      cads: cadTokensFromHay([ctx.subject, ...(ctx.attachmentFilenames ?? [])]),
      messageIds,
    });
  }
  threadIndexCache.set(threadContext, prepared);
  return prepared;
}

function preparedGroupRow(
  row: ContinuumCandidate,
  index: CandidateChronologyIndex,
): PreparedCandidate {
  const hit = index.byId.get(row.candidateId);
  if (hit?.row === row) return hit;
  return prepareCandidate(row);
}

function cadTokensFromHay(texts: readonly (string | null | undefined)[]): string[] {
  const seen = new Set<string>();
  const tokens: string[] = [];
  const push = (value: string) => {
    const cad = value.trim().toUpperCase();
    if (!cad || seen.has(cad)) return;
    seen.add(cad);
    tokens.push(cad);
  };
  for (const cad of currentCadTokensFromIdentityHay(texts)) push(cad);
  for (const text of texts) {
    for (const match of text?.match(/\bC\d{5,}\b/gi) ?? []) push(match);
  }
  return tokens;
}

export function chronologyPeers(
  groupRows: readonly ContinuumCandidate[],
  allRows: readonly ContinuumCandidate[] | null | undefined,
  thread?: TodayGmailThreadContext | null,
  threadContext?: ReadonlyMap<string, TodayGmailThreadContext> | null,
): ContinuumCandidate[] {
  const pool = allRows?.length ? allRows : groupRows;
  const index = candidateChronologyIndex(pool);
  const threadIds = new Set<string>();
  const messageIds = new Set<string>();
  const cads = new Set<string>();
  const addIdentity = (texts: readonly (string | null | undefined)[]) => {
    for (const cad of cadTokensFromHay(texts)) cads.add(cad);
  };
  for (const row of groupRows) {
    const prepared = preparedGroupRow(row, index);
    for (const value of prepared.threadIds) threadIds.add(value);
    for (const value of prepared.messageIds) messageIds.add(value);
    for (const cad of prepared.cads) cads.add(cad);
  }
  addIdentity([thread?.subject, ...(thread?.attachmentFilenames ?? [])]);
  for (const message of thread?.messages ?? []) {
    if (message.messageId) messageIds.add(message.messageId);
  }
  if (threadContext) {
    for (const prepared of threadChronologyIndex(threadContext)) {
      const hit =
        threadIds.has(prepared.threadId) ||
        prepared.cads.some((cad) => cads.has(cad)) ||
        prepared.messageIds.some(
          (messageId) => messageIds.has(messageId) || threadIds.has(messageId),
        );
      if (!hit) continue;
      threadIds.add(prepared.threadId);
      for (const messageId of prepared.messageIds) messageIds.add(messageId);
      for (const cad of prepared.cads) cads.add(cad);
    }
  }
  const groupIds = new Set(groupRows.map((row) => row.candidateId));
  const peers: ContinuumCandidate[] = [];
  for (const prepared of index.rows) {
    if (groupIds.has(prepared.row.candidateId)) {
      peers.push(prepared.row);
      continue;
    }
    if (
      prepared.threadIds.some((value) => threadIds.has(value) || messageIds.has(value)) ||
      prepared.messageIds.some((value) => messageIds.has(value) || threadIds.has(value)) ||
      prepared.cads.some((cad) => cads.has(cad))
    ) {
      peers.push(prepared.row);
    }
  }
  return peers;
}

export function currentActionEligibility(
  row: ContinuumCandidate,
  input: {
    peers: readonly ContinuumCandidate[];
    thread?: TodayGmailThreadContext | null;
  },
): CurrentActionEligibility {
  if (isQuotedHistoricalCandidate(row)) {
    return { eligible: false, reason: "quoted_historical" };
  }
  if (isContextOnly(row)) {
    return { eligible: false, reason: "context_only" };
  }
  if (isDuplicateWrapper(row, input.peers)) {
    return { eligible: false, reason: "duplicate_wrapper" };
  }
  if (isFulfilledArtifactRequest(row, input.peers)) {
    return { eligible: false, reason: "fulfilled_artifact" };
  }
  if (isSupersededDesignRequest(row, input.peers)) {
    return { eligible: false, reason: "superseded_by_later_state" };
  }
  const direction = candidateDirection(row, input.thread);
  if (
    direction === "inbound" &&
    hasRule(row, "explicit_founder_commitment") &&
    !hasRule(row, "explicit_external_commitment")
  ) {
    return { eligible: false, reason: "quoted_historical" };
  }
  return { eligible: true, reason: "eligible" };
}

export function isCurrentActionEligible(
  row: ContinuumCandidate,
  input: {
    peers: readonly ContinuumCandidate[];
    thread?: TodayGmailThreadContext | null;
  },
): boolean {
  return currentActionEligibility(row, input).eligible;
}

export function eligibleCurrentActionRows(
  rows: readonly ContinuumCandidate[],
  thread?: TodayGmailThreadContext | null,
  allRows?: readonly ContinuumCandidate[] | null,
  threadContext?: ReadonlyMap<string, TodayGmailThreadContext> | null,
): ContinuumCandidate[] {
  const peers = chronologyPeers(rows, allRows ?? rows, thread, threadContext);
  return rows.filter((row) => isCurrentActionEligible(row, { peers, thread }));
}

export function remainingIfCurrentlyActionable(
  remaining: RemainingFounderCommitment | null | undefined,
  rows: readonly ContinuumCandidate[],
  thread?: TodayGmailThreadContext | null,
  allRows?: readonly ContinuumCandidate[] | null,
  threadContext?: ReadonlyMap<string, TodayGmailThreadContext> | null,
  peers?: readonly ContinuumCandidate[],
): RemainingFounderCommitment | null {
  if (!remaining) return null;
  const needle = folded(remaining.matchedText);
  if (!needle) return remaining;
  const resolvedPeers =
    peers ?? chronologyPeers(rows, allRows ?? rows, thread, threadContext);
  const blocked = resolvedPeers.some((row) => {
    if (isCurrentActionEligible(row, { peers: resolvedPeers, thread })) return false;
    const matched = folded(row.evidenceBasis.matchedText);
    if (matched.length < 12) return false;
    return needle === matched || needle.includes(matched) || matched.includes(needle);
  });
  return blocked ? null : remaining;
}

export function ineligibleCurrentActionTexts(
  rows: readonly ContinuumCandidate[],
  thread?: TodayGmailThreadContext | null,
  allRows?: readonly ContinuumCandidate[] | null,
  threadContext?: ReadonlyMap<string, TodayGmailThreadContext> | null,
  peers?: readonly ContinuumCandidate[],
): string[] {
  const resolvedPeers = peers ?? chronologyPeers(rows, allRows ?? rows, thread, threadContext);
  return resolvedPeers
    .filter((row) => !isCurrentActionEligible(row, { peers: resolvedPeers, thread }))
    .map((row) => folded(row.evidenceBasis.matchedText))
    .filter((text) => text.length >= 12);
}

export function copyUsesIneligibleCandidateText(
  hay: string | null | undefined,
  ineligible: readonly string[],
): boolean {
  const text = folded(hay);
  if (!text) return false;
  return ineligible.some((needle) => needle.length >= 12 && text.includes(needle));
}

export type CurrentActionSemanticCopy = {
  remainingFounderCommitment?: RemainingFounderCommitment | null;
  headline?: string | null;
  candidateNextAction?: string | null;
  explanation?: string | null;
  recommended?: string | null;
};

export function currentActionCopyViolatesEligibility(
  copy: CurrentActionSemanticCopy,
  ineligible: readonly string[],
): boolean {
  if (ineligible.length === 0) return false;
  const remaining = copy.remainingFounderCommitment;
  return copyUsesIneligibleCandidateText(
    [
      copy.headline,
      copy.candidateNextAction,
      copy.explanation,
      copy.recommended,
      remaining?.matchedText,
      remaining?.headline,
      remaining?.explanation,
      remaining?.recommended,
    ].join("\n"),
    ineligible,
  );
}

export function dropIneligibleCurrentActionCopy<T extends CurrentActionSemanticCopy>(
  copy: T,
  ineligible: readonly string[],
): T {
  if (!currentActionCopyViolatesEligibility(copy, ineligible)) return copy;
  const remaining = copy.remainingFounderCommitment;
  const remainingBlocked =
    remaining != null &&
    copyUsesIneligibleCandidateText(
      `${remaining.matchedText} ${remaining.headline} ${remaining.explanation} ${remaining.recommended}`,
      ineligible,
    );
  return {
    ...copy,
    remainingFounderCommitment: remainingBlocked ? null : remaining,
    headline: copyUsesIneligibleCandidateText(copy.headline, ineligible) ? null : copy.headline,
    candidateNextAction: copyUsesIneligibleCandidateText(copy.candidateNextAction, ineligible)
      ? null
      : copy.candidateNextAction,
    explanation: copyUsesIneligibleCandidateText(copy.explanation, ineligible) ? null : copy.explanation,
    recommended: copyUsesIneligibleCandidateText(copy.recommended, ineligible) ? null : copy.recommended,
  };
}
