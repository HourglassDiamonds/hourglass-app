import assert from "node:assert/strict";
import test from "node:test";
import { applySterlingProposal, buildSterlingScheduleAdjustment, proposeSterlingAdjustment, retargetSterlingScheduleAdjustment } from "./adaptation";
import { activateTrainingProgram, createInitialPersonalState, shiftDate } from "./program";
import { configureTonalProgram } from "./tonal-programs";

function activeState(today: string) {
  const setup = configureTonalProgram({ state: createInitialPersonalState(today), programId: "fit-over-40", weeklyFrequency: 3, source: { kind: "founder_confirmed", reference: "machine", reviewedAt: `${today}T03:00:00.000Z` }, founderVerifiedAt: `${today}T03:00:00.000Z` });
  return activateTrainingProgram(setup, today, `${today}T04:00:00.000Z`);
}

test("four hours sleep / gassed / ruck today / weights tomorrow is proposed, confirmed, and reflowed", () => {
  const today = "2026-10-05";
  const state = activeState(today);
  const original = state.schedule.find((workout) => workout.date === today)!;
  const proposal = proposeSterlingAdjustment(state, "I got about four hours of sleep and I’m gassed. Skip the weights today. I’m going to ruck. Move the weights to tomorrow.", today);
  assert.ok(proposal);
  assert.equal(state.schedule.find((workout) => workout.id === original.id)?.status, "planned", "proposal must not mutate canonical state");
  const confirmed = applySterlingProposal(state, proposal!);
  const originalOccurrence = confirmed.schedule.find((workout) => workout.id === original.id);
  const moved = confirmed.schedule.find((workout) => workout.replacesWorkoutId === original.id && workout.date === "2026-10-06");
  const replacement = confirmed.schedule.find((workout) => workout.replacesWorkoutId === original.id && workout.date === today);
  assert.equal(originalOccurrence?.status, "deferred");
  assert.equal(moved?.prescription.id, original.prescription.id);
  assert.deepEqual(moved?.prescription.exercises, original.prescription.exercises);
  assert.equal(replacement?.prescription.mode, "ruck");
  assert.equal(replacement?.prescription.intent, "easy");
  assert.deepEqual(confirmed.recoveryEntries[0]?.sleepHours, { value: 4, source: "manual" });
  assert.equal(confirmed.recoveryEntries[0]?.fatigue?.value, "high");
  assert.equal(confirmed.schedule.length, state.schedule.length + 2, "defer history, moved work, and replacement must not erase an occurrence");
  assert.equal(new Set(confirmed.schedule.map((workout) => workout.id)).size, confirmed.schedule.length);
  const activeStrength = confirmed.schedule.filter((workout) => workout.status === "planned" && workout.prescription.domain === "strength").sort((a, b) => a.date.localeCompare(b.date));
  for (let index = 1; index < activeStrength.length; index += 1) assert.notEqual(shiftDate(activeStrength[index - 1]!.date, 1), activeStrength[index]!.date);
});

test("Sterling can propose a recovery-only entry without fabricating WHOOP values", () => {
  const state = activeState("2026-10-05");
  const proposal = proposeSterlingAdjustment(state, "I slept about four hours and feel wrecked. No pain.", "2026-10-05");
  assert.ok(proposal);
  assert.deepEqual(proposal?.recovery?.sleepHours, { value: 4, source: "manual" });
  assert.equal(proposal?.recovery?.hrvMs, undefined);
  assert.equal(proposal?.affectedWorkoutIds.length, 0);
});

test("natural-language schedule intent becomes an editable proposal without mutating the program", () => {
  const today = "2026-10-12";
  const state = activeState(today);
  const source = state.schedule.find((workout) => workout.date === "2026-10-15")!;
  const proposal = buildSterlingScheduleAdjustment({
    state,
    command: "I am golfing Thursday. Move Thursday's planned workout to Friday.",
    workoutId: source.id,
    targetDate: "2026-10-16",
    summary: "Move Thursday's workout to Friday around golf.",
    confidence: "high",
    now: "2026-10-13T12:00:00.000Z",
  });
  assert.ok(proposal);
  assert.equal(state.schedule.find((workout) => workout.id === source.id)?.status, "planned");
  assert.equal(proposal?.sourceWorkoutId, source.id);
  assert.equal(proposal?.targetDate, "2026-10-16");
  assert.deepEqual(
    proposal?.nextSchedule.find((workout) => workout.replacesWorkoutId === source.id && workout.date === "2026-10-16")?.prescription,
    source.prescription,
  );
  const edited = retargetSterlingScheduleAdjustment(state, proposal!, "2026-10-17");
  assert.equal(edited?.targetDate, "2026-10-17");
  assert.equal(edited?.nextSchedule.some((workout) => workout.replacesWorkoutId === source.id && workout.date === "2026-10-17"), true);
  assert.equal(buildSterlingScheduleAdjustment({ state, command: "move", workoutId: "unknown", targetDate: "2026-10-17", summary: "x" }), null);
  assert.equal(buildSterlingScheduleAdjustment({ state, command: "move", workoutId: source.id, targetDate: source.date, summary: "x" }), null);
  assert.equal(state.program.anchorDate, "2026-10-12");
});

test("moving Monday Tonal onto Tuesday explicitly discloses and safely reflows the Tuesday run", () => {
  const state = activeState("2026-10-12");
  const mondayTonal = state.schedule.find((workout) => workout.date === "2026-10-12")!;
  const tuesdayRun = state.schedule.find((workout) => workout.date === "2026-10-13")!;
  const proposal = buildSterlingScheduleAdjustment({
    state,
    command: "I played golf Monday. Move Monday's Tonal session to Tuesday.",
    workoutId: mondayTonal.id,
    targetDate: "2026-10-13",
    summary: "Move Monday's Tonal session to Tuesday after Monday golf.",
    now: "2026-10-13T12:00:00.000Z",
  });

  assert.ok(proposal);
  const displacedTuesdayRun = proposal.displacedWorkouts.find((workout) => workout.workoutId === tuesdayRun.id);
  assert.deepEqual(displacedTuesdayRun, {
    workoutId: tuesdayRun.id,
    name: tuesdayRun.prescription.name,
    fromDate: "2026-10-13",
    toDate: "2026-10-16",
  });
  assert.equal(proposal.nextSchedule.filter((workout) => workout.date === "2026-10-13" && workout.status === "planned").length, 1);
  assert.equal(proposal.nextSchedule.find((workout) => workout.id === tuesdayRun.id)?.date, "2026-10-16");
  assert.equal(new Set(proposal.nextSchedule.map((workout) => workout.id)).size, proposal.nextSchedule.length);
  assert.equal(state.schedule.find((workout) => workout.id === tuesdayRun.id)?.date, "2026-10-13", "proposal must not mutate the reviewed schedule");
});
