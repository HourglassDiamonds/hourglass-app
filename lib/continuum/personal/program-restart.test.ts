import assert from "node:assert/strict";
import test from "node:test";
import { activateTrainingProgram, createInitialPersonalState, isCurrentFitOver40CycleStart, plannedWorkout, previewTrainingWeek, PROGRAM_RESTART_DATE, restartFitOver40Cycle } from "./program";
import { parsePersonalState } from "./state";
import { configureTonalProgram, markTonalSessionCompletedFromActivity, nextTonalSession, planTonalSessionFromScreenshot } from "./tonal-programs";
import { projectWorkoutRollover } from "./workout-rollover";

function configuredState() {
  return configureTonalProgram({
    state: createInitialPersonalState("2026-10-15"), programId: "fit-over-40", weeklyFrequency: 3,
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
  assert.equal(monday.prescription.name, "Fit Over 40 · Session 1 — title confirmation required");
  assert.equal(state.schedule.find((workout) => workout.date === "2026-10-21")?.prescription.id, "tonal-fit-over-40-2");
  assert.equal(state.schedule.find((workout) => workout.date === "2026-10-23")?.prescription.id, "tonal-fit-over-40-3");
  assert.match(monday.prescription.trainingBlock, /Week 1/);
  assert.equal(sunday.prescription.id, "hard-rest");
  assert.equal(state.schedule.length, 28);
  assert.equal(state.tonal.enrollment.sessions.filter((session) => session.scheduledWorkoutId).length, 12);
  assert.deepEqual(
    state.schedule.filter((workout) => workout.prescription.mode === "tonal").map((workout) => [workout.date, workout.prescription.tonalSessionOrder]),
    [
      ["2026-10-19", 1], ["2026-10-21", 2], ["2026-10-23", 3],
      ["2026-10-26", 4], ["2026-10-28", 5], ["2026-10-30", 6],
      ["2026-11-02", 7], ["2026-11-04", 8], ["2026-11-06", 9],
      ["2026-11-09", 10], ["2026-11-11", 11], ["2026-11-13", 12],
    ],
  );
  assert.equal(state.tonal.enrollment.sessions.every((session) => session.title === undefined), true);
});

test("legacy fixed-anchor state enters setup without creating missed sessions", () => {
  const legacy = {
    ...createInitialPersonalState("2026-10-08"),
    program: { anchorDate: PROGRAM_RESTART_DATE, anchorVersion: 1 },
    schedule: [plannedWorkout("2026-10-12")],
  };
  const parsed = parsePersonalState(JSON.stringify(legacy), "2026-10-20");
  assert.equal(parsed.program.status, "setup");
  assert.equal(parsed.schedule.length, 0);
});

test("Week 1 preview has three Tonal slots, two runs, Thursday recovery, and Sunday hard rest", () => {
  const preview = previewTrainingWeek(configuredState().tonal, "2026-10-19");
  assert.deepEqual(preview.filter((workout) => workout.prescription.mode === "tonal").map((workout) => workout.date), ["2026-10-19", "2026-10-21", "2026-10-23"]);
  assert.deepEqual(preview.filter((workout) => workout.prescription.mode === "run").map((workout) => workout.date), ["2026-10-20", "2026-10-24"]);
  assert.match(preview.find((workout) => workout.date === "2026-10-22")!.prescription.name, /Recovery/);
  assert.equal(preview.at(-1)?.prescription.id, "hard-rest");
});

test("founder-confirmed three-session cadence keeps order, recovery, two runs, and Sunday hard rest", () => {
  const setup = configureTonalProgram({ state: createInitialPersonalState("2026-10-17"), programId: "fit-over-40", weeklyFrequency: 3, source: { kind: "founder_confirmed", reference: "Tonal machine", reviewedAt: "2026-10-17T12:00:00Z" }, founderVerifiedAt: "2026-10-17T12:00:00Z" });
  const preview = previewTrainingWeek(setup.tonal, "2026-10-19");
  assert.deepEqual(preview.filter((workout) => workout.prescription.mode === "tonal").map((workout) => workout.date), ["2026-10-19", "2026-10-21", "2026-10-23"]);
  assert.deepEqual(preview.filter((workout) => workout.prescription.mode === "run").map((workout) => workout.date), ["2026-10-20", "2026-10-24"]);
  assert.equal(preview.find((workout) => workout.date === "2026-10-22")?.prescription.id, "restore");
  assert.equal(preview.at(-1)?.prescription.id, "hard-rest");
  assert.deepEqual(preview.filter((workout) => workout.prescription.mode === "tonal").map((workout) => workout.prescription.tonalSessionOrder), [1, 2, 3]);
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

test("a November 2 restart archives the prior enrollment and starts a distinct twelve-session cycle", () => {
  const active = activateTrainingProgram(configuredState(), "2026-10-19", "2026-10-17T12:00:00Z");
  const withBeforeEvidence = planTonalSessionFromScreenshot(active, {
    sequencePosition: 1,
    movements: [{ name: "Goblet Squat to Bench", sets: 3 }, { name: "Single-Arm Row", sets: 3 }],
    source: {
      kind: "tonal_app_screenshot",
      reference: "sha256:old-cycle-before",
      digest: "old-cycle-before",
      file: { name: "before.jpg", type: "image/jpeg", size: 1234, storagePath: "private/old-cycle-before.jpg" },
      reviewedAt: "2026-10-19T12:00:00Z",
    },
    approvedAt: "2026-10-19T12:00:00Z",
  });
  const oldSessionOneId = withBeforeEvidence.tonal.enrollment.sessions[0]!.scheduledWorkoutId!;
  const oldSessionTwoId = withBeforeEvidence.tonal.enrollment.sessions[1]!.scheduledWorkoutId!;
  withBeforeEvidence.schedule = withBeforeEvidence.schedule.map((workout) => workout.id === oldSessionOneId
    ? { ...workout, status: "completed", history: [...workout.history, { at: "2026-10-19T13:00:00Z", action: "completed", actor: "user", note: "Existing historical completion." }] }
    : workout);
  withBeforeEvidence.sessions.push({
    id: "historical-session-one",
    scheduledWorkoutId: oldSessionOneId,
    startedAt: "2026-10-19T12:30:00Z",
    completedAt: "2026-10-19T13:00:00Z",
    sets: [],
  });
  withBeforeEvidence.activities.push({
    id: "historical-activity-one",
    timestamp: "2026-10-19T13:00:00Z",
    occurredOn: "2026-10-19",
    facts: { activityType: "Tonal", durationMinutes: { value: 42, evidence: "user_supplied" } },
    sourceType: "activity_screenshot",
    source: { name: "historical-after.jpg", type: "image/jpeg", size: 2345, storagePath: "private/old-cycle-after.jpg" },
    assumptions: [],
    corrections: [],
    guidance: "Founder-approved historical completion evidence.",
    idempotencyKey: "historical-activity-one",
    provenance: ["user_confirmed"],
  });
  const unfinishedOldProgramIds = new Set(withBeforeEvidence.schedule
    .filter((workout) => workout.provenance.includes("program") && ["planned", "unresolved", "in_progress"].includes(workout.status))
    .map((workout) => workout.id));

  const restarted = restartFitOver40Cycle(withBeforeEvidence, "2026-11-02", "2026-10-30T12:00:00Z");
  assert.equal(restarted.program.anchorDate, "2026-11-02");
  assert.equal(restarted.tonal.enrollment.startedOn, "2026-11-02");
  assert.equal(restarted.tonal.enrollment.sessions.length, 12);
  assert.deepEqual(restarted.tonal.enrollment.sessions.map((session) => session.order), Array.from({ length: 12 }, (_, index) => index + 1));
  assert.equal(nextTonalSession(restarted)?.order, 1);
  assert.equal(restarted.tonal.enrollment.sessions[0]?.movements.length, 0);
  assert.equal(restarted.tonal.enrollment.sessions[0]?.plannedSource, undefined);
  assert.match(restarted.tonal.enrollment.sessions[0]!.scheduledWorkoutId!, /^program-fit-over-40-2026-11-02-/);
  assert.equal(restarted.tonal.historicalEnrollments.length, 1);
  assert.equal(restarted.tonal.historicalEnrollments[0]?.status, "paused");
  assert.equal(restarted.tonal.historicalEnrollments[0]?.sessions[0]?.plannedSource?.file?.storagePath, "private/old-cycle-before.jpg");
  assert.equal(restarted.schedule.find((workout) => workout.id === oldSessionOneId)?.status, "completed");
  assert.equal(restarted.schedule.find((workout) => workout.id === oldSessionTwoId)?.status, "replaced");
  assert.equal([...unfinishedOldProgramIds].every((id) => restarted.schedule.find((workout) => workout.id === id)?.status === "replaced"), true);
  assert.match(restarted.schedule.find((workout) => workout.id === oldSessionTwoId)?.history.at(-1)?.note ?? "", /distinct Fit Over 40 cycle/);
  assert.equal(restarted.schedule.filter((workout) => workout.id.startsWith("program-fit-over-40-2026-11-02-")).length, 28);
  assert.equal(restarted.schedule.filter((workout) => workout.id.startsWith("program-fit-over-40-2026-11-02-") && workout.prescription.id === "hard-rest" && workout.status === "planned").length, 4);
  assert.equal(restarted.sessions.find((session) => session.id === "historical-session-one")?.completedAt, "2026-10-19T13:00:00Z");
  assert.equal(restarted.activities.find((activity) => activity.id === "historical-activity-one")?.source?.storagePath, "private/old-cycle-after.jpg");

  const restored = parsePersonalState(JSON.stringify(restarted), "2026-11-02");
  assert.equal(restored.tonal.historicalEnrollments[0]?.sessions[0]?.plannedSource?.digest, "old-cycle-before");
  assert.equal(restored.tonal.enrollment.sessions[0]?.scheduledWorkoutId, restarted.tonal.enrollment.sessions[0]?.scheduledWorkoutId);
  assert.equal(restored.activities.find((activity) => activity.id === "historical-activity-one")?.source?.storagePath, "private/old-cycle-after.jpg");
  assert.equal(restored.sessions.find((session) => session.id === "historical-session-one")?.completedAt, "2026-10-19T13:00:00Z");
});

test("the active November 2 cycle is identified as current rather than offered as a restart", () => {
  const active = activateTrainingProgram(configuredState(), "2026-11-02", "2026-10-29T15:21:06.727Z");
  assert.equal(isCurrentFitOver40CycleStart(active, "2026-11-02"), true);
  assert.equal(isCurrentFitOver40CycleStart(active, "2026-11-09"), false);
  assert.throws(() => restartFitOver40Cycle(active, "2026-11-02", "2026-10-30T12:00:00Z"), /performance-cycle-restart-date-invalid/);
});

test("the restarted Session 1 accepts titleless before evidence, completes once, and makes Session 2 next", () => {
  const restarted = restartFitOver40Cycle(
    activateTrainingProgram(configuredState(), "2026-10-19", "2026-10-17T12:00:00Z"),
    "2026-11-02",
    "2026-10-30T12:00:00Z",
  );
  const movements = [{ name: "Goblet Squat to Bench", sets: 3 }, { name: "Single-Arm Row", sets: 3 }];
  const planned = planTonalSessionFromScreenshot(restarted, {
    sequencePosition: 1,
    movements,
    source: { kind: "tonal_app_screenshot", reference: "sha256:new-session-one", digest: "new-session-one", file: { name: "before.jpg", type: "image/jpeg", size: 1234 }, reviewedAt: "2026-11-02T12:00:00Z" },
    approvedAt: "2026-11-02T12:00:00Z",
  });
  assert.equal(planned.tonal.enrollment.sessions[0]?.title, undefined);
  assert.equal(planned.tonal.enrollment.sessions[0]?.plannedSource?.digest, "new-session-one");
  const completed = markTonalSessionCompletedFromActivity(planned, {
    sequencePosition: 1,
    programTitle: "Fit Over 40",
    movements,
    activityId: "activity-new-session-one",
    at: "2026-11-02T13:00:00Z",
  });
  assert.equal(completed.tonal.enrollment.sessions[0]?.completedActivityId, "activity-new-session-one");
  assert.equal(nextTonalSession(completed)?.order, 2);
  const duplicate = markTonalSessionCompletedFromActivity(completed, {
    sequencePosition: 1,
    programTitle: "Fit Over 40",
    movements,
    activityId: "activity-new-session-one",
    at: "2026-11-02T13:01:00Z",
  });
  assert.deepEqual(duplicate, completed);
});

test("a missed restarted workout projects forward without canonical writes or Sunday catch-up", () => {
  const restarted = restartFitOver40Cycle(
    activateTrainingProgram(configuredState(), "2026-10-19", "2026-10-17T12:00:00Z"),
    "2026-11-02",
    "2026-10-30T12:00:00Z",
  );
  const canonical = JSON.stringify(restarted);
  const rollover = projectWorkoutRollover(restarted, "2026-11-05");
  assert.equal(rollover.nextSession?.order, 1);
  assert.equal(rollover.nextProjectedDate, "2026-11-06");
  assert.equal(rollover.schedule.some((workout) => workout.projection && workout.date === "2026-11-08" && workout.prescription.mode === "tonal"), false);
  assert.equal(JSON.stringify(restarted), canonical);
});
