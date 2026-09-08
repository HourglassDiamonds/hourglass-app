/**
 * CoS proposed actions over existing open_job Candidates.
 * Read-only. Does not approve, discard, or create Open Jobs.
 */

import { parseHumanEvidenceSourceRef } from "@/lib/continuum/candidates/human-evidence-source-ref";
import type { ContinuumCandidate } from "@/lib/continuum/candidates/types";
import {
  findUnresolvedJobByActionIdentity,
  openJobActionIdentityKey,
} from "@/lib/continuum/client-memory/project-jobs/identity";
import { isUnresolvedOpenJobState } from "@/lib/continuum/client-memory/project-jobs/validate";
import type { ProjectJob } from "@/lib/continuum/client-memory/project-jobs/types";
import { sourceHrefFor, sourceLabelFor } from "./evidence";
import type { CosProjectContext, CosProposedAction } from "./types";

export const COS_PROPOSED_ACTIONS_TITLE = "Proposed actions";

const ACTION_RULES = new Set([
  "explicit_founder_commitment",
  "explicit_client_request",
  "explicit_vendor_waiting",
  "explicit_vendor_commitment",
  "explicit_follow_up",
]);

const BLOCKED_RULES = new Set([
  "explicit_client_approval",
  "lifecycle",
  "unread",
  "email_age",
]);

function payloadSubject(row: ContinuumCandidate): string | null {
  const payload = row.founderEditedPayload ?? row.payload;
  if (payload.kind === "open_job") return payload.subject;
  return null;
}

function payloadProjectId(row: ContinuumCandidate): string | null {
  const target = row.founderEditedTarget ?? row.proposedTarget;
  if (target.kind === "open_job" || target.kind === "project") return target.projectId;
  if (target.kind === "project_spec") return target.projectId;
  return null;
}

function humanSourceId(row: ContinuumCandidate): string | null {
  return parseHumanEvidenceSourceRef(row.sourceRef)?.sourceId ?? null;
}

function canApproveOnHumanPath(row: ContinuumCandidate): boolean {
  return (
    (row.sourceSystem === "human-intake" ||
      row.sourceSystem === "plaud" ||
      row.sourceSystem === "remarkable") &&
    Boolean(humanSourceId(row))
  );
}

function isExplicitActionCandidate(row: ContinuumCandidate): boolean {
  if (row.reviewStatus !== "pending") return false;
  if (row.candidateState === "superseded") return false;
  if (row.evidenceBasis.ruleIds.some((id) => BLOCKED_RULES.has(id))) return false;
  if (row.candidateType !== "open_job") return false;
  const payload = row.founderEditedPayload ?? row.payload;
  if (payload.kind !== "open_job") return false;
  if (payload.jobKind === "question") return false;
  return row.evidenceBasis.ruleIds.some((id) => ACTION_RULES.has(id));
}

function alreadyHasOpenJob(
  jobs: readonly ProjectJob[],
  projectId: string | null,
  subject: string,
): boolean {
  if (!projectId) return false;
  const key = openJobActionIdentityKey(subject);
  if (!key) return false;
  const unresolved = jobs.filter(
    (job) => isUnresolvedOpenJobState(job.state) && job.projectId === projectId,
  );
  return findUnresolvedJobByActionIdentity(unresolved, projectId, subject) != null;
}

export function proposeExplicitActions(input: {
  jobs: readonly ProjectJob[];
  candidates: readonly ContinuumCandidate[];
  projects: ReadonlyMap<string, CosProjectContext>;
  newMutationId: () => string;
}): CosProposedAction[] {
  const items: CosProposedAction[] = [];
  const seen = new Set<string>();

  for (const row of input.candidates) {
    if (!isExplicitActionCandidate(row)) continue;
    const subject = payloadSubject(row);
    if (!subject) continue;
    const projectId = payloadProjectId(row);
    if (alreadyHasOpenJob(input.jobs, projectId, subject)) continue;
    const identity = `${projectId ?? "none"}:${openJobActionIdentityKey(subject)}`;
    if (seen.has(identity)) continue;
    seen.add(identity);
    const projectTitle = projectId
      ? (input.projects.get(projectId)?.title ?? null)
      : null;
    const sourceId = humanSourceId(row);
    const canAdd = canApproveOnHumanPath(row) && Boolean(projectId);
    items.push({
      id: `proposed:${row.candidateId}`,
      candidateId: row.candidateId,
      sourceId,
      headline: subject,
      sourceLabel: sourceLabelFor(row),
      sourceHref: sourceHrefFor(row),
      projectId,
      projectTitle,
      canAddToActions: canAdd,
      canDismiss: canAdd && Boolean(sourceId),
      mutationId: input.newMutationId(),
    });
  }

  return items;
}
