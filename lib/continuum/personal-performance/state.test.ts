import assert from "node:assert/strict";
import test from "node:test";
import {
  createInitialPerformanceState,
  parsePerformanceState,
  rollingWeightAverage,
} from "./state";

test("starts without fictional measurements, adherence, or meals", () => {
  const state = createInitialPerformanceState();
  assert.deepEqual(state.weights, []);
  assert.deepEqual(state.days, {});
  assert.deepEqual(state.meals, {});
  assert.deepEqual(state.parameters, { dailyCalories: 2400, dailyProteinG: 190 });
});

test("rejects incompatible versions and safely sanitizes malformed nested data", () => {
  assert.equal(parsePerformanceState({ version: 99 }), null);
  const state = parsePerformanceState({
    version: 2,
    weights: [
      { date: "2026-09-28", weight: 217 },
      { date: "bad", weight: "heavy" },
      { date: "2026-10-05", weight: 217, waist: 42 },
    ],
    days: {
      "2026-09-30": { status: "completed" },
      "2026-10-05": { status: "invented", readiness: "sore", exerciseNotes: null },
      "2026-10-06": { status: "completed", exerciseNotes: { row: "clean" } },
    },
    meals: {
      "2026-10-05": [null, { name: "Breakfast", calories: 600, protein: 55 }],
      "2026-10-06": "not-an-array",
    },
    parameters: { dailyCalories: "low", dailyProteinG: 190 },
  });
  assert.ok(state);
  assert.deepEqual(state.weights, [{ date: "2026-10-05", weight: 217, waist: 42 }]);
  assert.deepEqual(state.days["2026-10-05"], { readiness: "sore" });
  assert.deepEqual(state.days["2026-10-06"], {
    status: "completed",
    exerciseNotes: { row: "clean" },
  });
  assert.equal(state.days["2026-09-30"], undefined);
  assert.equal(state.meals["2026-10-05"].length, 1);
  assert.deepEqual(state.parameters, { dailyCalories: 2400, dailyProteinG: 190 });
});

test("migrates valid V1 completion records without inventing failures", () => {
  const state = parsePerformanceState({
    version: 1,
    weights: [],
    days: {
      "2026-10-05": { complete: true },
      "2026-10-06": { complete: false },
    },
    meals: {},
  });
  assert.ok(state);
  assert.equal(state.days["2026-10-05"].status, "completed");
  assert.equal(state.days["2026-10-06"], undefined);
});

test("uses a rolling average so one measurement is not presented as a trend", () => {
  assert.equal(rollingWeightAverage([]), null);
  assert.equal(rollingWeightAverage([{ date: "2026-10-05", weight: 217 }]), 217);
  assert.equal(rollingWeightAverage([
    { date: "2026-10-05", weight: 217 },
    { date: "2026-10-06", weight: 219 },
    { date: "2026-10-07", weight: 216 },
  ]), 217 + 1 / 3);
});
