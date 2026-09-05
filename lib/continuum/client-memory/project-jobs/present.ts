/**
 * Founder-facing Open Job labels. Not CoS ranking. Not waiting-on status inference.
 */

import type { OpenJobActor, OpenJobKind, OpenJobSourceSystem } from "./types";

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
