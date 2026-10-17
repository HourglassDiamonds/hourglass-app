import assert from "node:assert/strict";
import test from "node:test";
import { activateTrainingProgram, createInitialPersonalState } from "./program";
import { migrateLegacyPersonalState, parsePersonalState, rolloverUnresolved } from "./state";
import { configureTonalProgram } from "./tonal-programs";

function configuredState(today: string) {
  return configureTonalProgram({ state: createInitialPersonalState(today), programId: "fit-over-40", weeklyFrequency: 2, source: { kind: "founder_confirmed", reference: "machine", reviewedAt: `${today}T10:00:00Z` }, founderVerifiedAt: `${today}T10:00:00Z` });
}

test("an untouched workout remains planned / unresolved after midnight", () => {
  const state = activateTrainingProgram(configuredState("2026-10-12"), "2026-10-12", "2026-10-11T12:00:00Z");
  const rolled = rolloverUnresolved(state, "2026-10-13", "2026-10-13T04:01:00.000Z");
  const prior = rolled.schedule.find((workout) => workout.date === "2026-10-12");
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
  assert.equal(parsed.schedule.length, 0);
  assert.equal(parsed.program.status, "setup");
});

test("a completed Tonal block remains completed after canonical reload", () => {
  const active = activateTrainingProgram(configuredState("2026-10-17"), "2026-10-19", "2026-10-17T12:01:00.000Z");
  const completed = {
    ...active,
    tonal: { ...active.tonal, enrollment: { ...active.tonal.enrollment, status: "completed" as const, completedAt: "2026-11-15T12:00:00.000Z" } },
  };
  const parsed = parsePersonalState(JSON.stringify(completed), "2026-11-16");
  assert.equal(parsed.program.status, "active");
  assert.equal(parsed.tonal.enrollment.status, "completed");
  assert.equal(parsed.tonal.enrollment.completedAt, "2026-11-15T12:00:00.000Z");
});
