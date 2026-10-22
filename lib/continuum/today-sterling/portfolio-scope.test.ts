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
  payload: { kind: "follow_up", text: "I will send CAD to Sarah Monday", dueAt: null, sourceTimestamp: "2026-10-21T12:00:00.000Z" },
  confidence: "medium",
  evidenceBasis: { ruleIds: ["explicit_follow_up"], matchedText: "I will send CAD to Sarah Monday" },
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

  it("keeps historical rows out of the active frontier while reporting every suppression", () => {
    const current = candidate("current", null);
    const deferred = candidate("deferred", null, "active", "deferred");
    const discarded = candidate("discarded", null, "active", "discarded");
    const historical = {
      ...candidate("historical", null),
      candidateType: "project_context" as const,
      payload: { kind: "project_context" as const, topic: "design_basis", value: "old context" },
      evidenceBasis: { ruleIds: ["historical_context"], matchedText: "old context" },
    };
    const result = selectSterlingPortfolio({
      projects: [], jobs: [], candidates: [current, deferred, discarded, historical],
      corrections: [], calendar: [], previousToday: [],
    }, "2026-10-21T12:00:00.000Z");
    assert.deepEqual(result.candidates.map((row) => row.candidateId), ["current"]);
    assert.deepEqual(result.candidateCoverage, {
      total: 4,
      selected: 1,
      suppressed: 3,
      suppressedByReason: {
        superseded_or_discarded: 1,
        deferred_or_quoted_historical: 1,
        historical_context_outside_active_frontier: 1,
      },
    });
  });

  it("retains same-thread chronology for an actionable provisional anchor", () => {
    const actionable = candidate("action", null);
    const context = {
      ...candidate("context", null),
      sourceRef: actionable.sourceRef.replace("message-action", "message-context"),
      candidateType: "note" as const,
      payload: { kind: "note" as const, text: "platinum", contextLayer: null },
      evidenceBasis: { ruleIds: ["explicit_spec"], matchedText: "platinum" },
    };
    const result = selectSterlingPortfolio({
      projects: [], jobs: [], candidates: [actionable, context], corrections: [], calendar: [], previousToday: [],
    }, "2026-10-21T12:00:00.000Z");
    assert.deepEqual(result.candidates.map((row) => row.candidateId), ["action", "context"]);
  });

  it("keeps a recent operational job anchor even when it waits on the client", () => {
    const waiting = { ...candidate("waiting", null), candidateType: "open_job" as const,
      payload: { kind: "open_job" as const, jobKind: "request" as const, subject: "Shipping label requested", detail: null,
        waitingOnActor: "client" as const, dueAt: null, createJob: false as const },
      sourceTimestamp: "2026-10-20T12:00:00.000Z",
      evidenceBasis: { ruleIds: ["explicit_client_request"], matchedText: "Please send the shipping label." } };
    const result = selectSterlingPortfolio({ projects: [], jobs: [], candidates: [waiting], corrections: [],
      calendar: [], previousToday: [] }, "2026-10-22T12:00:00.000Z");
    assert.deepEqual(result.candidates.map((row) => row.candidateId), ["waiting"]);
  });

  it("does not reopen a historical operational job outside the bounded frontier", () => {
    const old = { ...candidate("old", null), candidateType: "open_job" as const,
      payload: { kind: "open_job" as const, jobKind: "request" as const, subject: "Old request", detail: null,
        waitingOnActor: "founder" as const, dueAt: null, createJob: false as const },
      sourceTimestamp: "2024-01-01T00:00:00.000Z",
      evidenceBasis: { ruleIds: ["historical_context"], matchedText: "Old request" } };
    const result = selectSterlingPortfolio({ projects: [], jobs: [], candidates: [old], corrections: [],
      calendar: [], previousToday: [] }, "2026-10-22T12:00:00.000Z");
    assert.deepEqual(result.candidates, []);
  });

  it("bounds a large historical candidate portfolio without erasing coverage", () => {
    const historical = Array.from({ length: 500 }, (_, index) => ({
      ...candidate(`history-${index}`, null),
      candidateType: "project_context" as const,
      payload: { kind: "project_context" as const, topic: "design_basis", value: `history ${index}` },
      evidenceBasis: { ruleIds: ["historical_context"], matchedText: `history ${index}` },
    }));
    const result = selectSterlingPortfolio({
      projects: [], jobs: [], candidates: [...historical, candidate("current", null)],
      corrections: [], calendar: [], previousToday: [],
    }, "2026-10-21T12:00:00.000Z");
    assert.deepEqual(result.candidates.map((row) => row.candidateId), ["current"]);
    assert.equal(result.candidateCoverage.total, 501);
    assert.equal(result.candidateCoverage.suppressed, 500);
    assert.equal(result.candidateCoverage.suppressedByReason.historical_context_outside_active_frontier, 500);
  });
});
