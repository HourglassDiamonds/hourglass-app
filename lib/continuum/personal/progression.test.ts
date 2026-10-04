import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { proposeProgression } from "./progression";
import type { ExercisePrescription, PerformedSet } from "./types";
const exercise: ExercisePrescription = { id: "press", name: "Press", kind: "loaded", equipment: "Tonal", sets: 3, targetReps: [8, 10], targetLoad: 30, loadUnit: "lb", notes: "" };
const sets = (reps: number[], patch: Partial<PerformedSet> = {}): PerformedSet[] => reps.map((value, index) => ({ id: String(index), exerciseId: exercise.id, setNumber: index + 1, load: 30, reps: value, rir: 2, completed: true, skipped: false, pain: false, ...patch }));
describe("personal progression", () => {
  it("proposes a small load increase after all top-range sets", () => { const result = proposeProgression({ exercise, sets: sets([10, 10, 10]) }); assert.equal(result.action, "increase"); assert.equal(result.proposedLoad, 35); });
  it("does not count a scheduled skip as failure", () => { const result = proposeProgression({ exercise, sets: sets([0, 0, 0], { completed: false, skipped: true }), recentMisses: 3 }); assert.equal(result.action, "hold"); assert.match(result.reason, /not counted/); });
  it("treats pain as a stop and regression signal", () => { const result = proposeProgression({ exercise, sets: sets([8], { pain: true }) }); assert.equal(result.action, "regress"); assert.match(result.reason, /Pain/); });
  it("reduces only after a repeated miss", () => { assert.equal(proposeProgression({ exercise, sets: sets([6, 6]), recentMisses: 0 }).action, "hold"); assert.equal(proposeProgression({ exercise, sets: sets([6, 6]), recentMisses: 1 }).action, "reduce"); });
  it("advances 5 / 10 / 15 through persisted round stages", () => {
    const staged: ExercisePrescription = { ...exercise, targetLoad: undefined, sets: 3, targetReps: [5, 5], progressionMode: "amrap-rounds", progressionStage: 1 };
    const result = proposeProgression({ exercise: staged, sets: sets([5, 5, 5]).map((set) => ({ ...set, exerciseId: staged.id })) });
    assert.equal(result.action, "increase");
    assert.equal(result.proposedSets, 4);
    assert.equal(result.proposedStage, 2);
  });
});
