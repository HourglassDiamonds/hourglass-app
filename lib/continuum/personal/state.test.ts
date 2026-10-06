import assert from "node:assert/strict";
import test from "node:test";
import { createInitialPersonalState } from "./program";
import { migrateLegacyPersonalState, parsePersonalState, rolloverUnresolved } from "./state";

test("an untouched workout remains planned / unresolved after midnight", () => {
  const state = createInitialPersonalState("2026-10-05");
  const rolled = rolloverUnresolved(state, "2026-10-06", "2026-10-06T04:01:00.000Z");
  const prior = rolled.schedule.find((workout) => workout.date === "2026-10-05");
  assert.equal(prior?.status, "unresolved");
  assert.equal(prior?.history.at(-1)?.action, "rolled_unresolved");
  assert.doesNotMatch(JSON.stringify(prior), /failed/i);
});

test("migrates the approved Personal RC browser logs into the canonical v2 model", () => {
  const migrated = migrateLegacyPersonalState(JSON.stringify({
    version: 1,
    nutritionTargets: { calories: 2400, protein: 190, carbs: 220, fat: 75 },
    foodEntries: [{ id: "meal-1", timestamp: "2026-10-05T12:00:00.000Z", meal: "lunch", description: "Chicken and rice", calories: 700, protein: 55, carbs: 70, fat: 20 }],
    bodyMeasurements: [{ id: "weight-1", timestamp: "2026-10-05T07:00:00.000Z", weight: 217 }],
    sessions: [],
  }), "2026-10-05");
  assert.ok(migrated);
  assert.equal(migrated?.meals[0]?.items[0]?.name, "Chicken and rice");
  assert.equal(migrated?.recoveryEntries[0]?.bodyweightLb?.value, 217);
  assert.equal(migrated?.nutritionTargets.protein, 190);
  assert.deepEqual(migrated?.frequentMeals, []);
});

test("existing v2 browser state migrates forward with an empty frequent-meal collection", () => {
  const prior = createInitialPersonalState("2026-10-05") as unknown as Record<string, unknown>;
  delete prior.frequentMeals;
  const parsed = parsePersonalState(JSON.stringify(prior), "2026-10-05");
  assert.deepEqual(parsed.frequentMeals, []);
  assert.equal(parsed.schedule.length, 14);
});

test("refresh carries yesterday's unresolved workout into today and durably reflows today's plan", () => {
  const prior = createInitialPersonalState("2026-10-05");
  const yesterday = prior.schedule.find((workout) => workout.date === "2026-10-05")!;
  const todayPlan = prior.schedule.find((workout) => workout.date === "2026-10-06")!;
  const parsed = parsePersonalState(JSON.stringify(prior), "2026-10-06");
  const moved = parsed.schedule.find((workout) => workout.date === "2026-10-06" && workout.replacesWorkoutId === yesterday.id);
  assert.deepEqual(moved?.prescription, yesterday.prescription);
  assert.notEqual(parsed.schedule.find((workout) => workout.id === todayPlan.id)?.date, "2026-10-06");
  assert.equal(parsed.schedule.find((workout) => workout.id === yesterday.id)?.status, "deferred");
  const refreshed = parsePersonalState(JSON.stringify(parsed), "2026-10-06");
  assert.equal(refreshed.schedule.filter((workout) => workout.date === "2026-10-06" && workout.replacesWorkoutId === yesterday.id).length, 1);
  assert.doesNotMatch(JSON.stringify(refreshed), /failed/i);
});
