import type {
  PersonalState,
  ScheduledWorkout,
  TonalProgramEnrollment,
  TonalProgramId,
  TonalProgramPlan,
  TonalProgramSession,
  TonalProgramSource,
} from "./types";

export type TonalCatalogProgram = {
  id: TonalProgramId;
  title: string;
  trainer: string;
  level: "intermediate" | "advanced";
  durationWeeks: number;
  weeklyFrequency: number;
  sessionMinutes: [number, number];
  availability: "available";
  officialUrl: string;
  cadenceEvidence: string;
  cadenceNote?: string;
};

export const TONAL_PROGRAM_CATALOG: Readonly<Record<TonalProgramId, TonalCatalogProgram>> = {
  "fit-over-40": {
    id: "fit-over-40",
    title: "Fit Over 40",
    trainer: "Coach Tanysha",
    level: "intermediate",
    durationWeeks: 4,
    weeklyFrequency: 2,
    sessionMinutes: [35, 55],
    availability: "available",
    officialUrl: "https://tonal.com/pages/training-programs",
    cadenceEvidence: "https://tonal.com/pages/success-stories-active-aging",
    cadenceNote: "Tonal's current Fit Over 40 feature pages say two workouts per week; its general catalog currently conflicts by listing three. Confirm the machine/app cadence before activation.",
  },
  "next-level-strength": {
    id: "next-level-strength",
    title: "Next Level Strength",
    trainer: "Coach Tanysha",
    level: "intermediate",
    durationWeeks: 4,
    weeklyFrequency: 4,
    sessionMinutes: [35, 50],
    availability: "available",
    officialUrl: "https://tonal.com/pages/training-programs",
    cadenceEvidence: "https://tonal.com/pages/training-programs",
  },
  "12-weeks-to-jacked": {
    id: "12-weeks-to-jacked",
    title: "12 Weeks to Jacked",
    trainer: "Coach Joe",
    level: "advanced",
    durationWeeks: 12,
    weeklyFrequency: 4,
    sessionMinutes: [36, 53],
    availability: "available",
    officialUrl: "https://tonal.com/pages/training-programs",
    cadenceEvidence: "https://tonal.com/pages/training-programs",
  },
} as const;

export const TONAL_PROGRESSION: readonly TonalProgramId[] = ["fit-over-40", "next-level-strength", "12-weeks-to-jacked"];

export function requiredTonalSessionCount(programId: TonalProgramId): number {
  const program = TONAL_PROGRAM_CATALOG[programId];
  return program.durationWeeks * program.weeklyFrequency;
}

export function createInitialTonalPlan(): TonalProgramPlan {
  return {
    progression: [...TONAL_PROGRESSION],
    selectedProgramId: "fit-over-40",
    enrollment: { programId: "fit-over-40", status: "setup", sessions: [], sources: [] },
    completedEnrollments: [],
    transitions: [],
  };
}

export function verifiedTonalSessions(programId: TonalProgramId, titles: readonly string[]): TonalProgramSession[] {
  const expected = requiredTonalSessionCount(programId);
  const sessions = titles.map((title, index) => ({ order: index + 1, title: title.trim().slice(0, 160) })).filter((session) => session.title);
  if (sessions.length !== expected) throw new Error(`tonal-session-count-required:${expected}`);
  const normalized = sessions.map((session) => session.title.toLocaleLowerCase());
  if (new Set(normalized).size !== normalized.length) throw new Error("tonal-session-title-duplicate");
  return sessions;
}

export function configureTonalProgram(input: {
  state: PersonalState;
  programId: TonalProgramId;
  sessionTitles: readonly string[];
  source: TonalProgramSource;
  founderVerifiedAt: string;
}): PersonalState {
  if (input.state.program.status !== "setup") throw new Error("tonal-configuration-requires-setup");
  if (input.programId !== "fit-over-40") throw new Error("tonal-initial-program-invalid");
  if (!input.source.reference.trim() || !input.founderVerifiedAt) throw new Error("tonal-source-required");
  const sessions = verifiedTonalSessions(input.programId, input.sessionTitles);
  const enrollment: TonalProgramEnrollment = {
    programId: input.programId,
    status: "setup",
    sessions,
    sources: [input.source],
    founderVerifiedAt: input.founderVerifiedAt,
  };
  return { ...input.state, tonal: { ...input.state.tonal, selectedProgramId: input.programId, enrollment } };
}

export function tonalEnrollmentReady(plan: TonalProgramPlan): boolean {
  return Boolean(plan.enrollment.founderVerifiedAt)
    && plan.enrollment.programId === plan.selectedProgramId
    && plan.enrollment.sessions.length === requiredTonalSessionCount(plan.selectedProgramId)
    && plan.enrollment.sessions.every((session, index) => session.order === index + 1 && Boolean(session.title.trim()));
}

export function tonalSessionStatus(state: PersonalState, session: TonalProgramSession): "unplanned" | "planned" | "in_progress" | "completed" | "deferred" | "skipped" | "replaced" | "unresolved" {
  if (!session.scheduledWorkoutId) return "unplanned";
  return state.schedule.find((workout) => workout.id === session.scheduledWorkoutId)?.status ?? "unplanned";
}

export function nextTonalSession(state: PersonalState): TonalProgramSession | undefined {
  return state.tonal.enrollment.sessions.find((session) => tonalSessionStatus(state, session) !== "completed");
}

export function syncTonalProgramCompletion(state: PersonalState, at: string): PersonalState {
  const enrollment = state.tonal.enrollment;
  if (enrollment.status !== "active" || !enrollment.sessions.length) return state;
  const complete = enrollment.sessions.every((session) => session.scheduledWorkoutId && state.schedule.some((workout) => workout.id === session.scheduledWorkoutId && workout.status === "completed"));
  return complete ? { ...state, tonal: { ...state.tonal, enrollment: { ...enrollment, status: "completed", completedAt: at } } } : state;
}

export function markTonalSessionCompletedFromActivity(state: PersonalState, input: { activityId: string; programTitle?: string; workoutTitle?: string; at: string }): PersonalState {
  const program = TONAL_PROGRAM_CATALOG[state.tonal.enrollment.programId];
  if (!input.programTitle || !input.workoutTitle || input.programTitle.trim().toLocaleLowerCase() !== program.title.toLocaleLowerCase()) return state;
  const candidates = state.tonal.enrollment.sessions.filter((session) => session.title.toLocaleLowerCase() === input.workoutTitle!.trim().toLocaleLowerCase());
  if (candidates.length !== 1) return state;
  const match = candidates[0]!;
  const schedule = state.schedule.map((workout): ScheduledWorkout => workout.id === match.scheduledWorkoutId
    ? { ...workout, status: "completed", history: [...workout.history, { at: input.at, action: "completed", actor: "user", note: "Founder-approved Tonal summary matched this exact program session." }] }
    : workout);
  const sessions = state.tonal.enrollment.sessions.map((session) => session.order === match.order ? { ...session, completedActivityId: input.activityId } : session);
  return syncTonalProgramCompletion({
    ...state,
    schedule,
    tonal: { ...state.tonal, enrollment: { ...state.tonal.enrollment, sessions } },
  }, input.at);
}

export function reviewTonalTransition(state: PersonalState, input: Omit<TonalProgramPlan["transitions"][number], "from">): PersonalState {
  const current = state.tonal.enrollment;
  if (current.status !== "completed") throw new Error("tonal-transition-requires-completion");
  const currentIndex = TONAL_PROGRESSION.indexOf(current.programId);
  if (TONAL_PROGRESSION[currentIndex + 1] !== input.to) throw new Error("tonal-transition-order-invalid");
  if (!input.approvedAt) throw new Error("tonal-transition-founder-approval-required");
  return { ...state, tonal: { ...state.tonal, transitions: [...state.tonal.transitions, { from: current.programId, ...input }] } };
}
