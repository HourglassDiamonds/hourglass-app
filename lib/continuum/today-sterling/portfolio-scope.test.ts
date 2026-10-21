import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ContinuumCandidate } from "@/lib/continuum/candidates/types";
import type { ProjectDeskSummary } from "@/lib/continuum/client-memory/project-desk/types";
import type { ProjectJob } from "@/lib/continuum/client-memory/project-jobs/types";
import { selectSterlingPortfolio } from "./portfolio-scope";

const project = (projectId: string, lifecycleStage: string | null): ProjectDeskSummary => ({
  projectId,
  title: projectId,
  projectKind: "custom_new_jewelry",
  people: [],
  specs: [],
  latestNoteAt: null,
  latestNotePreview: null,
  coverage: { people: "missing", specs: "sparse", notes: "none", jobs: "none", files: "none", email: "not-connected" },
  recordCreatedAt: "2026-10-01T00:00:00.000Z",
  projectWork: { connected: false },
  lifecycleStage,
  lifecycleLabel: lifecycleStage,
});

const candidate = (candidateId: string, projectId: string | null, state: "active" | "conflict" | "superseded" = "active",
  reviewStatus: "pending" | "approved" | "discarded" | "deferred" = "pending"): ContinuumCandidate => ({
  candidateId,
  sourceSystem: "gmail",
  sourceRef: `gc1|thread-${candidateId}|message-${candidateId}`,
  sourceTimestamp: "2026-10-21T12:00:00.000Z",
  candidateType: "follow_up",
  proposedTarget: { kind: "project", projectId },
  payload: { kind: "follow_up", text: "Evidence-backed work", dueAt: null, sourceTimestamp: "2026-10-21T12:00:00.000Z" },
  confidence: "medium",
  evidenceBasis: { ruleIds: ["fixture"], matchedText: "Evidence-backed work" },
  candidateState: state,
  reviewStatus,
  lastReviewAction: null,
  founderEditedPayload: null,
  founderEditedTarget: null,
  reviewedAt: null,
  createdAt: "2026-10-21T12:00:00.000Z",
  canonical: false,
  automaticApply: false,
  parserVersion: "fixture",
  supersedesCandidateId: null,
  supersededByCandidateId: null,
});

describe("Sterling portfolio-first scope", () => {
  it("keeps every active canonical project plus evidence-backed provisional work", () => {
    const result = selectSterlingPortfolio({
      projects: [project("active-a", "cad"), project("active-b", null), project("closed", "completed")],
      jobs: [],
      candidates: [candidate("unassigned", null), candidate("discarded", null, "active", "discarded")],
      corrections: [],
      calendar: [],
      previousToday: [],
    });
    assert.deepEqual(result.projects.map((row) => row.projectId), ["active-a", "active-b"]);
    assert.deepEqual(result.candidates.map((row) => row.candidateId), ["unassigned"]);
  });

  it("retains a completed project only when bounded current work still references it", () => {
    const openJob = { projectId: "closed-with-job", state: "open" } as ProjectJob;
    const result = selectSterlingPortfolio({
      projects: [project("closed-with-job", "completed"), project("closed-with-evidence", "completed"), project("closed-old", "completed")],
      jobs: [openJob],
      candidates: [candidate("new-evidence", "closed-with-evidence")],
      corrections: [],
      calendar: [],
      previousToday: [],
    });
    assert.deepEqual(result.projects.map((row) => row.projectId), ["closed-with-job", "closed-with-evidence"]);
  });

  it("does not select by acceptance names or case identifiers", () => {
    const result = selectSterlingPortfolio({
      projects: [project("ordinary-active-project", "production")],
      jobs: [],
      candidates: [candidate("ordinary-provisional", null)],
      corrections: [],
      calendar: [],
      previousToday: [],
    });
    assert.equal(result.projects.length, 1);
    assert.equal(result.candidates.length, 1);
  });
});
