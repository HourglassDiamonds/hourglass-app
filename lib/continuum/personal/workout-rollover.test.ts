import assert from "node:assert/strict";
import test from "node:test";
import { activateTrainingProgram, createInitialPersonalState } from "./program";
import { configureTonalProgram, nextTonalSession } from "./tonal-programs";
import type { PersonalState } from "./types";
import { projectWorkoutRollover } from "./workout-rollover";

function activeState(): PersonalState {
  const configured = configureTonalProgram({
    state: createInitialPersonalState("2026-10-19"),
    programId: "fit-over-40",
    weeklyFrequency: 3,
    source: { kind: "founder_confirmed", reference: "Tonal", reviewedAt: "2026-10-18T20:00:00.000Z" },
    founderVerifiedAt: "2026-10-18T20:00:00.000Z",
  });
  return activateTrainingProgram(configured, "2026-10-19", "2026-10-18T20:05:00.000Z");
}

function withSessionStatus(state: PersonalState, order: number, status: "completed" | "deferred" | "skipped") {
  const session = state.tonal.enrollment.sessions.find((candidate) => candidate.order === order)!;
  return { ...state, schedule: state.schedule.map((workout) => workout.id === session.scheduledWorkoutId ? { ...workout, status } : workout) };
}

test("one missed workout remains next and projects to the next strength day without mutation", () => {
  const state = withSessionStatus(activeState(), 1, "completed");
  const before = JSON.stringify(state);
  const plan = projectWorkoutRollover(state, "2026-10-22");
  assert.equal(plan.nextSession?.order, 2);
  assert.equal(plan.nextProjectedDate, "2026-10-23");
  assert.equal(plan.schedule.find((workout) => workout.prescription.tonalSessionOrder === 2)?.projection?.canonicalDate, "2026-10-21");
  assert.equal(JSON.stringify(state), before);
});

test("multiple missed sessions shift in sequence and extend the cadence without using rest days", () => {
  const state = withSessionStatus(activeState(), 1, "completed");
  const plan = projectWorkoutRollover(state, "2026-10-29");
  const dates = plan.schedule.filter((workout) => workout.prescription.mode === "tonal" && workout.status !== "completed").map((workout) => workout.date);
  assert.deepEqual(dates.slice(0, 5), ["2026-10-30", "2026-11-02", "2026-11-04", "2026-11-06", "2026-11-09"]);
  assert.equal(dates.every((date) => [0, 2, 4].includes(new Date(`${date}T12:00:00Z`).getUTCDay() === 0 ? 6 : new Date(`${date}T12:00:00Z`).getUTCDay() - 1)), true);
  assert.equal(new Set(plan.schedule.map((workout) => workout.id)).size, plan.schedule.length);
});

test("continue in succession keeps one session per protected strength day", () => {
  let state = withSessionStatus(activeState(), 1, "completed");
  state = { ...state, workoutRolloverChoice: { mode: "succession", primarySessionOrder: 2, targetDate: "2026-10-30", reviewedAt: "2026-10-29T12:00:00Z" } };
  const plan = projectWorkoutRollover(state, "2026-10-29");
  const firstTwo = plan.schedule.filter((workout) => [2, 3].includes(workout.prescription.tonalSessionOrder ?? 0)).map((workout) => workout.date);
  assert.deepEqual(firstTwo, ["2026-10-30", "2026-11-02"]);
  assert.equal(plan.doubleUpActive, false);
});

test("double up is explicit, binds only the next two sessions, and completes neither", () => {
  let state = withSessionStatus(activeState(), 1, "completed");
  state = { ...state, workoutRolloverChoice: { mode: "double_up", primarySessionOrder: 2, secondarySessionOrder: 3, targetDate: "2026-10-30", reviewedAt: "2026-10-29T12:00:00Z" } };
  const plan = projectWorkoutRollover(state, "2026-10-29");
  const firstTwo = plan.schedule.filter((workout) => [2, 3].includes(workout.prescription.tonalSessionOrder ?? 0));
  assert.deepEqual(firstTwo.map((workout) => workout.date), ["2026-10-30", "2026-10-30"]);
  assert.equal(firstTwo.every((workout) => workout.status !== "completed"), true);
  assert.equal(plan.doubleUpActive, true);
});

test("completed and explicitly skipped sessions retain canonical history while deferred remains next", () => {
  let state = withSessionStatus(activeState(), 1, "completed");
  state = withSessionStatus(state, 2, "skipped");
  state = withSessionStatus(state, 3, "deferred");
  assert.equal(nextTonalSession(state)?.order, 3);
  const plan = projectWorkoutRollover(state, "2026-10-29");
  assert.equal(plan.schedule.find((workout) => workout.prescription.tonalSessionOrder === 1)?.date, "2026-10-19");
  assert.equal(plan.schedule.find((workout) => workout.prescription.tonalSessionOrder === 2)?.date, "2026-10-21");
  assert.equal(plan.schedule.find((workout) => workout.prescription.tonalSessionOrder === 3)?.status, "deferred");
  assert.equal(plan.nextProjectedDate, "2026-10-30");
});

test("stale double-up choices do not reopen completed or skipped sessions", () => {
  let state = withSessionStatus(activeState(), 1, "completed");
  state = withSessionStatus(state, 2, "completed");
  state = { ...state, workoutRolloverChoice: { mode: "double_up", primarySessionOrder: 2, secondarySessionOrder: 3, targetDate: "2026-10-30", reviewedAt: "2026-10-29T12:00:00Z" } };
  const plan = projectWorkoutRollover(state, "2026-10-29");
  assert.equal(plan.nextSession?.order, 3);
  assert.equal(plan.doubleUpActive, false);
});
