import { createInitialPersonalState, PROGRAM_RESTART_DATE } from "./program";
import { createInitialTonalPlan, TONAL_PROGRESSION } from "./tonal-programs";
import type { PersonalState, ScheduledWorkout, TonalProgramId, TonalProgramPlan } from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isWorkout(value: unknown): value is ScheduledWorkout {
  if (!isRecord(value) || !isRecord(value.prescription)) return false;
  return typeof value.id === "string" && typeof value.date === "string" && typeof value.originalDate === "string" &&
    ["planned", "unresolved", "in_progress", "completed", "deferred", "skipped", "replaced"].includes(String(value.status)) &&
    typeof value.prescription.name === "string" && Array.isArray(value.prescription.exercises) && Array.isArray(value.history);
}

function parseTonalPlan(value: unknown): TonalProgramPlan {
  const fallback = createInitialTonalPlan();
  if (!isRecord(value) || !TONAL_PROGRESSION.includes(value.selectedProgramId as TonalProgramId) || !isRecord(value.enrollment)) return fallback;
  const enrollment = value.enrollment;
  if (!TONAL_PROGRESSION.includes(enrollment.programId as TonalProgramId) || !["setup", "active", "completed", "paused"].includes(String(enrollment.status))) return fallback;
  const sessions = Array.isArray(enrollment.sessions) ? enrollment.sessions.flatMap((candidate) => {
    if (!isRecord(candidate) || !Number.isSafeInteger(candidate.order) || Number(candidate.order) < 1) return [];
    const movements = Array.isArray(candidate.movements) ? candidate.movements.flatMap((movement) => {
      if (!isRecord(movement) || typeof movement.name !== "string" || !movement.name.trim()) return [];
      return [{ name: movement.name.slice(0, 120), sets: Number.isSafeInteger(movement.sets) && Number(movement.sets) > 0 ? Number(movement.sets) : undefined, reps: typeof movement.reps === "string" ? movement.reps.slice(0, 80) : undefined, prescribedResistance: typeof movement.prescribedResistance === "string" ? movement.prescribedResistance.slice(0, 80) : undefined, details: typeof movement.details === "string" ? movement.details.slice(0, 240) : undefined }];
    }) : [];
    const plannedSource = isRecord(candidate.plannedSource) && ["tonal_app_screenshot", "tonal_link", "founder_confirmed"].includes(String(candidate.plannedSource.kind)) && typeof candidate.plannedSource.reference === "string" && typeof candidate.plannedSource.reviewedAt === "string"
      ? { kind: candidate.plannedSource.kind as "tonal_app_screenshot" | "tonal_link" | "founder_confirmed", reference: candidate.plannedSource.reference.slice(0, 500), reviewedAt: candidate.plannedSource.reviewedAt, digest: typeof candidate.plannedSource.digest === "string" ? candidate.plannedSource.digest : undefined, file: isRecord(candidate.plannedSource.file) && typeof candidate.plannedSource.file.name === "string" && typeof candidate.plannedSource.file.type === "string" && typeof candidate.plannedSource.file.size === "number" ? { name: candidate.plannedSource.file.name, type: candidate.plannedSource.file.type, size: candidate.plannedSource.file.size, storagePath: typeof candidate.plannedSource.file.storagePath === "string" ? candidate.plannedSource.file.storagePath : undefined } : undefined }
      : undefined;
    return [{ order: Number(candidate.order), title: typeof candidate.title === "string" && candidate.title.trim() ? candidate.title.slice(0, 160) : undefined, movements, plannedAt: typeof candidate.plannedAt === "string" ? candidate.plannedAt : undefined, plannedSource, scheduledWorkoutId: typeof candidate.scheduledWorkoutId === "string" ? candidate.scheduledWorkoutId : undefined, completedActivityId: typeof candidate.completedActivityId === "string" ? candidate.completedActivityId : undefined }];
  }) : [];
  const sources = Array.isArray(enrollment.sources) ? enrollment.sources.flatMap((candidate) => {
    if (!isRecord(candidate) || !["tonal_app_screenshot", "tonal_link", "founder_confirmed"].includes(String(candidate.kind)) || typeof candidate.reference !== "string" || typeof candidate.reviewedAt !== "string") return [];
    return [{ kind: candidate.kind as "tonal_app_screenshot" | "tonal_link" | "founder_confirmed", reference: candidate.reference.slice(0, 500), reviewedAt: candidate.reviewedAt, digest: typeof candidate.digest === "string" ? candidate.digest : undefined, file: isRecord(candidate.file) && typeof candidate.file.name === "string" && typeof candidate.file.type === "string" && typeof candidate.file.size === "number" ? { name: candidate.file.name, type: candidate.file.type, size: candidate.file.size, storagePath: typeof candidate.file.storagePath === "string" ? candidate.file.storagePath : undefined } : undefined }];
  }) : [];
  return {
    progression: [...TONAL_PROGRESSION],
    selectedProgramId: value.selectedProgramId as TonalProgramId,
    enrollment: {
      programId: enrollment.programId as TonalProgramId,
      weeklyFrequency: [2, 3, 4].includes(Number(enrollment.weeklyFrequency)) ? Number(enrollment.weeklyFrequency) as 2 | 3 | 4 : fallback.enrollment.weeklyFrequency,
      status: enrollment.status as "setup" | "active" | "completed" | "paused",
      sessions,
      sources,
      founderVerifiedAt: typeof enrollment.founderVerifiedAt === "string" ? enrollment.founderVerifiedAt : undefined,
      startedOn: typeof enrollment.startedOn === "string" ? enrollment.startedOn : undefined,
      completedAt: typeof enrollment.completedAt === "string" ? enrollment.completedAt : undefined,
    },
    completedEnrollments: Array.isArray(value.completedEnrollments)
      ? value.completedEnrollments.flatMap((candidate) => {
        const parsed = parseTonalPlan({
          selectedProgramId: isRecord(candidate) ? candidate.programId : undefined,
          enrollment: candidate,
          completedEnrollments: [],
          transitions: [],
        }).enrollment;
        return parsed.status === "completed" ? [parsed] : [];
      })
      : [],
    transitions: Array.isArray(value.transitions) ? value.transitions as TonalProgramPlan["transitions"] : [],
  };
}

export function parsePersonalState(raw: string | null, today: string): PersonalState {
  const fallback = createInitialPersonalState(today);
  if (!raw) return fallback;
  try {
    const value: unknown = JSON.parse(raw);
    if (!isRecord(value) || (value.version !== 2 && value.version !== 3)) return fallback;
    const schedule = Array.isArray(value.schedule) ? value.schedule.filter(isWorkout).slice(0, 120) : [];
    const rawProgram = value.version === 3 && isRecord(value.program) ? value.program : null;
    const tonal = parseTonalPlan(value.tonal);
    const active = rawProgram?.status === "active" && typeof rawProgram.anchorDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(rawProgram.anchorDate) && typeof rawProgram.activatedAt === "string" && ["active", "completed", "paused"].includes(tonal.enrollment.status);
    const next: PersonalState = {
      version: 3,
      program: active
        ? { status: "active", anchorDate: rawProgram.anchorDate as string, activatedAt: rawProgram.activatedAt as string, anchorVersion: 1, legacyAnchorDate: PROGRAM_RESTART_DATE }
        : { status: "setup", anchorVersion: 1, legacyAnchorDate: PROGRAM_RESTART_DATE },
      tonal: active ? tonal : { ...tonal, enrollment: { ...tonal.enrollment, status: "setup", startedOn: undefined, completedAt: undefined } },
      schedule: active ? schedule : preserveHistoricalSchedule(schedule, value.sessions),
      sessions: Array.isArray(value.sessions) ? value.sessions as PersonalState["sessions"] : [],
      recoveryEntries: Array.isArray(value.recoveryEntries) ? value.recoveryEntries as PersonalState["recoveryEntries"] : [],
      meals: Array.isArray(value.meals) ? value.meals as PersonalState["meals"] : [],
      activities: Array.isArray(value.activities) ? value.activities as PersonalState["activities"] : [],
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
    };
    return ensureSchedule(next, today);
  } catch {
    return fallback;
  }
}

function preserveHistoricalSchedule(schedule: ScheduledWorkout[], rawSessions: unknown): ScheduledWorkout[] {
  const sessionWorkoutIds = new Set(Array.isArray(rawSessions) ? rawSessions.flatMap((session) => isRecord(session) && typeof session.scheduledWorkoutId === "string" ? [session.scheduledWorkoutId] : []) : []);
  return schedule.filter((workout) => sessionWorkoutIds.has(workout.id) || !["planned", "unresolved"].includes(workout.status));
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
  if (state.program.status !== "active" || !state.program.anchorDate) return { ...state, schedule: preserveHistoricalSchedule(state.schedule, state.sessions) };
  return rolloverUnresolved(state, today);
}

export function rolloverUnresolved(state: PersonalState, today: string, now = new Date().toISOString()): PersonalState {
  if (state.program.status !== "active" || !state.program.anchorDate) return state;
  return {
    ...state,
    schedule: state.schedule.map((workout) => workout.date < today && workout.status === "planned" && workout.originalDate >= state.program.anchorDate!
      ? {
          ...workout,
          status: "unresolved" as const,
          provenance: [...new Set([...workout.provenance, "user" as const])],
          history: [...workout.history, { at: now, action: "rolled_unresolved" as const, actor: "system" as const, note: "Midnight passed without a resolution; the workout remains planned / unresolved." }],
        }
      : workout),
  };
}
