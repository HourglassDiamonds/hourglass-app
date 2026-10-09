import type { ActivityFacts, ActivityLog, MealItem, MealLog, NaturalIngestionProposal, PersonalState } from "./types";

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

function finite(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}

export function validateMealItem(item: MealItem): string[] {
  const errors: string[] = [];
  if (!item.id || !item.name.trim() || item.name.length > 120) errors.push("meal-item-name");
  if (item.portion.length > 120) errors.push("meal-item-portion");
  if (!finite(item.calories, 0, 5_000)) errors.push("meal-item-calories");
  if (!finite(item.protein, 0, 500)) errors.push("meal-item-protein");
  if (!finite(item.carbs, 0, 800)) errors.push("meal-item-carbs");
  if (!finite(item.fat, 0, 500)) errors.push("meal-item-fat");
  return errors;
}

export function validateMealLog(meal: MealLog): string[] {
  const errors = meal.items.flatMap(validateMealItem);
  if (!meal.id || !meal.timestamp || !meal.items.length || meal.items.length > 20) errors.push("meal-shape");
  if (meal.occurredOn && !DATE_KEY.test(meal.occurredOn)) errors.push("meal-date");
  const sum = meal.items.reduce((total, item) => ({
    calories: total.calories + item.calories,
    protein: total.protein + item.protein,
    carbs: total.carbs + item.carbs,
    fat: total.fat + item.fat,
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
  for (const key of ["calories", "protein", "carbs", "fat"] as const) {
    if (Math.abs(sum[key] - meal[key]) > 0.01) errors.push(`meal-total-${key}`);
  }
  return [...new Set(errors)];
}

function metricErrors(facts: ActivityFacts): string[] {
  const errors: string[] = [];
  if (!facts.activityType.trim() || facts.activityType.length > 80) errors.push("activity-type");
  const ranges: Array<[keyof ActivityFacts, number, number]> = [
    ["durationMinutes", 0, 1_440], ["distanceMiles", 0, 500], ["averageSpeedMph", 0, 100],
    ["averageHeartRate", 20, 260], ["maxHeartRate", 20, 280], ["elevationFeet", 0, 100_000],
    ["reportedCalories", 0, 10_000], ["whoopStrain", 0, 21], ["steps", 0, 250_000], ["ruckWeightLb", 0, 250],
  ];
  for (const [key, min, max] of ranges) {
    const metric = facts[key];
    if (metric && typeof metric === "object" && "value" in metric && !finite(metric.value, min, max)) errors.push(`activity-${key}`);
  }
  if (facts.averageHeartRate && facts.maxHeartRate && facts.averageHeartRate.value > facts.maxHeartRate.value) errors.push("activity-heart-rate-order");
  return errors;
}

export function validateActivityLog(activity: ActivityLog): string[] {
  const errors = metricErrors(activity.facts);
  if (!activity.id || !activity.timestamp || !DATE_KEY.test(activity.occurredOn)) errors.push("activity-shape");
  if (!activity.idempotencyKey) errors.push("activity-idempotency");
  return [...new Set(errors)];
}

export function validateAcceptedProposal(proposal: NaturalIngestionProposal, accepted: MealLog | ActivityLog): string[] {
  if (proposal.kind === "meal") {
    if (!("items" in accepted)) return ["proposal-kind-mismatch"];
    return validateMealLog(accepted);
  }
  if (!("facts" in accepted)) return ["proposal-kind-mismatch"];
  return validateActivityLog(accepted);
}

export function validatePersonalState(state: PersonalState): string[] {
  const errors: string[] = [];
  if (state.version !== 3 || state.program.anchorDate !== "2026-10-12") errors.push("state-version");
  if (state.meals.length > 5_000 || state.activities.length > 5_000) errors.push("state-size");
  errors.push(...state.meals.flatMap(validateMealLog), ...state.activities.flatMap(validateActivityLog));
  if (!finite(state.nutritionTargets.calories, 500, 10_000) || !finite(state.nutritionTargets.protein, 0, 500)) errors.push("nutrition-targets");
  return [...new Set(errors)];
}
