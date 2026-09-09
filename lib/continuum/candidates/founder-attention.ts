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
export const COS_ANOMALY_TARGET = 2 as const;
export const COS_ORDINARY_VISIBLE_TARGET = 8 as const;
export const FOUNDER_ATTENTION_NOVELTY_MS = 7 * 86_400_000;
export const EXPLICIT_NEW_PROJECT_RULE = "explicit_new_project_request";

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
  currentProjectIds?: ReadonlySet<string>;
  specByProject?: ReadonlyMap<string, ReadonlyMap<string, string>>;
  lifecycleByProject?: ReadonlyMap<string, string | null>;
};

const STUDIO_LABELS = new Set(["hourglass", "studio", "the studio", "the house"]);

export function isStudioOrVendorLabel(name: string | null | undefined): boolean {
  if (!name) return false;
  const normalized = name.trim().toLowerCase();
  if (!normalized) return false;
  if (STUDIO_LABELS.has(normalized)) return true;
  return /\bhourglass diamonds\b/.test(normalized);
}

export function confirmedPersonId(row: ContinuumCandidate): string | null {
  const edited = row.founderEditedTarget;
  if (edited?.kind === "person" && edited.personId) return edited.personId;
  const target = row.proposedTarget;
  if (target.kind !== "person" || !target.personId) return null;
  if (row.reviewStatus === "approved") return target.personId;
  if (row.confidence === "high") return target.personId;
  return null;
}

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

export function isTechnicianVisit(row: ContinuumCandidate): boolean {
  const hay = candidateHaystack(row);
  return (
    /\btechnician\b/i.test(hay) &&
    /\b(arrive|arrives|arrival|on-?site|pets?|age of 18)\b/i.test(hay)
  );
}

function isOperationalLogistics(row: ContinuumCandidate): boolean {
  if (isTechnicianVisit(row)) return true;
  if (hasCommercialPayload(row)) return false;
  const tokens = contentTokens(candidateHaystack(row));
  return domainHits(tokens, OPERATIONAL) >= 2;
}

function isCalendarFollowUp(row: ContinuumCandidate): boolean {
  const hay = candidateHaystack(row);
  return (
    /\bfollow up w\/ /i.test(hay) &&
    /\b(?:mon|tue|wed|thu|fri|sat|sun|january|february|march|april|june|july|august|september|october|november|december|\d{1,2}:\d{2}\s*(?:am|pm))\b/i.test(
      hay,
    )
  );
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
  const commercialObject = objects.some((token) => COMMERCIAL.has(token));
  if (hasRule(row, "explicit_follow_up")) {
    return hasNamedActor(text) && (hasDateSignal(row) || commercialObject);
  }
  return commercialObject && objects.length > 0;
}

export function isNewProject(row: ContinuumCandidate): boolean {
  const payload = payloadOf(row);
  return payload.kind === "project_context" && payload.topic === "new_project";
}

export function isExplicitNewProject(row: ContinuumCandidate): boolean {
  return isNewProject(row) && hasRule(row, EXPLICIT_NEW_PROJECT_RULE);
}

export function isClientDesignAnswer(row: ContinuumCandidate): boolean {
  const payload = payloadOf(row);
  if (payload.kind !== "project_context") return false;
  return (
    payload.topic === "design_refinement" ||
    payload.topic === "cad_revision" ||
    payload.topic === "proposed_spec"
  );
}

function evidenceAgeMs(row: ContinuumCandidate, ctx: FounderAttentionContext): number | null {
  const then = Date.parse(row.sourceTimestamp);
  const now = Date.parse(ctx.nowIso);
  if (!Number.isFinite(then) || !Number.isFinite(now)) return null;
  return now - then;
}

export function isHistoricalRediscovery(
  row: ContinuumCandidate,
  ctx: FounderAttentionContext,
  windowMs = FOUNDER_ATTENTION_NOVELTY_MS,
): boolean {
  const age = evidenceAgeMs(row, ctx);
  return age != null && age > windowMs;
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

function expandSpecTokens(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .flatMap((token) => {
      if (token === "yg") return ["yellow", "gold"];
      if (token === "wg") return ["white", "gold"];
      if (token === "rg") return ["rose", "gold"];
      if (token === "pt") return ["platinum"];
      if (token === "twotone" || token === "two") return [];
      return [token];
    });
}

function specTextCompatible(proposed: string, canonical: string): boolean {
  const left = proposed.trim().toLowerCase();
  const right = canonical.trim().toLowerCase();
  if (!left || !right) return false;
  if (left === right) return true;
  if (right.includes(left) || left.includes(right)) return true;
  const proposedTokens = new Set(expandSpecTokens(proposed).filter((token) => token.length >= 3));
  const canonicalTokens = new Set(expandSpecTokens(canonical));
  if (proposedTokens.size === 0) return false;
  return [...proposedTokens].every((token) => canonicalTokens.has(token));
}

function supplyNotesCompatible(proposed: string, canonical: string): boolean {
  if (specTextCompatible(proposed, canonical)) return true;
  const topics = ["lab", "grown", "mounting", "vlora", "center", "diamond", "dias"] as const;
  const hits = (value: string) =>
    topics.filter((topic) => value.toLowerCase().includes(topic));
  const overlap = hits(proposed).filter((topic) => hits(canonical).includes(topic));
  return overlap.length >= 2;
}

export function specValuesMateriallyDisagree(
  fieldName: string,
  proposed: string,
  canonical: string | null | undefined,
): boolean {
  const current = (canonical ?? "").trim();
  if (!current) return false;
  if (fieldName === "diamond_supply_notes") {
    return !supplyNotesCompatible(proposed, current);
  }
  return !specTextCompatible(proposed, current);
}

function canonicalSpecFor(
  row: ContinuumCandidate,
  ctx: FounderAttentionContext,
): string | null {
  const payload = payloadOf(row);
  if (payload.kind !== "structured_spec") return null;
  const projectId = candidateProjectId(row);
  const live = projectId ? ctx.specByProject?.get(projectId)?.get(payload.fieldName) : null;
  if (live && live.trim()) return live;
  return payload.currentValue;
}

function projectLifecycleOf(
  row: ContinuumCandidate,
  ctx: FounderAttentionContext,
): string | null {
  const projectId = candidateProjectId(row);
  if (!projectId) return null;
  return ctx.lifecycleByProject?.get(projectId) ?? null;
}

function isProductionLifecycle(stage: string | null | undefined): boolean {
  return stage === "production" || stage === "in_production";
}

export function isActionableSpecConflict(
  row: ContinuumCandidate,
  ctx: FounderAttentionContext,
): boolean {
  if (row.candidateState !== "conflict" && !specConflicts(row)) return false;
  const payload = payloadOf(row);
  if (payload.kind !== "structured_spec") return row.candidateState === "conflict";
  const canonical = canonicalSpecFor(row, ctx);
  if (!specValuesMateriallyDisagree(payload.fieldName, payload.proposedValue, canonical)) {
    return false;
  }
  const lifecycle = projectLifecycleOf(row, ctx);
  if (isProductionLifecycle(lifecycle) && payload.fieldName === "cad_job_number") {
    return false;
  }
  return true;
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

function tokenOverlap(left: readonly string[], right: ReadonlySet<string>): boolean {
  return left.some((token) => right.has(token));
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
    if (!projectId && !ctx.top5Ids?.has(job.jobId)) return false;
    const jobTokens = tokensOf(job.subject);
    if (!tokenOverlap(jobTokens, tokens)) return false;
    if (ctx.top5Ids?.has(job.jobId)) return true;
    return projectId != null;
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

export function sourceThreadId(row: ContinuumCandidate): string | null {
  const parts = row.sourceRef.split("|");
  return parts[0] === "gc1" && parts[1] ? parts[1] : null;
}

export function projectByThreadFromCandidates(
  rows: readonly ContinuumCandidate[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const row of rows) {
    const projectId = candidateProjectId(row);
    const threadId = sourceThreadId(row);
    if (projectId && threadId && !map.has(threadId)) map.set(threadId, projectId);
  }
  return map;
}

export function groupingKey(
  row: ContinuumCandidate,
  projectByThread?: ReadonlyMap<string, string>,
): string {
  const threadId = sourceThreadId(row);
  const projectId =
    candidateProjectId(row) ?? (threadId ? (projectByThread?.get(threadId) ?? null) : null);
  if (projectId) return `project:${projectId}`;
  if (threadId) return `thread:${threadId}`;
  const parts = row.sourceRef.split("|");
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

  if (isTechnicianVisit(row) || isOperationalLogistics(row)) {
    factors.push("operational_logistics");
    return { lane: "background", score: 0, factors, candidateId: row.candidateId };
  }
  if (isChannelMetaSpeechAct(row)) {
    factors.push("channel_meta");
    return { lane: "background", score: 0, factors, candidateId: row.candidateId };
  }
  if (isSignatureLike(row) || isCalendarFollowUp(row)) {
    factors.push(isCalendarFollowUp(row) ? "channel_meta" : "signature");
    return { lane: "background", score: 0, factors, candidateId: row.candidateId };
  }

  if (row.candidateState === "conflict" || specConflicts(row)) {
    if (!isActionableSpecConflict(row, ctx)) {
      factors.push("canonical_mismatch", "already_represented");
      return { lane: "background", score: 0, factors, candidateId: row.candidateId };
    }
    factors.push("canonical_mismatch");
    score += 90;
    if (alreadyRepresentedByJob(row, ctx)) factors.push("already_represented");
    return { lane: "decision", score, factors, candidateId: row.candidateId };
  }

  if (isPaymentStateChange(row)) {
    factors.push("project_state_change", "novelty");
    score += 90;
    return { lane: "signal", score, factors, candidateId: row.candidateId };
  }

  if (isNewProject(row)) {
    if (candidateProjectId(row)) {
      factors.push("already_represented");
      return { lane: "background", score: 0, factors, candidateId: row.candidateId };
    }
    if (!isExplicitNewProject(row) || isHistoricalRediscovery(row, ctx)) {
      factors.push(isHistoricalRediscovery(row, ctx) ? "already_represented" : "subordinate_evidence");
      return { lane: "background", score: 0, factors, candidateId: row.candidateId };
    }
    factors.push("project_state_change", "novelty");
    score += 60;
    return { lane: "decision", score, factors, candidateId: row.candidateId };
  }

  if (
    (row.confidence === "low" || row.confidence === "ambiguous") &&
    !isApproval(row) &&
    !isClientDesignAnswer(row)
  ) {
    factors.push("confidence");
    return { lane: "background", score: 0, factors, candidateId: row.candidateId };
  }

  if (isApproval(row)) {
    factors.push("commercial_relevance", "project_state_change");
    score += 70;
    if (alreadyRepresentedByJob(row, ctx) || isHistoricalRediscovery(row, ctx, FOUNDER_ATTENTION_NOVELTY_MS * 2)) {
      factors.push("already_represented");
      return { lane: "background", score: 0, factors, candidateId: row.candidateId };
    }
    return { lane: "signal", score, factors, candidateId: row.candidateId };
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

  if (isClientDesignAnswer(row) || isDesignChange(row)) {
    factors.push("commercial_relevance");
    if (isSubordinateType(row)) {
      factors.push("subordinate_evidence");
      return { lane: "background", score, factors, candidateId: row.candidateId };
    }
    score += 70;
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
    return { lane: "background", score: 0, factors, candidateId: row.candidateId };
  }

  const payload = payloadOf(row);
  if (payload.kind === "open_job" && payload.dueAt && isPastDueDate(payload.dueAt, ctx.nowIso)) {
    factors.push("urgency");
    score += 16;
  }

  if (isSubordinateType(row)) {
    factors.push("subordinate_evidence");
    return { lane: "background", score, factors, candidateId: row.candidateId };
  }

  if (score >= DECISION_SCORE && (waitingOnFounder(row) || isClientDesignAnswer(row))) {
    return { lane: "decision", score, factors, candidateId: row.candidateId };
  }
  if (score >= DECISION_SCORE) {
    return { lane: "decision", score, factors, candidateId: row.candidateId };
  }
  if (score >= SIGNAL_SCORE && hasCommercialPayload(row) && !isHistoricalRediscovery(row, ctx)) {
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

