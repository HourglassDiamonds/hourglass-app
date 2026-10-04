import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createInitialPersonalState, planForDate } from "./program";

describe("personal weekly program", () => {
  const state = createInitialPersonalState();

  it("prescribes Tonal-first strength on Monday", () => {
    const monday = planForDate(state.plans, new Date(2026, 9, 5));
    assert.equal(monday.id, "foundation-tonal-a");
    assert.equal(monday.mode, "tonal");
    assert.ok(monday.exercises.every((exercise) => exercise.previous === undefined));
  });

  it("keeps the heavy ruck out and provides a real indoor substitution", () => {
    const saturday = planForDate(state.plans, new Date(2026, 9, 10));
    assert.match(saturday.name, /20 lb ruck/);
    assert.doesNotMatch(JSON.stringify(saturday.exercises), /100 lb/);
    assert.equal(saturday.swap?.mode, "peloton");
    assert.deepEqual(saturday.swap?.exercises.map((exercise) => exercise.id), ["peloton-aerobic-base"]);
  });

  it("stages the Sunday 5 / 10 / 15 practice", () => {
    const sunday = planForDate(state.plans, new Date(2026, 9, 11));
    assert.deepEqual(sunday.exercises.map((exercise) => exercise.targetReps), [[5, 5], [10, 10], [15, 15]]);
    assert.match(sunday.notes, /Stage 1/);
    assert.ok(sunday.exercises.every((exercise) => exercise.progressionMode === "amrap-rounds" && exercise.progressionStage === 1 && exercise.regression && exercise.progressionCriterion));
  });
});
