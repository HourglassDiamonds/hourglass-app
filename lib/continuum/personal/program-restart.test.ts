import assert from "node:assert/strict";
import test from "node:test";
import { activateTrainingProgram, createInitialPersonalState, plannedWorkout, previewTrainingWeek, PROGRAM_RESTART_DATE } from "./program";
import { parsePersonalState, rolloverUnresolved } from "./state";
import { configureTonalProgram } from "./tonal-programs";

const TITLES = Array.from({ length: 8 }, (_, index) => `Verified Tonal Workout ${index + 1}`);
function configuredState() {
  return configureTonalProgram({
    state: createInitialPersonalState("2026-10-15"), programId: "fit-over-40", sessionTitles: TITLES,
    source: { kind: "founder_confirmed", reference: "Tonal machine program overview", reviewedAt: "2026-10-17T12:00:00Z" },
    founderVerifiedAt: "2026-10-17T12:00:00Z",
  });
}

test("the old October 12 anchor is historical configuration, not an active program", () => {
  assert.equal(PROGRAM_RESTART_DATE, "2026-10-12");
  const state = createInitialPersonalState("2026-10-15");
  assert.equal(state.program.status, "setup");
  assert.equal(state.program.anchorDate, undefined);
  assert.equal(state.program.legacyAnchorDate, "2026-10-12");
  assert.deepEqual(state.schedule, []);
});

test("explicit activation generates Week 1 from the selected Monday with Sunday rest", () => {
  const state = activateTrainingProgram(configuredState(), "2026-10-19", "2026-10-17T12:00:00Z");
  assert.equal(state.program.status, "active");
  assert.equal(state.program.anchorDate, "2026-10-19");
  const monday = state.schedule.find((workout) => workout.date === "2026-10-19")!;
  const sunday = state.schedule.find((workout) => workout.date === "2026-10-25")!;
  assert.equal(monday.prescription.id, "tonal-fit-over-40-1");
  assert.equal(monday.prescription.name, "Fit Over 40 · Verified Tonal Workout 1");
  assert.equal(state.schedule.find((workout) => workout.date === "2026-10-22")?.prescription.id, "tonal-fit-over-40-2");
  assert.match(monday.prescription.trainingBlock, /Week 1/);
  assert.equal(sunday.prescription.id, "hard-rest");
  assert.equal(state.schedule.length, 28);
  assert.equal(state.tonal.enrollment.sessions.filter((session) => session.scheduledWorkoutId).length, 8);
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

test("Week 1 preview has two Tonal slots, two runs, optional conditioning, and Sunday hard rest", () => {
  const preview = previewTrainingWeek(configuredState().tonal, "2026-10-19");
  assert.deepEqual(preview.filter((workout) => workout.prescription.mode === "tonal").map((workout) => workout.date), ["2026-10-19", "2026-10-22"]);
  assert.deepEqual(preview.filter((workout) => workout.prescription.mode === "run").map((workout) => workout.date), ["2026-10-20", "2026-10-24"]);
  assert.match(preview.find((workout) => workout.date === "2026-10-23")!.prescription.name, /Optional light conditioning/);
  assert.equal(preview.at(-1)?.prescription.id, "hard-rest");
});

test("activation rejects a start date that would move Sunday rest", () => {
  assert.throws(() => activateTrainingProgram(createInitialPersonalState(), "2026-10-20"), /start-must-be-monday/);
  assert.throws(() => activateTrainingProgram(createInitialPersonalState(), "2026-10-19"), /tonal-session-sequence-required/);
  const active = activateTrainingProgram(configuredState(), "2026-10-19", "2026-10-17T12:00:00Z");
  assert.throws(() => activateTrainingProgram(active, "2026-10-26"), /already-active/);
});

test("setup activity history survives activation without advancing or duplicating training", () => {
  const setup = configuredState();
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
