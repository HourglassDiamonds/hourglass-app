import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  compareOperationalBoard,
  type ManualObligationAuditRow,
  type ShadowBoardAuditRow,
} from "./operational-board-comparison";
import { decideOperationalBoardRow } from "./operational-board-decision";

function expected(overrides: Partial<ManualObligationAuditRow> = {}): ManualObligationAuditRow {
  return {
    workUnitId: "project:morgan",
    label: "Morgan",
    personId: "person:morgan",
    projectId: "project:morgan",
    jobId: "job:morgan",
    exactSourceRefs: ["gmail:thread:morgan"],
    material: true,
    disposition: "waiting_on_shop",
    owner: "vendor_shop",
    lifecycleStage: "cad",
    jobsExpectedClosed: ["job:stale-clarification"],
    ...overrides,
  };
}

function actual(overrides: Partial<ShadowBoardAuditRow> = {}): ShadowBoardAuditRow {
  return {
    workUnitId: "project:morgan",
    label: "Morgan",
    personId: "person:morgan",
    projectId: "project:morgan",
    jobId: "job:morgan",
    exactSourceRefs: ["gmail:thread:morgan"],
    disposition: "waiting_on_shop",
    owner: "vendor_shop",
    lifecycleStage: "cad",
    openJobIds: [],
    ...overrides,
  };
}

describe("operational board comparison", () => {
  it("accepts an exact identity-bound obligation and produces retry-stable output", () => {
    const input = { expected: [expected()], actual: [actual()] };
    const first = compareOperationalBoard(input);
    const second = compareOperationalBoard(input);
    assert.equal(first.passed, true);
    assert.deepEqual(first, second);
  });

  it("reports a newly discovered material obligation missing from the shadow board", () => {
    const result = compareOperationalBoard({ expected: [expected()], actual: [] });
    assert.equal(result.passed, false);
    assert.deepEqual(result.missedMaterialObligations.map((row) => row.reason), ["missing-shadow-row"]);
  });

  it("fails closed when a name-equivalent row lacks the exact source binding", () => {
    const result = compareOperationalBoard({
      expected: [expected()],
      actual: [actual({ exactSourceRefs: ["gmail:thread:unrelated"] })],
    });
    assert.equal(result.passed, false);
    assert.deepEqual(result.missedMaterialObligations.map((row) => row.reason),
      ["identity-or-source-binding-mismatch"]);
  });

  it("reports incorrect ownership and a false YOUR MOVE alert", () => {
    const result = compareOperationalBoard({
      expected: [expected()],
      actual: [actual({ disposition: "founder_action", owner: "founder" })],
    });
    assert.equal(result.passed, false);
    assert.equal(result.ownershipConflicts.length, 1);
    assert.equal(result.falseFounderMoves.length, 1);
  });

  it("reports a resolved Job that remains open while retaining separate follow-up work", () => {
    const result = compareOperationalBoard({
      expected: [
        expected({
          workUnitId: "project:dylan-delivery",
          label: "Dylan delivery",
          disposition: "resolved",
          owner: "none",
          material: false,
          jobsExpectedClosed: ["job:delivery"],
        }),
        expected({
          workUnitId: "project:dylan-follow-up",
          label: "Dylan follow-up",
          disposition: "founder_action",
          owner: "founder",
          jobsExpectedClosed: [],
        }),
      ],
      actual: [
        actual({
          workUnitId: "project:dylan-delivery",
          label: "Dylan delivery",
          disposition: "watching",
          owner: "vendor_shop",
          openJobIds: ["job:delivery"],
        }),
        actual({
          workUnitId: "project:dylan-follow-up",
          label: "Dylan follow-up",
          disposition: "founder_action",
          owner: "founder",
          openJobIds: [],
        }),
      ],
    });
    assert.deepEqual(result.unresolvedStaleJobs.map((row) => row.reason),
      ["expected-closed-job-remains-open:job:delivery"]);
    assert.deepEqual(result.staleActionsReappeared.map((row) => row.reason),
      ["terminal:resolved;reappeared:watching"]);
    assert.equal(result.falseFounderMoves.length, 0);
  });

  it("rejects duplicate projection of one work unit", () => {
    const result = compareOperationalBoard({ expected: [expected()], actual: [actual(), actual()] });
    assert.equal(result.passed, false);
    assert.deepEqual(result.duplicateWorkUnits.map((row) => row.reason),
      ["duplicate-shadow-rows:project:morgan:2"]);
  });

  it("keeps a canonical project and separately sourced work distinct", () => {
    const result = compareOperationalBoard({
      expected: [expected({ workUnitId: "project:one", exactSourceRefs: ["gmail:thread:next-step"] })],
      actual: [
        actual({ workUnitId: "project:one", exactSourceRefs: [] }),
        actual({ workUnitId: "provisional:one", projectId: null, personId: null,
          jobId: null, exactSourceRefs: ["gmail:thread:next-step"] }),
      ],
    });
    assert.deepEqual(result.missedMaterialObligations.map((row) => row.reason),
      ["identity-or-source-binding-mismatch"]);
    assert.equal(result.duplicateWorkUnits.length, 0);
  });

  it("requires a specific supported obligation before emitting a founder alert", () => {
    const unsupported = decideOperationalBoardRow({
      nextStepOwner: "founder", todayDisposition: "presented", lifecycle: "intake",
      obligations: [], recommendation: { category: "founder_actions", obligations: [] },
      evidenceComplete: true,
    });
    assert.deepEqual(unsupported,
      { disposition: "ambiguous", owner: "unknown", reason: "unsupported_founder_action" });

    const obligation = { obligationId: "follow-up", status: "open",
      responsibleParty: "founder", evidenceRefs: ["canonical:job:one"] };
    const supported = decideOperationalBoardRow({
      nextStepOwner: "founder", todayDisposition: "presented", lifecycle: "intake",
      obligations: [obligation], recommendation: { category: "founder_actions", obligations: [obligation] },
      evidenceComplete: true,
    });
    assert.equal(supported.disposition, "founder_action");
    assert.equal(supported.owner, "founder");
  });

  it("leaves a decision visibly unresolved when its evidence is incomplete", () => {
    const obligation = { obligationId: "follow-up", status: "open",
      responsibleParty: "founder", evidenceRefs: ["gmail:message:one"] };
    assert.deepEqual(decideOperationalBoardRow({
      nextStepOwner: "founder", todayDisposition: "presented", lifecycle: "intake",
      obligations: [obligation], recommendation: { category: "founder_actions", obligations: [obligation] },
      evidenceComplete: false,
    }), { disposition: "ambiguous", owner: "unknown", reason: "evidence_incomplete" });
  });
});
