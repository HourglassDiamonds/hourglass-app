import assert from "node:assert/strict";
import test from "node:test";
import { createInitialPersonalState, isRestDayWorkout, isSunday } from "./program";
import { enforceSundayRest, migrateLegacyPersonalState, parsePersonalState, rolloverUnresolved } from "./state";

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

test("existing founder v2 state reconciles a skipped strength day and completed ruck exactly once", () => {
  const prior = createInitialPersonalState("2026-10-05");
  const strength = prior.schedule.find((workout) => workout.date === "2026-10-05")!;
  const easyRun = prior.schedule.find((workout) => workout.date === "2026-10-06")!;
  strength.status = "skipped";
  strength.history.push({
    at: "2026-10-05T23:00:00.000Z",
    action: "skipped",
    actor: "user",
    note: "Skipped in the existing founder browser state.",
  });
  delete (prior as unknown as { appliedReconciliations?: string[] }).appliedReconciliations;

  const parsed = parsePersonalState(JSON.stringify(prior), "2026-10-06");
  const restored = parsed.schedule.find(
    (workout) => workout.date === "2026-10-06" && workout.replacesWorkoutId === strength.id,
  );
  const ruck = parsed.schedule.find(
    (workout) =>
      workout.date === "2026-10-05" &&
      workout.replacesWorkoutId === strength.id &&
      workout.prescription.mode === "ruck",
  );
  assert.deepEqual(restored?.prescription, strength.prescription);
  assert.equal(ruck?.status, "completed");
  assert.notEqual(parsed.schedule.find((workout) => workout.id === easyRun.id)?.date, "2026-10-06");
  assert.equal(parsed.schedule.find((workout) => workout.id === strength.id)?.status, "deferred");
  assert.equal(parsed.appliedReconciliations.length, 1);

  const refreshed = parsePersonalState(JSON.stringify(parsed), "2026-10-06");
  assert.equal(
    refreshed.schedule.filter(
      (workout) => workout.date === "2026-10-06" && workout.replacesWorkoutId === strength.id,
    ).length,
    1,
  );
  assert.equal(
    refreshed.schedule.filter(
      (workout) => workout.date === "2026-10-05" && workout.prescription.mode === "ruck",
    ).length,
    1,
  );
  assert.equal(refreshed.appliedReconciliations.length, 1);
  assert.doesNotMatch(JSON.stringify(refreshed), /failed/i);
});

test("Sunday rollover carries unresolved Saturday work to Monday", () => {
  const prior = createInitialPersonalState("2026-10-10");
  const saturday = prior.schedule.find((workout) => workout.date === "2026-10-10")!;
  const parsed = parsePersonalState(JSON.stringify(prior), "2026-10-11");
  const restored = parsed.schedule.find(
    (workout) => workout.replacesWorkoutId === saturday.id && workout.status === "planned",
  );
  assert.equal(restored?.date, "2026-10-12");
  assert.ok(parsed.schedule.some((workout) => workout.date === "2026-10-11" && isRestDayWorkout(workout)));
  assert.equal(
    parsed.schedule.some(
      (workout) => isSunday(workout.date) && !isRestDayWorkout(workout) && workout.status === "planned",
    ),
    false,
  );
});

test("saved automatic Sunday training is replaced or moved without erasing completed history", () => {
  const state = createInitialPersonalState("2026-10-10");
  const sundayRest = state.schedule.find((workout) => workout.date === "2026-10-11")!;
  const oldProgramSunday = structuredClone(state.schedule.find((workout) => workout.date === "2026-10-12")!);
  oldProgramSunday.id = "program-2026-10-11-old-sunday-strength";
  oldProgramSunday.date = "2026-10-11";
  oldProgramSunday.originalDate = "2026-10-11";
  oldProgramSunday.history = [{
    at: "2026-10-11T05:00:00.000Z",
    action: "planned",
    actor: "program",
    note: "Old Sunday program prescription.",
  }];
  const completedSunday = { ...structuredClone(oldProgramSunday), id: "completed-sunday", status: "completed" as const };
  const reconciled = enforceSundayRest(
    [...state.schedule.filter((workout) => workout.id !== sundayRest.id), oldProgramSunday, completedSunday],
    "2026-10-11T12:00:00.000Z",
  );
  assert.ok(reconciled.some((workout) => workout.date === "2026-10-11" && isRestDayWorkout(workout)));
  assert.equal(reconciled.some((workout) => workout.id === oldProgramSunday.id), false);
  assert.ok(reconciled.some((workout) => workout.id === completedSunday.id && workout.status === "completed"));
});

test("an explicitly chosen Sunday recovery walk remains allowed", () => {
  const state = createInitialPersonalState("2026-10-11");
  const rest = state.schedule.find((workout) => workout.date === "2026-10-11")!;
  const walk = {
    ...structuredClone(rest),
    id: "user-sunday-walk",
    prescription: {
      ...rest.prescription,
      id: "user-light-walk",
      name: "Light walk",
      durationMinutes: 20,
    },
    provenance: ["user" as const, "user_confirmed" as const],
  };
  const reconciled = enforceSundayRest([...state.schedule, walk]);
  assert.ok(reconciled.some((workout) => workout.id === walk.id && workout.date === "2026-10-11"));
});
