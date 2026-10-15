import type { PersonalState, ScheduledWorkout, WorkoutPrescription } from "./types";

const DAY_MS = 86_400_000;
export const PROGRAM_RESTART_DATE = "2026-10-12";
export const PROGRAM_TIME_ZONE = "America/New_York";
export const PROGRAM_HORIZON_DAYS = 12 * 7;

export const WEEKLY_PROGRAM: readonly WorkoutPrescription[] = [
  {
    id: "foundation-a", name: "Foundation A · Tonal strength", domain: "strength", mode: "tonal", intent: "moderate", durationMinutes: 45,
    notes: "Full-body strength. Leave 2–3 clean reps in reserve.", trainingBlock: "Foundation · sustainable strength + 5K", lowerBodyLoad: "moderate",
    exercises: [
      { id: "front-squat", name: "Tonal front squat", equipment: "Tonal", sets: 3, targetReps: [8, 10], targetLoad: 40, notes: "Brace first; keep every rep clean.", progressionContext: "Add the smallest load only after all sets reach 10 with 2 RIR." },
      { id: "bench", name: "Tonal bench press", equipment: "Tonal + bench", sets: 3, targetReps: [8, 12], targetLoad: 35, notes: "Stop before form changes.", progressionContext: "Build reps before load." },
      { id: "pulldown", name: "Tonal lat pulldown", equipment: "Tonal bar", sets: 3, targetReps: [8, 12], targetLoad: 40, notes: "Pull elbows down without leaning back.", progressionContext: "Build clean reps before load." },
    ],
  },
  {
    id: "foundation-b", name: "Foundation B · hinge + pull", domain: "strength", mode: "tonal", intent: "moderate", durationMinutes: 45,
    notes: "Hinge, press, row, and trunk work without grinding.", trainingBlock: "Foundation · sustainable strength + 5K", lowerBodyLoad: "high",
    exercises: [
      { id: "rdl", name: "Tonal Romanian deadlift", equipment: "Tonal bar", sets: 3, targetReps: [8, 10], targetLoad: 45, notes: "Hips back; stop at the hamstring limit.", progressionContext: "Hold when recovery is poor; never chase missed volume." },
      { id: "press", name: "Tonal standing press", equipment: "Tonal handles", sets: 3, targetReps: [8, 12], targetLoad: 20, notes: "Ribs stacked; no backbend.", progressionContext: "Build reps before load." },
      { id: "row", name: "Tonal seated row", equipment: "Tonal", sets: 3, targetReps: [10, 12], targetLoad: 35, notes: "Finish with elbows, not momentum.", progressionContext: "Add load after three clean top-range sets." },
    ],
  },
  {
    id: "restore", name: "Restore · walk + mobility", domain: "recovery", mode: "recovery", intent: "easy", durationMinutes: 25,
    notes: "Easy movement only. Recovery creates room to progress.", trainingBlock: "Foundation · sustainable strength + 5K", lowerBodyLoad: "none", exercises: [],
  },
  {
    id: "foundation-c", name: "Foundation C · full body", domain: "strength", mode: "tonal", intent: "moderate", durationMinutes: 46,
    notes: "Finish the strength week with crisp volume, not failure.", trainingBlock: "Foundation · sustainable strength + 5K", lowerBodyLoad: "moderate",
    exercises: [
      { id: "split-squat", name: "Tonal split squat", equipment: "Tonal handles", sets: 3, targetReps: [8, 10], targetLoad: 20, notes: "Use a short stable stance and control the descent.", progressionContext: "Build clean reps before load." },
      { id: "chest-press", name: "Tonal standing chest press", equipment: "Tonal handles", sets: 3, targetReps: [10, 12], targetLoad: 25, notes: "Staggered stance; resist rotation.", progressionContext: "Progress only after repeatable top-range sets." },
      { id: "pullover", name: "Tonal pullover", equipment: "Tonal rope", sets: 3, targetReps: [10, 15], targetLoad: 25, notes: "Keep ribs down and move through the shoulders.", progressionContext: "Hold load until all reps stay controlled." },
    ],
  },
  {
    id: "easy-run", name: "Easy 5K development", domain: "engine", mode: "run", intent: "moderate", durationMinutes: 32,
    notes: "Conversational run/walk with a controlled finish. Do not chase exercise calories.", trainingBlock: "Foundation · sustainable strength + 5K", lowerBodyLoad: "moderate", exercises: [],
    alternative: { name: "Peloton aerobic build", domain: "engine", mode: "peloton", intent: "moderate", durationMinutes: 38, notes: "Steady aerobic work with a controlled finish; no all-out intervals.", lowerBodyLoad: "moderate", exercises: [] },
  },
  {
    id: "ruck-foundation", name: "Light ruck + 5 / 10 / 15", domain: "engine", mode: "combination", intent: "easy", durationMinutes: 35,
    notes: "Gradual ruck re-entry, then unhurried bodyweight practice. Add time before load and stop well short of failure.", trainingBlock: "Foundation · sustainable strength + 5K", lowerBodyLoad: "low", exercises: [
      { id: "benchmark-pull", name: "Pull-up progression", equipment: "Pull-up bar", sets: 3, targetReps: [5, 5], notes: "Use the easiest version that stays controlled.", progressionContext: "Build rounds before advancing the movement." },
      { id: "benchmark-push", name: "Push-up progression", equipment: "Floor or incline", sets: 3, targetReps: [10, 10], notes: "Choose an incline that keeps every rep strict.", progressionContext: "Lower the incline only after repeatable rounds." },
      { id: "benchmark-squat", name: "Squat progression", equipment: "Floor or support", sets: 3, targetReps: [15, 15], notes: "Controlled reps to a repeatable depth.", progressionContext: "Reduce support only after clean repeatable rounds." },
    ],
    alternative: { name: "Peloton recovery ride + movement", domain: "recovery", mode: "combination", intent: "easy", durationMinutes: 35, notes: "Easy spin followed by controlled bodyweight movement.", lowerBodyLoad: "low", exercises: [] },
  },
  {
    id: "hard-rest", name: "Hard rest", domain: "recovery", mode: "recovery", intent: "easy", durationMinutes: 0,
    notes: "No catch-up workout. Easy daily living is enough; begin Monday recovered.", trainingBlock: "Foundation · sustainable strength + 5K", lowerBodyLoad: "none", exercises: [],
  },
] as const;

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

export function plannedWorkout(key: string, anchorDate = PROGRAM_RESTART_DATE): ScheduledWorkout {
  const prescription = programPrescription(key, anchorDate);
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

function programPrescription(key: string, anchorDate: string): WorkoutPrescription {
  const week = programWeek(key, anchorDate);
  const prescription = structuredClone(WEEKLY_PROGRAM[weekdayIndex(key)]!);
  prescription.trainingBlock = `Week ${week} · sustainable strength + 5K`;
  if (week >= 11 && prescription.id === "easy-run") {
    prescription.name = "Continuous 5K objective";
    prescription.durationMinutes = 40;
    prescription.notes = "Run the continuous 5K only if the prior ten weeks support it. A controlled run/walk remains a valid completion.";
  }
  return prescription;
}

export function createInitialPersonalState(today = dateKey()): PersonalState {
  void today;
  return {
    version: 3,
    program: { status: "setup", anchorVersion: 1, legacyAnchorDate: PROGRAM_RESTART_DATE },
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
  const generated = Array.from({ length: PROGRAM_HORIZON_DAYS }, (_, offset) => plannedWorkout(shiftDate(anchorDate, offset), anchorDate));
  const retainedIds = new Set(state.sessions.map((session) => session.scheduledWorkoutId));
  const historical = state.schedule.filter((workout) => workout.date < anchorDate && (retainedIds.has(workout.id) || !["planned", "unresolved"].includes(workout.status)));
  return {
    ...state,
    program: { status: "active", anchorVersion: 1, anchorDate, activatedAt, legacyAnchorDate: state.program.legacyAnchorDate || PROGRAM_RESTART_DATE },
    schedule: [...historical, ...generated].sort((a, b) => a.date.localeCompare(b.date)),
    progressionProposals: state.progressionProposals.filter((proposal) => proposal.status !== "pending" && proposal.status !== "edited"),
  };
}
