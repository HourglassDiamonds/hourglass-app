import type { PersonalState, ScheduledWorkout, WorkoutPrescription } from "./types";

const DAY_MS = 86_400_000;

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
    id: "easy-run", name: "Easy 5K development", domain: "engine", mode: "run", intent: "aerobic", durationMinutes: 32,
    notes: "Conversational run/walk. Finish wanting one more interval.", trainingBlock: "Foundation · sustainable strength + 5K", lowerBodyLoad: "low", exercises: [],
    alternative: { name: "Peloton Zone 2 + movement", domain: "engine", mode: "combination", intent: "aerobic", durationMinutes: 42, notes: "Conversation-pace ride followed by unhurried beginner movement practice.", lowerBodyLoad: "low", exercises: [] },
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
    id: "ruck-foundation", name: "Outdoor 20 lb ruck", domain: "engine", mode: "ruck", intent: "aerobic", durationMinutes: 35,
    notes: "Use the 20 lb ruck only. Add time or terrain before load.", trainingBlock: "Foundation · sustainable strength + 5K", lowerBodyLoad: "low", exercises: [],
    alternative: { name: "Peloton aerobic base", domain: "engine", mode: "peloton", intent: "aerobic", durationMinutes: 35, notes: "Conversational effort with no hard intervals.", lowerBodyLoad: "low", exercises: [] },
  },
  {
    id: "benchmark-foundation", name: "5 / 10 / 15 foundation", domain: "strength", mode: "bodyweight", intent: "easy", durationMinutes: 20,
    notes: "Three unhurried rounds. Build capacity without turning broken form into a score.", trainingBlock: "Foundation · sustainable strength + 5K", lowerBodyLoad: "low", exercises: [
      { id: "benchmark-pull", name: "Pull-up progression", equipment: "Pull-up bar", sets: 3, targetReps: [5, 5], notes: "Use the easiest version that stays controlled.", progressionContext: "Build rounds before advancing the movement." },
      { id: "benchmark-push", name: "Push-up progression", equipment: "Floor or incline", sets: 3, targetReps: [10, 10], notes: "Choose an incline that keeps every rep strict.", progressionContext: "Lower the incline only after repeatable rounds." },
      { id: "benchmark-squat", name: "Squat progression", equipment: "Floor or support", sets: 3, targetReps: [15, 15], notes: "Controlled reps to a repeatable depth.", progressionContext: "Reduce support only after clean repeatable rounds." },
    ],
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

export function plannedWorkout(key: string): ScheduledWorkout {
  const prescription = structuredClone(WEEKLY_PROGRAM[weekdayIndex(key)]!);
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

export function createInitialPersonalState(today = dateKey()): PersonalState {
  return {
    version: 2,
    schedule: Array.from({ length: 14 }, (_, offset) => plannedWorkout(shiftDate(today, offset))),
    sessions: [],
    recoveryEntries: [],
    meals: [],
    frequentMeals: [],
    progressionProposals: [],
    nutritionTargets: { calories: 2200, protein: 180, carbs: 215, fat: 70 },
  };
}
