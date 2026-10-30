import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  evaluateOctober30Acceptance,
  OCTOBER_30_FOUNDER_EXPECTATIONS,
  type October30Observation,
} from "./october-30-acceptance";

function acceptedObservations(): October30Observation[] {
  return OCTOBER_30_FOUNDER_EXPECTATIONS.map((row, index) => ({
    id: row.id,
    found: true,
    identityVerified: true,
    canonicalIdentity: row.id === "j-pennock" ? "person-j-pennock"
      : row.id === "jp" ? "person-jp" : `identity-${index}`,
    disposition: row.disposition,
    lifecycleStage: row.lifecycleStage ?? null,
    waitingOn: row.waitingOn ?? null,
    attentionPriority: row.attentionPriority ?? "no_attention",
    relationshipRole: row.relationshipRole ?? null,
  }));
}

describe("October 30 founder acceptance", () => {
  it("captures all named founder outcomes without runtime name heuristics", () => {
    const result = evaluateOctober30Acceptance(acceptedObservations());
    assert.equal(result.passed, true);
    assert.equal(result.cases.length, 21);
  });

  it("fails JP/J. Pennock identity collisions", () => {
    const observations = acceptedObservations();
    const jp = observations.find((row) => row.id === "jp")!;
    jp.canonicalIdentity = "person-j-pennock";
    const result = evaluateOctober30Acceptance(observations);
    const row = result.cases.find((item) => item.id === "jp");
    assert.deepEqual(row?.failures, ["jp-j-pennock-identity-collision"]);
  });

  it("keeps evidence-gapped investigations unverified instead of inventing facts", () => {
    const observations = acceptedObservations().filter((row) => row.id !== "justin-ckezepis");
    const result = evaluateOctober30Acceptance(observations);
    const row = result.cases.find((item) => item.id === "justin-ckezepis");
    assert.equal(row?.status, "unverified");
    assert.deepEqual(row?.failures, ["missing-observation"]);
  });
});
