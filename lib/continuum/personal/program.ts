import { createInitialTonalPlan, requiredTonalSessionCount, tonalEnrollmentReady, TONAL_PROGRAM_CATALOG, TONAL_PROGRESSION, verifiedTonalSessions } from "./tonal-programs";
import type { PersonalState, ScheduledWorkout, TonalProgramId, TonalProgramPlan, TonalProgramSource, TonalProgramTransition, WorkoutPrescription } from "./types";

const DAY_MS = 86_400_000;
export const PROGRAM_RESTART_DATE = "2026-10-12";
export const PROGRAM_TIME_ZONE = "America/New_York";
export const PROGRAM_HORIZON_DAYS = 4 * 7;

export function dateKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function shiftDate(key: string, days: number): string {
  const at = new Date(`${key}T12:00:00Z`);
  return new Date(at.valueOf() + days * DAY_MS).toISOString().slice(0, 10);
}

export function weekdayIndex(key: string): number {
  const day = new Date(`${key}T12:00:00Z`).getUTCDay();
  return day === 0 ? 6 : day - 1;
}

export function plannedWorkout(key: string, anchorDate = PROGRAM_RESTART_DATE, tonal = createInitialTonalPlan()): ScheduledWorkout {
  const prescription = programPrescription(key, anchorDate, tonal);
  return {
    id: `program-${key}-${prescription.id}`,
    date: key,
    originalDate: key,
    status: "planned",
    prescription,
    provenance: ["program"],
    history: [{ at: `${key}T05:00:00.000Z`, action: "planned", actor: "program", note: `Planned by ${prescription.trainingBlock}.` }],
  };
}

export function programWeek(key: string, anchorDate = PROGRAM_RESTART_DATE): number {
  if (key < anchorDate) return 0;
  const elapsed = Math.floor((Date.parse(`${key}T12:00:00Z`) - Date.parse(`${anchorDate}T12:00:00Z`)) / DAY_MS);
  return Math.floor(elapsed / 7) + 1;
}

function programPrescription(key: string, anchorDate: string, tonal: TonalProgramPlan): WorkoutPrescription {
  const week = programWeek(key, anchorDate);
  const day = weekdayIndex(key);
  const block = TONAL_PROGRAM_CATALOG[tonal.selectedProgramId];
  const base: Pick<WorkoutPrescription, "trainingBlock" | "exercises"> = { trainingBlock: `Week ${week} · ${block.title} + 5K development`, exercises: [] };
  const strengthDays = block.weeklyFrequency === 2 ? [0, 3] : [0, 1, 3, 4];
  const strengthDayIndex = strengthDays.indexOf(day);
  if (strengthDayIndex >= 0) {
    const order = (week - 1) * block.weeklyFrequency + strengthDayIndex + 1;
    const session = tonal.enrollment.sessions.find((candidate) => candidate.order === order);
    return {
      ...base,
      id: `tonal-${block.id}-${order}`,
      name: session?.title ? `${block.title} · ${session.title}` : `${block.title} · Session ${order} — title confirmation required`,
      domain: "strength", mode: "tonal", intent: "moderate", durationMinutes: block.sessionMinutes[1],
      notes: session?.title ? `Follow Tonal's verified session exactly with ${block.trainer}.` : "Do not activate or perform this slot from Continuum until its exact Tonal title is confirmed from the app or machine.",
      lowerBodyLoad: "moderate", tonalProgramId: block.id, tonalSessionOrder: order,
    };
  }
  if (block.weeklyFrequency === 2 && day === 1) return { ...base, id: "run-progression-a", name: "5K development · easy run/walk", domain: "engine", mode: "run", intent: "easy", durationMinutes: Math.min(36, 28 + (week - 1) * 2), notes: "Conversational effort. Preserve fresh legs after Monday strength; no hard intervals.", lowerBodyLoad: "moderate" };
  if (day === 2) return { ...base, id: "restore", name: "Recovery · walk + mobility", domain: "recovery", mode: "recovery", intent: "easy", durationMinutes: 25, notes: "Easy movement only. Recovery protects the next Tonal session.", lowerBodyLoad: "none" };
  if (block.weeklyFrequency === 2 && day === 4) return { ...base, id: "optional-conditioning", name: "Optional light conditioning / ruck", domain: "engine", mode: "ruck", intent: "easy", durationMinutes: 30, notes: "Optional only. Skip when Thursday strength or recovery signals warrant it; never convert this into a third heavy workout.", lowerBodyLoad: "low" };
  if (day === 5) return { ...base, id: "run-progression-b", name: "5K development · aerobic run/walk", domain: "engine", mode: "run", intent: "moderate", durationMinutes: Math.min(42, 34 + (week - 1) * 2), notes: "Controlled aerobic progression. Finish with energy in reserve.", lowerBodyLoad: "moderate" };
  return { ...base, id: "hard-rest", name: "Hard rest", domain: "recovery", mode: "recovery", intent: "easy", durationMinutes: 0, notes: "No catch-up workout. Begin Monday recovered.", lowerBodyLoad: "none" };
}

export function previewTrainingWeek(tonal: TonalProgramPlan, anchorDate: string): ScheduledWorkout[] {
  return Array.from({ length: 7 }, (_, offset) => plannedWorkout(shiftDate(anchorDate, offset), anchorDate, tonal));
}

export function createInitialPersonalState(today = dateKey()): PersonalState {
  void today;
  return {
    version: 3,
    program: { status: "setup", anchorVersion: 1, legacyAnchorDate: PROGRAM_RESTART_DATE },
    tonal: createInitialTonalPlan(),
    schedule: [],
    sessions: [],
    recoveryEntries: [],
    meals: [],
    activities: [],
    frequentMeals: [],
    progressionProposals: [],
    nutritionTargets: { calories: 2400, protein: 190, carbs: 240, fat: 80 },
  };
}

export function activateTrainingProgram(state: PersonalState, anchorDate: string, activatedAt = new Date().toISOString()): PersonalState {
  if (state.program.status !== "setup") throw new Error("performance-program-already-active");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(anchorDate) || weekdayIndex(anchorDate) !== 0) throw new Error("performance-program-start-must-be-monday");
  if (!tonalEnrollmentReady(state.tonal)) throw new Error("tonal-session-sequence-required");
  const block = TONAL_PROGRAM_CATALOG[state.tonal.selectedProgramId];
  const generated = Array.from({ length: block.durationWeeks * 7 }, (_, offset) => plannedWorkout(shiftDate(anchorDate, offset), anchorDate, state.tonal));
  const sessions = state.tonal.enrollment.sessions.map((session) => ({
    ...session,
    scheduledWorkoutId: generated.find((workout) => workout.prescription.tonalSessionOrder === session.order)?.id,
  }));
  if (sessions.length !== requiredTonalSessionCount(block.id) || sessions.some((session) => !session.scheduledWorkoutId)) throw new Error("tonal-session-schedule-invalid");
  const retainedIds = new Set(state.sessions.map((session) => session.scheduledWorkoutId));
  const historical = state.schedule.filter((workout) => workout.date < anchorDate && (retainedIds.has(workout.id) || !["planned", "unresolved"].includes(workout.status)));
  return {
    ...state,
    program: { status: "active", anchorVersion: 1, anchorDate, activatedAt, legacyAnchorDate: state.program.legacyAnchorDate || PROGRAM_RESTART_DATE },
    tonal: { ...state.tonal, enrollment: { ...state.tonal.enrollment, status: "active", startedOn: anchorDate, sessions } },
    schedule: [...historical, ...generated].sort((a, b) => a.date.localeCompare(b.date)),
    progressionProposals: state.progressionProposals.filter((proposal) => proposal.status !== "pending" && proposal.status !== "edited"),
  };
}

export function transitionTrainingProgram(state: PersonalState, input: {
  nextProgramId: TonalProgramId;
  startDate: string;
  sessionTitles: readonly string[];
  source: TonalProgramSource;
  readiness: TonalProgramTransition["readiness"];
  reviewedAt: string;
  approvedAt: string;
}): PersonalState {
  const current = state.tonal.enrollment;
  if (state.program.status !== "active" || current.status !== "completed") throw new Error("tonal-transition-requires-completion");
  const currentIndex = TONAL_PROGRESSION.indexOf(current.programId);
  if (TONAL_PROGRESSION[currentIndex + 1] !== input.nextProgramId) throw new Error("tonal-transition-order-invalid");
  if (!input.approvedAt || !input.reviewedAt) throw new Error("tonal-transition-founder-approval-required");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.startDate) || weekdayIndex(input.startDate) !== 0) throw new Error("performance-program-start-must-be-monday");
  const sessions = verifiedTonalSessions(input.nextProgramId, input.sessionTitles);
  const nextTonal: TonalProgramPlan = {
    ...state.tonal,
    selectedProgramId: input.nextProgramId,
    enrollment: { programId: input.nextProgramId, status: "active", sessions, sources: [input.source], founderVerifiedAt: input.approvedAt, startedOn: input.startDate },
    completedEnrollments: [...state.tonal.completedEnrollments, current],
    transitions: [...state.tonal.transitions, { from: current.programId, to: input.nextProgramId, reviewedAt: input.reviewedAt, approvedAt: input.approvedAt, readiness: input.readiness }],
  };
  const block = TONAL_PROGRAM_CATALOG[input.nextProgramId];
  const generated = Array.from({ length: block.durationWeeks * 7 }, (_, offset) => plannedWorkout(shiftDate(input.startDate, offset), input.startDate, nextTonal));
  nextTonal.enrollment.sessions = sessions.map((session) => ({ ...session, scheduledWorkoutId: generated.find((workout) => workout.prescription.tonalSessionOrder === session.order)?.id }));
  if (nextTonal.enrollment.sessions.some((session) => !session.scheduledWorkoutId)) throw new Error("tonal-session-schedule-invalid");
  const preserved = state.schedule.filter((workout) => workout.date < input.startDate || !["planned", "unresolved"].includes(workout.status));
  return { ...state, tonal: nextTonal, schedule: [...preserved, ...generated].sort((a, b) => a.date.localeCompare(b.date)) };
}
