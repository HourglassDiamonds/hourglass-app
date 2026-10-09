import assert from "node:assert/strict";
import test from "node:test";
import { createInitialPersonalState, plannedWorkout, programWeek, PROGRAM_RESTART_DATE, shiftDate } from "./program";
import { parsePersonalState, rolloverUnresolved } from "./state";

test("Monday October 12 is the clean Week 1 anchor", () => {
  assert.equal(PROGRAM_RESTART_DATE, "2026-10-12");
  assert.equal(programWeek("2026-10-12"), 1);
  const monday = plannedWorkout("2026-10-12");
  assert.equal(monday.prescription.id, "foundation-a");
  assert.match(monday.prescription.trainingBlock, /Week 1/);
});

test("weekend prep does not create missed sessions or advance progression and Sunday is hard rest", () => {
  const state = createInitialPersonalState("2026-10-10");
  const saturday = state.schedule.find((workout) => workout.originalDate === "2026-10-10")!;
  const sunday = state.schedule.find((workout) => workout.originalDate === "2026-10-11")!;
  assert.match(saturday.prescription.trainingBlock, /Prep/);
  assert.equal(sunday.prescription.id, "prestart-rest");
  const rolled = rolloverUnresolved(state, "2026-10-12", "2026-10-12T05:00:00Z");
  assert.equal(rolled.schedule.find((workout) => workout.id === saturday.id)?.status, "planned");
  assert.equal(rolled.schedule.find((workout) => workout.id === sunday.id)?.status, "planned");
});

test("legacy state keeps history but regenerates the formal program from the anchor", () => {
  const legacy = createInitialPersonalState("2026-10-08") as unknown as Record<string, unknown>;
  legacy.version = 2; delete legacy.program;
  const parsed = parsePersonalState(JSON.stringify(legacy), "2026-10-08");
  assert.equal(parsed.schedule.find((workout) => workout.originalDate === "2026-10-12")?.prescription.id, "foundation-a");
  assert.match(parsed.schedule.find((workout) => workout.originalDate === "2026-10-12")?.prescription.trainingBlock ?? "", /Week 1/);
});

test("Week 11 preserves the continuous 5K objective", () => {
  const week11Friday = shiftDate(PROGRAM_RESTART_DATE, 10 * 7 + 4);
  const objective = plannedWorkout(week11Friday);
  assert.equal(programWeek(week11Friday), 11);
  assert.match(objective.prescription.name, /Continuous 5K/);
});
