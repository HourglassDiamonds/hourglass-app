/**
 * Founder-approved apply of a Gmail new-project Candidate.
 * Candidate review is persisted only after the canonical writer succeeds.
 * Requires a confirmed Person target. Does not mint People.
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
import {
  warnPossibleExistingProject,
} from "./duplicate";
import { confirmedPersonFromThread } from "./identity-gate";
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
  confirmPossibleExisting?: boolean;
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
        | "identity-unconfirmed"
        | "person-mismatch"
        | "possible-existing"
        | "create-failed"
        | "review-unpersisted";
      create?: CreateFounderProjectResult;
      existingTitle?: string;
    };

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
  const confirmed = threadId ? confirmedPersonFromThread(rows, threadId) : null;
  if (!confirmed) {
    return { ok: false, reason: "identity-unconfirmed" };
  }
  const requested = input.body.personId.trim();
  if (requested && requested !== confirmed.personId) {
    return { ok: false, reason: "person-mismatch" };
  }

  const title = input.body.title.trim() || payload.value;
  const existing = await input.writer.listActiveClientProjects(confirmed.personId);
  const possible = warnPossibleExistingProject({
    title,
    existing,
  });
  if (possible && !input.body.confirmPossibleExisting) {
    return {
      ok: false,
      reason: "possible-existing",
      existingTitle: possible.title,
    };
  }

  const createInput: CreateFounderProjectInput = {
    mutationId: input.body.mutationId,
    title,
    personId: confirmed.personId,
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
