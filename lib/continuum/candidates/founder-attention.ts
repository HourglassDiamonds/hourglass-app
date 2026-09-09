/**
 * Pure founder-attention classification over Candidates.
 * Shared by CoS presentation and Gmail scan-summary. Not React. Not ingestion.
 * Does not delete Candidates, write Open Jobs, or resolve work.
 *
 * Model: cos-founder-attention-v1
 */

import type { ContinuumCandidate } from "@/lib/continuum/candidates/types";
import type { ProjectJob } from "@/lib/continuum/client-memory/project-jobs/types";
import { isUnresolvedOpenJobState } from "@/lib/continuum/client-memory/project-jobs/validate";
import { isPastDueDate } from "@/lib/continuum/date-only";

export const FOUNDER_ATTENTION_MODEL_ID = "cos-founder-attention-v1" as const;

export const FOUNDER_ATTENTION_LANES = [
  "decision",
  "signal",
  "anomaly",
  "background",
] as const;

export type FounderAttentionLane = (typeof FOUNDER_ATTENTION_LANES)[number];

export const COS_DECISION_TARGET = 3 as const;
export const COS_SIGNAL_TARGET = 3 as const;
export const COS_ORDINARY_VISIBLE_TARGET = 8 as const;

export const FOUNDER_ATTENTION_FACTOR_IDS = [
  "source_type",
  "commercial_relevance",
  "commitment_complete",
  "commitment_fragment",
  "ownership_founder",
  "novelty",
  "already_represented",
  "canonical_mismatch",
  "project_state_change",
  "subordinate_evidence",
  "urgency",
  "confidence",
  "channel_meta",
  "signature",
  "operational_logistics",
] as const;

export type FounderAttentionFactorId =
  (typeof FOUNDER_ATTENTION_FACTOR_IDS)[number];

export type FounderAttentionJudgment = {
  lane: FounderAttentionLane;
  /** Internal only. Never shown to the founder. */
  score: number;
  factors: FounderAttentionFactorId[];
  candidateId: string;
};

export type FounderAttentionContext = {
  jobs: readonly ProjectJob[];
  nowIso: string;
  top5Ids?: ReadonlySet<string>;
};

const STOP = new Set([
  "this",
  "that",
  "with",
  "from",
  "have",
  "will",
  "please",
  "could",
  "would",
  "send",
  "make",
  "your",
  "their",
  "the",
  "and",
  "for",
  "was",
  "but",
  "not",
  "you",
  "are",
  "our",
  "she",
  "his",
]);

function evidenceTokens(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3 && !STOP.has(token));
}

export function candidateProjectId(row: ContinuumCandidate): string | null {
  const target = row.founderEditedTarget ?? row.proposedTarget;
  if (target.kind === "project" || target.kind === "project_spec") {
    return target.projectId;
  }
  if (target.kind === "open_job") return target.projectId;
  return null;
}

export function candidateText(row: ContinuumCandidate): string {
  const payload = row.founderEditedPayload ?? row.payload;
  if (payload.kind === "follow_up") return payload.text;
  if (payload.kind === "note") return payload.text;
  if (payload.kind === "open_job") {
    return `${payload.subject} ${payload.detail ?? ""}`;
  }
  if (payload.kind === "project_context") {
    return `${payload.topic} ${payload.value}`;
  }
  if (payload.kind === "date") return payload.raw;
  return row.evidenceBasis.matchedText ?? "";
}

function candidateHaystack(row: ContinuumCandidate): string {
  return `${candidateText(row)} ${row.evidenceBasis.matchedText ?? ""}`;
}

function isUsableEvidence(row: ContinuumCandidate): boolean {
  if (row.candidateState === "superseded") return false;
  if (row.reviewStatus === "discarded") return false;
  return true;
}

export const DECISION_SCORE = 75;
export const SIGNAL_SCORE = 40;
export const CRITICAL_SCORE = 88;

const FUNCTION_WORDS = new Set([
  "this",
  "that",
  "with",
  "from",
  "have",
  "will",
  "please",
  "could",
  "would",
  "send",
  "make",
  "your",
  "their",
  "the",
  "and",
  "for",
  "was",
  "but",
  "not",
  "you",
  "are",
  "our",
  "she",
  "his",
  "her",
  "they",
  "them",
  "i'll",
  "ill",
  "we'll",
  "well",
  "can",
  "do",
  "did",
  "just",
  "directly",
  "someone",
  "anyone",
  "between",
  "ensure",
]);

const CHANNEL_META = new Set([
  "reply",
  "replied",
  "email",
  "emails",
  "message",
  "messages",
  "inbox",
  "thread",
  "subject",
  "unsubscribe",
  "notification",
  "notifications",
  "mailbox",
  "newsletter",
  "signature",
  "mailto",
  "noreply",
]);

const VALEDICTION = new Set([
  "regards",
  "sincerely",
  "thanks",
  "thank",
  "best",
  "cheers",
  "warmly",
  "cordially",
]);

const OPERATIONAL = new Set([
  "technician",
  "arrive",
  "arrival",
  "site",
  "access",
  "installation",
  "window",
  "appointment",
  "on-site",
  "onsite",
]);

const COMMERCIAL = new Set([
  "cad",
  "render",
  "revision",
  "quote",
  "wax",
  "tracking",
  "metal",
  "gold",
  "platinum",
  "palladium",
  "diamond",
  "diamonds",
  "stone",
  "center",
  "ring",
  "rings",
  "earring",
  "earrings",
  "necklace",
  "pendant",
  "bracelet",
  "size",
  "spec",
  "specs",
  "approval",
  "approved",
  "invoice",
  "payment",
  "deposit",
  "project",
  "design",
  "setting",
  "prong",
  "pave",
  "band",
  "engagement",
  "marquise",
  "oval",
  "round",
  "emerald",
  "sapphire",
  "file",
  "files",
]);

const COMMITMENT_RULES = new Set([
  "explicit_founder_commitment",
  "explicit_client_request",
  "explicit_vendor_waiting",
  "explicit_vendor_commitment",
  "explicit_follow_up",
]);

const BLOCKED_RULES = new Set([
  "lifecycle",
  "unread",
  "email_age",
]);

function tokensOf(text: string): string[] {
  return evidenceTokens(text);
}

export function payloadOf(row: ContinuumCandidate) {
  return row.founderEditedPayload ?? row.payload;
}

function ruleIdsOf(row: ContinuumCandidate): readonly string[] {
  return row.evidenceBasis.ruleIds;
}

export function hasRule(row: ContinuumCandidate, id: string): boolean {
  return ruleIdsOf(row).includes(id);
}

function contentTokens(text: string): string[] {
  return tokensOf(text).filter((token) => !FUNCTION_WORDS.has(token));
}

function domainHits(tokens: readonly string[], domain: ReadonlySet<string>): number {
  return tokens.filter((token) => domain.has(token)).length;
}

export function hasCommercialPayload(row: ContinuumCandidate): boolean {
  const payload = payloadOf(row);
  if (payload.kind === "structured_spec") return true;
  if (payload.kind === "project_context") {
    return (
      payload.topic === "new_project" ||
      payload.topic === "client_approval" ||
      payload.topic === "cad_revision" ||
      payload.topic === "design_refinement" ||
      payload.topic === "proposed_spec" ||
      payload.topic === "gift_context" ||
      payload.topic === "design_basis"
    );
  }
  if (payload.kind === "date" && payload.role === "deadline") return true;
  const hay = candidateHaystack(row);
  return domainHits(tokensOf(hay), COMMERCIAL) > 0;
}

function isChannelMetaSpeechAct(row: ContinuumCandidate): boolean {
  const hay = candidateHaystack(row);
  const tokens = contentTokens(hay);
  if (tokens.length === 0) return false;
  if (hasCommercialPayload(row)) return false;
  const channel = domainHits(tokens, CHANNEL_META);
  return channel > 0 && channel >= Math.ceil(tokens.length * 0.5);
}

function isSignatureLike(row: ContinuumCandidate): boolean {
  const hay = candidateHaystack(row);
  const tokens = contentTokens(hay);
  if (tokens.length === 0 || tokens.length > 5) return false;
  if (hasCommercialPayload(row)) return false;
  return domainHits(tokens, VALEDICTION) > 0;
}

function isOperationalLogistics(row: ContinuumCandidate): boolean {
  if (hasCommercialPayload(row)) return false;
  const tokens = contentTokens(candidateHaystack(row));
  return domainHits(tokens, OPERATIONAL) >= 2;
}

function objectAfterCommitmentVerb(text: string): string[] {
  const raw = text
    .toLowerCase()
    .split(/[^a-z0-9']+/)
    .filter(Boolean);
  const verbs = new Set(["send", "do", "call", "email", "revise", "update", "make"]);
  const index = raw.findIndex((token) => verbs.has(token) || token === "follow");
  if (index < 0) return contentTokens(text);
  return raw.slice(index + 1).filter((token) => {
    const normalized = token.replace(/'/g, "");
    return normalized.length >= 3 && !FUNCTION_WORDS.has(normalized) && !FUNCTION_WORDS.has(token);
  });
}

function hasNamedActor(text: string): boolean {
  return /(?:^|[.!?]\s+)[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})?/.test(text) ||
    /\b(?:with|for|to)\s+[A-Z][a-z]{2,}\b/.test(text);
}

function hasDateSignal(row: ContinuumCandidate): boolean {
  const payload = payloadOf(row);
  if (payload.kind === "open_job" && payload.dueAt) return true;
  if (payload.kind === "follow_up" && payload.dueAt) return true;
  if (payload.kind === "date") return payload.isoDate != null || payload.role === "deadline";
  const hay = candidateHaystack(row);
  return /\b(?:tomorrow|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday|january|february|march|april|june|july|august|september|october|november|december)\b/i.test(
    hay,
  );
}

export function commitmentIsComplete(row: ContinuumCandidate): boolean {
  const payload = payloadOf(row);
  const text =
    payload.kind === "open_job"
      ? payload.subject
      : payload.kind === "follow_up"
        ? payload.text
        : candidateText(row);
  const objects = objectAfterCommitmentVerb(text);
  const commercialObject = objects.some((token) => COMMERCIAL.has(token) || token.length >= 4);
  if (hasRule(row, "explicit_follow_up")) {
    return hasNamedActor(text) && (hasDateSignal(row) || commercialObject);
  }
  return commercialObject && objects.length > 0;
}

export function isNewProject(row: ContinuumCandidate): boolean {
  const payload = payloadOf(row);
  return payload.kind === "project_context" && payload.topic === "new_project";
}

export function isPaymentStateChange(row: ContinuumCandidate): boolean {
  if (hasRule(row, "transactional_customer_notice")) return true;
  const hay = candidateHaystack(row);
  return /\bpayment received\b/i.test(hay) && /\binvoice\b/i.test(hay);
}

export function isApproval(row: ContinuumCandidate): boolean {
  const payload = payloadOf(row);
  if (payload.kind === "project_context" && payload.topic === "client_approval") return true;
  return hasRule(row, "explicit_client_approval");
}

function isDesignChange(row: ContinuumCandidate): boolean {
  const payload = payloadOf(row);
  if (payload.kind === "structured_spec") return true;
  if (payload.kind !== "project_context") return false;
  return (
    payload.topic === "cad_revision" ||
    payload.topic === "design_refinement" ||
    payload.topic === "proposed_spec"
  );
}

export function specConflicts(row: ContinuumCandidate): boolean {
  const payload = payloadOf(row);
  return payload.kind === "structured_spec" && payload.conflict === true;
}

export function isSubordinateType(row: ContinuumCandidate): boolean {
  if (specConflicts(row) || row.candidateState === "conflict") return false;
  return (
    row.candidateType === "structured_spec" ||
    row.candidateType === "date" ||
    row.candidateType === "person_association" ||
    row.candidateType === "project_association"
  );
}

export function waitingOnFounder(row: ContinuumCandidate): boolean {
  const payload = payloadOf(row);
  return payload.kind === "open_job" && payload.waitingOnActor === "founder";
}

function alreadyRepresentedByJob(
  row: ContinuumCandidate,
  ctx: FounderAttentionContext,
): boolean {
  const projectId = candidateProjectId(row);
  const hay = candidateHaystack(row);
  const tokens = new Set(tokensOf(hay));
  if (tokens.size === 0) return false;
  return ctx.jobs.some((job) => {
    if (!isUnresolvedOpenJobState(job.state)) return false;
    if (projectId && job.projectId !== projectId) return false;
    if (ctx.top5Ids?.has(job.jobId)) {
      const jobTokens = tokensOf(job.subject);
      return jobTokens.some((token) => tokens.has(token));
    }
    return false;
  });
}

function confidenceWeight(row: ContinuumCandidate): number {
  if (row.confidence === "high") return 8;
  if (row.confidence === "medium") return 3;
  if (row.confidence === "low") return -6;
  return -10;
}

function sourceWeight(row: ContinuumCandidate): number {
  if (row.sourceSystem === "human-intake" || row.sourceSystem === "plaud") return 12;
  if (row.sourceSystem === "remarkable") return 10;
  if (row.sourceSystem === "gmail") return 6;
  if (row.sourceSystem === "google_calendar") return 2;
  return 0;
}

export function groupingKey(row: ContinuumCandidate): string {
  const projectId = candidateProjectId(row);
  if (projectId) return `project:${projectId}`;
  const parts = row.sourceRef.split("|");
  if (parts[0] === "gc1" && parts[1]) return `thread:${parts[1]}`;
  if (parts[0] === "he1" && parts[1]) return `human:${parts[1]}`;
  return `candidate:${row.candidateId}`;
}

export function classifyCandidateAttention(
  row: ContinuumCandidate,
  ctx: FounderAttentionContext,
): FounderAttentionJudgment {
  const factors: FounderAttentionFactorId[] = [];
  let score = 0;

  if (!isUsableEvidence(row)) {
    return { lane: "background", score: 0, factors: ["already_represented"], candidateId: row.candidateId };
  }
  if (ruleIdsOf(row).some((id) => BLOCKED_RULES.has(id))) {
    return { lane: "background", score: 0, factors: ["already_represented"], candidateId: row.candidateId };
  }

  const source = sourceWeight(row);
  if (source > 0) {
    factors.push("source_type");
    score += source;
  }

  const confidence = confidenceWeight(row);
  if (confidence !== 0) {
    factors.push("confidence");
    score += confidence;
  }

  if (row.candidateState === "conflict" || specConflicts(row)) {
    factors.push("canonical_mismatch");
    score += 90;
    return { lane: "decision", score, factors, candidateId: row.candidateId };
  }

  if (isChannelMetaSpeechAct(row)) {
    factors.push("channel_meta");
    return { lane: "background", score: 0, factors, candidateId: row.candidateId };
  }
  if (isSignatureLike(row)) {
    factors.push("signature");
    return { lane: "background", score: 0, factors, candidateId: row.candidateId };
  }
  if (isOperationalLogistics(row)) {
    factors.push("operational_logistics");
    return { lane: "background", score: 0, factors, candidateId: row.candidateId };
  }

  if (isNewProject(row)) {
    factors.push("project_state_change", "novelty");
    score += 100;
    return { lane: "decision", score, factors, candidateId: row.candidateId };
  }
  if (isPaymentStateChange(row)) {
    factors.push("project_state_change");
    score += 90;
    return { lane: "decision", score, factors, candidateId: row.candidateId };
  }
  if (isApproval(row)) {
    factors.push("commercial_relevance", "ownership_founder");
    score += 95;
    return { lane: "decision", score, factors, candidateId: row.candidateId };
  }

  if (ruleIdsOf(row).some((id) => COMMITMENT_RULES.has(id)) || row.candidateType === "open_job") {
    if (!commitmentIsComplete(row)) {
      factors.push("commitment_fragment");
      return { lane: "background", score: 0, factors, candidateId: row.candidateId };
    }
    factors.push("commitment_complete", "commercial_relevance");
    score += 70;
    if (waitingOnFounder(row)) {
      factors.push("ownership_founder");
      score += 18;
    }
  }

  if (isDesignChange(row)) {
    factors.push("commercial_relevance");
    score += isSubordinateType(row) ? 38 : 70;
    if (isSubordinateType(row)) factors.push("subordinate_evidence");
  }

  if (row.candidateType === "follow_up") {
    if (!commitmentIsComplete(row)) {
      factors.push("commitment_fragment");
      return { lane: "background", score: 0, factors, candidateId: row.candidateId };
    }
    factors.push("commitment_complete");
    score += 50;
  }

  if (alreadyRepresentedByJob(row, ctx)) {
    factors.push("already_represented");
    if (score < CRITICAL_SCORE) {
      return { lane: "background", score: 0, factors, candidateId: row.candidateId };
    }
  }

  const payload = payloadOf(row);
  if (payload.kind === "open_job" && payload.dueAt && isPastDueDate(payload.dueAt, ctx.nowIso)) {
    factors.push("urgency");
    score += 16;
  }

  if (isSubordinateType(row) && score < DECISION_SCORE) {
    factors.push("subordinate_evidence");
    return {
      lane: score >= SIGNAL_SCORE ? "signal" : "background",
      score,
      factors,
      candidateId: row.candidateId,
    };
  }

  if (score >= DECISION_SCORE) {
    return { lane: "decision", score, factors, candidateId: row.candidateId };
  }
  if (score >= SIGNAL_SCORE && hasCommercialPayload(row)) {
    return { lane: "signal", score, factors, candidateId: row.candidateId };
  }
  if (score >= SIGNAL_SCORE && waitingOnFounder(row) && commitmentIsComplete(row)) {
    return { lane: "decision", score: Math.max(score, DECISION_SCORE), factors, candidateId: row.candidateId };
  }
  return { lane: "background", score, factors, candidateId: row.candidateId };
}

export function isFounderAttentionWorthy(
  row: ContinuumCandidate,
  ctx: FounderAttentionContext,
): boolean {
  const lane = classifyCandidateAttention(row, ctx).lane;
  return lane === "decision" || lane === "signal";
}

