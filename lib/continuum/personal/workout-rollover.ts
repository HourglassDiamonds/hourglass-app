import { shiftDate, weekdayIndex } from "./program";
import { nextTonalSession, tonalSessionStatus } from "./tonal-programs";
import type { PersonalState, ScheduledWorkout, TonalProgramSession } from "./types";

export type ProjectedWorkout = ScheduledWorkout;
type ProjectionReason = NonNullable<ProjectedWorkout["projection"]>["reason"];

export type WorkoutRolloverPlan = {
  schedule: ProjectedWorkout[];
  nextSession?: TonalProgramSession;
  nextProjectedDate?: string;
  missedSessionCount: number;
  doubleUpAvailable: boolean;
  doubleUpActive: boolean;
};

function strengthWeekdays(frequency: number): readonly number[] {
  if (frequency === 2) return [0, 3];
  if (frequency === 4) return [0, 1, 3, 4];
  return [0, 2, 4];
}

function nextEligibleDate(onOrAfter: string, weekdays: readonly number[]): string {
  let candidate = onOrAfter;
  for (let offset = 0; offset < 8; offset += 1) {
    if (weekdays.includes(weekdayIndex(candidate))) return candidate;
    candidate = shiftDate(candidate, 1);
  }
  throw new Error("workout-rollover-cadence-invalid");
}

function laterDate(left: string, right: string): string {
  return left > right ? left : right;
}

export function projectWorkoutRollover(state: PersonalState, today: string): WorkoutRolloverPlan {
  const terminal = new Set(["completed", "skipped", "replaced"]);
  const activeWorkoutIds = new Set(state.tonal.enrollment.sessions.flatMap((session) => session.scheduledWorkoutId ? [session.scheduledWorkoutId] : []));
  const schedule = state.program.status === "active"
    ? state.schedule.filter((workout) => {
        const isTonalOccurrence = workout.prescription.tonalSessionOrder !== undefined;
        const isUnfinishedOldCycleOccurrence = isTonalOccurrence && !activeWorkoutIds.has(workout.id) && !terminal.has(workout.status);
        return !isUnfinishedOldCycleOccurrence;
      })
    : state.schedule;
  const nextSession = nextTonalSession(state);
  if (state.program.status !== "active" || !nextSession) {
    return { schedule, nextSession, missedSessionCount: 0, doubleUpAvailable: false, doubleUpActive: false };
  }

  const unfinished = [...state.tonal.enrollment.sessions]
    .filter((session) => !terminal.has(tonalSessionStatus(state, session)))
    .sort((left, right) => left.order - right.order);
  const workoutBySession = new Map<number, ScheduledWorkout>();
  for (const session of unfinished) {
    const workout = schedule.find((candidate) => candidate.id === session.scheduledWorkoutId);
    if (workout) workoutBySession.set(session.order, workout);
  }
  const weekdays = strengthWeekdays(state.tonal.enrollment.weeklyFrequency);
  const projectedById = new Map<string, ProjectedWorkout>();
  let priorProjectedDate: string | undefined;
  const choice = state.workoutRolloverChoice;
  const choiceApplies = Boolean(choice
    && choice.primarySessionOrder === nextSession.order
    && choice.targetDate >= today
    && choice.mode === "double_up"
    && choice.secondarySessionOrder === unfinished[1]?.order);

  for (const [index, session] of unfinished.entries()) {
    const workout = workoutBySession.get(session.order);
    if (!workout) continue;
    let projectedDate: string;
    let reason: ProjectionReason;
    if (index === 1 && choiceApplies && choice) {
      projectedDate = choice.targetDate;
      reason = "explicit_double_up";
    } else {
      const earliest = priorProjectedDate ? shiftDate(priorProjectedDate, 1) : today;
      projectedDate = nextEligibleDate(laterDate(earliest, workout.date), weekdays);
      reason = workout.date < today ? "missed_sequence" : projectedDate === workout.date ? "future_shift" : "future_shift";
    }
    priorProjectedDate = projectedDate;
    projectedById.set(workout.id, projectedDate === workout.date
      ? workout
      : { ...workout, date: projectedDate, projection: { canonicalDate: workout.date, reason } });
  }

  const projectedSchedule = schedule.map((workout) => projectedById.get(workout.id) ?? workout).sort((left, right) => left.date.localeCompare(right.date) || left.id.localeCompare(right.id));
  const firstWorkout = workoutBySession.get(nextSession.order);
  const nextProjectedDate = firstWorkout ? projectedById.get(firstWorkout.id)?.date ?? firstWorkout.date : undefined;
  const missedSessionCount = unfinished.filter((session) => (workoutBySession.get(session.order)?.date ?? today) < today).length;
  return {
    schedule: projectedSchedule,
    nextSession,
    nextProjectedDate,
    missedSessionCount,
    doubleUpAvailable: Boolean(unfinished[1] && nextProjectedDate),
    doubleUpActive: choiceApplies,
  };
}
