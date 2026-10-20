import { shiftDate, weekdayIndex } from "./program";
import type { MealItem, PersonalState } from "./types";

export type MacroTotals = { calories: number; protein: number; carbs: number; fat: number };

export function mondayFor(key: string): string {
  return shiftDate(key, -weekdayIndex(key));
}

export function weekDateKeys(monday: string): string[] {
  return Array.from({ length: 7 }, (_, offset) => shiftDate(monday, offset));
}

export function mealDate(meal: PersonalState["meals"][number]): string {
  return meal.occurredOn ?? meal.timestamp.slice(0, 10);
}

export function sumMealItems(items: readonly MealItem[]): MacroTotals {
  return items.reduce((sum, item) => ({
    calories: sum.calories + item.calories,
    protein: sum.protein + item.protein,
    carbs: sum.carbs + item.carbs,
    fat: sum.fat + item.fat,
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
}

export function targetsForDate(state: PersonalState, date: string): MacroTotals {
  const historical = [...(state.nutritionTargetHistory ?? [])]
    .filter((entry) => entry.effectiveOn <= date)
    .sort((left, right) => right.effectiveOn.localeCompare(left.effectiveOn))[0];
  return historical
    ? { calories: historical.calories, protein: historical.protein, carbs: historical.carbs, fat: historical.fat }
    : state.nutritionTargets;
}

export function dayRecord(state: PersonalState, date: string) {
  const meals = state.meals.filter((meal) => mealDate(meal) === date);
  const workouts = state.schedule.filter((workout) => workout.date === date && workout.status !== "replaced");
  const activities = state.activities.filter((activity) => activity.occurredOn === date);
  const consumed = sumMealItems(meals.flatMap((meal) => meal.items));
  const targets = targetsForDate(state, date);
  return {
    date,
    meals,
    workouts,
    activities,
    activityCount: workouts.length + activities.filter((activity) => !activity.scheduledWorkoutId).length,
    recovery: state.recoveryEntries.find((entry) => entry.date === date),
    consumed,
    targets,
    remaining: {
      calories: targets.calories - consumed.calories,
      protein: targets.protein - consumed.protein,
      carbs: targets.carbs - consumed.carbs,
      fat: targets.fat - consumed.fat,
    },
  };
}

export function weekRecords(state: PersonalState, monday: string) {
  return weekDateKeys(monday).map((date) => dayRecord(state, date));
}
