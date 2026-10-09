import assert from "node:assert/strict";
import test from "node:test";
import { activityNutritionGuidance } from "./guidance";
import { acceptProposal, buildAcceptedActivity, buildAcceptedMeal } from "./mutations";
import { createInitialPersonalState } from "./program";
import { validateActivityLog, validateMealLog } from "./validation";
import type { NaturalIngestionProposal } from "./types";

const mealProposal: Extract<NaturalIngestionProposal, { kind: "meal" }> = {
  id: "proposal-meal", proposedAt: "2026-10-08T12:00:00Z", sourceType: "text",
  rawInput: "8 oz chicken blend and one tablespoon butter", confidence: "medium",
  assumptions: ["Brand label was not supplied."], summary: "Chicken blend with butter", model: "fixture",
  kind: "meal", meal: {
    id: "estimate", estimatedAt: "2026-10-08T12:00:00Z", confidence: "medium", model: "fixture",
    assumptions: ["Brand label was not supplied."], caveat: "Review brand values.",
    items: [{ id: "chicken", name: "Chicken blend", portion: "8 oz", calories: 400, protein: 55, carbs: 5, fat: 18, confidence: "medium" }],
    calories: 400, protein: 55, carbs: 5, fat: 18,
  },
};

const activityProposal: Extract<NaturalIngestionProposal, { kind: "activity" }> = {
  id: "proposal-activity", proposedAt: "2026-10-08T14:00:00Z", sourceType: "activity_screenshot",
  confidence: "high", assumptions: [], summary: "Outdoor ruck", model: "fixture", kind: "activity",
  activity: { activityType: "Ruck", durationMinutes: { value: 62, evidence: "observed" }, distanceMiles: { value: 4.1, evidence: "observed" }, ruckWeightLb: { value: 20, evidence: "user_supplied" } },
  guidance: "Review recovery needs without eating back every calorie.",
};

test("typed meal approval preserves proposal, correction, date, and deterministic totals", () => {
  const state = createInitialPersonalState("2026-10-08");
  const items = [{ ...mealProposal.meal.items[0]!, calories: 420 }];
  const meal = buildAcceptedMeal({ proposal: mealProposal, items, occurredOn: "2026-10-08", timestamp: "2026-10-08T16:00:00Z", id: "meal-1", idempotencyKey: "submit-1" });
  assert.deepEqual(validateMealLog(meal), []);
  assert.equal(meal.calories, 420);
  assert.ok(meal.corrections?.length);
  assert.equal(acceptProposal(state, mealProposal, meal).meals.length, 1);
});

test("duplicate acceptance is idempotent and rejection leaves canonical state unchanged", () => {
  const state = createInitialPersonalState("2026-10-08");
  const meal = buildAcceptedMeal({ proposal: mealProposal, items: mealProposal.meal.items, occurredOn: "2026-10-08", timestamp: "2026-10-08T16:00:00Z", id: "meal-1", idempotencyKey: "submit-1" });
  const once = acceptProposal(state, mealProposal, meal);
  assert.equal(acceptProposal(once, mealProposal, meal).meals.length, 1);
  const rejected = state;
  assert.equal(rejected.meals.length, 0);
});

test("activity correction remains observed/user-supplied and guidance does not auto-change targets", () => {
  const state = createInitialPersonalState("2026-10-08");
  const facts = { ...activityProposal.activity, ruckWeightLb: { value: 25, evidence: "user_supplied" as const } };
  const activity = buildAcceptedActivity({ proposal: activityProposal, facts, occurredOn: "2026-10-08", timestamp: "2026-10-08T18:00:00Z", id: "activity-1", idempotencyKey: "activity-submit-1", targets: state.nutritionTargets });
  assert.deepEqual(validateActivityLog(activity), []);
  const accepted = acceptProposal(state, activityProposal, activity);
  assert.equal(accepted.activities[0]?.facts.ruckWeightLb?.value, 25);
  assert.deepEqual(accepted.nutritionTargets, state.nutritionTargets);
  assert.match(activity.guidance, /do not automatically eat back/i);
});

test("light activity keeps targets unchanged without recommending calorie replacement", () => {
  const guidance = activityNutritionGuidance({ activityType: "Walk", durationMinutes: { value: 22, evidence: "observed" } }, { calories: 2400, protein: 190, carbs: 240, fat: 80 });
  assert.match(guidance, /no automatic calorie adjustment/i);
});
