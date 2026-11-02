import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { STERLING_FOUNDER_ACCEPTANCE_FIXTURE_MANIFEST as manifest } from "./founder-acceptance-fixture-manifest";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256 = /^[0-9a-f]{64}$/;

describe("Sterling founder acceptance fixture manifest", () => {
  it("contains the eight approved scenarios and no shared-data write behavior", () => {
    assert.equal(manifest.cases.length, 8);
    assert.deepEqual(manifest.cases.map((fixture) => fixture.id), [
      "design-waiting-vendor",
      "transition-to-production",
      "complete-and-resolve",
      "cancel-superseded-obligation",
      "exact-source-suppression",
      "ambiguous-cross-client-identity",
      "stale-approval",
      "duplicate-approval-replay",
    ]);
    assert.equal(manifest.targetSupabaseProjectRef, "hrmpzplffuhhvbtxxhnt");
    assert.equal(JSON.stringify(manifest).includes("@"), false);
  });

  it("uses only live canonical lifecycle values and keeps cad_design presentation-only", () => {
    const canonical = new Set(manifest.liveConstraintSnapshot.customNewJewelryStages);
    const serialized = JSON.stringify(manifest);
    for (const fixture of manifest.cases) {
      if ("initialLifecycle" in fixture) assert.equal(canonical.has(fixture.initialLifecycle.stage), true);
      if ("approval" in fixture && "operations" in fixture.approval) {
        for (const operation of fixture.approval.operations) {
          if (operation.kind === "set_project_lifecycle") {
            assert.equal(canonical.has(operation.targetLifecycleStage), true);
          }
        }
      }
    }
    assert.equal(serialized.includes('"targetLifecycleStage":"cad_design"'), false);
    assert.equal(manifest.liveConstraintSnapshot.presentationGroupOnly, "cad_design");
  });

  it("reserves unique valid UUIDs and exact source hashes", () => {
    const ids: string[] = [];
    const walk = (value: unknown, key = ""): void => {
      if (typeof value === "string" && key.endsWith("Id") && key !== "candidateId") ids.push(value);
      else if (Array.isArray(value)) value.forEach((item) => walk(item));
      else if (value && typeof value === "object") {
        for (const [childKey, child] of Object.entries(value)) walk(child, childKey);
      }
    };
    walk(manifest.cases);
    ids.forEach((id) => assert.match(id, UUID));
    assert.equal(ids.length, 64);
    assert.equal(new Set(ids).size, 60);

    const sourceCase = manifest.cases[4];
    assert.equal(sourceCase.id, "exact-source-suppression");
    if (sourceCase.id !== "exact-source-suppression") return;
    assert.match(sourceCase.candidate.candidateId, SHA256);
    assert.match(sourceCase.candidate.emailHash, SHA256);
    assert.equal(sourceCase.candidate.sourceSystem, "gmail");
    assert.match(sourceCase.candidate.sourceRef, /^fixture-gmail:\/\//);
    assert.equal(sourceCase.suppress.expectedCandidateVersion, "1");
    assert.equal(sourceCase.restore.expectedCandidateVersion, "2");
  });

  it("pins proposal, candidate, stale, and replay version expectations", () => {
    const successful = manifest.cases.filter((fixture) => "approval" in fixture && fixture.id !== "stale-approval");
    for (const fixture of successful) {
      if (!("approval" in fixture) || !("expectedExecutedVersion" in fixture.approval)) continue;
      assert.equal(fixture.approval.expectedProposalVersion, 1);
      assert.equal(fixture.approval.expectedExecutedVersion, 3);
    }
    const stale = manifest.cases[6];
    assert.equal(stale.id, "stale-approval");
    if (stale.id !== "stale-approval") return;
    assert.equal(stale.approval.expectedAfterDecisionVersion, 2);
    assert.equal(stale.approval.expectedExecutionStatus, "pending");
    assert.equal(stale.approval.expectedFailure, "stale-job-version");

    const replay = manifest.cases[7];
    assert.equal(replay.id, "duplicate-approval-replay");
    if (replay.id !== "duplicate-approval-replay") return;
    assert.equal(replay.approval.replayOutcome, "already-present");
  });
});

