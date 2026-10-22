import assert from "node:assert/strict";
import test from "node:test";
import { deriveFrequentlyEaten, frequentFromMeal, frequentMealMutationKey, logFrequentMeal, mealSignature, saveMealAsFrequent } from "./nutrition";
import type { MealLog } from "./types";

function meal(id: string, timestamp: string, name = "Chicken Patties", portion = "2 patties", calories = 420): MealLog {
  return { id, timestamp, mealType: "lunch", items: [{ id: `${id}-item`, name, portion, calories, protein: 48, carbs: 12, fat: 18, confidence: "high" }], calories, protein: 48, carbs: 12, fat: 18, provenance: ["user_confirmed"] };
}

test("signatures ignore capitalization, punctuation, and spacing", () => {
  assert.equal(mealSignature(meal("a", "2026-10-01T12:00:00Z")), mealSignature(meal("b", "2026-10-02T12:00:00Z", " chicken   patties ", "2 PATTIES!")));
});

test("two recent canonical logs promote a meal and use the latest corrected values", () => {
  const first = meal("a", "2026-10-01T12:00:00Z", "Chicken Patties", "2 patties", 390);
  const corrected = meal("b", "2026-10-05T12:00:00Z", "chicken patties", "2 PATTIES", 420);
  const frequent = deriveFrequentlyEaten([first, corrected], [], "2026-10-06T12:00:00Z");
  assert.equal(frequent.length, 1);
  assert.equal(frequent[0]?.useCount, 2);
  assert.equal(frequent[0]?.calories, 420);
  assert.equal(frequent[0]?.pinned, false);
});

test("two stale uses do not promote until a third use or a recent repeat", () => {
  const first = meal("a", "2025-01-01T12:00:00Z");
  const second = meal("b", "2025-02-01T12:00:00Z");
  assert.equal(deriveFrequentlyEaten([first, second], [], "2026-10-06T12:00:00Z").length, 0);
  assert.equal(deriveFrequentlyEaten([first, second, meal("c", "2025-03-01T12:00:00Z")], [], "2026-10-06T12:00:00Z").length, 1);
});

test("pinned defaults win, one-tap copies macros, and hide removes the candidate", () => {
  const source = meal("a", "2026-10-05T12:00:00Z");
  const pinned = { ...frequentFromMeal(source), calories: 415, pinned: true };
  const visible = deriveFrequentlyEaten([source], [pinned], "2026-10-06T12:00:00Z");
  assert.equal(visible[0]?.calories, 415);
  const logged = logFrequentMeal(visible[0]!, "2026-10-06T18:00:00Z", "meal-new");
  assert.equal(logged.calories, 415);
  assert.equal(logged.frequentMealId, pinned.id);
  assert.notEqual(logged.items[0]?.id, pinned.items[0]?.id);
  assert.equal(deriveFrequentlyEaten([source], [{ ...pinned, hidden: true }]).length, 0);
  assert.equal(deriveFrequentlyEaten([source], [{ ...pinned, pinned: false }]).length, 0);
});

test("editing a one-tap occurrence never rewrites the derived frequent default", () => {
  const first = meal("a", "2026-10-01T12:00:00Z", "Chicken Patties", "2 patties", 390);
  const canonical = meal("b", "2026-10-05T12:00:00Z", "Chicken Patties", "2 patties", 420);
  const occurrence = { ...meal("c", "2026-10-06T12:00:00Z", "Chicken Patties", "2 patties", 500), frequentMealId: "frequent-b" };
  const frequent = deriveFrequentlyEaten([first, canonical, occurrence], [], "2026-10-06T13:00:00Z");
  assert.equal(frequent[0]?.useCount, 3);
  assert.equal(frequent[0]?.calories, 420);
});

test("a corrected historical meal becomes one reusable frequent template without changing history", () => {
  const historical = {
    ...meal("historical", "2026-10-18T12:00:00Z", "Chicken Bowl", "1 bowl", 515),
    occurredOn: "2026-10-18",
    protein: 48,
    carbs: 42,
    fat: 17,
    items: [{ id: "corrected-item", name: "Chicken Bowl", portion: "1 bowl", calories: 515, protein: 48, carbs: 42, fat: 17, confidence: "high" as const }],
    corrections: [{ field: "items", from: "estimated", to: "founder corrected" }],
  };
  const state = { meals: [historical], frequentMeals: [] };
  const first = saveMealAsFrequent(state, historical.id, "2026-10-22T12:00:00Z");
  const second = saveMealAsFrequent({ ...state, frequentMeals: first }, historical.id, "2026-10-22T12:01:00Z");

  assert.equal(second.length, 1);
  assert.equal(second[0]?.id, first[0]?.id);
  assert.deepEqual(second[0]?.items.map(({ id: _id, ...item }) => item), historical.items.map(({ id: _id, ...item }) => item));
  assert.deepEqual({ meals: state.meals }, { meals: [historical] }, "the source meal and its audited correction remain unchanged");
  const reused = logFrequentMeal(second[0]!, "2026-10-23T12:00:00Z", "meal-reused");
  assert.deepEqual({ calories: reused.calories, protein: reused.protein, carbs: reused.carbs, fat: reused.fat }, { calories: 515, protein: 48, carbs: 42, fat: 17 });
  assert.equal(frequentMealMutationKey(historical), frequentMealMutationKey(structuredClone(historical)));
  assert.notEqual(frequentMealMutationKey(historical), frequentMealMutationKey({ ...historical, calories: 516 }));
  assert.ok(frequentMealMutationKey(historical).length < 200);
});
