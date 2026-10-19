import assert from "node:assert/strict";
import test from "node:test";
import { activateTrainingProgram, createInitialPersonalState, transitionTrainingProgram } from "./program";
import { parsePersonalState } from "./state";
import { configureTonalProgram, markTonalSessionCompletedFromActivity, matchesNextTonalSessionCompletion, matchesTonalSessionCompletion, nextTonalSession, planTonalSessionFromScreenshot, requiredTonalSessionCount, reviewTonalTransition, tonalSessionOutcome, tonalSessionStatus, TONAL_PROGRAM_CATALOG } from "./tonal-programs";

function configured() {
  return configureTonalProgram({
    state: createInitialPersonalState("2026-10-17"), programId: "fit-over-40", weeklyFrequency: 3,
    source: { kind: "tonal_app_screenshot", reference: "sha256:abc", digest: "abc", reviewedAt: "2026-10-17T12:00:00Z", file: { name: "program.png", type: "image/png", size: 123 } },
    founderVerifiedAt: "2026-10-17T12:00:00Z",
  });
}

test("official Tonal identities and published program dimensions stay exact", () => {
  assert.deepEqual({ ...TONAL_PROGRAM_CATALOG["fit-over-40"], cadenceNote: undefined }, {
    id: "fit-over-40", title: "Fit Over 40", trainer: "Coach Tanysha", level: "intermediate", durationWeeks: 4, weeklyFrequency: 3,
    sessionMinutes: [35, 55], availability: "available", officialUrl: "https://tonal.com/pages/training-programs", cadenceEvidence: "Founder-confirmed from the Tonal app or machine on 2026-10-18", cadenceNote: undefined,
  });
  assert.equal(TONAL_PROGRAM_CATALOG["next-level-strength"].weeklyFrequency, 4);
  assert.equal(TONAL_PROGRAM_CATALOG["next-level-strength"].durationWeeks, 4);
  assert.equal(TONAL_PROGRAM_CATALOG["12-weeks-to-jacked"].weeklyFrequency, 4);
  assert.equal(TONAL_PROGRAM_CATALOG["12-weeks-to-jacked"].durationWeeks, 12);
  assert.equal(requiredTonalSessionCount("fit-over-40"), 12);
});

test("configuration requires founder-confirmed cadence but no future workout titles", () => {
  const confirmed = configured();
  assert.equal(confirmed.tonal.enrollment.sessions.length, 12);
  assert.equal(confirmed.tonal.enrollment.sessions.every((session) => session.title === undefined), true);
  const three = configureTonalProgram({ state: createInitialPersonalState(), programId: "fit-over-40", weeklyFrequency: 3, source: { kind: "founder_confirmed", reference: "machine", reviewedAt: "now" }, founderVerifiedAt: "now" });
  assert.equal(three.tonal.enrollment.sessions.length, 12);
  assert.throws(() => configureTonalProgram({ state: createInitialPersonalState(), programId: "fit-over-40", weeklyFrequency: 2 as 3, source: { kind: "founder_confirmed", reference: "stale assumption", reviewedAt: "now" }, founderVerifiedAt: "now" }), /tonal-cadence-invalid/);
});

test("exact founder-approved Tonal activity marks only the matching session complete", () => {
  const activated = activateTrainingProgram(configured(), "2026-10-19", "2026-10-18T12:00:00Z");
  const active = planTonalSessionFromScreenshot(activated, { sequencePosition: 1, title: "Machine title 1", movements: [{ name: "Goblet squat", sets: 3, reps: "10", prescribedResistance: "30 lb" }, { name: "Row" }], source: { kind: "tonal_app_screenshot", reference: "sha256:plan", digest: "plan", reviewedAt: "now", file: { name: "plan.png", type: "image/png", size: 100 } }, approvedAt: "2026-10-18T13:00:00Z" });
  const unchanged = markTonalSessionCompletedFromActivity(active, { activityId: "activity-wrong", sequencePosition: 1, programTitle: "Fit Over 40", workoutTitle: "Not a real session", at: "2026-10-19T13:00:00Z" });
  assert.equal(tonalSessionStatus(unchanged, unchanged.tonal.enrollment.sessions[0]!), "planned");
  const completed = markTonalSessionCompletedFromActivity(active, { activityId: "activity-1", sequencePosition: 1, programTitle: "Fit Over 40", workoutTitle: "Machine title 1", at: "2026-10-19T13:00:00Z" });
  assert.equal(tonalSessionStatus(completed, completed.tonal.enrollment.sessions[0]!), "completed");
  assert.equal(completed.tonal.enrollment.sessions[0]?.completedActivityId, "activity-1");
  assert.equal(nextTonalSession(completed)?.order, 2);
});

test("a titleless approved exercise-list plan matches only the same visible movements", () => {
  const activated = activateTrainingProgram(configured(), "2026-10-19", "2026-10-18T12:00:00Z");
  const active = planTonalSessionFromScreenshot(activated, { sequencePosition: 1, movements: [{ name: "Goblet squat", sets: 3, reps: "10" }, { name: "Standing row", sets: 3 }], source: { kind: "tonal_app_screenshot", reference: "sha256:plan-list", digest: "plan-list", reviewedAt: "now", file: { name: "plan.png", type: "image/png", size: 100 } }, approvedAt: "2026-10-18T13:00:00Z" });
  assert.equal(matchesNextTonalSessionCompletion(active, { sequencePosition: 1, programTitle: "Fit Over 40", movements: [{ name: "Goblet squat" }] }), false);
  assert.equal(matchesNextTonalSessionCompletion(active, { sequencePosition: 1, programTitle: "Fit Over 40", movements: [{ name: "Standing Row" }, { name: "Goblet Squat" }] }), true);
  const completed = markTonalSessionCompletedFromActivity(active, { activityId: "activity-list", sequencePosition: 1, programTitle: "Fit Over 40", movements: [{ name: "Goblet squat" }, { name: "Standing row" }], at: "2026-10-19T13:00:00Z" });
  assert.equal(tonalSessionStatus(completed, completed.tonal.enrollment.sessions[0]!), "completed");
  const duplicate = markTonalSessionCompletedFromActivity(completed, { activityId: "activity-list-duplicate", sequencePosition: 1, programTitle: "Fit Over 40", movements: [{ name: "Goblet squat" }, { name: "Standing row" }], at: "2026-10-19T13:05:00Z" });
  assert.equal(duplicate.tonal.enrollment.sessions[0]?.completedActivityId, "activity-list");
});

test("a schedule-completed historical session can receive its matching completion evidence after next-session advancement", () => {
  const activated = activateTrainingProgram(configured(), "2026-10-19", "2026-10-18T12:00:00Z");
  const planned = planTonalSessionFromScreenshot(activated, { sequencePosition: 1, title: "Workout 1", movements: [{ name: "Goblet squat" }], source: { kind: "tonal_app_screenshot", reference: "sha256:plan-1", digest: "plan-1", reviewedAt: "now", file: { name: "plan.png", type: "image/png", size: 100 } }, approvedAt: "2026-10-19T12:00:00Z" });
  const firstId = planned.tonal.enrollment.sessions[0]!.scheduledWorkoutId!;
  const manuallyCompleted = { ...planned, schedule: planned.schedule.map((workout) => workout.id === firstId ? { ...workout, status: "completed" as const } : workout) };

  assert.equal(nextTonalSession(manuallyCompleted)?.order, 2);
  assert.equal(tonalSessionOutcome(manuallyCompleted, manuallyCompleted.tonal.enrollment.sessions[0]!), "Completed");
  assert.equal(matchesNextTonalSessionCompletion(manuallyCompleted, { sequencePosition: 1, programTitle: "Fit Over 40", workoutTitle: "Workout 1" }), false);
  assert.equal(matchesTonalSessionCompletion(manuallyCompleted, { sequencePosition: 1, programTitle: "Fit Over 40", workoutTitle: "Workout 1" }), true);

  const historyCount = manuallyCompleted.schedule.find((workout) => workout.id === firstId)!.history.length;
  const enriched = markTonalSessionCompletedFromActivity(manuallyCompleted, { activityId: "activity-session-1", sequencePosition: 1, programTitle: "Fit Over 40", workoutTitle: "Workout 1", at: "2026-10-19T18:00:00Z" });
  assert.equal(enriched.tonal.enrollment.sessions[0]?.completedActivityId, "activity-session-1");
  assert.equal(enriched.schedule.find((workout) => workout.id === firstId)?.status, "completed");
  assert.equal(enriched.schedule.find((workout) => workout.id === firstId)?.history.length, historyCount);
  assert.equal(enriched.tonal.enrollment.sessions[1]?.completedActivityId, undefined);

  const reloaded = parsePersonalState(JSON.stringify(enriched), "2026-10-19");
  assert.equal(reloaded.tonal.enrollment.sessions[0]?.completedActivityId, "activity-session-1");
  assert.equal(reloaded.schedule.find((workout) => workout.id === firstId)?.status, "completed");

  const duplicate = markTonalSessionCompletedFromActivity(enriched, { activityId: "activity-duplicate", sequencePosition: 1, programTitle: "Fit Over 40", workoutTitle: "Workout 1", at: "2026-10-19T18:05:00Z" });
  assert.equal(duplicate.tonal.enrollment.sessions[0]?.completedActivityId, "activity-session-1");
});

test("historical recovery requires reviewed plan evidence and cannot target an unrelated future session", () => {
  const activated = activateTrainingProgram(configured(), "2026-10-19", "2026-10-18T12:00:00Z");
  const firstId = activated.tonal.enrollment.sessions[0]!.scheduledWorkoutId!;
  const skipped = { ...activated, schedule: activated.schedule.map((workout) => workout.id === firstId ? { ...workout, status: "skipped" as const } : workout) };
  assert.equal(tonalSessionOutcome(skipped, skipped.tonal.enrollment.sessions[0]!), "Skipped");
  assert.equal(matchesTonalSessionCompletion(skipped, { sequencePosition: 1, programTitle: "Fit Over 40", workoutTitle: "Workout 1" }), false);

  const recoveredPlan = planTonalSessionFromScreenshot(skipped, { sequencePosition: 1, title: "Workout 1", movements: [], source: { kind: "tonal_app_screenshot", reference: "sha256:historical-plan", digest: "historical-plan", reviewedAt: "now", file: { name: "plan.png", type: "image/png", size: 100 } }, approvedAt: "2026-10-19T18:00:00Z" });
  const corrected = markTonalSessionCompletedFromActivity(recoveredPlan, { activityId: "activity-recovery", sequencePosition: 1, programTitle: "Fit Over 40", workoutTitle: "Workout 1", at: "2026-10-19T19:00:00Z" });
  assert.equal(tonalSessionOutcome(corrected, corrected.tonal.enrollment.sessions[0]!), "Completed");
  assert.equal(corrected.tonal.enrollment.sessions[0]?.completedActivityId, "activity-recovery");

  assert.throws(() => planTonalSessionFromScreenshot(activated, { sequencePosition: 3, title: "Future", movements: [], source: { kind: "tonal_app_screenshot", reference: "sha256:future", digest: "future", reviewedAt: "now", file: { name: "future.png", type: "image/png", size: 100 } }, approvedAt: "2026-10-19T18:00:00Z" }), /tonal-session-plan-order-invalid/);
});

test("deferred Tonal work stays linked and transition cannot occur without completion and approval", () => {
  const active = activateTrainingProgram(configured(), "2026-10-19", "2026-10-18T12:00:00Z");
  const firstId = active.tonal.enrollment.sessions[0]!.scheduledWorkoutId!;
  const deferred = { ...active, schedule: active.schedule.map((workout) => workout.id === firstId ? { ...workout, status: "deferred" as const, deferredTo: "2026-10-21" } : workout) };
  assert.equal(tonalSessionStatus(deferred, deferred.tonal.enrollment.sessions[0]!), "deferred");
  assert.throws(() => reviewTonalTransition(active, { to: "next-level-strength", reviewedAt: "2026-11-16T12:00:00Z", approvedAt: "2026-11-16T12:01:00Z", readiness: { adherence: "reviewed", strengthProgression: "reviewed", recoveryAndFatigue: "reviewed", runningProgress: "reviewed", availableTrainingTime: "reviewed" } }), /requires-completion/);
});

test("founder-approved transition activates only the next verified program block", () => {
  const active = activateTrainingProgram(configured(), "2026-10-19", "2026-10-18T12:00:00Z");
  const completed = { ...active, schedule: active.schedule.map((workout) => workout.prescription.mode === "tonal" ? { ...workout, status: "completed" as const } : workout), tonal: { ...active.tonal, enrollment: { ...active.tonal.enrollment, status: "completed" as const, completedAt: "2026-11-15T12:00:00Z" } } };
  const next = transitionTrainingProgram(completed, {
    nextProgramId: "next-level-strength", startDate: "2026-11-16", weeklyFrequency: 4,
    source: { kind: "tonal_link", reference: "https://tonal.com/program/verified", reviewedAt: "2026-11-15T12:00:00Z" }, reviewedAt: "2026-11-15T12:00:00Z", approvedAt: "2026-11-15T12:05:00Z",
    readiness: { adherence: "12/12 complete", strengthProgression: "ready", recoveryAndFatigue: "stable", runningProgress: "on plan", availableTrainingTime: "four days confirmed" },
  });
  assert.equal(next.tonal.selectedProgramId, "next-level-strength");
  assert.equal(next.tonal.enrollment.status, "active");
  assert.equal(next.tonal.enrollment.sessions.length, 16);
  assert.equal(next.tonal.completedEnrollments.length, 1);
  assert.equal(next.tonal.completedEnrollments[0]?.programId, "fit-over-40");
  assert.equal(next.tonal.completedEnrollments[0]?.status, "completed");
  assert.equal(next.tonal.completedEnrollments[0]?.sessions.length, 12);
  assert.equal(next.schedule.filter((workout) => workout.date >= "2026-11-16" && workout.prescription.mode === "tonal").length, 16);
  assert.equal(next.schedule.filter((workout) => workout.date >= "2026-11-16" && workout.prescription.id === "hard-rest").length, 4);
  assert.equal(next.tonal.progression.includes("12-weeks-to-jacked"), true);
});
