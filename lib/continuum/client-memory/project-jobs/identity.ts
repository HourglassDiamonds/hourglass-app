/**
 * Deterministic Open Job action identity.
 * Same Project + same normalized subject = the same unresolved action.
 * Does not infer work from Lifecycle, email age, or waiting-state labels.
 */

import { isUnresolvedOpenJobState } from "./validate";
import type { ProjectJob } from "./types";
import { attentionModeOf, exactAttentionIdentity } from "./attention";

export function openJobActionIdentityKey(subject: string): string {
  return subject.replace(/\s+/g, " ").trim().toLowerCase();
}

export function jobsShareActionIdentity(
  left: Pick<ProjectJob, "projectId" | "subject" | "attentionMode" | "attentionMetadata" | "sourceRef" | "associatedPersonId">,
  right: Pick<ProjectJob, "projectId" | "subject" | "attentionMode" | "attentionMetadata" | "sourceRef" | "associatedPersonId">,
): boolean {
  if (left.projectId !== right.projectId) return false;
  const leftExact = exactAttentionIdentity(left);
  const rightExact = exactAttentionIdentity(right);
  if (leftExact || rightExact) return leftExact !== null && leftExact === rightExact;
  // Preserve intentional legacy Action title identity. Attention-enabled work,
  // and projectless work associated to different People, can only be the same
  // through an exact durable identity or mutation/job ID.
  if (attentionModeOf(left) !== "action" || attentionModeOf(right) !== "action") return false;
  if (left.projectId === null && left.associatedPersonId !== right.associatedPersonId) return false;
  const a = openJobActionIdentityKey(left.subject);
  const b = openJobActionIdentityKey(right.subject);
  return Boolean(a) && a === b;
}

export function findUnresolvedJobByActionIdentity(
  jobs: readonly ProjectJob[],
  candidateOrProjectId: Pick<ProjectJob, "projectId" | "subject" | "attentionMode" | "attentionMetadata" | "sourceRef" | "associatedPersonId"> | string | null,
  legacySubject?: string,
): ProjectJob | null {
  const candidate = typeof candidateOrProjectId === "object" && candidateOrProjectId !== null
    ? candidateOrProjectId
    : {
        projectId: candidateOrProjectId as string | null,
        subject: legacySubject ?? "",
        attentionMode: undefined,
        attentionMetadata: undefined,
        sourceRef: null,
        associatedPersonId: null,
      };
  for (const job of jobs) {
    if (!isUnresolvedOpenJobState(job.state)) continue;
    if (jobsShareActionIdentity(job, candidate)) return job;
  }
  return null;
}
