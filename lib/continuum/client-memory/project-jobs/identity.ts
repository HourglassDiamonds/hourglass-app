/**
 * Deterministic Open Job action identity.
 * Same Project + same normalized subject = the same unresolved action.
 * Does not infer work from Lifecycle, email age, or waiting-state labels.
 */

import { isUnresolvedOpenJobState } from "./validate";
import type { ProjectJob } from "./types";

export function openJobActionIdentityKey(subject: string): string {
  return subject.replace(/\s+/g, " ").trim().toLowerCase();
}

export function jobsShareActionIdentity(
  left: Pick<ProjectJob, "projectId" | "subject">,
  right: Pick<ProjectJob, "projectId" | "subject">,
): boolean {
  if (left.projectId !== right.projectId) return false;
  const a = openJobActionIdentityKey(left.subject);
  const b = openJobActionIdentityKey(right.subject);
  return Boolean(a) && a === b;
}

export function findUnresolvedJobByActionIdentity(
  jobs: readonly ProjectJob[],
  projectId: string,
  subject: string,
): ProjectJob | null {
  const key = openJobActionIdentityKey(subject);
  if (!key) return null;
  for (const job of jobs) {
    if (job.projectId !== projectId) continue;
    if (!isUnresolvedOpenJobState(job.state)) continue;
    if (openJobActionIdentityKey(job.subject) === key) return job;
  }
  return null;
}
