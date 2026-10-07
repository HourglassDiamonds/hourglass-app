import { createInitialPersonalState, isRestDayWorkout, isSunday, nextTrainingDate, plannedWorkout, shiftDate } from "./program";
import {
  carryYesterdayUnresolvedToToday,
  deferAndReflow,
  FOUNDER_RUCK_ROLLOVER_RECONCILIATION,
  reconcileFounderRuckRollover,
} from "./adaptation";
import type { PersonalState, ScheduledWorkout } from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isWorkout(value: unknown): value is ScheduledWorkout {
  if (!isRecord(value) || !isRecord(value.prescription)) return false;
  return typeof value.id === "string" && typeof value.date === "string" && typeof value.originalDate === "string" &&
    ["planned", "unresolved", "in_progress", "completed", "deferred", "skipped", "replaced"].includes(String(value.status)) &&
    typeof value.prescription.name === "string" && Array.isArray(value.prescription.exercises) && Array.isArray(value.history);
}

export function parsePersonalState(raw: string | null, today: string): PersonalState {
  const fallback = createInitialPersonalState(today);
  if (!raw) return fallback;
  try {
    const value: unknown = JSON.parse(raw);
    if (!isRecord(value) || value.version !== 2) return fallback;
    return ensureSchedule({
      version: 2,
      appliedReconciliations: Array.isArray(value.appliedReconciliations)
        ? value.appliedReconciliations.filter((item): item is string => typeof item === "string").slice(0, 40)
        : [],
      schedule: Array.isArray(value.schedule) ? value.schedule.filter(isWorkout).slice(0, 120) : [],
      sessions: Array.isArray(value.sessions) ? value.sessions as PersonalState["sessions"] : [],
      recoveryEntries: Array.isArray(value.recoveryEntries) ? value.recoveryEntries as PersonalState["recoveryEntries"] : [],
      meals: Array.isArray(value.meals) ? value.meals as PersonalState["meals"] : [],
      frequentMeals: Array.isArray(value.frequentMeals) ? value.frequentMeals as PersonalState["frequentMeals"] : [],
      progressionProposals: Array.isArray(value.progressionProposals) ? value.progressionProposals as PersonalState["progressionProposals"] : [],
      nutritionTargets: isRecord(value.nutritionTargets)
        ? {
            calories: Number(value.nutritionTargets.calories) || fallback.nutritionTargets.calories,
            protein: Number(value.nutritionTargets.protein) || fallback.nutritionTargets.protein,
            carbs: Number(value.nutritionTargets.carbs) || fallback.nutritionTargets.carbs,
            fat: Number(value.nutritionTargets.fat) || fallback.nutritionTargets.fat,
          }
        : fallback.nutritionTargets,
    }, today);
  } catch {
    return fallback;
  }
}

export function migrateLegacyPersonalState(raw: string | null, today: string): PersonalState | null {
  if (!raw) return null;
  try {
    const legacy: unknown = JSON.parse(raw);
    if (!isRecord(legacy) || legacy.version !== 1) return null;
    const next = createInitialPersonalState(today);
    if (isRecord(legacy.nutritionTargets)) {
      next.nutritionTargets = {
        calories: Number(legacy.nutritionTargets.calories) || next.nutritionTargets.calories,
        protein: Number(legacy.nutritionTargets.protein) || next.nutritionTargets.protein,
        carbs: Number(legacy.nutritionTargets.carbs) || next.nutritionTargets.carbs,
        fat: Number(legacy.nutritionTargets.fat) || next.nutritionTargets.fat,
      };
    }
    if (Array.isArray(legacy.foodEntries)) {
      next.meals = legacy.foodEntries.flatMap((candidate, index) => {
        if (!isRecord(candidate) || typeof candidate.description !== "string" || typeof candidate.timestamp !== "string") return [];
        const item = {
          id: `legacy-item-${index}`,
          name: candidate.description.slice(0, 120),
          portion: typeof candidate.notes === "string" ? candidate.notes.slice(0, 80) : "",
          calories: Number(candidate.calories) || 0,
          protein: Number(candidate.protein) || 0,
          carbs: Number(candidate.carbs) || 0,
          fat: Number(candidate.fat) || 0,
          confidence: "high" as const,
        };
        return [{
          id: typeof candidate.id === "string" ? candidate.id : `legacy-meal-${index}`,
          timestamp: candidate.timestamp,
          mealType: ["breakfast", "lunch", "dinner", "snack"].includes(String(candidate.meal)) ? candidate.meal as "breakfast" | "lunch" | "dinner" | "snack" : undefined,
          items: [item],
          calories: item.calories,
          protein: item.protein,
          carbs: item.carbs,
          fat: item.fat,
          photo: typeof candidate.imageName === "string" ? { name: candidate.imageName, type: "legacy", size: 0 } : undefined,
          provenance: ["user_confirmed" as const],
        }];
      });
    }
    if (Array.isArray(legacy.bodyMeasurements)) {
      next.recoveryEntries = legacy.bodyMeasurements.flatMap((candidate, index) => {
        if (!isRecord(candidate) || typeof candidate.timestamp !== "string" || !Number.isFinite(Number(candidate.weight))) return [];
        return [{
          id: typeof candidate.id === "string" ? candidate.id : `legacy-weight-${index}`,
          date: candidate.timestamp.slice(0, 10),
          recordedAt: candidate.timestamp,
          bodyweightLb: { value: Number(candidate.weight), source: "manual" as const },
          provenance: ["manual_recovery" as const, "user_confirmed" as const],
        }];
      });
    }
    if (Array.isArray(legacy.sessions)) {
      for (const [index, candidate] of legacy.sessions.entries()) {
        if (!isRecord(candidate) || typeof candidate.startedAt !== "string") continue;
        const sessionDate = candidate.startedAt.slice(0, 10);
        const workout = next.schedule.find((item) => item.originalDate === sessionDate);
        if (!workout) continue;
        next.sessions.push({
          id: typeof candidate.id === "string" ? candidate.id : `legacy-session-${index}`,
          scheduledWorkoutId: workout.id,
          startedAt: candidate.startedAt,
          completedAt: typeof candidate.completedAt === "string" ? candidate.completedAt : undefined,
          perceivedEffort: Number.isFinite(Number(candidate.perceivedEffort)) ? Number(candidate.perceivedEffort) : undefined,
          notes: typeof candidate.notes === "string" ? candidate.notes : undefined,
          sets: Array.isArray(candidate.sets) ? candidate.sets as PersonalState["sessions"][number]["sets"] : [],
        });
        workout.status = typeof candidate.completedAt === "string" ? "completed" : "in_progress";
        workout.provenance = [...new Set([...workout.provenance, "user" as const])];
      }
    }
    return next;
  } catch {
    return null;
  }
}

export function ensureSchedule(state: PersonalState, today: string): PersonalState {
  const schedule = [...state.schedule];
  for (let offset = 0; offset < 14; offset += 1) {
    const key = shiftDate(today, offset);
    if (!schedule.some((workout) => workout.originalDate === key)) schedule.push(plannedWorkout(key));
  }
  const sundaySafe = enforceSundayRest(schedule, new Date().toISOString());
  const rolled = rolloverUnresolved(
    { ...state, schedule: sundaySafe.sort((a, b) => a.date.localeCompare(b.date)) },
    today,
  );
  let reconciled = rolled;
  if (!rolled.appliedReconciliations.includes(FOUNDER_RUCK_ROLLOVER_RECONCILIATION)) {
    const schedule = reconcileFounderRuckRollover(rolled.schedule, today);
    if (schedule) {
      reconciled = {
        ...rolled,
        schedule,
        appliedReconciliations: [
          ...rolled.appliedReconciliations,
          FOUNDER_RUCK_ROLLOVER_RECONCILIATION,
        ],
      };
    }
  }
  return {
    ...reconciled,
    schedule: carryYesterdayUnresolvedToToday(reconciled.schedule, today),
  };
}

export function rolloverUnresolved(state: PersonalState, today: string, now = new Date().toISOString()): PersonalState {
  return {
    ...state,
    schedule: state.schedule.map((workout) => workout.date < today && workout.status === "planned" && !isSunday(workout.date) && !isRestDayWorkout(workout)
      ? {
          ...workout,
          status: "unresolved" as const,
          provenance: [...new Set([...workout.provenance, "user" as const])],
          history: [...workout.history, { at: now, action: "rolled_unresolved" as const, actor: "system" as const, note: "Midnight passed without a resolution; the workout remains planned / unresolved." }],
        }
      : workout),
  };
}

function isSupersededSundayProgramWorkout(workout: ScheduledWorkout): boolean {
  return isSunday(workout.date) &&
    workout.originalDate === workout.date &&
    workout.provenance.includes("program") &&
    !workout.replacesWorkoutId &&
    workout.history.every((event) => event.action === "planned" || event.action === "rolled_unresolved");
}

function isExplicitSundayRecovery(workout: ScheduledWorkout): boolean {
  return workout.prescription.domain === "recovery" &&
    workout.prescription.mode === "recovery" &&
    (workout.provenance.includes("user") || workout.provenance.includes("user_confirmed"));
}

export function enforceSundayRest(
  schedule: readonly ScheduledWorkout[],
  now = new Date().toISOString(),
): ScheduledWorkout[] {
  let next = schedule.map((workout) => structuredClone(workout));
  const activeSundayTraining = next.filter(
    (workout) =>
      isSunday(workout.date) &&
      !isRestDayWorkout(workout) &&
      !isExplicitSundayRecovery(workout) &&
      (workout.status === "planned" || workout.status === "unresolved"),
  );
  for (const workout of activeSundayTraining) {
    if (isSupersededSundayProgramWorkout(workout)) {
      next = next.filter((item) => item.id !== workout.id);
      if (!next.some((item) => item.date === workout.date && isRestDayWorkout(item))) {
        next.push(plannedWorkout(workout.date));
      }
      continue;
    }
    next = deferAndReflow(next, workout.id, nextTrainingDate(workout.date), now, "sterling");
  }
  return next.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}
