import type { FrequentMeal, MealItem, MealLog, PersonalState } from "./types";

const RECENT_WINDOW_MS = 45 * 86_400_000;

function normalizedText(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

export function mealSignature(meal: Pick<MealLog, "items">): string {
  return meal.items.map((item) => `${normalizedText(item.name)}:${normalizedText(item.portion)}`).sort().join("|");
}

export function mealName(items: readonly MealItem[]): string {
  return items.map((item) => item.name.trim()).filter(Boolean).join(", ");
}

function cloneItems(items: readonly MealItem[], idPrefix: string): MealItem[] {
  return items.map((item, index) => ({ ...item, id: `${idPrefix}-${index}` }));
}

export function frequentFromMeal(meal: MealLog, now = new Date().toISOString()): FrequentMeal {
  return {
    id: `frequent-${meal.id}`,
    signature: mealSignature(meal),
    name: mealName(meal.items),
    mealType: meal.mealType,
    items: cloneItems(meal.items, `frequent-item-${meal.id}`),
    calories: meal.calories,
    protein: meal.protein,
    carbs: meal.carbs,
    fat: meal.fat,
    pinned: true,
    hidden: false,
    createdAt: now,
    updatedAt: now,
  };
}

export function saveMealAsFrequent(state: Pick<PersonalState, "meals" | "frequentMeals">, mealId: string, now = new Date().toISOString()): FrequentMeal[] {
  const meal = state.meals.find((candidate) => candidate.id === mealId);
  if (!meal) throw new Error("frequent-source-meal-not-found");
  const candidate = frequentFromMeal(meal, now);
  const existing = state.frequentMeals.find((item) => item.signature === candidate.signature);
  const saved = existing ? { ...candidate, id: existing.id, createdAt: existing.createdAt } : candidate;
  return [saved, ...state.frequentMeals.filter((item) => item.signature !== candidate.signature)];
}

export function frequentMealMutationKey(meal: MealLog): string {
  const value = JSON.stringify({ signature: mealSignature(meal), items: meal.items, mealType: meal.mealType, calories: meal.calories, protein: meal.protein, carbs: meal.carbs, fat: meal.fat });
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) hash = Math.imul(hash ^ value.charCodeAt(index), 16_777_619);
  return `save-frequent-${meal.id}-${(hash >>> 0).toString(36)}`;
}

export type FrequentMealCandidate = FrequentMeal & { useCount: number; lastUsedAt?: string; automatic: boolean };

export function deriveFrequentlyEaten(meals: readonly MealLog[], saved: readonly FrequentMeal[], now = new Date().toISOString()): FrequentMealCandidate[] {
  const groups = new Map<string, MealLog[]>();
  for (const meal of meals) {
    if (!meal.provenance.includes("user_confirmed")) continue;
    const signature = mealSignature(meal);
    if (!signature) continue;
    groups.set(signature, [...(groups.get(signature) ?? []), meal]);
  }
  const savedBySignature = new Map(saved.map((meal) => [meal.signature, meal]));
  const candidates = new Map<string, FrequentMealCandidate>();
  for (const [signature, occurrences] of groups) {
    const ordered = [...occurrences].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    const recentCount = ordered.filter((meal) => Date.parse(now) - Date.parse(meal.timestamp) <= RECENT_WINDOW_MS).length;
    const stored = savedBySignature.get(signature);
    if (!stored?.pinned && recentCount < 2 && occurrences.length < 3) continue;
    const canonicalMeal = ordered.find((meal) => !meal.frequentMealId) ?? ordered[0]!;
    const canonical = stored ?? { ...frequentFromMeal(canonicalMeal, canonicalMeal.timestamp), pinned: false };
    candidates.set(signature, { ...canonical, useCount: occurrences.length, lastUsedAt: ordered[0]?.timestamp, automatic: !stored });
  }
  for (const stored of saved) {
    if (stored.pinned && !candidates.has(stored.signature)) candidates.set(stored.signature, { ...stored, useCount: groups.get(stored.signature)?.length ?? 0, lastUsedAt: groups.get(stored.signature)?.sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0]?.timestamp, automatic: false });
  }
  return [...candidates.values()].filter((meal) => !meal.hidden).sort((a, b) => Number(b.pinned) - Number(a.pinned) || (b.lastUsedAt ?? b.updatedAt).localeCompare(a.lastUsedAt ?? a.updatedAt));
}

export function logFrequentMeal(frequent: FrequentMeal, timestamp: string, id: string): MealLog {
  const items = cloneItems(frequent.items, `relog-item-${id}`);
  return { id, timestamp, mealType: frequent.mealType, items, calories: frequent.calories, protein: frequent.protein, carbs: frequent.carbs, fat: frequent.fat, frequentMealId: frequent.id, provenance: ["user_confirmed"] };
}
