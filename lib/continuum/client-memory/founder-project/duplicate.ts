/**
 * Duplicate guards for founder Project / action create versus CoS proposals.
 * Warning only — never auto-writes.
 */

import type { ContinuumCandidate } from "@/lib/continuum/candidates/types";
import { parseGmailCandidateSourceRef } from "@/lib/continuum/gmail/candidates/source-ref";
import {
  NEW_PROJECT_CONTEXT_TOPIC,
  foldProposedTitle,
} from "@/lib/continuum/gmail/candidates/new-project";
import {
  findDuplicateLinkedProject,
  foldProjectTitle,
  type FounderLinkedProject,
} from "./create";

export type DuplicateNewProjectWarning = {
  kind: "existing-project" | "pending-candidate";
  title: string;
  projectId: string | null;
  candidateId: string | null;
  message: string;
};

export function warnDuplicateNewProject(input: {
  title: string;
  personId: string;
  existing: readonly FounderLinkedProject[];
  pendingCandidates?: readonly ContinuumCandidate[];
}): DuplicateNewProjectWarning | null {
  const existing = findDuplicateLinkedProject(input.title, input.existing);
  if (existing) {
    return {
      kind: "existing-project",
      title: existing.title,
      projectId: existing.projectId,
      candidateId: null,
      message: "That project already exists for this person.",
    };
  }
  const folded = foldProjectTitle(input.title);
  for (const row of input.pendingCandidates ?? []) {
    if (row.reviewStatus !== "pending") continue;
    if (row.candidateState === "superseded") continue;
    if (row.payload.kind !== "project_context") continue;
    if (row.payload.topic !== NEW_PROJECT_CONTEXT_TOPIC) continue;
    if (foldProposedTitle(row.payload.value) !== folded) continue;
    const personTarget =
      row.founderEditedTarget?.kind === "person"
        ? row.founderEditedTarget.personId
        : null;
    if (personTarget && personTarget !== input.personId) continue;
    return {
      kind: "pending-candidate",
      title: row.payload.value,
      projectId: null,
      candidateId: row.candidateId,
      message: "CoS already proposed this project. Review that proposal instead of creating a duplicate.",
    };
  }
  return null;
}

export function warnDuplicateFounderAction(input: {
  subject: string;
  projectId: string;
  pendingCandidates?: readonly ContinuumCandidate[];
}): DuplicateNewProjectWarning | null {
  const folded = foldProjectTitle(input.subject);
  for (const row of input.pendingCandidates ?? []) {
    if (row.reviewStatus !== "pending") continue;
    if (row.candidateState === "superseded") continue;
    if (row.payload.kind !== "open_job") continue;
    if (row.proposedTarget.kind !== "open_job") continue;
    if (row.proposedTarget.projectId !== input.projectId) continue;
    if (foldProjectTitle(row.payload.subject) !== folded) continue;
    return {
      kind: "pending-candidate",
      title: row.payload.subject,
      projectId: input.projectId,
      candidateId: row.candidateId,
      message: "CoS already proposed this action. Review that proposal instead of creating a duplicate.",
    };
  }
  return null;
}

export function candidateThreadId(row: ContinuumCandidate): string | null {
  if (row.sourceSystem !== "gmail") return null;
  return parseGmailCandidateSourceRef(row.sourceRef)?.threadId ?? null;
}
