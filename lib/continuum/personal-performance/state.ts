import { PERFORMANCE_PARAMETERS } from "./program";

export type DayStatus = "completed" | "skipped";
export type Readiness = "ready" | "sore";

export type WeightEntry = {
  date: string;
  weight: number;
  waist?: number;
};

export type MealEntry = {
  id: string;
  name: string;
  calories: number;
  protein: number;
};

export type DayLog = {
  status?: DayStatus;
  readiness?: Readiness;
  exerciseNotes?: Record<string, string>;
};

export type PerformanceState = {
  version: 2;
  weights: WeightEntry[];
  days: Record<string, DayLog>;
  meals: Record<string, MealEntry[]>;
  parameters: {
    dailyCalories: number;
    dailyProteinG: number;
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isDateKey(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function finiteNumber(value: unknown, min: number, max: number): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max
    ? value
    : null;
}

export function createInitialPerformanceState(): PerformanceState {
  return {
    version: 2,
    weights: [],
    days: {},
    meals: {},
    parameters: {
      dailyCalories: PERFORMANCE_PARAMETERS.nutrition.dailyCalories,
      dailyProteinG: PERFORMANCE_PARAMETERS.nutrition.dailyProteinG,
    },
  };
}

function sanitizeWeights(value: unknown): WeightEntry[] {
  if (!Array.isArray(value)) return [];
  const byDate = new Map<string, WeightEntry>();
  for (const candidate of value) {
    if (!isRecord(candidate) || !isDateKey(candidate.date)) continue;
    if (candidate.date < PERFORMANCE_PARAMETERS.startDate) continue;
    const weight = finiteNumber(candidate.weight, 100, 400);
    const waist = candidate.waist === undefined
      ? undefined
      : finiteNumber(candidate.waist, 20, 80);
    if (weight === null || (candidate.waist !== undefined && waist === null)) continue;
    const entry: WeightEntry = {
      date: candidate.date,
      weight,
    };
    if (waist !== undefined && waist !== null) entry.waist = waist;
    byDate.set(candidate.date, entry);
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function sanitizeExerciseNotes(value: unknown): Record<string, string> | undefined {
  if (!isRecord(value)) return undefined;
  const notes = Object.fromEntries(
    Object.entries(value)
      .filter(([key, note]) => key.length <= 100 && typeof note === "string")
      .map(([key, note]) => [key, (note as string).slice(0, 240)]),
  );
  return Object.keys(notes).length ? notes : undefined;
}

function sanitizeDays(value: unknown): Record<string, DayLog> {
  if (!isRecord(value)) return {};
  const days: Record<string, DayLog> = {};
  for (const [date, candidate] of Object.entries(value)) {
    if (!isDateKey(date) || date < PERFORMANCE_PARAMETERS.startDate || !isRecord(candidate)) {
      continue;
    }
    const legacyComplete = candidate.complete === true;
    const status = candidate.status === "completed" || candidate.status === "skipped"
      ? candidate.status
      : legacyComplete
        ? "completed"
        : undefined;
    const readiness = candidate.readiness === "ready" || candidate.readiness === "sore"
      ? candidate.readiness
      : undefined;
    const exerciseNotes = sanitizeExerciseNotes(candidate.exerciseNotes);
    if (status || readiness || exerciseNotes) {
      days[date] = {
        ...(status ? { status } : {}),
        ...(readiness ? { readiness } : {}),
        ...(exerciseNotes ? { exerciseNotes } : {}),
      };
    }
  }
  return days;
}

function sanitizeMeals(value: unknown): Record<string, MealEntry[]> {
  if (!isRecord(value)) return {};
  const meals: Record<string, MealEntry[]> = {};
  for (const [date, candidates] of Object.entries(value)) {
    if (!isDateKey(date) || date < PERFORMANCE_PARAMETERS.startDate || !Array.isArray(candidates)) {
      continue;
    }
    const rows = candidates.flatMap((candidate): MealEntry[] => {
      if (!isRecord(candidate) || typeof candidate.name !== "string") return [];
      const calories = finiteNumber(candidate.calories, 0, 3000);
      const protein = finiteNumber(candidate.protein, 0, 250);
      if (calories === null || protein === null) return [];
      const name = candidate.name.trim().slice(0, 120);
      if (!name) return [];
      return [{
        id: typeof candidate.id === "string" && candidate.id.length <= 160
          ? candidate.id
          : `${date}-${rowsFallbackId(name, calories, protein)}`,
        name,
        calories,
        protein,
      }];
    });
    if (rows.length) meals[date] = rows.slice(0, 30);
  }
  return meals;
}

function rowsFallbackId(name: string, calories: number, protein: number): string {
  return `${name}-${calories}-${protein}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 80);
}

function sanitizeParameters(value: unknown): PerformanceState["parameters"] {
  const defaults = createInitialPerformanceState().parameters;
  if (!isRecord(value)) return defaults;
  return {
    dailyCalories: finiteNumber(value.dailyCalories, 1200, 5000) ?? defaults.dailyCalories,
    dailyProteinG: finiteNumber(value.dailyProteinG, 50, 300) ?? defaults.dailyProteinG,
  };
}

export function parsePerformanceState(value: unknown): PerformanceState | null {
  if (!isRecord(value) || (value.version !== 1 && value.version !== 2)) return null;
  return {
    version: 2,
    weights: sanitizeWeights(value.weights),
    days: sanitizeDays(value.days),
    meals: sanitizeMeals(value.meals),
    parameters: sanitizeParameters(value.parameters),
  };
}

export function rollingWeightAverage(
  entries: readonly WeightEntry[],
  windowSize = 7,
): number | null {
  if (!entries.length) return null;
  const window = entries.slice(-Math.max(1, windowSize));
  return window.reduce((sum, entry) => sum + entry.weight, 0) / window.length;
}
