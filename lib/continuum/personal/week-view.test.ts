import assert from "node:assert/strict";
import test from "node:test";
import { activateTrainingProgram, createInitialPersonalState, dateKey } from "./program";
import { configureTonalProgram } from "./tonal-programs";
import { dayRecord, mondayFor, targetsForDate, weekDateKeys, weekRecords } from "./week-view";

test("weeks run Monday through Sunday across month and year boundaries", () => {
  assert.equal(mondayFor("2026-10-20"), "2026-10-19");
  assert.deepEqual(weekDateKeys("2026-12-28"), [
    "2026-12-28", "2026-12-29", "2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02", "2027-01-03",
  ]);
});

test("the current date and Monday boundary use the founder's New York timezone", () => {
  assert.equal(dateKey(new Date("2026-10-20T03:30:00.000Z")), "2026-10-19");
  assert.equal(mondayFor(dateKey(new Date("2026-10-20T03:30:00.000Z"))), "2026-10-19");
  assert.equal(dateKey(new Date("2026-10-20T04:30:00.000Z")), "2026-10-20");
});

test("daily nutrition uses accepted canonical meals and preserves overages", () => {
  const state = createInitialPersonalState("2026-10-20");
  state.meals = [{
    id: "meal-1", timestamp: "2026-10-20T12:00:00.000Z", occurredOn: "2026-10-19", provenance: ["user_confirmed"],
    items: [{ id: "item-1", name: "Lunch", portion: "1", calories: 2500, protein: 200, carbs: 250, fat: 90, confidence: "high" }],
    calories: 2500, protein: 200, carbs: 250, fat: 90,
  }];
  const monday = dayRecord(state, "2026-10-19");
  const tuesday = dayRecord(state, "2026-10-20");
  assert.equal(monday.meals.length, 1);
  assert.deepEqual(monday.remaining, { calories: -100, protein: -10, carbs: -10, fat: -10 });
  assert.equal(tuesday.meals.length, 0);
  assert.equal(tuesday.remaining.calories, 2400);
});

test("historical target snapshots apply without rewriting earlier weeks", () => {
  const state = createInitialPersonalState("2026-10-20");
  state.nutritionTargetHistory = [
    { effectiveOn: "2026-10-01", calories: 2200, protein: 180, carbs: 210, fat: 75 },
    { effectiveOn: "2026-10-20", calories: 2400, protein: 190, carbs: 240, fat: 80 },
  ];
  assert.equal(targetsForDate(state, "2026-10-19").calories, 2200);
  assert.equal(targetsForDate(state, "2026-10-20").calories, 2400);
});

test("week records group workouts, activities, recovery, and meals by exact date", () => {
  const state = createInitialPersonalState("2026-10-20");
  state.activities = [{ id: "activity-1", timestamp: "2026-10-20T20:00:00.000Z", occurredOn: "2026-10-20", facts: { activityType: "Walk" }, sourceType: "text", assumptions: [], corrections: [], guidance: "", idempotencyKey: "activity-1", provenance: ["user_confirmed"] }];
  state.recoveryEntries = [{ id: "recovery-1", date: "2026-10-20", recordedAt: "2026-10-20T10:00:00.000Z", strain: { value: 12.1, source: "manual" }, provenance: ["user_confirmed"] }];
  const records = weekRecords(state, "2026-10-19");
  assert.equal(records.length, 7);
  assert.equal(records[1]?.activities.length, 1);
  assert.equal(records[1]?.recovery?.strain?.value, 12.1);
  assert.equal(records[0]?.activities.length, 0);
});

test("active Tonal weeks retain completed schedule history without requiring a completion activity", () => {
  const configured = configureTonalProgram({
    state: createInitialPersonalState("2026-10-19"),
    programId: "fit-over-40",
    weeklyFrequency: 3,
    source: { kind: "founder_confirmed", reference: "Tonal", reviewedAt: "2026-10-18T20:00:00.000Z" },
    founderVerifiedAt: "2026-10-18T20:00:00.000Z",
  });
  const active = activateTrainingProgram(configured, "2026-10-19", "2026-10-18T20:05:00.000Z");
  const mondayWorkout = active.schedule.find((workout) => workout.date === "2026-10-19")!;
  const tuesdayWorkout = active.schedule.find((workout) => workout.date === "2026-10-20")!;
  const wednesdayWorkout = active.schedule.find((workout) => workout.date === "2026-10-21")!;
  const state = {
    ...active,
    schedule: active.schedule.map((workout) =>
      workout.id === mondayWorkout.id || workout.id === tuesdayWorkout.id
        ? { ...workout, status: "completed" as const }
        : workout,
    ),
    tonal: {
      ...active.tonal,
      enrollment: {
        ...active.tonal.enrollment,
        sessions: active.tonal.enrollment.sessions.map((session) => session.order === 1 ? {
          ...session,
          title: "Founder-reviewed Session 1",
          plannedAt: "2026-10-19T12:00:00.000Z",
          plannedSource: { kind: "tonal_app_screenshot" as const, reference: "approved-source", reviewedAt: "2026-10-19T12:00:00.000Z" },
        } : session),
      },
    },
    sessions: [{ id: "session-1", scheduledWorkoutId: mondayWorkout.id, startedAt: "2026-10-19T17:30:00.000Z", completedAt: "2026-10-19T18:00:00.000Z", sets: [] }],
    activities: [
      { id: "run-completion", timestamp: "2026-10-20T13:00:00.000Z", occurredOn: "2026-10-20", facts: { activityType: "Run" }, sourceType: "text" as const, assumptions: [], corrections: [], guidance: "", idempotencyKey: "run-completion", scheduledWorkoutId: tuesdayWorkout.id, provenance: ["user_confirmed" as const] },
      { id: "walk", timestamp: "2026-10-20T19:00:00.000Z", occurredOn: "2026-10-20", facts: { activityType: "Walk" }, sourceType: "text" as const, assumptions: [], corrections: [], guidance: "", idempotencyKey: "walk", provenance: ["user_confirmed" as const] },
    ],
    meals: [{
      id: "late-meal", timestamp: "2026-10-20T02:00:00.000Z", occurredOn: "2026-10-19", provenance: ["user_confirmed" as const],
      items: [{ id: "meal-item", name: "Dinner", portion: "1", calories: 700, protein: 45, carbs: 60, fat: 25, confidence: "high" as const }],
      calories: 700, protein: 45, carbs: 60, fat: 25,
    }],
  };

  const records = weekRecords(state, "2026-10-19");
  const monday = records[0]!;
  const tuesday = records[1]!;
  const wednesday = records[2]!;

  assert.equal(monday.workouts[0]?.status, "completed");
  assert.equal(monday.workouts[0]?.id, mondayWorkout.id);
  assert.equal(monday.activityCount, 1, "completed schedule history counts without a separate activity");
  assert.equal(monday.activities.length, 0, "missing completion metrics remain absent");
  assert.equal(monday.meals[0]?.id, "late-meal", "meal uses accepted occurrence date, not creation timestamp");
  assert.equal(tuesday.workouts[0]?.status, "completed");
  assert.equal(tuesday.activityCount, 2, "linked run completion is not double-counted beside its schedule row");
  assert.equal(wednesday.workouts[0]?.id, wednesdayWorkout.id);
  assert.equal(wednesday.workouts[0]?.status, "planned");
});

test("deferred and skipped sessions remain on their canonical dates while replaced occurrences stay hidden", () => {
  const state = createInitialPersonalState("2026-10-20");
  const workout = (id: string, date: string, status: "deferred" | "skipped" | "replaced") => ({
    id, date, originalDate: date, status,
    prescription: { id, name: id, domain: "strength" as const, mode: "tonal" as const, intent: "moderate" as const, durationMinutes: 30, notes: "", trainingBlock: "test", lowerBodyLoad: "moderate" as const, exercises: [] },
    provenance: ["program" as const], history: [],
  });
  state.schedule = [
    workout("deferred", "2026-10-19", "deferred"),
    workout("skipped", "2026-10-20", "skipped"),
    workout("replaced", "2026-10-21", "replaced"),
  ];
  assert.equal(dayRecord(state, "2026-10-19").workouts[0]?.status, "deferred");
  assert.equal(dayRecord(state, "2026-10-20").workouts[0]?.status, "skipped");
  assert.equal(dayRecord(state, "2026-10-21").workouts.length, 0);
});
