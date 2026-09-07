import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CANDIDATE_CONTRACT_VERSION,
  CANDIDATE_MUTATION_BOUNDARY,
  CANDIDATE_SOURCE_REF_MAX,
  CANDIDATE_STATUSES,
  CANDIDATE_TYPES,
  DETERMINISTIC_CANDIDATE_BRAIN_GATE,
} from "./index";

describe("Continuum Candidate contract", () => {
  it("owns the canonical candidate categories for later source adapters", () => {
    assert.equal(CANDIDATE_CONTRACT_VERSION, "continuum-candidates-v1");
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
    assert.deepEqual([...CANDIDATE_STATUSES], [
      "pending",
      "conflict_review_required",
      "superseded",
    ]);
  });

  it("forbids canonical writes and live model calls at the contract boundary", () => {
    assert.equal(CANDIDATE_MUTATION_BOUNDARY.canonical, false);
    assert.equal(CANDIDATE_MUTATION_BOUNDARY.automaticApply, false);
    assert.equal(CANDIDATE_MUTATION_BOUNDARY.writesPersons, false);
    assert.equal(CANDIDATE_MUTATION_BOUNDARY.writesProjectSpecs, false);
    assert.equal(CANDIDATE_MUTATION_BOUNDARY.writesLifecycle, false);
    assert.equal(CANDIDATE_MUTATION_BOUNDARY.writesProjectKind, false);
    assert.equal(CANDIDATE_MUTATION_BOUNDARY.createsOpenJobs, false);
    assert.equal(CANDIDATE_MUTATION_BOUNDARY.mutatesGmail, false);
    assert.equal(CANDIDATE_MUTATION_BOUNDARY.callsSpecWriter, false);
    assert.deepEqual(CANDIDATE_MUTATION_BOUNDARY.proposedCanonicalWrites, []);
    assert.equal(DETERMINISTIC_CANDIDATE_BRAIN_GATE.liveModelCalls, false);
    assert.equal(CANDIDATE_SOURCE_REF_MAX, 2048);
  });
});
