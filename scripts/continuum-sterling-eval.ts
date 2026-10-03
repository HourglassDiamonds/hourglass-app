import assert from "node:assert/strict";
import type { ContinuumCandidate } from "../lib/continuum/candidates/types";
import type { ProjectJob } from "../lib/continuum/client-memory/project-jobs/types";
import { detectFindings, nextThree, runSterling } from "../lib/continuum/sterling/engine";
import { STERLING_DIRECT_WRITE_CAPABILITIES } from "../lib/continuum/sterling/tools";
import { fingerprintCanonicalState } from "../lib/continuum/sterling/fingerprint";
import { deriveLedgerPreferenceSignals } from "../lib/continuum/sterling/ledger/preferences";
import { persistSterlingResponse } from "../lib/continuum/sterling/ledger/persist";
import { InMemorySterlingProposalRepository } from "../lib/continuum/sterling/ledger/repository";
import type {
  SterlingResponse,
  SterlingTodayItem,
  SterlingTruth,
} from "../lib/continuum/sterling/types";

const NOW = new Date("2026-10-03T14:00:00.000Z");
const PROJECT_A = "22222222-2222-4222-8222-222222222222";
const PROJECT_B = "44444444-4444-4444-8444-444444444444";
const observed: SterlingResponse[] = [];

const cases: readonly { name: string; run: () => void | Promise<void> }[] = [
  {
    name: "new-client-request",
    run: () => assert.equal(nextThree(truth([
      today("internal", { clientFacing: false }),
      today("client", { clientFacing: true }),
    ]), NOW)[0]?.id, "client"),
  },
  {
    name: "vendor-acknowledgment",
    run: () => assert.equal(detectFindings(truth([
      today("order", { owner: "shop", projectId: PROJECT_A, sourceRefs: ["gmail:vendor-ack"] }),
    ], [job("Place order", { projectId: PROJECT_A })]), NOW)[0]?.proposal?.proposedState, "vendor"),
  },
  {
    name: "duplicate-capture",
    run: () => assert.ok(detectFindings(truth([], [
      job("Call Duane", { jobId: "job-a" }),
      job("Call  Duane!", { jobId: "job-b" }),
    ]), NOW).some((finding) => finding.kind === "duplicate")),
  },
  {
    name: "projectless-task",
    run: () => assert.equal(detectFindings(truth([], [], [
      capture("Call Duane before Friday", null),
    ]), NOW)[0]?.proposal?.kind, "new_projectless_job"),
  },
  {
    name: "deadline-tomorrow",
    run: () => assert.equal(nextThree(truth([
      today("undated"),
      today("tomorrow", { dueAt: "2026-10-04T17:00:00.000Z" }),
    ]), NOW)[0]?.id, "tomorrow"),
  },
  {
    name: "old-stale-item",
    run: () => assert.ok(detectFindings(truth([], [job("Waiting for quote", {
      waitingOnActor: "vendor",
      updatedAt: "2026-08-01T12:00:00.000Z",
    })]), NOW).some((finding) => finding.kind === "stale")),
  },
  {
    name: "conflicting-source-truth",
    run: () => assert.ok(detectFindings(truth([
      today("handoff", { owner: "client", projectId: PROJECT_A }),
    ], [job("Send CAD", { projectId: PROJECT_A })]), NOW).some(
      (finding) => finding.proposal?.proposedState === "client",
    )),
  },
  {
    name: "rejected-proposal-boundary",
    run: () => {
      const rejected = capture("Rejected capture", null);
      rejected.reviewStatus = "discarded";
      rejected.lastReviewAction = "discard";
      assert.equal(detectFindings(truth([], [], [rejected]), NOW).length, 0);
    },
  },
  {
    name: "edited-proposal-boundary",
    run: () => {
      const edited = capture("Original wording", null);
      edited.lastReviewAction = "edit";
      edited.founderEditedPayload = openJobPayload("Finish Nate resin");
      edited.founderEditedTarget = { kind: "open_job", projectId: PROJECT_A };
      assert.ok(detectFindings(truth([], [
        job("Finish Nate resin", { projectId: PROJECT_A }),
      ], [edited]), NOW).some((finding) => finding.id.startsWith("capture-duplicate:")));
    },
  },
  {
    name: "fewer-than-three",
    run: () => assert.equal(nextThree(truth([today("only")]), NOW).length, 1),
  },
  {
    name: "capture-job-dedupe",
    run: () => assert.ok(detectFindings(truth([], [
      job("Finish Nate resin", { projectId: PROJECT_A }),
    ], [capture("Finish Nate resin", PROJECT_A)]), NOW).some(
      (finding) => finding.id.startsWith("capture-duplicate:"),
    )),
  },
  {
    name: "no-source-evidence",
    run: () => assert.equal(nextThree(truth([
      today("weak", { sourceRefs: [] }),
    ]), NOW)[0]?.confidence, "medium"),
  },
  {
    name: "contradictory-events",
    run: () => assert.equal(detectFindings({
      ...truth([]),
      anomalies: [{
        id: "reply-after-close",
        kind: "contradicts-completion",
        headline: "New reply conflicts",
        detail: "Client replied after completion was inferred.",
        jobId: "job-a",
        projectId: PROJECT_A,
        sourceRefs: ["gmail:new-reply"],
      }],
    }, NOW)[0]?.proposal?.kind, "stale_resolution"),
  },
  {
    name: "missing-context",
    run: () => assert.ok(detectFindings(truth([], [], [
      capture("Unmapped actionable note", null),
    ]), NOW).some((finding) => finding.kind === "orphan")),
  },
  {
    name: "duplicate-clients",
    run: () => assert.equal(detectFindings(truth([], [
      job("Review CAD", { jobId: "job-a", projectId: PROJECT_A }),
      job("Review CAD", { jobId: "job-b", projectId: PROJECT_B }),
    ]), NOW).some((finding) => finding.id.startsWith("duplicate:")), false),
  },
  {
    name: "stale-timestamps",
    run: () => assert.equal(detectFindings(truth([], [job("Malformed timestamp", {
      waitingOnActor: "client",
      updatedAt: "not-a-date",
    })]), NOW).some((finding) => finding.kind === "stale"), false),
  },
  {
    name: "ambiguous-capture",
    run: () => assert.equal(detectFindings(truth([], [], [
      capture("Maybe call the installer", null),
    ]), NOW)[0]?.proposal?.status, "review-required"),
  },
  {
    name: "no-op-day",
    run: () => {
      const result = evaluate(truth([]), "missing");
      assert.equal(result.findings.length, 0);
      assert.equal(result.proposals.length, 0);
    },
  },
  {
    name: "tool-failure",
    run: () => {
      const result = evaluate({ ...truth([today("unsafe")]), sourceStatus: "disconnected" }, "next-three");
      assert.equal(result.priorities.length, 0);
      assert.deepEqual(result.telemetry.failures, ["current-truth-disconnected"]);
    },
  },
  {
    name: "partial-source-outage",
    run: () => assert.ok(evaluate(
      { ...truth([]), sourceStatus: "refreshing" },
      "missing",
    ).uncertainty.some((line) => /refreshing/i.test(line))),
  },
  {
    name: "client-wait",
    run: () => assert.deepEqual(evaluate(truth([
      today("mine"),
      today("client", { owner: "client" }),
    ]), "waiting-client").findings.map((finding) => finding.title), ["Task client"]),
  },
  {
    name: "shop-wait",
    run: () => assert.deepEqual(evaluate(truth([
      today("shop", { owner: "shop" }),
      today("client", { owner: "client" }),
    ]), "waiting-shop").findings.map((finding) => finding.title), ["Task shop"]),
  },
  {
    name: "founder-wait",
    run: () => assert.deepEqual(evaluate(truth([
      today("mine"),
      today("client", { owner: "client" }),
    ]), "waiting-founder").findings.map((finding) => finding.title), ["Task mine"]),
  },
  {
    name: "deterministic-tie",
    run: () => assert.deepEqual(nextThree(truth([
      today("b"), today("a"),
    ]), NOW).map((priority) => priority.id), ["a", "b"]),
  },
  {
    name: "production-blocker",
    run: () => assert.equal(nextThree(truth([
      today("admin"),
      today("resin", { productionBlocker: true }),
    ]), NOW)[0]?.id, "resin"),
  },
  {
    name: "preference-minimum-evidence",
    run: () => {
      const decisions = [capture("One", null), capture("Two", null), capture("Three", null)];
      for (const decision of decisions) {
        decision.reviewStatus = "approved";
        decision.lastReviewAction = "approve";
      }
      assert.equal(evaluate(truth([], [], decisions), "missing").preferences[0]?.supportingDecisionCount, 3);
    },
  },
  {
    name: "ledger-stale-proposal",
    run: async () => {
      const { record } = await ledgerSeed("Stale proposal");
      assert.notEqual(record.currentStateFingerprint, fingerprintCanonicalState({ changed: true }));
    },
  },
  {
    name: "ledger-edited-approval",
    run: async () => {
      const { repository, record } = await ledgerSeed("Original action");
      assert.equal(record.originalProposal.proposedAction.kind, "create_projectless_job");
      if (record.originalProposal.proposedAction.kind !== "create_projectless_job") return;
      const edited = { ...record.originalProposal.proposedAction, subject: "Edited action" };
      const result = await repository.recordEditAndApproval(record.proposalId, edited, { decidedAt: NOW.toISOString() });
      assert.equal(result.ok && result.record.founderEditedPayload?.kind === "create_projectless_job" && result.record.founderEditedPayload.subject, "Edited action");
      assert.equal(record.originalProposal.proposedAction.subject, "Original action");
    },
  },
  {
    name: "ledger-rejected-proposal",
    run: async () => {
      const { repository, record } = await ledgerSeed("Reject me");
      const result = await repository.recordRejection(record.proposalId, { decidedAt: NOW.toISOString() });
      assert.equal(result.ok && result.record.status, "rejected");
      assert.equal((await repository.listActive()).length, 0);
    },
  },
  {
    name: "ledger-deferred-proposal",
    run: async () => {
      const { repository, record } = await ledgerSeed("Defer me");
      const result = await repository.recordDefer(record.proposalId, "2026-10-04T14:00:00.000Z", { decidedAt: NOW.toISOString() });
      assert.equal(result.ok && result.record.status, "deferred");
    },
  },
  {
    name: "ledger-duplicate-approval",
    run: async () => {
      const { repository, record } = await ledgerSeed("Approve once");
      await repository.recordApproval(record.proposalId, { decidedAt: NOW.toISOString() });
      const replay = await repository.recordApproval(record.proposalId, { decidedAt: NOW.toISOString() });
      assert.equal(replay.ok && replay.idempotent, true);
    },
  },
  {
    name: "ledger-failed-canonical-writer",
    run: async () => {
      const { repository, record } = await ledgerSeed("Writer failure");
      await repository.recordApproval(record.proposalId, { decidedAt: NOW.toISOString() });
      await repository.markExecuting(record.proposalId);
      const failed = await repository.markFailed(record.proposalId, "canonical-writer-unavailable", NOW.toISOString());
      assert.equal(failed.ok && failed.record.executionStatus, "failed");
    },
  },
  {
    name: "ledger-preference-context",
    run: async () => {
      const repository = new InMemorySterlingProposalRepository();
      for (const subject of ["Vendor one", "Vendor two", "Vendor three"]) {
        const seed = await ledgerSeed(subject, repository);
        await repository.recordDefer(seed.record.proposalId, "2026-10-04T14:00:00.000Z", { decidedAt: NOW.toISOString() });
      }
      assert.ok(deriveLedgerPreferenceSignals(await repository.listRecentDecisions()).some((signal) => signal.key.includes("repeated-defers")));
    },
  },
  {
    name: "ledger-conflicting-founder-history",
    run: async () => {
      const repository = new InMemorySterlingProposalRepository();
      const seeds = await Promise.all(["A", "B", "C"].map((subject) => ledgerSeed(subject, repository)));
      await repository.recordApproval(seeds[0]!.record.proposalId, { decidedAt: NOW.toISOString() });
      await repository.recordRejection(seeds[1]!.record.proposalId, { decidedAt: NOW.toISOString() });
      await repository.recordDefer(seeds[2]!.record.proposalId, "2026-10-04T14:00:00.000Z", { decidedAt: NOW.toISOString() });
      const signal = deriveLedgerPreferenceSignals(await repository.listRecentDecisions())[0];
      assert.match(signal?.description ?? "", /1\/3 approved, 1 rejected, 1 deferred/);
    },
  },
  {
    name: "ledger-no-history",
    run: () => assert.deepEqual(deriveLedgerPreferenceSignals([]), []),
  },
];

async function main(): Promise<void> {
  const started = Date.now();
  const failures: { name: string; message: string }[] = [];
  for (const scenario of cases) {
    try {
      await scenario.run();
    } catch (error) {
      failures.push({
        name: scenario.name,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const boundaryViolations =
    STERLING_DIRECT_WRITE_CAPABILITIES.length +
    observed.flatMap((result) => result.proposals).filter(
      (proposal) => proposal.status !== "review-required",
    ).length;

  console.info(JSON.stringify({
    suite: "sterling-v1",
    representativeTasks: cases.length,
    passed: cases.length - failures.length,
    failed: failures.length,
    boundaryViolations,
    failures,
    durationMs: Date.now() - started,
  }, null, 2));

  if (failures.length > 0 || boundaryViolations > 0) {
    throw new Error("Sterling evaluation failed");
  }
}

async function ledgerSeed(
  subject: string,
  repository = new InMemorySterlingProposalRepository(),
) {
  const candidate = capture(subject, null);
  const input = truth([], [], [candidate]);
  const response = await persistSterlingResponse(
    repository,
    runSterling({ truth: input, intent: "captures", now: NOW }),
    input,
  );
  const record = await repository.get(response.proposals[0]!.proposalId);
  assert.ok(record);
  return { repository, record };
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

function evaluate(
  input: SterlingTruth,
  intent: Parameters<typeof runSterling>[0]["intent"],
): SterlingResponse {
  const result = runSterling({ truth: input, intent, now: NOW });
  observed.push(result);
  return result;
}

function truth(
  todayItems: SterlingTodayItem[],
  openJobs: ProjectJob[] = [],
  candidates: ContinuumCandidate[] = [],
): SterlingTruth {
  return {
    generatedAt: NOW.toISOString(),
    sourceWatermark: "synthetic-eval",
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
    projectId: PROJECT_A,
    projectTitle: "Evaluation project",
    personName: "Evaluation client",
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
    jobId: "job-default",
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
    createdBy: "sterling-eval",
    sourceSystem: "continuum",
    sourceRef: `job:${subject}`,
    createdMutationId: "eval-mutation",
    attentionMode: "action",
    activationAt: null,
    checkpointAt: null,
    attentionMetadata: null,
    ...override,
  };
}

function openJobPayload(subject: string) {
  return {
    kind: "open_job" as const,
    jobKind: "required_action" as const,
    subject,
    detail: null,
    waitingOnActor: "founder" as const,
    dueAt: null,
    createJob: false as const,
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
    payload: openJobPayload(subject),
    confidence: projectId ? "high" : "ambiguous",
    evidenceBasis: { ruleIds: ["sterling-eval"], matchedText: subject },
    candidateState: "active",
    reviewStatus: "pending",
    lastReviewAction: null,
    founderEditedPayload: null,
    founderEditedTarget: null,
    reviewedAt: null,
    createdAt: NOW.toISOString(),
    canonical: false,
    automaticApply: false,
    parserVersion: "sterling-eval",
    supersedesCandidateId: null,
    supersededByCandidateId: null,
  };
}
