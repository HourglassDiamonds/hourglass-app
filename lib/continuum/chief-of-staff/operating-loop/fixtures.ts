import { randomUUID } from "node:crypto";
import type { ContinuumCandidate } from "@/lib/continuum/candidates/types";
import type { ProjectJob } from "@/lib/continuum/client-memory/project-jobs/types";
import type { CosProjectContext } from "./types";

export const COS_LOOP_NOW = "2026-09-07T16:00:00.000Z";
export const COS_LOOP_PROJECT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
export const COS_LOOP_PROJECT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
export const COS_LOOP_PERSON_A = "11111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

export function fixtureJob(
  extra: Partial<ProjectJob> & Pick<ProjectJob, "jobId" | "subject">,
): ProjectJob {
  const row: ProjectJob = {
    projectId: COS_LOOP_PROJECT_A,
    kind: "required_action",
    detail: null,
    waitingOnActor: "founder",
    associatedPersonId: COS_LOOP_PERSON_A,
    dueAt: null,
    deferredUntil: null,
    resolvedAt: null,
    cancelledAt: null,
    createdAt: COS_LOOP_NOW,
    updatedAt: COS_LOOP_NOW,
    createdBy: "justin",
    sourceSystem: "concierge-manual",
    sourceRef: null,
    createdMutationId: randomUUID(),
    state: "open",
    ...extra,
  };
  if (row.state === "resolved" && row.resolvedAt == null) row.resolvedAt = COS_LOOP_NOW;
  return row;
}

export function fixtureProjects(): Map<string, CosProjectContext> {
  return new Map([
    [
      COS_LOOP_PROJECT_A,
      {
        projectId: COS_LOOP_PROJECT_A,
        title: "Lee / Spiegel",
        personName: "Lee",
        people: [{ personId: COS_LOOP_PERSON_A, displayName: "Lee" }],
        isCurrent: true,
      },
    ],
    [
      COS_LOOP_PROJECT_B,
      {
        projectId: COS_LOOP_PROJECT_B,
        title: "Travis band",
        personName: "Travis",
        people: [{ personId: COS_LOOP_PERSON_A, displayName: "Travis" }],
        isCurrent: false,
      },
    ],
  ]);
}

export function fixtureCandidate(
  extra: Partial<ContinuumCandidate> & Pick<ContinuumCandidate, "candidateId">,
): ContinuumCandidate {
  return {
    sourceSystem: "gmail",
    sourceRef: "gc1|thread|msg",
    sourceTimestamp: "2026-09-07T18:00:00.000Z",
    candidateType: "project_context",
    proposedTarget: { kind: "project", projectId: COS_LOOP_PROJECT_A },
    payload: {
      kind: "project_context",
      topic: "client_approval",
      value: "CAD looks great",
    },
    confidence: "high",
    evidenceBasis: {
      ruleIds: ["explicit_client_approval"],
      matchedText: "CAD looks great",
    },
    candidateState: "active",
    reviewStatus: "pending",
    lastReviewAction: null,
    founderEditedPayload: null,
    founderEditedTarget: null,
    reviewedAt: null,
    createdAt: COS_LOOP_NOW,
    canonical: false,
    automaticApply: false,
    parserVersion: "gmail-candidates-deterministic-v1",
    supersedesCandidateId: null,
    supersededByCandidateId: null,
    ...extra,
  };
}
