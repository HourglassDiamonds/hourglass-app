import assert from "node:assert/strict";
import test from "node:test";
import { activateTrainingProgram, createInitialPersonalState, transitionTrainingProgram } from "./program";
import { configureTonalProgram, markTonalSessionCompletedFromActivity, nextTonalSession, requiredTonalSessionCount, reviewTonalTransition, tonalSessionStatus, TONAL_PROGRAM_CATALOG } from "./tonal-programs";

const titles = Array.from({ length: 8 }, (_, index) => `Machine title ${index + 1}`);
function configured() {
  return configureTonalProgram({
    state: createInitialPersonalState("2026-10-17"), programId: "fit-over-40", sessionTitles: titles,
    source: { kind: "tonal_app_screenshot", reference: "sha256:abc", digest: "abc", reviewedAt: "2026-10-17T12:00:00Z", file: { name: "program.png", type: "image/png", size: 123 } },
    founderVerifiedAt: "2026-10-17T12:00:00Z",
  });
}

test("official Tonal identities and published program dimensions stay exact", () => {
  assert.deepEqual({ ...TONAL_PROGRAM_CATALOG["fit-over-40"], cadenceNote: undefined }, {
    id: "fit-over-40", title: "Fit Over 40", trainer: "Coach Tanysha", level: "intermediate", durationWeeks: 4, weeklyFrequency: 2,
    sessionMinutes: [35, 55], availability: "available", officialUrl: "https://tonal.com/pages/training-programs", cadenceEvidence: "https://tonal.com/pages/success-stories-active-aging", cadenceNote: undefined,
  });
  assert.equal(TONAL_PROGRAM_CATALOG["next-level-strength"].weeklyFrequency, 4);
  assert.equal(TONAL_PROGRAM_CATALOG["next-level-strength"].durationWeeks, 4);
  assert.equal(TONAL_PROGRAM_CATALOG["12-weeks-to-jacked"].weeklyFrequency, 4);
  assert.equal(TONAL_PROGRAM_CATALOG["12-weeks-to-jacked"].durationWeeks, 12);
  assert.equal(requiredTonalSessionCount("fit-over-40"), 8);
});

test("configuration requires the complete founder-verified sequence and provenance", () => {
  assert.throws(() => configureTonalProgram({ state: createInitialPersonalState(), programId: "fit-over-40", sessionTitles: titles.slice(0, 7), source: { kind: "founder_confirmed", reference: "machine", reviewedAt: "now" }, founderVerifiedAt: "now" }), /count-required:8/);
  assert.throws(() => configureTonalProgram({ state: createInitialPersonalState(), programId: "fit-over-40", sessionTitles: [...titles.slice(0, 7), titles[0]!], source: { kind: "founder_confirmed", reference: "machine", reviewedAt: "now" }, founderVerifiedAt: "now" }), /title-duplicate/);
});

test("exact founder-approved Tonal activity marks only the matching session complete", () => {
  const active = activateTrainingProgram(configured(), "2026-10-19", "2026-10-18T12:00:00Z");
  const unchanged = markTonalSessionCompletedFromActivity(active, { activityId: "activity-wrong", programTitle: "Fit Over 40", workoutTitle: "Not a real session", at: "2026-10-19T13:00:00Z" });
  assert.equal(tonalSessionStatus(unchanged, unchanged.tonal.enrollment.sessions[0]!), "planned");
  const completed = markTonalSessionCompletedFromActivity(active, { activityId: "activity-1", programTitle: "Fit Over 40", workoutTitle: titles[0], at: "2026-10-19T13:00:00Z" });
  assert.equal(tonalSessionStatus(completed, completed.tonal.enrollment.sessions[0]!), "completed");
  assert.equal(completed.tonal.enrollment.sessions[0]?.completedActivityId, "activity-1");
  assert.equal(nextTonalSession(completed)?.order, 2);
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
    nextProgramId: "next-level-strength", startDate: "2026-11-16", sessionTitles: Array.from({ length: 16 }, (_, index) => `NLS verified ${index + 1}`),
    source: { kind: "tonal_link", reference: "https://tonal.com/program/verified", reviewedAt: "2026-11-15T12:00:00Z" }, reviewedAt: "2026-11-15T12:00:00Z", approvedAt: "2026-11-15T12:05:00Z",
    readiness: { adherence: "8/8 complete", strengthProgression: "ready", recoveryAndFatigue: "stable", runningProgress: "on plan", availableTrainingTime: "four days confirmed" },
  });
  assert.equal(next.tonal.selectedProgramId, "next-level-strength");
  assert.equal(next.tonal.enrollment.status, "active");
  assert.equal(next.tonal.enrollment.sessions.length, 16);
  assert.equal(next.tonal.completedEnrollments.length, 1);
  assert.equal(next.tonal.completedEnrollments[0]?.programId, "fit-over-40");
  assert.equal(next.tonal.completedEnrollments[0]?.status, "completed");
  assert.equal(next.tonal.completedEnrollments[0]?.sessions.length, 8);
  assert.equal(next.schedule.filter((workout) => workout.date >= "2026-11-16" && workout.prescription.mode === "tonal").length, 16);
  assert.equal(next.schedule.filter((workout) => workout.date >= "2026-11-16" && workout.prescription.id === "hard-rest").length, 4);
  assert.equal(next.tonal.progression.includes("12-weeks-to-jacked"), true);
});
