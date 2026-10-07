import assert from "node:assert/strict";
import test from "node:test";
import { createInitialPersonalState, isRestDayWorkout, isSunday, nextTrainingDate, plannedWorkout } from "./program";

test("Sunday is always generated as REST DAY", () => {
  const sunday = plannedWorkout("2026-10-11");
  assert.equal(isSunday(sunday.date), true);
  assert.equal(isRestDayWorkout(sunday), true);
  assert.equal(sunday.prescription.name, "REST DAY");
  assert.equal(sunday.prescription.domain, "recovery");
  assert.equal(sunday.prescription.mode, "recovery");
  assert.equal(sunday.prescription.durationMinutes, 0);
  assert.equal(nextTrainingDate("2026-10-11"), "2026-10-12");
});

test("historical and forward program generation contain no Sunday training prescription", () => {
  const state = createInitialPersonalState("2026-10-04");
  const sundays = state.schedule.filter((workout) => isSunday(workout.date));
  assert.equal(sundays.length, 2);
  assert.ok(sundays.every(isRestDayWorkout));
  assert.ok(
    state.schedule.every(
      (workout) => !isSunday(workout.date) || workout.prescription.domain === "recovery",
    ),
  );
});
