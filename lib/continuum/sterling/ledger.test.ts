import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CandidateStore, ContinuumCandidate, FounderReviewInput } from "@/lib/continuum/candidates/types";
import type { CreateProjectJobInput, CreateProjectJobResult } from "@/lib/continuum/client-memory/project-jobs/create";
import type { MutateOpenJobInput, MutateOpenJobResult } from "@/lib/continuum/client-memory/project-jobs/mutate";
import type { ProjectJob } from "@/lib/continuum/client-memory/project-jobs/types";
import type { ProjectJobWriter } from "@/lib/continuum/client-memory/project-jobs/writer";
import { runSterling } from "./engine";
import { deriveLedgerPreferenceSignals } from "./ledger/preferences";
import { persistRegeneratedSterlingResponse, persistSterlingResponse } from "./ledger/persist";
import { InMemorySterlingProposalRepository } from "./ledger/repository";
import { SterlingApprovalService } from "./ledger/service";
import type { SterlingProposalRecord } from "./ledger/types";
import type { SterlingTodayItem, SterlingTruth } from "./types";

const NOW = "2026-10-03T14:00:00.000Z";
const PROJECT = "22222222-2222-4222-8222-222222222222";
const JOB = "11111111-1111-4111-8111-111111111111";
const CANDIDATE = "33333333-3333-4333-8333-333333333333";

describe("Sterling proposal ledger", () => {
  it("creates, reads, and lists a proposal with provenance", async () => {
    const harness = await waitingHarness();
    const active = await harness.repository.listActive();
    assert.equal(active.length, 1);
    assert.equal(active[0]?.runId, harness.response.telemetry.runId);
    assert.equal(active[0]?.model, harness.response.telemetry.model);
    assert.deepEqual(active[0]?.evidenceRefs, ["gmail:vendor-ack"]);
  });

  it("approves through the canonical writer and links its mutation", async () => {
    const harness = await waitingHarness();
    const result = await harness.service.review({ action: "approve", proposalId: harness.proposal.proposalId });
    assert.equal(result.ok && result.status, "executed");
    assert.equal(harness.writer.mutationCount, 1);
    assert.equal((await harness.repository.get(harness.proposal.proposalId))?.canonicalMutationId, harness.proposal.proposalId);
  });

  it("replays duplicate approval without a duplicate mutation", async () => {
    const harness = await waitingHarness();
    const first = await harness.service.review({ action: "approve", proposalId: harness.proposal.proposalId });
    const second = await harness.service.review({ action: "approve", proposalId: harness.proposal.proposalId });
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    assert.equal(harness.writer.mutationCount, 1);
  });

  it("reports bounded dependency timing without changing approval semantics", async () => {
    const harness = await waitingHarness();
    const stages: string[] = [];
    let tick = 0;
    const service = new SterlingApprovalService({
      repository: harness.repository,
      jobs: harness.writer,
      candidates: harness.candidates,
      actor: "founder",
      nowIso: () => NOW,
      clockMs: () => tick++,
      onTiming: ({ stage, durationMs }) => {
        stages.push(stage);
        assert.equal(durationMs, 1);
      },
    });
    const result = await service.review({ action: "approve", proposalId: harness.proposal.proposalId });
    assert.equal(result.ok && result.status, "executed");
    assert.deepEqual(stages, [
      "ledger-read",
      "ledger-decision",
      "currentness-check",
      "ledger-claim",
      "canonical-writer",
      "ledger-finalize",
    ]);
    assert.equal(harness.writer.mutationCount, 1);
  });

  it("executes an edited approval and preserves the original proposal", async () => {
    const harness = await waitingHarness();
    const result = await harness.service.review({
      action: "edit_and_approve",
      proposalId: harness.proposal.proposalId,
      editedValue: "client",
    });
    assert.equal(result.ok && result.status, "executed");
    const stored = await harness.repository.get(harness.proposal.proposalId);
    assert.equal(stored?.founderEditedPayload?.kind, "update_job");
    assert.equal(stored?.originalProposal.proposedAction.kind === "update_job" && stored.originalProposal.proposedAction.waitingOnActor, "vendor");
    assert.equal(harness.writer.jobs.get(JOB)?.waitingOnActor, "client");
  });

  it("rejects without a canonical mutation", async () => {
    const harness = await waitingHarness();
    const result = await harness.service.review({ action: "reject", proposalId: harness.proposal.proposalId, note: "Already handled" });
    assert.equal(result.ok && result.status, "rejected");
    assert.equal(harness.writer.mutationCount, 0);
  });

  it("defers without a canonical mutation", async () => {
    const harness = await waitingHarness();
    const result = await harness.service.review({ action: "defer", proposalId: harness.proposal.proposalId, deferUntil: "2026-10-04T14:00:00.000Z" });
    assert.equal(result.ok && result.status, "deferred");
    assert.equal(harness.writer.mutationCount, 0);
    assert.equal((await harness.repository.get(harness.proposal.proposalId))?.deferUntil, "2026-10-04T14:00:00.000Z");
  });

  it("blocks a stale proposal before execution", async () => {
    const harness = await waitingHarness();
    harness.writer.jobs.set(JOB, { ...harness.writer.jobs.get(JOB)!, updatedAt: "2026-10-03T15:00:00.000Z" });
    const result = await harness.service.review({ action: "approve", proposalId: harness.proposal.proposalId });
    assert.equal(result.ok, false);
    assert.equal(!result.ok && result.status, "stale");
    assert.equal(harness.writer.mutationCount, 0);
  });

  it("links a regenerated proposal to the stale proposal", async () => {
    const harness = await waitingHarness();
    const changed = { ...harness.writer.jobs.get(JOB)!, updatedAt: "2026-10-03T15:00:00.000Z" };
    harness.writer.jobs.set(JOB, changed);
    await harness.service.review({ action: "approve", proposalId: harness.proposal.proposalId });
    const nextTruth = waitingTruth(changed);
    const regenerated = runSterling({ truth: nextTruth, intent: "missing", now: new Date(NOW) });
    await persistRegeneratedSterlingResponse(harness.repository, regenerated, nextTruth, harness.proposal.proposalId);
    const replacement = (await harness.repository.listActive())[0];
    assert.notEqual(replacement?.proposalId, harness.proposal.proposalId);
    assert.equal(replacement?.replacesProposalId, harness.proposal.proposalId);
    assert.equal((await harness.repository.get(harness.proposal.proposalId))?.supersededBy, replacement?.proposalId);
  });

  it("records canonical writer failure cleanly and permits safe retry", async () => {
    const harness = await waitingHarness();
    harness.writer.failNext = true;
    const failed = await harness.service.review({ action: "approve", proposalId: harness.proposal.proposalId });
    assert.equal(!failed.ok && failed.status, "failed");
    assert.equal((await harness.repository.get(harness.proposal.proposalId))?.executionStatus, "failed");
    const retried = await harness.service.review({ action: "approve", proposalId: harness.proposal.proposalId });
    assert.equal(retried.ok && retried.status, "executed");
  });

  it("keeps unsupported approval recorded but unexecuted", async () => {
    const repository = new InMemorySterlingProposalRepository();
    const jobs = [job("Call Duane", { jobId: JOB }), job("Call  Duane!", { jobId: "55555555-5555-4555-8555-555555555555" })];
    const input = truth([], jobs);
    const response = await persistSterlingResponse(repository, runSterling({ truth: input, intent: "missing", now: new Date(NOW) }), input);
    const writer = new FakeJobWriter(jobs);
    const service = serviceFor(repository, writer, new FakeCandidateStore());
    const result = await service.review({ action: "approve", proposalId: response.proposals[0]!.proposalId });
    assert.equal(result.ok && result.status, "approved-unexecuted");
    assert.equal(result.ok && result.proposal.executionStatus, "blocked_unsupported");
    assert.equal(writer.mutationCount, 0);
  });

  it("treats one rejection as insufficient preference evidence", async () => {
    const harness = await waitingHarness();
    await harness.service.review({ action: "reject", proposalId: harness.proposal.proposalId });
    assert.equal(deriveLedgerPreferenceSignals(await harness.repository.listRecentDecisions()).length, 0);
  });

  it("creates inspectable preference signals after three consistent decisions", async () => {
    const rows = [0, 1, 2].map((index) => reviewedRecord(`00000000-0000-4000-8000-00000000000${index}`, "deferred"));
    const signals = deriveLedgerPreferenceSignals(rows);
    assert.ok(signals.some((signal) => signal.key === "ledger:repeated-defers:waiting_state"));
    assert.ok(signals.every((signal) => signal.supportingDecisionCount >= 3));
  });

  it("grounds Sterling explanations in repeated ledger history", () => {
    const history = [0, 1, 2].map((index) => reviewedRecord(`00000000-0000-4000-8000-00000000000${index}`, "deferred"));
    const result = runSterling({ truth: waitingTruth(job("Place order")), intent: "missing", now: new Date(NOW), proposalHistory: history });
    assert.match(result.findings[0]?.whyItMatters ?? "", /deferred 3 times/i);
  });

  it("rejects a Quick Capture duplicate without state mutation", async () => {
    const repository = new InMemorySterlingProposalRepository();
    const candidate = capture("Finish resin", PROJECT);
    const input = truth([], [job("Finish resin", { projectId: PROJECT })], [candidate]);
    const response = await persistSterlingResponse(repository, runSterling({ truth: input, intent: "captures", now: new Date(NOW) }), input);
    const writer = new FakeJobWriter(input.openJobs);
    const result = await serviceFor(repository, writer, new FakeCandidateStore([candidate])).review({ action: "reject", proposalId: response.proposals[0]!.proposalId });
    assert.equal(result.ok && result.status, "rejected");
    assert.equal(writer.mutationCount, 0);
  });

  it("creates a projectless Job only after approval", async () => {
    const repository = new InMemorySterlingProposalRepository();
    const candidate = capture("Call Duane", null);
    const input = truth([], [], [candidate]);
    const response = await persistSterlingResponse(repository, runSterling({ truth: input, intent: "captures", now: new Date(NOW) }), input);
    const writer = new FakeJobWriter();
    assert.equal(writer.jobs.size, 0);
    const result = await serviceFor(repository, writer, new FakeCandidateStore([candidate])).review({ action: "approve", proposalId: response.proposals[0]!.proposalId });
    assert.equal(result.ok && result.status, "executed");
    assert.equal(writer.jobs.size, 1);
  });

  it("treats a deleted entity as stale", async () => {
    const harness = await waitingHarness();
    harness.writer.jobs.delete(JOB);
    const result = await harness.service.review({ action: "approve", proposalId: harness.proposal.proposalId });
    assert.equal(!result.ok && result.status, "stale");
  });

  it("keeps concurrent approvals to one canonical mutation", async () => {
    const harness = await waitingHarness();
    const results = await Promise.all([
      harness.service.review({ action: "approve", proposalId: harness.proposal.proposalId }),
      harness.service.review({ action: "approve", proposalId: harness.proposal.proposalId }),
    ]);
    assert.ok(results.every((result) => result.ok));
    assert.equal(harness.writer.mutationCount, 1);
  });

  it("excludes terminal proposals from the active queue", async () => {
    const harness = await waitingHarness();
    await harness.service.review({ action: "reject", proposalId: harness.proposal.proposalId });
    assert.equal((await harness.repository.listActive()).length, 0);
    assert.equal((await harness.repository.listForEntity("job", JOB)).length, 1);
  });

  it("deduplicates persistence replay without replacing provenance", async () => {
    const harness = await waitingHarness();
    const replay = await persistSterlingResponse(harness.repository, harness.response, waitingTruth(job("Place order")));
    assert.equal(replay.ledgerStatus, "persisted");
    assert.equal((await harness.repository.listForEntity("job", JOB)).length, 1);
    assert.equal((await harness.repository.get(harness.proposal.proposalId))?.runId, harness.proposal.runId);
  });

  it("rejects an illegal decision after execution", async () => {
    const harness = await waitingHarness();
    await harness.service.review({ action: "approve", proposalId: harness.proposal.proposalId });
    const rejected = await harness.service.review({ action: "reject", proposalId: harness.proposal.proposalId });
    assert.equal(rejected.ok, false);
    assert.equal(harness.writer.mutationCount, 1);
  });
});

async function waitingHarness() {
  const canonical = job("Place order");
  const input = waitingTruth(canonical);
  const repository = new InMemorySterlingProposalRepository();
  const response = await persistSterlingResponse(repository, runSterling({ truth: input, intent: "missing", now: new Date(NOW) }), input);
  const writer = new FakeJobWriter([canonical]);
  const candidates = new FakeCandidateStore();
  const proposal = (await repository.get(response.proposals[0]!.proposalId))!;
  return { repository, response, writer, candidates, proposal, service: serviceFor(repository, writer, candidates) };
}

function serviceFor(repository: InMemorySterlingProposalRepository, writer: FakeJobWriter, candidates: FakeCandidateStore) {
  return new SterlingApprovalService({ repository, jobs: writer, candidates, actor: "founder", nowIso: () => NOW });
}

function waitingTruth(canonical: ProjectJob): SterlingTruth {
  return truth([today("shop", { owner: "shop", projectId: PROJECT, sourceRefs: ["gmail:vendor-ack"] })], [canonical]);
}

function truth(todayItems: SterlingTodayItem[], openJobs: ProjectJob[] = [], candidates: ContinuumCandidate[] = []): SterlingTruth {
  return { generatedAt: NOW, sourceWatermark: "eval-watermark", sourceStatus: "current", today: todayItems, openJobs, candidates, anomalies: [] };
}

function today(id: string, override: Partial<SterlingTodayItem> = {}): SterlingTodayItem {
  return { id, title: `Task ${id}`, why: "Current evidence", projectId: PROJECT, projectTitle: "Project", personName: "Client", owner: "founder", state: "Up next", proposedNextAction: "Act", dueAt: null, sourceRefs: ["gmail:source"], authoritative: true, clientFacing: true, productionBlocker: false, ...override };
}

function job(subject: string, override: Partial<ProjectJob> = {}): ProjectJob {
  return { jobId: JOB, projectId: PROJECT, kind: "required_action", subject, detail: null, waitingOnActor: "founder", associatedPersonId: null, state: "open", dueAt: null, deferredUntil: null, resolvedAt: null, cancelledAt: null, createdAt: "2026-10-01T12:00:00.000Z", updatedAt: "2026-10-01T12:00:00.000Z", createdBy: "fixture", sourceSystem: "continuum", sourceRef: `job:${subject}`, createdMutationId: "44444444-4444-4444-8444-444444444444", attentionMode: "action", activationAt: null, checkpointAt: null, attentionMetadata: null, ...override };
}

function capture(subject: string, projectId: string | null): ContinuumCandidate {
  return { candidateId: CANDIDATE, sourceSystem: "human-intake", sourceRef: `human-intake:${subject}`, sourceTimestamp: NOW, candidateType: "open_job", proposedTarget: { kind: "open_job", projectId }, payload: { kind: "open_job", jobKind: "required_action", subject, detail: null, waitingOnActor: "founder", dueAt: null, createJob: false }, confidence: projectId ? "high" : "ambiguous", evidenceBasis: { ruleIds: ["fixture"], matchedText: subject }, candidateState: "active", reviewStatus: "pending", lastReviewAction: null, founderEditedPayload: null, founderEditedTarget: null, reviewedAt: null, createdAt: NOW, canonical: false, automaticApply: false, parserVersion: "fixture", supersedesCandidateId: null, supersededByCandidateId: null };
}

function reviewedRecord(id: string, decision: "deferred" | "rejected"): SterlingProposalRecord {
  const original = runSterling({ truth: waitingTruth(job("Place order")), intent: "missing", now: new Date(NOW) }).proposals[0]!;
  return { proposalId: id, proposalType: "waiting_state", status: decision, affectedEntityType: "job", affectedEntityId: JOB, currentStateFingerprint: original.currentStateFingerprint, currentStateSnapshot: original.currentStateSnapshot, entityVersion: NOW, originalProposal: original, evidenceRefs: original.evidence, reasoningSummary: original.reason, confidence: "high", sourceWorkflow: "missing", sourceWatermark: "watermark", provider: "openai", model: "test", modelConfiguration: "test", runId: id, traceId: null, founderDecision: decision, founderDecisionAt: NOW, founderDecisionNote: null, founderEditedPayload: null, deferUntil: decision === "deferred" ? "2026-10-04T14:00:00.000Z" : null, canonicalMutationId: null, executedPayload: null, executionStatus: "not_requested", executionErrorCategory: null, supersededBy: null, replacesProposalId: null, createdAt: NOW, updatedAt: NOW, executedAt: null, ledgerVersion: "sterling-proposal-ledger-v1", contractVersion: "sterling-v1", promptVersion: "sterling-grounding-v1" };
}

class FakeJobWriter implements ProjectJobWriter {
  readonly jobs = new Map<string, ProjectJob>();
  readonly mutations = new Map<string, ProjectJob>();
  mutationCount = 0;
  failNext = false;

  constructor(rows: readonly ProjectJob[] = []) {
    for (const row of rows) this.jobs.set(row.jobId, { ...row });
  }

  async getJob(projectId: string | null, jobId: string) {
    const row = this.jobs.get(jobId);
    return row?.projectId === projectId ? { ...row } : null;
  }

  async mutateJob(input: MutateOpenJobInput): Promise<MutateOpenJobResult> {
    const applied = this.mutations.get(input.mutationId);
    if (applied) return { ok: true, status: "already-present", job: { ...applied } };
    if (this.failNext) {
      this.failNext = false;
      return { ok: false, reason: "unavailable" };
    }
    const current = this.jobs.get(input.jobId);
    if (!current) return { ok: false, reason: "job-not-found" };
    if (input.expectedUpdatedAt && current.updatedAt !== input.expectedUpdatedAt) return { ok: false, reason: "invalid-input", code: "stale-write" };
    const next = { ...current, waitingOnActor: (input.waitingOnActor || current.waitingOnActor) as ProjectJob["waitingOnActor"], updatedAt: NOW };
    this.jobs.set(next.jobId, next);
    this.mutations.set(input.mutationId, next);
    this.mutationCount += 1;
    return { ok: true, status: "updated", job: { ...next } };
  }

  async createJob(input: CreateProjectJobInput): Promise<CreateProjectJobResult> {
    const applied = this.mutations.get(input.mutationId);
    if (applied) return { ok: true, status: "already-present", job: { ...applied } };
    if (this.failNext) {
      this.failNext = false;
      return { ok: false, reason: "unavailable" };
    }
    const created = job(input.subject, { jobId: "66666666-6666-4666-8666-666666666666", projectId: input.projectId, waitingOnActor: input.waitingOnActor as ProjectJob["waitingOnActor"], sourceRef: input.sourceRef ?? null, createdMutationId: input.mutationId });
    this.jobs.set(created.jobId, created);
    this.mutations.set(input.mutationId, created);
    this.mutationCount += 1;
    return { ok: true, status: "created", job: { ...created } };
  }
}

class FakeCandidateStore implements CandidateStore {
  private readonly rows = new Map<string, ContinuumCandidate>();
  constructor(rows: readonly ContinuumCandidate[] = []) { for (const row of rows) this.rows.set(row.candidateId, { ...row }); }
  async put(row: ContinuumCandidate) { const existing = this.rows.get(row.candidateId); if (existing) return { status: "duplicate" as const, record: existing }; this.rows.set(row.candidateId, row); return { status: "inserted" as const, record: row }; }
  async get(candidateId: string) { return this.rows.get(candidateId) ?? null; }
  async list() { return [...this.rows.values()]; }
  async replace(row: ContinuumCandidate) { this.rows.set(row.candidateId, row); return row; }
  async applyReview(candidateId: string, input: FounderReviewInput, reviewedAt: string) { void input; void reviewedAt; const row = this.rows.get(candidateId); return row ? { ok: true as const, record: row } : { ok: false as const, reason: "not-found" as const }; }
}
