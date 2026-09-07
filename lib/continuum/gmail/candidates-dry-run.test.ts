import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CANDIDATE_CONSUMER_CONTRACT,
  CANDIDATE_MUTATION_BOUNDARY,
  CANDIDATE_TYPES,
  DETERMINISTIC_CANDIDATE_BRAIN_GATE,
  isLiveCandidateReasoningEnabled,
} from "@/lib/continuum/candidates";
import { presentEightProjectCandidateDryRun } from "./candidates/dry-run";
import { EIGHT_PROJECT_IDS } from "./candidates/fixtures";

describe("eight-project Gmail candidate dry-run", () => {
  const dryRun = presentEightProjectCandidateDryRun();

  it("stays non-canonical and does not call a live model", () => {
    assert.equal(dryRun.liveModelCalls, false);
    assert.deepEqual(dryRun.mutationBoundary, CANDIDATE_MUTATION_BOUNDARY);
    assert.equal(isLiveCandidateReasoningEnabled(), false);
    assert.equal(DETERMINISTIC_CANDIDATE_BRAIN_GATE.providerSdk, null);
    assert.ok(dryRun.candidateCount > 0);
    for (const row of dryRun.candidates) {
      assert.equal(row.canonical, false);
      assert.equal(row.automaticApply, false);
    }
  });

  it("surfaces Pennock platinum and family synthetic sapphire conflict", () => {
    const platinum = dryRun.candidates.find(
      (row) =>
        row.payload.kind === "structured_spec" &&
        row.payload.fieldName === "metal" &&
        /platinum/i.test(row.payload.proposedValue) &&
        row.proposedTarget.kind === "project_spec" &&
        row.proposedTarget.projectId === EIGHT_PROJECT_IDS.pennock,
    );
    assert.ok(platinum);
    assert.equal(platinum?.candidateState, "conflict");
    assert.equal(platinum?.reviewStatus, "pending");
    const supply = dryRun.candidates.find(
      (row) =>
        row.payload.kind === "structured_spec" &&
        row.payload.fieldName === "diamond_supply_notes" &&
        /synthetic sapphire/i.test(row.payload.proposedValue),
    );
    assert.ok(supply);
    assert.equal(supply?.candidateState, "conflict");
    assert.equal(supply?.reviewStatus, "pending");
  });

  it("surfaces Lee / Spiegel refinement, approval, durability, and render request", () => {
    assert.ok(
      dryRun.candidates.some(
        (row) =>
          row.candidateType === "project_context" &&
          row.payload.kind === "project_context" &&
          row.payload.topic === "design_refinement",
      ),
    );
    assert.ok(
      dryRun.candidates.some(
        (row) =>
          row.payload.kind === "project_context" &&
          row.payload.topic === "client_approval",
      ),
    );
    assert.ok(
      dryRun.candidates.some(
        (row) =>
          row.candidateType === "note" &&
          row.payload.kind === "note" &&
          /durability/i.test(row.payload.text),
      ),
    );
    const job = dryRun.candidates.find(
      (row) =>
        row.candidateType === "open_job" &&
        row.payload.kind === "open_job" &&
        /render/i.test(row.payload.subject),
    );
    assert.ok(job);
    if (job?.payload.kind === "open_job") {
      assert.equal(job.payload.createJob, false);
      assert.equal(job.payload.waitingOnActor, "founder");
    }
  });

  it("surfaces Travis size 12.5 conflict and vendor waiting language", () => {
    const size = dryRun.candidates.find(
      (row) =>
        row.payload.kind === "structured_spec" &&
        row.payload.fieldName === "finger_size" &&
        row.payload.proposedValue === "12.5",
    );
    assert.ok(size);
    assert.equal(size?.candidateState, "conflict");
    assert.equal(size?.reviewStatus, "pending");
    const vendor = dryRun.candidates.find(
      (row) =>
        row.candidateType === "open_job" &&
        row.payload.kind === "open_job" &&
        row.payload.waitingOnActor === "vendor",
    );
    assert.ok(vendor);
    if (vendor?.payload.kind === "open_job") {
      assert.equal(vendor.payload.createJob, false);
    }
  });

  it("surfaces Sarah revision D, size 8.5, and supply split", () => {
    assert.ok(
      dryRun.candidates.some(
        (row) =>
          row.payload.kind === "project_context" &&
          row.payload.topic === "cad_revision" &&
          row.payload.value === "D",
      ),
    );
    const size = dryRun.candidates.find(
      (row) =>
        row.payload.kind === "structured_spec" &&
        row.payload.fieldName === "finger_size" &&
        row.payload.proposedValue === "8.5" &&
        row.proposedTarget.kind === "project_spec" &&
        row.proposedTarget.projectId === EIGHT_PROJECT_IDS.sarah,
    );
    assert.ok(size);
    assert.equal(size?.candidateState, "active");
    assert.equal(size?.reviewStatus, "pending");
    assert.ok(
      dryRun.candidates.some(
        (row) =>
          row.payload.kind === "structured_spec" &&
          row.payload.fieldName === "diamond_supply_notes" &&
          /customer center|vendor melee/i.test(row.payload.proposedValue),
      ),
    );
  });

  it("surfaces Dylan CAD/diamond approval language", () => {
    const approvals = dryRun.candidates.filter(
      (row) =>
        row.payload.kind === "project_context" &&
        row.payload.topic === "client_approval" &&
        row.proposedTarget.kind === "project" &&
        row.proposedTarget.projectId === EIGHT_PROJECT_IDS.dylan,
    );
    assert.ok(approvals.some((row) => /CAD looks great/i.test(
      row.payload.kind === "project_context" ? row.payload.value : "",
    )));
    assert.ok(approvals.some((row) => /diamond looks awesome/i.test(
      row.payload.kind === "project_context" ? row.payload.value : "",
    )));
  });

  it("exactly associates Chelsea, Madi, and Kaitlin Projects", () => {
    const associated = new Set(
      dryRun.candidates
        .filter(
          (row) =>
            row.candidateType === "project_association" &&
            row.payload.kind === "project_association" &&
            row.payload.match === "exact" &&
            row.proposedTarget.kind === "project",
        )
        .map((row) =>
          row.proposedTarget.kind === "project" ? row.proposedTarget.projectId : "",
        ),
    );
    assert.ok(associated.has(EIGHT_PROJECT_IDS.chelsea));
    assert.ok(associated.has(EIGHT_PROJECT_IDS.madi));
    assert.ok(associated.has(EIGHT_PROJECT_IDS.kaitlin));
    const cadValues = dryRun.candidates
      .filter(
        (row) =>
          row.payload.kind === "structured_spec" &&
          row.payload.fieldName === "cad_job_number",
      )
      .map((row) =>
        row.payload.kind === "structured_spec" ? row.payload.proposedValue : "",
      );
    assert.equal(cadValues.includes("CR5001024"), false);
    assert.ok(
      dryRun.candidates.some((row) => row.sourceRef.includes("msg-chelsea")),
    );
    assert.ok(
      dryRun.candidates.some((row) => row.sourceRef.includes("msg-madi")),
    );
    assert.ok(
      dryRun.candidates.some((row) => row.sourceRef.includes("msg-kaitlin")),
    );
  });

  it("exposes the cross-source consumer contract", () => {
    assert.deepEqual([...CANDIDATE_TYPES], [
      "person_association",
      "project_association",
      "project_context",
      "note",
      "structured_spec",
      "open_job",
      "date",
      "follow_up",
    ]);
    assert.equal(CANDIDATE_CONSUMER_CONTRACT.brainGate, "pluggable-later");
    assert.equal(CANDIDATE_CONSUMER_CONTRACT.mutationBoundary.canonical, false);
  });
});
