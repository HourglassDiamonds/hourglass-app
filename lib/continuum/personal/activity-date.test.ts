import assert from "node:assert/strict";
import test from "node:test";
import { compareActivityDate } from "./activity-date";
import { acceptActivityProposal, buildAcceptedActivity, correctActivityDate } from "./mutations";
import { createInitialPersonalState } from "./program";
import type { ActivityFacts, NaturalIngestionProposal } from "./types";

const golf: ActivityFacts = { activityType: "Golf", whoopStrain: { value: 12.9, evidence: "observed" } };
const soccer: ActivityFacts = { activityType: "Soccer", whoopStrain: { value: 5.9, evidence: "observed" } };
const proposal: Extract<NaturalIngestionProposal, { kind: "activity" }> = {
  id: "proposal-multi", proposedAt: "2026-10-17T12:00:00Z", sourceType: "activity_screenshot",
  confidence: "high", assumptions: [], summary: "Two visible activities", model: "test", sourceDigest: "a".repeat(64),
  kind: "activity", activity: golf, activities: [golf, soccer], sourceDate: { month: 10, day: 12, evidence: "observed" },
  dailySummary: { whoopStrain: { value: 15.1, evidence: "observed" } }, guidance: "Review visible values.",
};

test("visible screenshot dates match, conflict, or remain unknown without inventing a year", () => {
  assert.equal(compareActivityDate(proposal.sourceDate, "2026-10-12"), "match");
  assert.equal(compareActivityDate(proposal.sourceDate, "2026-10-16"), "conflict");
  assert.equal(compareActivityDate(undefined, "2026-10-16"), "unknown");
  assert.equal(compareActivityDate({ month: 10, day: 12, year: 2025, evidence: "observed" }, "2026-10-12"), "conflict");
});

test("a conflicting selected date requires explicit confirmation and records it in provenance", () => {
  assert.throws(() => buildAcceptedActivity({ proposal, facts: golf, occurredOn: "2026-10-16", timestamp: "2026-10-17T12:01:00Z", id: "activity-a", idempotencyKey: "accept-activity-a", targets: { calories: 2400, protein: 190, carbs: 240, fat: 80 } }), /activity-date-confirmation-required/);
  const accepted = buildAcceptedActivity({ proposal, facts: golf, occurredOn: "2026-10-16", timestamp: "2026-10-17T12:01:00Z", id: "activity-a", idempotencyKey: "accept-activity-a", dateConflictConfirmed: true, targets: { calories: 2400, protein: 190, carbs: 240, fat: 80 } });
  assert.deepEqual(accepted.corrections.at(-1), { field: "occurredOn", from: proposal.sourceDate, to: "2026-10-16" });
});

test("multiple screenshot activities remain separate and daily strain is not copied into either activity", () => {
  const shared = { proposal, occurredOn: "2026-10-12", timestamp: "2026-10-17T12:01:00Z", idempotencyKey: "accept-activity-a", targets: { calories: 2400, protein: 190, carbs: 240, fat: 80 } };
  const accepted = [
    buildAcceptedActivity({ ...shared, id: "activity-a", facts: golf, originalFacts: golf }),
    buildAcceptedActivity({ ...shared, id: "activity-a-2", facts: soccer, originalFacts: soccer }),
  ];
  const state = acceptActivityProposal(createInitialPersonalState("2026-10-17"), proposal, accepted);
  assert.deepEqual(state.activities.map((activity) => activity.facts.activityType), ["Golf", "Soccer"]);
  assert.deepEqual(state.activities.map((activity) => activity.facts.whoopStrain?.value), [12.9, 5.9]);
  assert.equal(state.activities.some((activity) => activity.facts.whoopStrain?.value === 15.1), false);
  assert.equal(acceptActivityProposal(state, proposal, accepted), state, "the shared source digest remains idempotent");
});

test("an existing activity date correction updates in place and retains an audit fact", () => {
  const accepted = buildAcceptedActivity({ proposal, facts: golf, occurredOn: "2026-10-12", timestamp: "2026-10-17T12:01:00Z", id: "activity-a", idempotencyKey: "accept-activity-a", targets: { calories: 2400, protein: 190, carbs: 240, fat: 80 } });
  const initial = acceptActivityProposal(createInitialPersonalState("2026-10-17"), proposal, [accepted]);
  const corrected = correctActivityDate(initial, accepted.id, "2026-10-11");
  assert.equal(corrected.state.activities.length, 1);
  assert.equal(corrected.activity.occurredOn, "2026-10-11");
  assert.deepEqual(corrected.activity.corrections.at(-1), { field: "occurredOn", from: "2026-10-12", to: "2026-10-11" });
});
