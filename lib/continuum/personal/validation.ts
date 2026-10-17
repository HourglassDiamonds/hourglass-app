import type { ActivityFacts, ActivityLog, MealItem, MealLog, NaturalIngestionProposal, PersonalState } from "./types";
import { compareActivityDate } from "./activity-date";
import { requiredTonalSessionCount, tonalEnrollmentReady, TONAL_PROGRESSION } from "./tonal-programs";

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
  if (facts.workoutTitle && facts.workoutTitle.length > 160) errors.push("activity-workout-title");
  if (facts.trainer && facts.trainer.length > 120) errors.push("activity-trainer");
  if (facts.tonalProgramTitle && facts.tonalProgramTitle.length > 160) errors.push("activity-tonal-program");
  if (facts.tonalMovements && (facts.tonalMovements.length > 40 || facts.tonalMovements.some((movement) => !movement.name.trim() || movement.name.length > 120 || movement.sets !== undefined && (!Number.isSafeInteger(movement.sets) || movement.sets < 1)))) errors.push("activity-tonal-movements");
  const ranges: Array<[keyof ActivityFacts, number, number]> = [
    ["durationMinutes", 0, 1_440], ["distanceMiles", 0, 500], ["averageSpeedMph", 0, 100],
    ["averageHeartRate", 20, 260], ["maxHeartRate", 20, 280], ["elevationFeet", 0, 100_000],
    ["reportedCalories", 0, 10_000], ["whoopStrain", 0, 21], ["steps", 0, 250_000], ["ruckWeightLb", 0, 250],
    ["tonalSessionOrder", 1, 500], ["totalVolumeLb", 0, 10_000_000], ["maxResistanceLb", 0, 500], ["completedSets", 0, 1_000], ["completedReps", 0, 10_000],
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
  if (activity.sterlingProposal?.kind === "activity" && compareActivityDate(activity.sterlingProposal.sourceDate, activity.occurredOn) === "conflict"
    && !activity.corrections.some((correction) => correction.field === "occurredOn" && correction.to === activity.occurredOn)) errors.push("activity-date-confirmation");
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
  if (state.version !== 3 || !["setup", "active"].includes(state.program.status) || state.program.anchorVersion !== 1 || state.program.legacyAnchorDate !== "2026-10-12") errors.push("state-version");
  if (state.program.status === "setup" && (state.program.anchorDate || state.program.activatedAt)) errors.push("program-setup-state");
  if (state.program.status === "setup" && state.schedule.some((workout) => ["planned", "unresolved"].includes(workout.status))) errors.push("program-setup-schedule");
  if (state.program.status === "active" && (!state.program.anchorDate || !DATE_KEY.test(state.program.anchorDate) || new Date(`${state.program.anchorDate}T12:00:00Z`).getUTCDay() !== 1 || !state.program.activatedAt)) errors.push("program-active-state");
  if (!state.tonal || !TONAL_PROGRESSION.includes(state.tonal.selectedProgramId) || state.tonal.enrollment.programId !== state.tonal.selectedProgramId) errors.push("tonal-program-identity");
  else {
    if (![2, 3, 4].includes(state.tonal.enrollment.weeklyFrequency) || state.tonal.enrollment.sessions.length > requiredTonalSessionCount(state.tonal.selectedProgramId, state.tonal.enrollment.weeklyFrequency)) errors.push("tonal-session-count");
    if (state.tonal.enrollment.sessions.some((session, index) => session.order !== index + 1 || session.title && session.title.length > 160 || session.movements.length > 40 || session.movements.some((movement) => !movement.name.trim() || movement.name.length > 120))) errors.push("tonal-session-shape");
    if (state.tonal.enrollment.founderVerifiedAt && !tonalEnrollmentReady(state.tonal)) errors.push("tonal-session-sequence");
    if (state.program.status === "active" && (!tonalEnrollmentReady(state.tonal) || !["active", "completed", "paused"].includes(state.tonal.enrollment.status))) errors.push("tonal-active-state");
    if (state.program.status === "setup" && state.tonal.enrollment.status !== "setup") errors.push("tonal-setup-state");
    if (state.tonal.completedEnrollments.some((enrollment) => enrollment.status !== "completed" || !enrollment.completedAt)) errors.push("tonal-completed-history");
  }
  if (state.meals.length > 5_000 || state.activities.length > 5_000) errors.push("state-size");
  errors.push(...state.meals.flatMap(validateMealLog), ...state.activities.flatMap(validateActivityLog));
  if (!finite(state.nutritionTargets.calories, 500, 10_000) || !finite(state.nutritionTargets.protein, 0, 500)) errors.push("nutrition-targets");
  return [...new Set(errors)];
}
