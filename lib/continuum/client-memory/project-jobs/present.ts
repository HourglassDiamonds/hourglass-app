/**
 * Founder-facing Open Job labels. Not CoS ranking. Not waiting-on status inference.
 */

import type { OpenJobActor, OpenJobKind, OpenJobSourceSystem } from "./types";
import type { ProjectWorkSummary } from "./intelligence";

export const OPEN_JOB_KIND_LABELS: Record<OpenJobKind, string> = {
  request: "Request",
  commitment: "Commitment",
  question: "Question",
  required_action: "Required action",
  approval: "Approval",
  blocked_issue: "Blocked issue",
};

export const OPEN_JOB_ACTOR_LABELS: Record<OpenJobActor, string> = {
  founder: "Founder",
  hourglass: "Hourglass",
  client: "Client",
  vendor: "Vendor",
  unknown: "Unknown",
};

export const OPEN_JOB_SECTION_TITLE = "Open Jobs";
export const OPEN_JOBS_NONE_LABEL = "No open jobs recorded.";
export const OPEN_JOBS_NOT_CONNECTED_LABEL = "Not connected yet";
export const OPEN_JOB_ACTOR_FIELD_LABEL = "Actor";
export const OPEN_JOB_DEFERRED_LABEL = "Deferred";
export const OPEN_JOB_ADD_LABEL = "Add open job";
export const OPEN_JOB_EDIT_LABEL = "Open job";

export function projectWorkFacts(summary: ProjectWorkSummary): string[] {
  if (!summary.connected) return [];
  if (summary.unresolvedCount === 0) return [OPEN_JOBS_NONE_LABEL];
  const facts = [
    summary.unresolvedCount === 1
      ? "1 unresolved"
      : `${summary.unresolvedCount} unresolved`,
  ];
  if (summary.deferredCount > 0 && summary.activeCount === 0) {
    facts.push("Deferred only");
  }
  if (summary.waitingOn.founder > 0) facts.push("Founder action");
  if (summary.waitingOn.hourglass > 0) facts.push("Hourglass action");
  if (summary.waitingOn.client > 0) facts.push("Client action");
  if (summary.waitingOn.vendor > 0) facts.push("Vendor action");
  if (summary.waitingOn.unknown > 0) facts.push("Unknown actor");
  if (summary.blocked) facts.push("Blocked issue");
  if (summary.pastDueCount > 0) facts.push("Explicit due date has passed");
  if (summary.dueSoonCount > 0) facts.push("Due within 7 days");
  if (summary.forgottenRiskCount > 0) {
    facts.push("Hourglass job may have gone quiet");
  }
  return facts;
}

export function openJobKindLabel(kind: OpenJobKind): string {
  return OPEN_JOB_KIND_LABELS[kind];
}

export function openJobActorLabel(actor: OpenJobActor): string {
  return OPEN_JOB_ACTOR_LABELS[actor];
}

export function openJobSourceLabel(source: OpenJobSourceSystem): string {
  if (source === "concierge-manual") return "Manual";
  if (source === "continuum") return "Internal";
  return "Recorded pointer";
}
