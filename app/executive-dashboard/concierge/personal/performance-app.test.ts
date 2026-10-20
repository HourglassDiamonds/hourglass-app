import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const directory = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(directory, "performance-app.tsx"), "utf8");
const css = readFileSync(join(directory, "performance.module.css"), "utf8");

test("Performance exposes explicit workout resolution controls and confirmation-gated Sterling changes", () => {
  for (const label of ["Start", "Edit Workout", "Defer", "Skip", "Confirm changes", "Reject"]) assert.match(source, new RegExp(label));
  assert.match(source, /nothing has changed yet/i);
  assert.match(source, /Other planned sessions that will move/);
  assert.match(source, /displacedWorkouts/);
  assert.match(source, /performance-mutation-action-unavailable/);
});

test("meal photo and recovery flows stay optional, editable, and mobile usable", () => {
  assert.match(source, /capture="environment"/);
  assert.match(source, /TAKE MEAL PHOTO/);
  assert.match(source, /UPLOAD MEAL PHOTO/);
  for (const label of ["Add missing food", "Remove", "Accept", "Reject"]) assert.match(source, new RegExp(label));
  for (const field of ["sleepHours", "sleepQuality", "recoveryScore", "strain", "restingHeartRate", "hrvMs", "bodyweightLb", "fatigue", "soreness", "pain"]) assert.match(source, new RegExp(field));
  assert.match(css, /@media\(max-width:390px\)/);
  assert.match(css, /min-height:44px/);
});

test("nutrition preserves the review gate and exposes frequent one-tap controls", () => {
  assert.match(source, /Nothing is saved until you accept/);
  assert.match(source, /proposal:\s*intakeProposal/);
  for (const label of ["Frequently Eaten", "Save as frequent", "Unpin", "Pin", "Edit default", "Hide", "Undo", "Edit this occurrence"]) assert.match(source, new RegExp(label));
  assert.match(css, /\.photoActions\{display:grid/);
  assert.match(css, /\.frequentLog[^}]*min-height:88px/);
  assert.match(source, /Delete source image/);
  assert.match(source, /performance-revision-conflict/);
});

test("route navigation and legacy browser data migration remain available", () => {
  for (const route of ["/personal/workouts", "/personal/food", "/personal/recovery", "/personal/progress"]) {
    assert.match(source, new RegExp(route));
  }
  assert.match(source, /continuum\.personal\.performance\.v3/);
  assert.match(source, /continuum\.personal\.performance\.v2/);
  assert.match(source, /continuum\.personal\.v1/);
  assert.match(source, /migrateLegacyPersonalState/);
  assert.match(css, /\.tabs a\[aria-current=page\]/);
});

test("program stays in setup until a reviewed Monday activation is explicitly persisted", () => {
  assert.match(source, /program not started/);
  assert.match(source, /Review Week 1/);
  assert.match(source, /Proposed — the program is still not started/);
  assert.match(source, /Confirm and activate/);
  assert.match(source, /action:\s*"activate_program"/);
  assert.match(source, /week11ObjectiveDate/);
  assert.match(source, /lastPersistedState/);
  assert.match(source, /serialized === lastPersistedState\.current/);
  for (const copy of ["Fit Over 40", "Founder-confirmed cadence:", "3 Tonal workouts per week", "12 prescribed sessions", "Next Level Strength", "12 Weeks to Jacked", "Confirm Fit Over 40 enrollment", "Activation is blocked"]) assert.match(source, new RegExp(copy));
  assert.doesNotMatch(source, /2 Tonal workouts per week/);
  assert.doesNotMatch(source, /two or three strength workouts per week/);
  assert.match(source, /tonalEnrollmentReady/);
  assert.match(source, /configure_strength_program/);
  assert.match(source, /tonal-session-sequence-required/);
});

test("just-in-time Tonal plans and completion screenshots remain editable and exact", () => {
  for (const label of ["Add Before Photo", "Approve planned session", "Add visible movement", "Proposal rejected; nothing was saved", "plan_strength_session"]) assert.match(source, new RegExp(label));
  for (const label of ["Tonal workout title", "Tonal program", "Trainer", "Tonal volume", "Max resistance", "Completed sets", "Completed reps"]) assert.match(source, new RegExp(label));
  assert.match(source, /markTonalSessionCompletedFromActivity/);
  assert.match(source, /sequencePosition/);
});

test("mobile completion selection stays available while canonical completion remains match-gated", () => {
  assert.match(source, /Add After Photo<input type="file"[^>]+onChange=\{chooseTonalCompletionScreenshot\}/);
  assert.match(source, /Training schedule/);
  assert.match(source, /Today · upcoming · history/);
  assert.match(source, /data-unified-workout-cards/);
  assert.match(source, /setSelectedTonalSessionOrder/);
  assert.match(source, /Completed \/ Deferred \/ Skipped \/ Pending|tonalSessionOutcome/);
  assert.match(source, /Completion screenshot selected\. Sterling is reading only the visible results/);
  assert.match(source, /Completion screenshot ready for review\. Nothing is saved until you approve it/);
  assert.match(source, /matchesTonalSessionCompletion/);
  assert.match(source, /does not match the founder-selected Tonal session/);
  assert.match(source, /Add Before Photo/);
  assert.match(source, /No plan details will be fabricated/);
  assert.match(source, /Completion evidence added without creating another completed session/);
  assert.match(source, /existing reviewed correction path is approved/);
  assert.match(source, /PERFORMANCE_IMAGE_ACCEPT/);
  assert.match(source, /preparePerformanceImage/);
  assert.match(source, /Review \/ Complete Workout/);
  assert.match(css, /\.workoutControls[^}]*grid-template-columns/);
  assert.match(css, /\.workoutCardSelected/);
  assert.doesNotMatch(source, /Today is resolved/);
});

test("the unified card keeps Tonal and non-Tonal completion paths distinct", () => {
  assert.match(source, /selectedWorkoutTonalSession \?/);
  assert.match(source, /chooseSelectedWorkoutCompletion/);
  assert.match(source, /completeScheduledWorkoutFromActivity/);
  assert.match(source, /Before photos are optional and not needed for this activity type/);
  assert.match(source, /completionWorkoutId/);
});
