import type { ProjectJob } from "@/lib/continuum/client-memory/project-jobs/types";
import type {
  SterlingCleanupSummary,
  SterlingCommercialPriority,
  SterlingConfidence,
  SterlingFinding,
  SterlingSourceFreshness,
  SterlingTodayItem,
} from "./types";

export const COS_ACTIVE_HORIZON_DAYS = 56;
export const COS_MISSED_REPLY_DAYS = 12;
export const COS_GMAIL_FRESHNESS_TARGET_MS = 2 * 60 * 1000;
export const COS_GMAIL_DELAY_WARNING_MS = 3 * 60 * 1000;

const DAY_MS = 86_400_000;
const NOISE = /\b(?:receipt|invoice available|technology services|automated|system notification|unsubscribe|newsletter|delivery status)\b/i;
const HOT = /\b(?:new inquiry|interested in|looking for|availability|price|pricing|purchase|buy|engagement ring|custom ring|consultation)\b/i;
const DECISION = /\b(?:rendering|render|revision|revise|approval|approve|option|quote|estimate|deposit|payment link|movement|marquise)\b/i;
const DELIVERY_RISK = /\b(?:late|delay|delayed|deadline|wedding|travel|ship|delivery|promised|urgent|problem|issue)\b/i;
const FOLLOW_UP = /\b(?:follow[ -]?up|checking in|quote sent|proposal sent|circle back)\b/i;
const PRODUCTION = /\b(?:production|shop|vendor|cad|stl|casting|setting|order confirmation|blocker)\b/i;
const COMMITMENT = /\b(?:i(?:'ll| will)|we(?:'ll| will)|promised|commitment|send|review|call|reply)\b/i;
const QUESTION_OR_REQUEST = /\?|\b(?:can you|could you|would you|please|let me know|send|show|render|revise|want|need)\b/i;

export function evidenceHay(item: SterlingTodayItem): string {
  return `${item.title} ${item.why} ${item.proposedNextAction ?? ""} ${item.state} ${item.evidenceText ?? ""}`;
}

export function commercialPriorityOf(item: SterlingTodayItem): SterlingCommercialPriority {
  const hay = evidenceHay(item);
  if (NOISE.test(hay)) return "noise";
  if (item.clientFacing && HOT.test(hay)) return "hot_inbound";
  if (item.clientFacing && DECISION.test(hay)) return "revenue_blocking_decision";
  if (item.clientFacing && DELIVERY_RISK.test(hay)) return "client_delivery_risk";
  if (item.clientFacing && FOLLOW_UP.test(hay)) return "conversion_follow_up";
  if (item.productionBlocker || PRODUCTION.test(hay)) return "production_blocker";
  if (item.clientFacing || COMMITMENT.test(hay)) return "existing_commitment";
  return "operational_admin";
}

export function commercialReasonFor(priority: SterlingCommercialPriority): string {
  switch (priority) {
    case "hot_inbound": return "Fresh active sales opportunity.";
    case "revenue_blocking_decision": return "A client decision or deliverable is blocking revenue progress.";
    case "client_delivery_risk": return "Active client delivery or trust is at risk.";
    case "conversion_follow_up": return "A timely follow-up may convert the opportunity.";
    case "production_blocker": return "This blocks production or a downstream handoff.";
    case "existing_commitment": return "This is an existing client or founder commitment.";
    case "operational_admin": return "Operational or administrative work.";
    case "noise": return "Low-value automated or receipt-like traffic.";
  }
}

export function commercialRank(priority: SterlingCommercialPriority): number {
  return [
    "hot_inbound",
    "revenue_blocking_decision",
    "client_delivery_risk",
    "conversion_follow_up",
    "production_blocker",
    "existing_commitment",
    "operational_admin",
    "noise",
  ].indexOf(priority);
}

export function ageInDays(at: string | null | undefined, now: Date): number | null {
  const parsed = Date.parse(at ?? "");
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.floor((now.getTime() - parsed) / DAY_MS));
}

function hasPositiveActiveEvidence(item: SterlingTodayItem): boolean {
  const hay = evidenceHay(item);
  return Boolean(
    item.dueAt ||
    /\b(?:delay|delayed|hold|waiting for payment|problem|issue|deadline|follow[ -]?up|new|recent|latest)\b/i.test(hay),
  );
}

export function shouldEnterFounderPriorities(item: SterlingTodayItem, now: Date): boolean {
  if (!item.authoritative || item.owner !== "founder") return false;
  if (commercialPriorityOf(item) === "noise") return false;
  const age = ageInDays(item.activityAt, now);
  return age == null || age <= COS_ACTIVE_HORIZON_DAYS || hasPositiveActiveEvidence(item);
}

export function operationalReviewFindings(
  today: readonly SterlingTodayItem[],
  jobs: readonly ProjectJob[],
  now: Date,
): SterlingFinding[] {
  const findings: SterlingFinding[] = [];
  const jobById = new Map(jobs.map((job) => [job.jobId, job]));
  for (const item of today) {
    if (!item.authoritative) continue;
    const activityAt = item.activityAt ?? jobById.get(item.id)?.updatedAt ?? null;
    const age = ageInDays(activityAt, now);
    const hay = evidenceHay(item);
    if (commercialPriorityOf(item) === "noise") {
      findings.push({
        id: `noise:${item.id}`, kind: "stale", title: item.title,
        whyItMatters: "This looks like receipt or automated-system noise and should not displace revenue or client work.",
        evidence: item.sourceRefs, sourceRefs: item.sourceRefs,
        proposedFix: "Dismiss or leave outside Today after review.", proposal: null,
        reviewGroup: "noise_cleanup", confidence: "high", risk: "Low-value attention cost.",
      });
      continue;
    }
    if (age != null && age > COS_ACTIVE_HORIZON_DAYS && !hasPositiveActiveEvidence(item)) {
      findings.push({
        id: `likely-complete:${item.id}`, kind: "stale", title: `${item.title} is probably no longer active`,
        whyItMatters: `No meaningful activity is visible for ${age} days, beyond the ordinary 4–5 week production cycle. This is an inference from absence, not proof of completion.`,
        evidence: [...item.sourceRefs, ...(activityAt ? [`last meaningful activity ${activityAt}`] : [])],
        sourceRefs: item.sourceRefs,
        proposedFix: "Review, then close/archive if complete or keep active with current evidence.",
        proposal: null,
        reviewGroup: "likely_complete", confidence: age >= 70 ? "high" : "medium",
        risk: "Stale work can crowd out current client priorities.", inferredFromAbsence: true,
      });
      continue;
    }
    if (
      item.owner === "founder" &&
      item.clientFacing &&
      age != null && age >= COS_MISSED_REPLY_DAYS &&
      age <= COS_ACTIVE_HORIZON_DAYS &&
      QUESTION_OR_REQUEST.test(hay)
    ) {
      findings.push({
        id: `possibly-missed:${item.id}`, kind: "gap", title: `${item.title} may have been missed`,
        whyItMatters: `A client question or request appears to have waited ${age} days without newer founder action.`,
        evidence: [...item.sourceRefs, ...(activityAt ? [`latest visible request ${activityAt}`] : [])],
        sourceRefs: item.sourceRefs,
        proposedFix: item.proposedNextAction || "Review the source and respond if it is still open.",
        proposal: null, reviewGroup: commercialRank(commercialPriorityOf(item)) <= 3 ? "high_value_likely_miss" : "client_risk_miss",
        confidence: item.sourceRefs.length > 0 ? "medium" : "low",
        risk: "Client trust or revenue may be at risk.", inferredFromAbsence: true,
      });
    }
  }
  return findings;
}

export function cleanupSummary(findings: readonly SterlingFinding[]): SterlingCleanupSummary {
  const count = (groups: readonly string[]) => findings.filter((row) => row.reviewGroup && groups.includes(row.reviewGroup)).length;
  return {
    total: findings.filter((row) => row.reviewGroup).length,
    likelyComplete: count(["likely_complete"]),
    possiblyMissed: count(["high_value_likely_miss", "client_risk_miss"]),
    stillActive: count(["still_active"]),
    needsReview: count(["needs_review", "noise_cleanup"]),
  };
}

export function sourceFreshness(input: {
  status: "current" | "refreshing" | "disconnected";
  lastSuccessfulSyncAt: string | null;
  now: Date;
}): SterlingSourceFreshness {
  if (input.status === "disconnected") return { status: "disconnected", lastSuccessfulSyncAt: input.lastSuccessfulSyncAt, targetMs: COS_GMAIL_FRESHNESS_TARGET_MS, ageMs: null };
  const at = Date.parse(input.lastSuccessfulSyncAt ?? "");
  const ageMs = Number.isFinite(at) ? Math.max(0, input.now.getTime() - at) : null;
  return {
    status: input.status === "refreshing" ? "checking" : ageMs == null || ageMs > COS_GMAIL_DELAY_WARNING_MS ? "delayed" : "current",
    lastSuccessfulSyncAt: input.lastSuccessfulSyncAt,
    targetMs: COS_GMAIL_FRESHNESS_TARGET_MS,
    ageMs,
  };
}

export function confidenceForActivity(item: SterlingTodayItem): SterlingConfidence {
  return item.sourceRefs.length > 0 && item.activityAt ? "high" : "medium";
}
