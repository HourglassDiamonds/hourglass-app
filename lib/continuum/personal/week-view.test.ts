import assert from "node:assert/strict";
import test from "node:test";
import { createInitialPersonalState } from "./program";
import { dayRecord, mondayFor, targetsForDate, weekDateKeys, weekRecords } from "./week-view";

test("weeks run Monday through Sunday across month and year boundaries", () => {
  assert.equal(mondayFor("2026-10-20"), "2026-10-19");
  assert.deepEqual(weekDateKeys("2026-12-28"), [
    "2026-12-28", "2026-12-29", "2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02", "2027-01-03",
  ]);
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
