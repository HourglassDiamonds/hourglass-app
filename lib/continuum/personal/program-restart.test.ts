import assert from "node:assert/strict";
import test from "node:test";
import { activateTrainingProgram, createInitialPersonalState, plannedWorkout, programWeek, PROGRAM_RESTART_DATE, shiftDate } from "./program";
import { parsePersonalState, rolloverUnresolved } from "./state";

test("the old October 12 anchor is historical configuration, not an active program", () => {
  assert.equal(PROGRAM_RESTART_DATE, "2026-10-12");
  const state = createInitialPersonalState("2026-10-15");
  assert.equal(state.program.status, "setup");
  assert.equal(state.program.anchorDate, undefined);
  assert.equal(state.program.legacyAnchorDate, "2026-10-12");
  assert.deepEqual(state.schedule, []);
});

test("explicit activation generates Week 1 from the selected Monday with Sunday rest", () => {
  const state = activateTrainingProgram(createInitialPersonalState("2026-10-15"), "2026-10-19", "2026-10-15T12:00:00Z");
  assert.equal(state.program.status, "active");
  assert.equal(state.program.anchorDate, "2026-10-19");
  const monday = state.schedule.find((workout) => workout.date === "2026-10-19")!;
  const sunday = state.schedule.find((workout) => workout.date === "2026-10-25")!;
  assert.equal(monday.prescription.id, "foundation-a");
  assert.match(monday.prescription.trainingBlock, /Week 1/);
  assert.equal(sunday.prescription.id, "hard-rest");
  assert.equal(state.schedule.length, 84);
});

test("legacy fixed-anchor state enters setup without creating missed sessions", () => {
  const legacy = {
    ...createInitialPersonalState("2026-10-08"),
    program: { anchorDate: PROGRAM_RESTART_DATE, anchorVersion: 1 },
    schedule: [plannedWorkout("2026-10-12")],
  };
  const parsed = parsePersonalState(JSON.stringify(legacy), "2026-10-20");
  const rolled = rolloverUnresolved(parsed, "2026-10-21", "2026-10-21T05:00:00Z");
  assert.equal(parsed.program.status, "setup");
  assert.equal(parsed.schedule.length, 0);
  assert.deepEqual(rolled, parsed);
});

test("Week 11 objective is recalculated from the founder-selected start", () => {
  const anchor = "2026-11-02";
  const week11Friday = shiftDate(anchor, 10 * 7 + 4);
  const objective = plannedWorkout(week11Friday, anchor);
  assert.equal(programWeek(week11Friday, anchor), 11);
  assert.match(objective.prescription.name, /Continuous 5K/);
});

test("activation rejects a start date that would move Sunday rest", () => {
  assert.throws(() => activateTrainingProgram(createInitialPersonalState(), "2026-10-20"), /start-must-be-monday/);
  const active = activateTrainingProgram(createInitialPersonalState(), "2026-10-19", "2026-10-15T12:00:00Z");
  assert.throws(() => activateTrainingProgram(active, "2026-10-26"), /already-active/);
});

test("setup activity history survives activation without advancing or duplicating training", () => {
  const setup = createInitialPersonalState("2026-10-15");
  setup.activities.push({
    id: "activity-history", timestamp: "2026-10-15T12:00:00Z", occurredOn: "2026-10-14",
    facts: { activityType: "Golf", durationMinutes: { value: 90, evidence: "user_supplied" } },
    sourceType: "activity_screenshot", assumptions: [], corrections: [], guidance: "Historical activity only.",
    idempotencyKey: "activity-history", provenance: ["user_confirmed"],
  });
  const activated = activateTrainingProgram(setup, "2026-10-19", "2026-10-15T13:00:00Z");
  assert.equal(activated.activities.length, 1);
  assert.equal(activated.activities[0]?.occurredOn, "2026-10-14");
  assert.equal(activated.schedule.filter((workout) => workout.date < "2026-10-19").length, 0);
  assert.equal(activated.schedule.filter((workout) => workout.date === "2026-10-19").length, 1);
});
