import { attentionModeOf, parseAttention } from "./attention";
import type { ProjectJob } from "./types";

export type AttentionTargetAssessment = {
  status: "valid" | "satisfied" | "superseded" | "invalid" | "unknown";
  authoritative: boolean;
};

export type AttentionEligibilityReason =
  | "terminal"
  | "target-satisfied"
  | "target-superseded"
  | "repair-required"
  | "deferred"
  | "scheduled"
  | "founder-action"
  | "waiting-on-external"
  | "watching-unscheduled"
  | "watch-review";

export type AttentionEligibility = {
  eligible: boolean;
  kind: "action" | "review" | "waiting" | "repair" | "none";
  reason: AttentionEligibilityReason;
  /** Conservative copy boundary: absence of evidence never asserts non-response. */
  prompt: string | null;
};

function instant(value: string | null | undefined): number | null {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

export function evaluateAttentionEligibility(
  job: ProjectJob,
  input: { now: Date; target?: AttentionTargetAssessment | null },
): AttentionEligibility {
  if (job.state === "resolved" || job.state === "cancelled") {
    return { eligible: false, kind: "none", reason: "terminal", prompt: null };
  }
  const target = input.target;
  if (target?.authoritative && target.status === "invalid") {
    return { eligible: true, kind: "repair", reason: "repair-required", prompt: `Check whether ${job.subject}` };
  }
  if (target?.authoritative && target.status === "satisfied") {
    return { eligible: false, kind: "none", reason: "target-satisfied", prompt: null };
  }
  if (target?.authoritative && target.status === "superseded") {
    return { eligible: false, kind: "none", reason: "target-superseded", prompt: null };
  }
  const validAttention = parseAttention({
    attentionMode: job.attentionMode,
    activationAt: job.activationAt,
    checkpointAt: job.checkpointAt,
    attentionMetadata: job.attentionMetadata,
    waitingOnActor: job.waitingOnActor,
  });
  if (!validAttention.ok) {
    return { eligible: true, kind: "repair", reason: "repair-required", prompt: `Check whether ${job.subject}` };
  }
  const mode = attentionModeOf(job);
  const now = input.now.getTime();
  if (!Number.isFinite(now)) {
    return { eligible: true, kind: "repair", reason: "repair-required", prompt: `Check whether ${job.subject}` };
  }
  const deferred = instant(job.deferredUntil);
  if (job.state === "snoozed" && deferred == null) {
    return { eligible: true, kind: "repair", reason: "repair-required", prompt: `Check whether ${job.subject}` };
  }
  if (deferred != null && now < deferred) {
    return { eligible: false, kind: "waiting", reason: "deferred", prompt: null };
  }
  if (mode === "action") {
    return job.waitingOnActor === "founder"
      ? { eligible: true, kind: "action", reason: "founder-action", prompt: job.subject }
      : { eligible: false, kind: "waiting", reason: "waiting-on-external", prompt: null };
  }
  if (mode === "reminder") {
    const activation = instant(job.activationAt);
    if (activation == null) {
      return { eligible: true, kind: "repair", reason: "repair-required", prompt: `Check whether ${job.subject}` };
    }
    return now >= activation
      ? { eligible: true, kind: "action", reason: "founder-action", prompt: job.subject }
      : { eligible: false, kind: "waiting", reason: "scheduled", prompt: null };
  }
  const checkpoint = instant(job.checkpointAt);
  if (job.checkpointAt != null && checkpoint == null) {
    return { eligible: true, kind: "repair", reason: "repair-required", prompt: `Check whether ${job.subject}` };
  }
  if (checkpoint == null) {
    return { eligible: false, kind: "waiting", reason: "watching-unscheduled", prompt: null };
  }
  if (now < checkpoint) {
    return { eligible: false, kind: "waiting", reason: "scheduled", prompt: null };
  }
  return {
    eligible: true,
    kind: "review",
    reason: "watch-review",
    prompt: `Check whether ${job.subject}`,
  };
}
