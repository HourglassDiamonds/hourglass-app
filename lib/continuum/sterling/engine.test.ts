import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ContinuumCandidate } from "@/lib/continuum/candidates/types";
import type { ProjectJob } from "@/lib/continuum/client-memory/project-jobs/types";
import { detectFindings, nextThree, parseSterlingIntent, runSterling } from "./engine";
import type { SterlingTodayItem, SterlingTruth } from "./types";

const NOW = new Date("2026-10-03T14:00:00.000Z");

describe("Sterling V1", () => {
  it("recognizes the bounded Concierge commands", () => {
    assert.equal(parseSterlingIntent("What are my next three best things?"), "next-three");
    assert.equal(parseSterlingIntent("What am I missing?"), "missing");
    assert.equal(parseSterlingIntent("What is waiting on clients?"), "waiting-client");
    assert.equal(parseSterlingIntent("Review my recent captures."), "captures");
  });

  it("puts new client work ahead of non-client work", () => {
    const result = nextThree(truth([
      today("marketing", { clientFacing: false }),
      today("client", { clientFacing: true }),
    ]), NOW);
    assert.equal(result[0]?.id, "client");
  });

  it("puts an explicit tomorrow deadline ahead of undated stale work", () => {
    const result = nextThree(truth([
      today("stale", { clientFacing: true }),
      today("tomorrow", { dueAt: "2026-10-04T17:00:00.000Z" }),
    ]), NOW);
    assert.equal(result[0]?.id, "tomorrow");
  });

  it("puts production blockers ahead when other dimensions tie", () => {
    const result = nextThree(truth([
      today("admin"),
      today("resin", { productionBlocker: true }),
    ]), NOW);
    assert.equal(result[0]?.id, "resin");
  });

  it("returns fewer than three meaningful priorities", () => {
    assert.equal(nextThree(truth([today("only")]), NOW).length, 1);
  });

  it("excludes client-owned and shop-owned waits from next-three", () => {
    const result = nextThree(truth([
      today("mine"),
      today("client", { owner: "client" }),
      today("shop", { owner: "shop" }),
    ]), NOW);
    assert.deepEqual(result.map((row) => row.id), ["mine"]);
  });

  it("excludes non-authoritative work instead of inventing certainty", () => {
    assert.equal(nextThree(truth([today("weak", { authoritative: false })]), NOW).length, 0);
  });

  it("uses stable IDs to break exact ties deterministically", () => {
    const result = nextThree(truth([today("b"), today("a")]), NOW);
    assert.deepEqual(result.map((row) => row.id), ["a", "b"]);
  });

  it("detects vendor evidence changing founder-owned work to waiting", () => {
    const input = truth([today("project", { owner: "shop", projectId: ID2, sourceRefs: ["gmail:m1"] })], [
      job("Place order", { projectId: ID2, waitingOnActor: "founder" }),
    ]);
    const finding = detectFindings(input, NOW).find((row) => row.kind === "conflict");
    assert.equal(finding?.proposal?.kind, "waiting_state");
    assert.equal(finding?.proposal?.proposedState, "vendor");
  });

  it("detects client evidence changing founder-owned work to waiting", () => {
    const input = truth([today("project", { owner: "client", projectId: ID2 })], [
      job("Send CAD", { projectId: ID2, waitingOnActor: "founder" }),
    ]);
    assert.equal(detectFindings(input, NOW).some((row) => row.proposal?.proposedState === "client"), true);
  });

  it("does not claim a conflict when canonical and current ownership agree", () => {
    const input = truth([today("project", { owner: "shop", projectId: ID2 })], [
      job("Wait for CAD", { projectId: ID2, waitingOnActor: "vendor" }),
    ]);
    assert.equal(detectFindings(input, NOW).some((row) => row.id.startsWith("conflict:")), false);
  });

  it("detects duplicate unresolved Jobs", () => {
    const input = truth([], [
      job("Call Duane", { jobId: ID1 }),
      job("Call  Duane!", { jobId: ID3 }),
    ]);
    assert.equal(detectFindings(input, NOW).some((row) => row.kind === "duplicate"), true);
  });

  it("does not merge similar work across different projects", () => {
    const input = truth([], [
      job("Review CAD", { jobId: ID1, projectId: ID2 }),
      job("Review CAD", { jobId: ID3, projectId: ID4 }),
    ]);
    assert.equal(detectFindings(input, NOW).some((row) => row.id.startsWith("duplicate:")), false);
  });

  it("matches a Quick Capture proposal to an existing Job", () => {
    const existing = job("Finish Nate resin", { projectId: ID2 });
    const input = truth([], [existing], [capture("Finish Nate resin", ID2)]);
    assert.equal(detectFindings(input, NOW).some((row) => row.id.startsWith("capture-duplicate:")), true);
  });

  it("identifies a legitimately projectless capture for explicit review", () => {
    const input = truth([], [], [capture("Call Duane before Friday", null)]);
    const finding = detectFindings(input, NOW).find((row) => row.kind === "orphan");
    assert.equal(finding?.proposal?.kind, "new_projectless_job");
  });

  it("honors a founder-edited capture when checking for duplicates", () => {
    const edited = capture("Original wording", null);
    edited.lastReviewAction = "edit";
    edited.founderEditedPayload = {
      kind: "open_job",
      jobKind: "required_action",
      subject: "Finish Nate resin",
      detail: null,
      waitingOnActor: "founder",
      dueAt: null,
      createJob: false,
    };
    edited.founderEditedTarget = { kind: "open_job", projectId: ID2 };
    const input = truth([], [job("Finish Nate resin", { projectId: ID2 })], [edited]);
    assert.equal(detectFindings(input, NOW).some((row) => row.kind === "duplicate"), true);
  });

  it("does not treat a transcript proposal as canonical truth", () => {
    const input = truth([], [], [capture("Vincent asked for another CAD", ID2)]);
    assert.equal(nextThree(input, NOW).length, 0);
    assert.equal(input.candidates[0]?.canonical, false);
  });

  it("flags old waiting work but never closes it", () => {
    const input = truth([], [job("Waiting for quote", {
      waitingOnActor: "vendor",
      updatedAt: "2026-08-01T12:00:00.000Z",
    })]);
    const finding = detectFindings(input, NOW).find((row) => row.kind === "stale");
    assert.equal(finding?.proposal?.status, "review-required");
    assert.equal(input.openJobs[0]?.state, "open");
  });

  it("surfaces an existing operating-loop anomaly as a proposal", () => {
    const input = { ...truth([]), anomalies: [{
      id: "a1", kind: "contradicts-completion", headline: "New reply conflicts", detail: "Client replied after completion was inferred.", jobId: ID1, projectId: ID2, sourceRefs: ["gmail:m2"],
    }] };
    assert.equal(detectFindings(input, NOW)[0]?.proposal?.kind, "stale_resolution");
  });

  it("returns uncertainty instead of facts when current truth is disconnected", () => {
    const result = runSterling({ truth: { ...truth([today("x")]), sourceStatus: "disconnected" }, intent: "next-three", now: NOW });
    assert.equal(result.priorities.length, 0);
    assert.match(result.uncertainty[0] ?? "", /disconnected/i);
  });

  it("does not claim yesterday changes without a prior canonical snapshot", () => {
    const result = runSterling({ truth: truth([]), intent: "changed", now: NOW });
    assert.equal(result.findings.length, 0);
    assert.match(result.uncertainty[0] ?? "", /yesterday snapshot/i);
  });

  it("reports source-refresh uncertainty", () => {
    const result = runSterling({ truth: { ...truth([]), sourceStatus: "refreshing" }, intent: "missing", now: NOW });
    assert.equal(result.uncertainty.some((row) => /refreshing/i.test(row)), true);
  });

  it("keeps proposal IDs deterministic across runs", () => {
    const input = truth([], [job("Call Duane", { jobId: ID1 }), job("Call Duane", { jobId: ID3 })]);
    const first = detectFindings(input, NOW)[0]?.proposal?.proposalId;
    const second = detectFindings(input, NOW)[0]?.proposal?.proposalId;
    assert.equal(first, second);
  });

  it("exposes no write in a read-only next-three run", () => {
    const result = runSterling({ truth: truth([today("one")]), intent: "next-three", now: NOW });
    assert.equal(result.proposals.length, 0);
    assert.equal(result.telemetry.toolsInvoked.every((name) => name.startsWith("get_")), true);
  });

  it("filters waiting views by owner", () => {
    const result = runSterling({ truth: truth([
      today("mine"),
      today("client", { owner: "client" }),
      today("shop", { owner: "shop" }),
    ]), intent: "waiting-client", now: NOW });
    assert.deepEqual(result.findings.map((row) => row.title), ["Task client"]);
  });

  it("infers no permanent preference from one decision", () => {
    const candidate = capture("One", null);
    candidate.reviewStatus = "approved";
    candidate.lastReviewAction = "approve";
    const result = runSterling({ truth: truth([], [], [candidate]), intent: "missing", now: NOW });
    assert.equal(result.preferences.length, 0);
  });

  it("creates a reviewable preference only after repeated decisions", () => {
    const candidates = [capture("One", null), capture("Two", null), capture("Three", null)];
    for (const candidate of candidates) {
      candidate.reviewStatus = "approved";
      candidate.lastReviewAction = "approve";
    }
    const result = runSterling({ truth: truth([], [], candidates), intent: "missing", now: NOW });
    assert.equal(result.preferences[0]?.supportingDecisionCount, 3);
    assert.equal(result.preferences[0]?.reviewable, true);
  });
});

const ID1 = "11111111-1111-4111-8111-111111111111";
const ID2 = "22222222-2222-4222-8222-222222222222";
const ID3 = "33333333-3333-4333-8333-333333333333";
const ID4 = "44444444-4444-4444-8444-444444444444";

function truth(
  todayItems: SterlingTodayItem[],
  openJobs: ProjectJob[] = [],
  candidates: ContinuumCandidate[] = [],
): SterlingTruth {
  return {
    generatedAt: NOW.toISOString(),
    sourceWatermark: "fixture-watermark",
    sourceStatus: "current",
    today: todayItems,
    openJobs,
    candidates,
    anomalies: [],
  };
}
function today(id: string, override: Partial<SterlingTodayItem> = {}): SterlingTodayItem {
  return {
    id,
    title: `Task ${id}`,
    why: `Evidence for ${id}`,
    projectId: ID2,
    projectTitle: "Project",
    personName: "Client",
    owner: "founder",
    state: "Up next",
    proposedNextAction: `Do ${id}`,
    dueAt: null,
    sourceRefs: [`gmail:${id}`],
    authoritative: true,
    clientFacing: true,
    productionBlocker: false,
    ...override,
  };
}

function job(subject: string, override: Partial<ProjectJob> = {}): ProjectJob {
  return {
    jobId: ID1,
    projectId: null,
    kind: "required_action",
    subject,
    detail: null,
    waitingOnActor: "founder",
    associatedPersonId: null,
    state: "open",
    dueAt: null,
    deferredUntil: null,
    resolvedAt: null,
    cancelledAt: null,
    createdAt: "2026-10-01T12:00:00.000Z",
    updatedAt: "2026-10-01T12:00:00.000Z",
    createdBy: "fixture",
    sourceSystem: "continuum",
    sourceRef: `job:${subject}`,
    createdMutationId: ID4,
    attentionMode: "action",
    activationAt: null,
    checkpointAt: null,
    attentionMetadata: null,
    ...override,
  };
}

function capture(subject: string, projectId: string | null): ContinuumCandidate {
  return {
    candidateId: `capture-${subject.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    sourceSystem: "human-intake",
    sourceRef: `human-intake:${subject}`,
    sourceTimestamp: NOW.toISOString(),
    candidateType: "open_job",
    proposedTarget: { kind: "open_job", projectId },
    payload: {
      kind: "open_job",
      jobKind: "required_action",
      subject,
      detail: null,
      waitingOnActor: "founder",
      dueAt: null,
      createJob: false,
    },
    confidence: projectId ? "high" : "ambiguous",
    evidenceBasis: { ruleIds: ["fixture"], matchedText: subject },
    candidateState: "active",
    reviewStatus: "pending",
    lastReviewAction: null,
    founderEditedPayload: null,
    founderEditedTarget: null,
    reviewedAt: null,
    createdAt: NOW.toISOString(),
    canonical: false,
    automaticApply: false,
    parserVersion: "fixture",
    supersedesCandidateId: null,
    supersededByCandidateId: null,
  };
}
