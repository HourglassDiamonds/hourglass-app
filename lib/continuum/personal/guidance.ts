import type { ActivityFacts, PersonalState } from "./types";

export function activityNutritionGuidance(facts: ActivityFacts, targets: PersonalState["nutritionTargets"]): string {
  const duration = facts.durationMinutes?.value ?? 0;
  const activity = facts.activityType.toLowerCase();
  const hard = /hard|interval|tempo|race|ruck|strength|tonal/.test(`${activity} ${facts.notes ?? ""}`);
  const substantial = duration >= 45 || (facts.distanceMiles?.value ?? 0) >= 4 || (facts.whoopStrain?.value ?? 0) >= 12;
  if (!hard && !substantial) {
    return `Keep the configured ${targets.calories.toLocaleString("en-US")} kcal and ${targets.protein} g protein targets. Hydrate and use normal hunger cues; no automatic calorie adjustment is warranted.`;
  }
  return `Keep ${targets.protein} g protein as the floor. This session may justify a modest carbohydrate-forward meal or snack around recovery, but do not automatically eat back all reported exercise calories or change the ${targets.calories.toLocaleString("en-US")} kcal target.`;
}
