import { createInitialPersonalState } from "./program";
import type { PersonalState } from "./types";

export function parsePersonalState(raw: string | null): PersonalState {
  const fallback = createInitialPersonalState();
  if (!raw) return fallback;
  try {
    const value = JSON.parse(raw) as Partial<PersonalState>;
    if (value.version !== 1) return fallback;
    return {
      ...fallback,
      ...value,
      plans: Array.isArray(value.plans) && value.plans.length ? value.plans : fallback.plans,
      sessions: Array.isArray(value.sessions) ? value.sessions : [],
      proposals: Array.isArray(value.proposals) ? value.proposals : [],
      foodEntries: Array.isArray(value.foodEntries) ? value.foodEntries : [],
      bodyMeasurements: Array.isArray(value.bodyMeasurements) ? value.bodyMeasurements : [],
    };
  } catch {
    return fallback;
  }
}
