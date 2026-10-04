import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { nutritionTotals, remainingNutrition, weekStart } from "./summary";
describe("personal nutrition summaries", () => {
  const entries = [{ id: "1", timestamp: "2026-10-01T12:00:00.000Z", meal: "lunch" as const, description: "Lunch", calories: 600, protein: 45, carbs: 60, fat: 18, source: "manual" as const, confidence: "confirmed" as const }, { id: "2", timestamp: "2026-10-01T18:00:00.000Z", meal: "dinner" as const, description: "Dinner", calories: 700, protein: 55, carbs: 70, fat: 22, source: "text" as const, confidence: "confirmed" as const }];
  it("totals macros", () => assert.deepEqual(nutritionTotals(entries), { calories: 1300, protein: 100, carbs: 130, fat: 40 }));
  it("shows signed target context", () => assert.deepEqual(remainingNutrition(entries, { calories: 2200, protein: 180, carbs: 215, fat: 70 }), { calories: 900, protein: 80, carbs: 85, fat: 30 }));
  it("starts a week on Monday", () => assert.equal(weekStart(new Date(2026, 9, 4)).getDate(), 28));
});
