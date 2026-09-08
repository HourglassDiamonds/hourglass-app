/**
 * Founder-approved apply of a Gmail new-project Candidate.
 * Candidate review is persisted only after the canonical writer succeeds.
 */

import { effectiveCandidatePayload } from "@/lib/continuum/candidates/review";
import type {
  CandidateStore,
  ContinuumCandidate,
} from "@/lib/continuum/candidates/types";
import { parseGmailCandidateSourceRef } from "@/lib/continuum/gmail/candidates/source-ref";
import { isNewProjectContextPayload } from "@/lib/continuum/gmail/candidates/new-project";
import {
  type CreateFounderProjectInput,
  type CreateFounderProjectResult,
} from "./create";
import type { FounderProjectWriter } from "./writer";

export type ApplyNewProjectCandidateInput = {
  candidateId: string;
  personId: string;
  title: string;
  projectKind: string;
  lifecycleStage?: string | null;
  subject?: string | null;
  dueAt?: string | null;
  actor: string;
  mutationId: string;
};

export type ApplyNewProjectCandidateResult =
  | {
      ok: true;
      projectId: string;
      candidate: ContinuumCandidate;
      create: Extract<CreateFounderProjectResult, { ok: true }>;
    }
  | {
      ok: false;
      reason:
        | "not-found"
        | "not-new-project"
        | "already-reviewed"
        | "create-failed"
        | "review-unpersisted";
      create?: CreateFounderProjectResult;
    };

function personFromThread(
  rows: readonly ContinuumCandidate[],
  threadId: string,
): string | null {
  const ids = [
    ...new Set(
      rows.flatMap((row) => {
        if (row.candidateType !== "person_association") return [];
        if (row.proposedTarget.kind !== "person" || !row.proposedTarget.personId) {
          return [];
        }
        if (parseGmailCandidateSourceRef(row.sourceRef)?.threadId !== threadId) {
          return [];
        }
        return [row.proposedTarget.personId];
      }),
    ),
  ];
  return ids.length === 1 ? ids[0]! : null;
}

export async function applyGmailNewProjectCandidate(input: {
  store: CandidateStore;
  writer: FounderProjectWriter;
  body: ApplyNewProjectCandidateInput;
}): Promise<ApplyNewProjectCandidateResult> {
  const candidate = await input.store.get(input.body.candidateId);
  if (!candidate) return { ok: false, reason: "not-found" };
  if (candidate.reviewStatus !== "pending") {
    return { ok: false, reason: "already-reviewed" };
  }
  const payload = effectiveCandidatePayload(candidate);
  if (!isNewProjectContextPayload(payload) || payload.kind !== "project_context") {
    return { ok: false, reason: "not-new-project" };
  }
  const threadId = parseGmailCandidateSourceRef(candidate.sourceRef)?.threadId ?? null;
  const rows = await input.store.list();
  const resolvedPerson =
    input.body.personId.trim() ||
    (threadId ? personFromThread(rows, threadId) : null);
  if (!resolvedPerson) {
    return { ok: false, reason: "create-failed" };
  }

  const createInput: CreateFounderProjectInput = {
    mutationId: input.body.mutationId,
    title: input.body.title.trim() || payload.value,
    personId: resolvedPerson,
    projectKind: input.body.projectKind,
    lifecycleStage: input.body.lifecycleStage,
    subject: input.body.subject,
    dueAt: input.body.dueAt,
    actor: input.body.actor,
  };
  const create = await input.writer.createProject(createInput);
  if (!create.ok) {
    return { ok: false, reason: "create-failed", create };
  }

  const reviewed = await input.store.applyReview(
    candidate.candidateId,
    {
      action: "approve",
      payload: {
        kind: "project_context",
        topic: payload.topic,
        value: create.title,
      },
    },
    new Date().toISOString(),
  );
  if (!reviewed.ok) {
    return { ok: false, reason: "review-unpersisted", create };
  }
  return {
    ok: true,
    projectId: create.projectId,
    candidate: reviewed.record,
    create,
  };
}
