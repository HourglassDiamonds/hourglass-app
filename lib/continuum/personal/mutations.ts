import { activityNutritionGuidance } from "./guidance";
import type { ActivityFacts, ActivityLog, AuditFact, MealItem, MealLog, NaturalIngestionProposal, PersonalState, SourceReference } from "./types";
import { validateAcceptedProposal } from "./validation";
import { compareActivityDate } from "./activity-date";

function totals(items: readonly MealItem[]) {
  return items.reduce((sum, item) => ({ calories: sum.calories + item.calories, protein: sum.protein + item.protein, carbs: sum.carbs + item.carbs, fat: sum.fat + item.fat }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
}

function corrections(original: unknown, accepted: unknown): AuditFact[] {
  if (!original || !accepted || typeof original !== "object" || typeof accepted !== "object") return [];
  const before = original as Record<string, unknown>; const after = accepted as Record<string, unknown>;
  return Object.keys(after).flatMap((field) => JSON.stringify(before[field]) === JSON.stringify(after[field]) ? [] : [{ field, from: before[field], to: after[field] }]);
}

export function hasAcceptedMutation(state: PersonalState, idempotencyKey: string): boolean {
  return state.meals.some((meal) => meal.idempotencyKey === idempotencyKey) || state.activities.some((activity) => activity.idempotencyKey === idempotencyKey);
}

export function buildAcceptedMeal(input: {
  proposal: Extract<NaturalIngestionProposal, { kind: "meal" }>;
  items: MealItem[];
  mealType?: MealLog["mealType"];
  occurredOn: string;
  timestamp: string;
  id: string;
  idempotencyKey: string;
  source?: SourceReference;
}): MealLog {
  const sum = totals(input.items);
  return {
    id: input.id, timestamp: input.timestamp, occurredOn: input.occurredOn, mealType: input.mealType,
    items: input.items, ...sum, photo: input.source, sourceType: input.proposal.sourceType,
    rawInput: input.proposal.rawInput, aiEstimate: input.proposal.meal, sterlingProposal: input.proposal,
    assumptions: input.proposal.assumptions,
    corrections: corrections(input.proposal.meal.items, input.items), idempotencyKey: input.idempotencyKey,
    provenance: ["sterling", "ai_meal_estimate", "user_confirmed"],
  };
}

export function buildAcceptedActivity(input: {
  proposal: Extract<NaturalIngestionProposal, { kind: "activity" }>;
  facts: ActivityFacts;
  originalFacts?: ActivityFacts;
  occurredOn: string;
  timestamp: string;
  id: string;
  idempotencyKey: string;
  source?: SourceReference;
  targets: PersonalState["nutritionTargets"];
  dateConflictConfirmed?: boolean;
}): ActivityLog {
  const dateConflict = compareActivityDate(input.proposal.sourceDate, input.occurredOn) === "conflict";
  if (dateConflict && !input.dateConflictConfirmed) throw new Error("activity-date-confirmation-required");
  const dateCorrection: AuditFact[] = dateConflict
    ? [{ field: "occurredOn", from: input.proposal.sourceDate, to: input.occurredOn }]
    : [];
  return {
    id: input.id, timestamp: input.timestamp, occurredOn: input.occurredOn, facts: input.facts,
    rawInput: input.proposal.rawInput, sourceType: input.proposal.sourceType, source: input.source,
    sterlingProposal: input.proposal, assumptions: input.proposal.assumptions,
    corrections: [...corrections(input.originalFacts ?? input.proposal.activity, input.facts), ...dateCorrection],
    guidance: activityNutritionGuidance(input.facts, input.targets), idempotencyKey: input.idempotencyKey,
    provenance: ["sterling", "user_confirmed"],
  };
}

export function acceptActivityProposal(state: PersonalState, proposal: Extract<NaturalIngestionProposal, { kind: "activity" }>, accepted: ActivityLog[]): PersonalState {
  if (!accepted.length) throw new Error("activity-required");
  const idempotencyKey = accepted[0]?.idempotencyKey;
  if (!idempotencyKey || accepted.some((activity) => activity.idempotencyKey !== idempotencyKey)) throw new Error("idempotency-required");
  if (hasAcceptedMutation(state, idempotencyKey)) return state;
  const errors = accepted.flatMap((activity) => validateAcceptedProposal(proposal, activity));
  if (errors.length) throw new Error(`invalid-accepted-proposal:${[...new Set(errors)].join(",")}`);
  return { ...state, activities: [...accepted, ...state.activities] };
}

export function correctActivityDate(state: PersonalState, activityId: string, occurredOn: string): { state: PersonalState; activity: ActivityLog } {
  const existing = state.activities.find((activity) => activity.id === activityId);
  if (!existing) throw new Error("activity-not-found");
  if (existing.occurredOn === occurredOn) return { state, activity: existing };
  const activity: ActivityLog = {
    ...existing,
    occurredOn,
    corrections: [...existing.corrections, { field: "occurredOn", from: existing.occurredOn, to: occurredOn }],
    provenance: [...new Set([...existing.provenance, "user_confirmed" as const])],
  };
  return { state: { ...state, activities: state.activities.map((item) => item.id === activityId ? activity : item) }, activity };
}

export function acceptProposal(state: PersonalState, proposal: NaturalIngestionProposal, accepted: MealLog | ActivityLog): PersonalState {
  const idempotencyKey = "idempotencyKey" in accepted ? accepted.idempotencyKey : undefined;
  if (!idempotencyKey) throw new Error("idempotency-required");
  if (hasAcceptedMutation(state, idempotencyKey)) return state;
  const errors = validateAcceptedProposal(proposal, accepted);
  if (errors.length) throw new Error(`invalid-accepted-proposal:${errors.join(",")}`);
  return proposal.kind === "meal"
    ? { ...state, meals: [accepted as MealLog, ...state.meals] }
    : { ...state, activities: [accepted as ActivityLog, ...state.activities] };
}
