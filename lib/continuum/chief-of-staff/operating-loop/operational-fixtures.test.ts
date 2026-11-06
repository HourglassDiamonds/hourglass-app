import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ContinuumCandidate } from "@/lib/continuum/candidates/types";
import type { ClientWebsiteIntake } from "@/lib/continuum/client-memory/read/website-intake";
import {
  isOperationalCandidate,
  isOperationalProjectJob,
  isOperationalProjectSummary,
  isOperationalWebsiteIntake,
} from "./operational-fixtures";

function candidate(sourceRef: string): ContinuumCandidate {
  return {
    candidateId: sourceRef,
    sourceSystem: "gmail",
    sourceRef,
    sourceTimestamp: "2026-11-06T12:00:00.000Z",
    candidateType: "note",
    proposedTarget: { kind: "none" },
    payload: { kind: "note", text: "Current evidence", contextLayer: null },
    confidence: "medium",
    evidenceBasis: { ruleIds: [], matchedText: null },
    candidateState: "active",
    reviewStatus: "pending",
    lastReviewAction: null,
    founderEditedPayload: null,
    founderEditedTarget: null,
    reviewedAt: null,
    createdAt: "2026-11-06T12:00:00.000Z",
    canonical: false,
    automaticApply: false,
    parserVersion: "gmail-candidates-deterministic-v1",
    supersedesCandidateId: null,
    supersededByCandidateId: null,
  };
}

describe("operational fixture boundary", () => {
  it("keeps current real-client inputs and excludes historical acceptance records", () => {
    assert.equal(isOperationalProjectSummary({
      projectId: "morgan-project", title: "Morgan Jines — Marquise", sourceSystem: "concierge-manual",
      projectKind: null, people: [], latestNoteAt: null, latestNotePreview: null,
      coverage: { people: "available", specs: "none", notes: "none", jobs: "available", files: "none", email: "not-connected" },
      recordCreatedAt: "2026-11-06T12:00:00.000Z", projectWork: { connected: true, openCount: 0, founderActionCount: 0, waitingCount: 0, overdueCount: 0, nextDueAt: null },
      lifecycleStage: "design", lifecycleLabel: "Design",
    }), true);
    assert.equal(isOperationalProjectSummary({
      projectId: "fixture", title: "STERLING ACCEPTANCE SANDBOX — Zane Kennedy — Production", sourceSystem: "sterling-preview-acceptance",
      projectKind: null, people: [], latestNoteAt: null, latestNotePreview: null,
      coverage: { people: "available", specs: "none", notes: "none", jobs: "available", files: "none", email: "not-connected" },
      recordCreatedAt: "2026-10-30T12:00:00.000Z", projectWork: { connected: true, openCount: 1, founderActionCount: 0, waitingCount: 1, overdueCount: 0, nextDueAt: null },
      lifecycleStage: "production", lifecycleLabel: "In Production",
    }), false);
  });

  it("requires Gmail candidates to belong to a current or trusted provider thread", () => {
    const allowed = new Set(["real-thread"]);
    assert.equal(isOperationalCandidate(candidate("gc1|real-thread|message-1"), allowed), true);
    assert.equal(isOperationalCandidate(candidate("gc1|fixture-era-thread|message-2"), allowed), false);
  });

  it("excludes synthetic jobs and website intakes without deleting their records", () => {
    const projects = new Set(["real-project"]);
    assert.equal(isOperationalProjectJob({
      jobId: "real-job", projectId: "real-project", kind: "required_action", subject: "Send invoice", detail: null,
      waitingOnActor: "founder", associatedPersonId: null, state: "open", dueAt: null, deferredUntil: null,
      resolvedAt: null, cancelledAt: null, createdAt: "2026-11-06T12:00:00.000Z", updatedAt: "2026-11-06T12:00:00.000Z",
      createdBy: "founder", sourceSystem: "concierge-manual", sourceRef: null, createdMutationId: "mutation",
    }, projects), true);
    assert.equal(isOperationalProjectJob({
      jobId: "fixture-job", projectId: null, kind: "required_action", subject: "Synthetic acceptance task", detail: "No customer contact",
      waitingOnActor: "founder", associatedPersonId: null, state: "open", dueAt: null, deferredUntil: null,
      resolvedAt: null, cancelledAt: null, createdAt: "2026-11-05T12:00:00.000Z", updatedAt: "2026-11-05T12:00:00.000Z",
      createdBy: "preview-fixture", sourceSystem: "continuum", sourceRef: "continuum-preview-acceptance-v1:job", createdMutationId: "mutation",
    }, projects), false);
    assert.equal(isOperationalWebsiteIntake({
      fullName: "SYNTHETIC ACCEPTANCE — Preview Fixture", email: "continuum-acceptance@healthcheck.invalid",
      inspirationNotes: "Controlled Preview acceptance fixture", source: "website", lifecycle: { projectTitle: null },
    } as ClientWebsiteIntake), false);
  });
});
