/**
 * Read-time current-action eligibility over persisted Candidates.
 * continuum_candidates is a proposal/evidence store. candidate_state = active
 * never means the obligation is currently active. Does not write rows.
 */

import type { ContinuumCandidate } from "@/lib/continuum/candidates/types";
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
  /\b(?:please (?:change|soften|revise)|can we change|change request|soften the (?:double[- ]?)?prong|(?:change|soften|revise) (?:the )?(?:double[- ]?)?(?:prongs?|shank)|shank width)\b/i;
const LATER_LOOP_ADVANCE =
  /\b(?:workshop|going to (?:the )?workshop|stone is going|place (?:the |your )?order|order confirmation|final CAD|moving forward|please proceed|RN\d{4,}|size\s+\d)/i;
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
  const payload = payloadOf(row);
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
): ContinuumCandidate[] {
  return rows.filter((row) => isCurrentActionEligible(row, { peers: rows, thread }));
}

export function remainingIfCurrentlyActionable(
  remaining: RemainingFounderCommitment | null | undefined,
  rows: readonly ContinuumCandidate[],
  thread?: TodayGmailThreadContext | null,
): RemainingFounderCommitment | null {
  if (!remaining) return null;
  const needle = folded(remaining.matchedText);
  if (!needle) return remaining;
  const blocked = rows.some((row) => {
    if (isCurrentActionEligible(row, { peers: rows, thread })) return false;
    return folded(row.evidenceBasis.matchedText) === needle;
  });
  return blocked ? null : remaining;
}
