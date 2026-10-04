import type { FoodEntry, NutritionTargets, PersonalState } from "./types";
export function isSameLocalDay(iso: string, date: Date) { const value = new Date(iso); return value.getFullYear() === date.getFullYear() && value.getMonth() === date.getMonth() && value.getDate() === date.getDate(); }
export function nutritionTotals(entries: FoodEntry[]) { return entries.reduce((total, entry) => ({ calories: total.calories + entry.calories, protein: total.protein + entry.protein, carbs: total.carbs + entry.carbs, fat: total.fat + entry.fat }), { calories: 0, protein: 0, carbs: 0, fat: 0 }); }
export function remainingNutrition(entries: FoodEntry[], targets: NutritionTargets) { const totals = nutritionTotals(entries); return { calories: targets.calories - totals.calories, protein: targets.protein - totals.protein, carbs: targets.carbs - totals.carbs, fat: targets.fat - totals.fat }; }
export function weekStart(date = new Date()) { const result = new Date(date); const day = result.getDay(); result.setHours(0, 0, 0, 0); result.setDate(result.getDate() - (day === 0 ? 6 : day - 1)); return result; }
export function weeklySummary(state: PersonalState, now = new Date()) {
  const start = weekStart(now); const end = new Date(start); end.setDate(end.getDate() + 7);
  const sessions = state.sessions.filter((item) => { const at = new Date(item.startedAt); return at >= start && at < end; });
  const foodDays = new Map<string, FoodEntry[]>();
  for (const entry of state.foodEntries) { const at = new Date(entry.timestamp); if (at < start || at >= end) continue; const key = `${at.getFullYear()}-${at.getMonth()}-${at.getDate()}`; foodDays.set(key, [...(foodDays.get(key) ?? []), entry]); }
  const dayTotals = [...foodDays.values()].map(nutritionTotals); const average = (key: "calories" | "protein") => dayTotals.length ? Math.round(dayTotals.reduce((sum, day) => sum + day[key], 0) / dayTotals.length) : 0;
  const weights = state.bodyMeasurements.filter((item) => { const at = new Date(item.timestamp); return at >= start && at < end; });
  return { planned: state.plans.length, completed: sessions.filter((item) => item.completedAt).length, averageCalories: average("calories"), averageProtein: average("protein"), weightChange: weights.length > 1 ? Number((weights.at(-1)!.weight - weights[0].weight).toFixed(1)) : null, loggedNutritionDays: dayTotals.length };
}
