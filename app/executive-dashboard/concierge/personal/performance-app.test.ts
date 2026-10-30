import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import type { ReactElement, ReactNode } from "react";
import { FrequentMealSaveControl } from "./frequent-meal-save-control";
import { deriveFrequentlyEaten, saveMealAsFrequent } from "@/lib/continuum/personal/nutrition";
import type { MealLog } from "@/lib/continuum/personal/types";

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

test("weekly navigation and legacy browser data migration remain available", () => {
  assert.match(source, /label: "Week"/);
  assert.match(source, /\/personal\/progress/);
  assert.match(source, /← Previous/);
  assert.match(source, /Next →/);
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
  assert.match(source, /Add After Photo · after workout<input type="file"[^>]+onChange=\{chooseTonalCompletionScreenshot\}/);
  assert.match(source, /Training schedule/);
  assert.match(source, /Today · upcoming · history/);
  assert.match(source, /data-unified-workout-cards/);
  assert.match(source, /setSelectedTonalSessionOrder/);
  assert.match(source, /Completed \/ Deferred \/ Skipped \/ Pending|tonalSessionOutcome/);
  assert.match(source, /Completion screenshot selected\. Sterling is reading only the visible results/);
  assert.match(source, /Extraction complete\. Review the selected Tonal session below; nothing is saved until you approve it/);
  assert.match(source, /evaluateTonalSessionCompletion/);
  assert.match(source, /Nothing was saved/);
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

test("Tonal evidence controls present Before as the first step without weakening After gates", () => {
  assert.match(source, /Add Before Photo\{!selectedWorkoutTonalSession\.plannedSource \? " · first step" : ""\}/);
  assert.match(source, /selectedWorkoutTonalSession\.plannedSource && selectedWorkout\.date <= today \? styles\.primary/);
  assert.match(source, /disabled=\{intakeBusy \|\| selectedWorkout\.date > today \|\| !selectedWorkoutTonalSession\.plannedSource\}/);
  assert.match(source, /Add After Photo · after workout/);
  assert.match(source, /Scheduled for \$\{prettyDate\(selectedWorkout\.date\)\}\. Approve the Before Photo first; After Photo opens on or after the scheduled workout date\./);
  assert.match(source, /Step 1: approve the matching Before Photo\. Step 2: complete the workout, then add After Photo\./);
});

test("the unified card keeps Tonal and non-Tonal completion paths distinct", () => {
  assert.match(source, /selectedWorkoutTonalSession \?/);
  assert.match(source, /chooseSelectedWorkoutCompletion/);
  assert.match(source, /completeScheduledWorkoutFromActivity/);
  assert.match(source, /Before photos are optional and not needed for this activity type/);
  assert.match(source, /completionWorkoutId/);
});

test("the primary mobile experience is a Monday through Sunday day-centered week", () => {
  assert.match(source, /data-weekly-performance/);
  assert.match(source, /weekRecords\(projectedState, displayWeekStart\)/);
  assert.match(source, /Previous/);
  assert.match(source, /This week/);
  assert.match(source, /Next →/);
  assert.match(source, /expandedDays/);
  assert.match(source, /aria-expanded=\{expanded\}/);
  assert.match(source, /Meals, training, recovery, evidence, and corrections stay with the day/);
  assert.match(css, /\.daySummary/);
  assert.match(css, /\.dayBody/);
  assert.match(css, /@media\(max-width:390px\)[\s\S]*\.dailyTotals/);
});

test("activity approval has immediate saving feedback and actionable fail-closed errors", () => {
  assert.match(source, /activitySaveBusy/);
  assert.match(source, /Saving…/);
  assert.match(source, /Validating the selected session and source evidence/);
  assert.match(source, /Performance changed elsewhere\. The latest state was loaded/);
  assert.match(source, /Activity already logged/);
  assert.match(source, /disabled=\{busy/);
});

test("missed Tonal sessions use a deterministic founder-controlled projection", () => {
  assert.match(source, /projectWorkoutRollover/);
  assert.match(source, /Session \{rolloverPlan\.nextSession\.order\} remains next/);
  assert.match(source, /Continue in Succession/);
  assert.match(source, /Double Up \/ Makeup/);
  assert.match(source, /Two strength sessions together increase fatigue/);
  assert.match(source, /action: "accept_adjustment"/);
});

test("an active Fit Over 40 cycle exposes one reviewed restart without rewriting history", () => {
  assert.match(source, /data-program-restart/);
  assert.match(source, /restartFitOver40Cycle/);
  assert.match(source, /restart-fit-over-40/);
  assert.match(source, /Prior workout evidence remains in history/);
  assert.match(source, /unfinished old-cycle slots are retired, never completed or skipped/);
  assert.match(source, /isCurrentFitOver40CycleStart/);
  assert.match(source, /data-program-cycle-current/);
  assert.match(source, /Already active — this is the current Fit Over 40 cycle/);
  assert.match(source, /disabled=\{activationBusy \|\| currentFitOver40CycleSelected\}/);
});

test("daily nutrition shows exact remaining values and audited historical corrections", () => {
  assert.match(source, /day\.remaining\[key\] >= 0/);
  assert.match(source, /over/);
  assert.match(source, /New meal will be saved to/);
  assert.match(source, /occurredOn: mealTargetDate/);
  assert.match(source, /action: "edit_meal"/);
  assert.match(source, /Save audited correction/);
  assert.match(source, /Void this meal entry/);
  assert.match(source, /action: "accept_meal"/);
  assert.match(source, /saveMealAsFrequent\(state, meal\.id\)/);
  assert.match(source, /frequentMealMutationKey\(meal\)/);
  assert.match(source, /action: "snapshot"/);
  assert.match(source, /historical meal and daily totals remain unchanged/i);
});

test("the exact historical-meal click shows durable success, exposes the reusable template, and ignores repeats", async () => {
  const historical: MealLog = {
    id: "meal-preview-oct-21",
    timestamp: "2026-10-23T10:57:31.430Z",
    occurredOn: "2026-10-21",
    items: [
      { id: "tenders", name: "Chicken tenders", portion: "3 medium breaded tenders", calories: 360, protein: 30, carbs: 24, fat: 16, confidence: "low" },
      { id: "ranch", name: "Greek yogurt ranch", portion: "2 tbsp", calories: 35, protein: 2, carbs: 3, fat: 2, confidence: "low" },
    ],
    calories: 395, protein: 32, carbs: 27, fat: 18, provenance: ["user_confirmed"],
  };
  const original = structuredClone(historical);
  let interactionCount = 0;
  let frequentMeals = [] as ReturnType<typeof saveMealAsFrequent>;
  type ButtonElement = ReactElement<{ children: ReactNode; disabled: boolean; onClick: () => Promise<void> }>;

  const unsaved = FrequentMealSaveControl({
    saved: false,
    phase: "idle",
    onSave: async () => {
      interactionCount += 1;
      frequentMeals = saveMealAsFrequent({ meals: [historical], frequentMeals }, historical.id, "2026-10-23T10:57:37.695Z");
    },
  }) as ButtonElement;
  assert.equal(unsaved.props.children, "Save as frequent");
  await unsaved.props.onClick();

  const saved = FrequentMealSaveControl({
    saved: true,
    phase: "idle",
    onSave: async () => { interactionCount += 1; },
  }) as ButtonElement;
  assert.equal(saved.props.children, "Saved as frequent");
  assert.equal(saved.props.disabled, true);
  await saved.props.onClick();
  assert.equal(interactionCount, 1, "a repeated click must not issue another persistence action");
  assert.equal(frequentMeals.length, 1);
  assert.equal(deriveFrequentlyEaten([historical], frequentMeals, "2026-10-23T11:00:00Z")[0]?.name, "Chicken tenders, Greek yogurt ranch");
  assert.deepEqual({ calories: frequentMeals[0]?.calories, protein: frequentMeals[0]?.protein, carbs: frequentMeals[0]?.carbs, fat: frequentMeals[0]?.fat }, { calories: 395, protein: 32, carbs: 27, fat: 18 });
  assert.deepEqual(historical, original, "the original historical meal and portions remain unchanged");
});

test("daily training and recovery keep evidence semantics distinct", () => {
  for (const label of ["Before Photo", "After Photo", "Review / Complete", "Log unplanned activity", "Daily strain", "not activity-specific"]) assert.match(source, new RegExp(label));
  assert.match(source, /scheduledWorkoutId/);
  assert.match(source, /No plan details will be fabricated/);
  assert.match(source, /Unknown values remain unknown/);
});

test("daily review controls stay mounted on the selected day and never claim premature persistence", () => {
  assert.match(source, /function openMealEntry\(date: string\)/);
  assert.match(source, /data-meal-entry-date=\{day\.date\}/);
  assert.match(source, /mealEntryRef\.current\?\.scrollIntoView/);
  assert.match(source, /mealTextRef\.current\?\.focus/);
  assert.match(source, /Close Meal Entry/);
  assert.match(source, /Approve & Save Meal/);
  assert.match(source, /occurredOn: mealTargetDate/);
});

test("Tonal completion extraction exposes the exact historical-session review", () => {
  assert.match(source, /setPastActivityOpen\(true\)/);
  assert.match(source, /data-completion-review=\{tonalCompletionTargetOrder/);
  assert.match(source, /Review Fit Over 40 · Session/);
  assert.match(source, /Approve & Save/);
  assert.match(source, /enrich-activity-/);
  assert.match(source, /does not create a second completion/);
  assert.doesNotMatch(source, /Completion screenshot ready for review/);
  assert.match(source, /setTonalPlanProposal\(null\); setTonalPlanFile\(null\); setTonalPlanTargetOrder\(null\)/);
  assert.match(source, /tonalPlanCommitInFlight\.current/);
  assert.match(source, /Before photo already attached to this workout/);
  assert.doesNotMatch(source, /Workout plan already saved/);
  assert.match(source, /!selectedWorkoutTonalSession\.plannedSource/);
});

test("Before Photo approval reports the exact sequence rejection at the review", () => {
  assert.match(source, /setTonalPlanFeedback\("Saving the reviewed Before Photo…"\)/);
  assert.match(source, /Session \$\{nextOrder\} is still next\. Session \$\{session\.order\} cannot be approved/);
  assert.match(source, /aria-live="assertive"/);
  assert.match(source, /performance-source-digest-invalid/);
  assert.doesNotMatch(source, /The planned session was not saved\. Review the current sequence and retry\./);
});

test("recovery screenshots have date-gated editable review and confirmed persistence feedback", () => {
  assert.match(source, /chooseRecoveryScreenshot/);
  assert.match(source, /sourceType", "recovery_screenshot"/);
  assert.match(source, /intent", "recovery"/);
  assert.match(source, /data-recovery-review/);
  assert.match(source, /selected date conflicts with the visible screenshot date/i);
  assert.match(source, /Approve & Save Recovery/);
  assert.match(source, /action: "accept_recovery"/);
  assert.match(source, /Recovery screenshot already logged/);
  assert.match(source, /Daily strain · not workout-specific/);
});
