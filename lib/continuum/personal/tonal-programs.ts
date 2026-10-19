import type {
  PersonalState,
  ScheduledWorkout,
  TonalProgramEnrollment,
  TonalProgramId,
  TonalProgramPlan,
  TonalProgramSession,
  TonalProgramSource,
  TonalProgramMovement,
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

export const FIT_OVER_40_WEEKLY_FREQUENCY = 3 as const;

export const TONAL_PROGRAM_CATALOG: Readonly<Record<TonalProgramId, TonalCatalogProgram>> = {
  "fit-over-40": {
    id: "fit-over-40",
    title: "Fit Over 40",
    trainer: "Coach Tanysha",
    level: "intermediate",
    durationWeeks: 4,
    weeklyFrequency: FIT_OVER_40_WEEKLY_FREQUENCY,
    sessionMinutes: [35, 55],
    availability: "available",
    officialUrl: "https://tonal.com/pages/training-programs",
    cadenceEvidence: "Founder-confirmed from the Tonal app or machine on 2026-10-18",
    cadenceNote: "The founder verified three prescribed workouts per week, four weeks, and twelve ordered sessions in Tonal. Session content still arrives just in time from screenshots.",
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

export function requiredTonalSessionCount(programId: TonalProgramId, weeklyFrequency = TONAL_PROGRAM_CATALOG[programId].weeklyFrequency): number {
  const program = TONAL_PROGRAM_CATALOG[programId];
  return program.durationWeeks * weeklyFrequency;
}

export function createInitialTonalPlan(): TonalProgramPlan {
  return {
    progression: [...TONAL_PROGRESSION],
    selectedProgramId: "fit-over-40",
    enrollment: { programId: "fit-over-40", weeklyFrequency: FIT_OVER_40_WEEKLY_FREQUENCY, status: "setup", sessions: [], sources: [] },
    completedEnrollments: [],
    transitions: [],
  };
}

export function createTonalSessionSlots(programId: TonalProgramId, weeklyFrequency: number): TonalProgramSession[] {
  return Array.from({ length: requiredTonalSessionCount(programId, weeklyFrequency) }, (_, index) => ({ order: index + 1, movements: [] }));
}

export function configureTonalProgram(input: {
  state: PersonalState;
  programId: TonalProgramId;
  weeklyFrequency: typeof FIT_OVER_40_WEEKLY_FREQUENCY;
  source: TonalProgramSource;
  founderVerifiedAt: string;
}): PersonalState {
  if (input.state.program.status !== "setup") throw new Error("tonal-configuration-requires-setup");
  if (input.programId !== "fit-over-40") throw new Error("tonal-initial-program-invalid");
  if (input.weeklyFrequency !== FIT_OVER_40_WEEKLY_FREQUENCY) throw new Error("tonal-cadence-invalid");
  if (!input.source.reference.trim() || !input.founderVerifiedAt) throw new Error("tonal-source-required");
  const sessions = createTonalSessionSlots(input.programId, input.weeklyFrequency);
  const enrollment: TonalProgramEnrollment = {
    programId: input.programId,
    weeklyFrequency: input.weeklyFrequency,
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
    && plan.enrollment.weeklyFrequency === TONAL_PROGRAM_CATALOG[plan.selectedProgramId].weeklyFrequency
    && plan.enrollment.sources.length > 0
    && plan.enrollment.sessions.length === requiredTonalSessionCount(plan.selectedProgramId, plan.enrollment.weeklyFrequency)
    && plan.enrollment.sessions.every((session, index) => session.order === index + 1);
}

function cleanMovements(movements: readonly TonalProgramMovement[]): TonalProgramMovement[] {
  return movements.flatMap((movement) => {
    const name = movement.name.trim().slice(0, 120);
    if (!name) return [];
    return [{ name, sets: movement.sets && movement.sets > 0 ? Math.floor(movement.sets) : undefined, reps: movement.reps?.trim().slice(0, 80) || undefined, prescribedResistance: movement.prescribedResistance?.trim().slice(0, 80) || undefined, details: movement.details?.trim().slice(0, 240) || undefined }];
  }).slice(0, 40);
}

export function planTonalSessionFromScreenshot(state: PersonalState, input: { sequencePosition: number; title?: string; movements: readonly TonalProgramMovement[]; source: TonalProgramSource; approvedAt: string }): PersonalState {
  if (state.program.status !== "active" || state.tonal.enrollment.status !== "active") throw new Error("tonal-session-plan-requires-active-program");
  const next = nextTonalSession(state);
  const target = state.tonal.enrollment.sessions.find((session) => session.order === input.sequencePosition);
  const targetStatus = target ? tonalSessionStatus(state, target) : "unplanned";
  const historicalRecovery = targetStatus === "completed" || targetStatus === "deferred" || targetStatus === "skipped";
  if (!target || target.completedActivityId || (next?.order !== input.sequencePosition && !historicalRecovery)) throw new Error("tonal-session-plan-order-invalid");
  if (!input.source.digest || !input.source.file || !input.approvedAt) throw new Error("tonal-session-plan-source-required");
  const title = input.title?.trim().slice(0, 160) || undefined;
  const movements = cleanMovements(input.movements);
  if (!title && !movements.length) throw new Error("tonal-session-plan-evidence-required");
  const sessions = state.tonal.enrollment.sessions.map((session) => session.order === input.sequencePosition ? { ...session, title, movements, plannedAt: input.approvedAt, plannedSource: input.source } : session);
  const match = sessions.find((session) => session.order === input.sequencePosition)!;
  const schedule = state.schedule.map((workout): ScheduledWorkout => workout.id === match.scheduledWorkoutId ? {
    ...workout,
    prescription: { ...workout.prescription, name: title ? `${TONAL_PROGRAM_CATALOG[state.tonal.selectedProgramId].title} · ${title}` : `${TONAL_PROGRAM_CATALOG[state.tonal.selectedProgramId].title} · Session ${input.sequencePosition}`, notes: "Use only the founder-approved details visible in the linked Tonal screenshot; unknown prescription details remain unknown." },
    provenance: [...new Set([...workout.provenance, "sterling" as const, "user_confirmed" as const])],
    history: [...workout.history, { at: input.approvedAt, action: "modified", actor: "user", note: `Founder approved the just-in-time Tonal plan for sequence ${input.sequencePosition}.` }],
  } : workout);
  return { ...state, schedule, tonal: { ...state.tonal, enrollment: { ...state.tonal.enrollment, sessions } } };
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

type TonalCompletionIdentity = {
  sequencePosition?: number;
  programTitle?: string;
  workoutTitle?: string;
  movements?: readonly TonalProgramMovement[];
};

export type TonalSessionOutcome = "Completed" | "Deferred" | "Skipped" | "Pending";

export function tonalSessionOutcome(state: PersonalState, session: TonalProgramSession): TonalSessionOutcome {
  const status = tonalSessionStatus(state, session);
  if (status === "completed") return "Completed";
  if (status === "deferred") return "Deferred";
  if (status === "skipped") return "Skipped";
  return "Pending";
}

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase();
}

export function matchesTonalSessionCompletion(state: PersonalState, input: TonalCompletionIdentity): boolean {
  const program = TONAL_PROGRAM_CATALOG[state.tonal.enrollment.programId];
  const target = state.tonal.enrollment.sessions.find((session) => session.order === input.sequencePosition);
  const next = nextTonalSession(state);
  if (!target || !target.plannedAt || !target.plannedSource || target.completedActivityId) return false;
  const status = tonalSessionStatus(state, target);
  const historicalRecovery = status === "completed" || status === "deferred" || status === "skipped";
  if (next?.order !== target.order && !historicalRecovery) return false;
  if (!input.programTitle || normalized(input.programTitle) !== normalized(program.title)) return false;
  if (target.title) return Boolean(input.workoutTitle && normalized(input.workoutTitle) === normalized(target.title));

  const plannedMovements = target.movements.map((movement) => normalized(movement.name)).filter(Boolean);
  const completedMovements = new Set((input.movements ?? []).map((movement) => normalized(movement.name)).filter(Boolean));
  return plannedMovements.length > 0 && plannedMovements.every((movement) => completedMovements.has(movement));
}

export function matchesNextTonalSessionCompletion(state: PersonalState, input: TonalCompletionIdentity): boolean {
  const next = nextTonalSession(state);
  return Boolean(next && input.sequencePosition === next.order && matchesTonalSessionCompletion(state, input));
}

export function markTonalSessionCompletedFromActivity(state: PersonalState, input: TonalCompletionIdentity & { activityId: string; at: string }): PersonalState {
  if (!matchesTonalSessionCompletion(state, input)) return state;
  const match = state.tonal.enrollment.sessions.find((session) => session.order === input.sequencePosition)!;
  const schedule = state.schedule.map((workout): ScheduledWorkout => workout.id === match.scheduledWorkoutId
    ? workout.status === "completed"
      ? workout
      : { ...workout, status: "completed", history: [...workout.history, { at: input.at, action: "completed", actor: "user", note: "Founder-approved Tonal summary matched this exact program session." }] }
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
