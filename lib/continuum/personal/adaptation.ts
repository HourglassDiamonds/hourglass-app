import { shiftDate } from "./program";
import { hasRecoverySignal, proposeRecoveryFromNarrative } from "./recovery";
import type { PersonalState, ScheduledWorkout, SterlingProposal, WorkoutPrescription } from "./types";

function cloneWorkout(workout: ScheduledWorkout): ScheduledWorkout {
  return structuredClone(workout);
}

function isSleepCompromised(command: string): boolean {
  const match = command.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\b/i);
  const lowWord = /\b(?:one|two|three|four|five)\s+hours?\b/i.test(command);
  return Boolean(match && Number(match[1]) < 6) || lowWord || /\b(gassed|wrecked|exhausted)\b/i.test(command);
}

function wantsRuck(command: string): boolean {
  return /\bruck(?:ed|ing)?\b/i.test(command);
}

function wantsMoveTomorrow(command: string): boolean {
  return /\b(move|push|defer|reschedule)\b[\s\S]{0,50}\b(tomorrow|next day)\b/i.test(command) || /\b(tomorrow|next day)\b[\s\S]{0,50}\b(weights?|strength|workout)\b/i.test(command);
}

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3,
  apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7,
  aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10,
  october: 10, nov: 11, november: 11, dec: 12, december: 12,
};

function referencedPriorDate(command: string, today: string): string | null {
  if (/\byesterday(?:['’]s)?\b/i.test(command)) return shiftDate(today, -1);
  const iso = command.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
  if (iso) return `${iso[1]}-${iso[2]!.padStart(2, "0")}-${iso[3]!.padStart(2, "0")}`;
  const named = command.match(
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(20\d{2}))?\b/i,
  );
  if (!named) return null;
  const month = MONTHS[named[1]!.toLowerCase()];
  const year = named[3] ?? today.slice(0, 4);
  return month ? `${year}-${String(month).padStart(2, "0")}-${named[2]!.padStart(2, "0")}` : null;
}

function missedStrengthCandidates(
  state: PersonalState,
  targetDate: string,
): ScheduledWorkout[] {
  return state.schedule.filter((item) => {
    if (item.date !== targetDate || item.prescription.domain !== "strength") return false;
    if (["planned", "unresolved", "skipped", "deferred", "replaced"].includes(item.status)) return true;
    return state.schedule.some(
      (replacement) =>
        replacement.date === targetDate &&
        replacement.replacesWorkoutId === item.id &&
        replacement.prescription.domain === "recovery",
    );
  });
}

function stateAwareRestoreCandidate(
  state: PersonalState,
  command: string,
  today: string,
): { targetDate: string; workout: ScheduledWorkout } | null {
  const targetDate = referencedPriorDate(command, today);
  if (!targetDate || !/\btoday\b/i.test(command)) return null;
  const candidates = missedStrengthCandidates(state, targetDate);
  return candidates.length === 1 ? { targetDate, workout: candidates[0]! } : null;
}

export function sterlingClarification(
  state: PersonalState,
  command: string,
  today: string,
): string {
  const targetDate = referencedPriorDate(command, today);
  if (targetDate && /\btoday\b/i.test(command)) {
    const candidates = missedStrengthCandidates(state, targetDate);
    if (candidates.length > 1) {
      return `I found ${candidates.length} missed strength sessions on ${targetDate}. Which one should move to today?`;
    }
    if (candidates.length === 0) {
      return `I couldn't find a missed strength session on ${targetDate} in the saved schedule. Nothing changed.`;
    }
  }
  return "I need one detail: which workout or day should change? Nothing changed.";
}

function recoveryRuck(
  base: ScheduledWorkout,
  command: string,
  now = new Date().toISOString(),
): ScheduledWorkout {
  const prescription: WorkoutPrescription = {
    id: `recovery-ruck-${base.date}`,
    name: "Recovery-conscious ruck",
    domain: "recovery",
    mode: "ruck",
    intent: "easy",
    durationMinutes: 20,
    notes: "Easy 15–20 minute walk with no more than 20 lb. Keep breathing conversational; shorten or stop if it does not feel restorative.",
    trainingBlock: base.prescription.trainingBlock,
    lowerBodyLoad: "low",
    exercises: [],
  };
  return {
    id: `sterling-${base.date}-recovery-ruck`,
    date: base.date,
    originalDate: base.date,
    status: "completed",
    prescription,
    replacesWorkoutId: base.id,
    provenance: ["sterling"],
    history: [{ at: now, action: "completed", actor: "sterling", note: `Recorded from founder current truth: ${command}` }],
  };
}

function conflicts(candidate: ScheduledWorkout, placed: ScheduledWorkout[]): boolean {
  const prior = placed.find((item) => item.date === shiftDate(candidate.date, -1) && item.status !== "skipped" && item.status !== "deferred");
  const next = placed.find((item) => item.date === shiftDate(candidate.date, 1) && item.status !== "skipped" && item.status !== "deferred");
  if (candidate.prescription.domain === "strength") {
    if (prior?.prescription.domain === "strength" || next?.prescription.domain === "strength") return true;
    if (candidate.prescription.lowerBodyLoad !== "none" && next?.prescription.mode === "run") return true;
  }
  if (candidate.prescription.mode === "run" && prior?.prescription.domain === "strength" && prior.prescription.lowerBodyLoad !== "none") return true;
  return false;
}

export function deferAndReflow(schedule: readonly ScheduledWorkout[], workoutId: string, targetDate: string, now = new Date().toISOString(), actor: "user" | "sterling" = "user"): ScheduledWorkout[] {
  const source = schedule.find((item) => item.id === workoutId);
  if (!source) return [...schedule];
  const untouched = schedule.filter((item) => item.id !== workoutId).map(cloneWorkout);
  const collisions = untouched
    .filter((item) => item.date >= targetDate && item.status === "planned")
    .sort((a, b) => a.date.localeCompare(b.date));
  const collisionIds = new Set(collisions.map((item) => item.id));
  const placed = untouched.filter((item) => !collisionIds.has(item.id));
  placed.push({
    ...cloneWorkout(source),
    status: "deferred",
    deferredTo: targetDate,
    provenance: [...new Set([...source.provenance, actor === "sterling" ? "sterling" as const : "user" as const, "user_confirmed" as const])],
    history: [...source.history, { at: now, action: "deferred", actor, note: `Original occurrence intentionally deferred to ${targetDate}; kept unresolved with no penalty.` }],
  });
  const deferred: ScheduledWorkout = {
    ...cloneWorkout(source),
    id: `${source.id}--deferred-${targetDate}`,
    date: targetDate,
    status: "planned",
    deferredTo: targetDate,
    replacesWorkoutId: source.id,
    provenance: [...new Set([...source.provenance, actor === "sterling" ? "sterling" as const : "user" as const, "user_confirmed" as const])],
    history: [...source.history, { at: now, action: "deferred", actor, note: `Deferred from ${source.date} to ${targetDate}; prescription and progression context preserved.` }],
  };
  placed.push(deferred);

  const priority = [...collisions].sort((a, b) => {
    const aRecovery = a.prescription.domain === "recovery" ? 0 : 1;
    const bRecovery = b.prescription.domain === "recovery" ? 0 : 1;
    return aRecovery - bRecovery || a.date.localeCompare(b.date);
  });
  for (const original of priority) {
    let cursor = original.date === targetDate ? shiftDate(targetDate, 1) : original.date;
    for (let guard = 0; guard < 14; guard += 1) {
      const candidate = { ...cloneWorkout(original), date: cursor };
      const occupied = placed.some((item) => item.date === cursor && item.status !== "deferred" && item.status !== "skipped");
      if (!occupied && !conflicts(candidate, placed)) {
        placed.push({ ...candidate, history: [...candidate.history, { at: now, action: "reflowed", actor: "sterling", note: `Reflowed from ${original.date} to ${cursor} to protect recovery and avoid conflicting heavy days.` }], provenance: [...new Set([...candidate.provenance, "sterling" as const])] });
        break;
      }
      cursor = shiftDate(cursor, 1);
    }
  }
  return placed.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}

export function carryYesterdayUnresolvedToToday(
  schedule: readonly ScheduledWorkout[],
  today: string,
  now = new Date().toISOString(),
): ScheduledWorkout[] {
  const yesterday = shiftDate(today, -1);
  const prior = schedule.find(
    (item) => item.date === yesterday && item.status === "unresolved",
  );
  if (!prior) return [...schedule];
  if (
    schedule.some(
      (item) =>
        item.date === today &&
        item.replacesWorkoutId === prior.id &&
        !["deferred", "skipped", "replaced"].includes(item.status),
    )
  ) {
    return [...schedule];
  }
  return deferAndReflow(schedule, prior.id, today, now, "sterling");
}

export const FOUNDER_RUCK_ROLLOVER_RECONCILIATION =
  "2026-10-06-missed-strength-ruck-rollover-v1";

/**
 * One-time reconciliation for the founder's already-persisted Oct 5 state.
 * The earlier UI could store the missed strength occurrence as skipped or
 * deferred, while the failed Review Adjustment stored neither the restored
 * workout nor the completed ruck. Keep the scope exact so ordinary skips are
 * never reinterpreted as rucks.
 */
export function reconcileFounderRuckRollover(
  schedule: readonly ScheduledWorkout[],
  today: string,
  now = new Date().toISOString(),
): ScheduledWorkout[] | null {
  if (today !== "2026-10-06") return null;
  const yesterday = shiftDate(today, -1);
  const prior = schedule.find(
    (item) =>
      item.date === yesterday &&
      item.prescription.domain === "strength" &&
      ["unresolved", "skipped", "deferred", "replaced"].includes(item.status),
  );
  const currentRun = schedule.find(
    (item) =>
      item.date === today &&
      item.prescription.id === "easy-run" &&
      ["planned", "unresolved"].includes(item.status),
  );
  if (!prior || !currentRun) return null;

  const alreadyRestored = schedule.some(
    (item) =>
      item.date === today &&
      item.replacesWorkoutId === prior.id &&
      !["deferred", "skipped", "replaced"].includes(item.status),
  );
  const next = alreadyRestored
    ? schedule.map(cloneWorkout)
    : deferAndReflow(schedule, prior.id, today, now, "sterling");
  if (
    !next.some(
      (item) =>
        item.date === yesterday &&
        item.replacesWorkoutId === prior.id &&
        item.prescription.mode === "ruck",
    )
  ) {
    next.push(
      recoveryRuck(
        prior,
        "We skipped yesterday and rucked instead; restore the missed strength workout today.",
        now,
      ),
    );
  }
  return next.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}

export function proposeSterlingAdjustment(state: PersonalState, command: string, today: string): SterlingProposal | null {
  const recovery = proposeRecoveryFromNarrative(command, today);
  const resolvedRestore = stateAwareRestoreCandidate(state, command, today);
  if (resolvedRestore) {
    const yesterday = resolvedRestore.targetDate;
    const prior = resolvedRestore.workout;
    const alreadyMoved = prior
      ? state.schedule.some(
          (item) =>
            item.date === today &&
            item.replacesWorkoutId === prior.id &&
            !["deferred", "skipped", "replaced"].includes(item.status),
        )
      : false;
    const now = new Date().toISOString();
    const nextSchedule = alreadyMoved
      ? state.schedule.map(cloneWorkout)
      : deferAndReflow(state.schedule, prior.id, today, now, "sterling");
    if (wantsRuck(command) && !nextSchedule.some((item) => item.replacesWorkoutId === prior.id && item.date === yesterday && item.prescription.mode === "ruck")) {
      nextSchedule.push(recoveryRuck(prior, command));
      nextSchedule.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
    }
    const moved = nextSchedule.find(
      (item) => item.replacesWorkoutId === prior.id && item.date === today,
    );
    if (!moved) return null;
    return {
      id: `sterling-restore-proposal-${Date.now()}`,
      command,
      createdAt: now,
      summary: `Restore yesterday’s intact ${prior.prescription.name} prescription to today, record the recovery ruck substitution, and reflow today’s planned session to the next sensible slot.`,
      recovery,
      nextSchedule,
      affectedWorkoutIds: [prior.id, moved.id, ...nextSchedule.filter((item) => item.history.at(-1)?.action === "reflowed").map((item) => item.id)],
      warnings: [],
    };
  }
  const todayWorkout = state.schedule.find((item) => item.date === today && (item.status === "planned" || item.status === "unresolved"));
  if (!todayWorkout || !wantsMoveTomorrow(command)) {
    if (!hasRecoverySignal(recovery)) return null;
    return {
      id: `sterling-recovery-proposal-${Date.now()}`,
      command,
      createdAt: new Date().toISOString(),
      summary: "Save the recovery values you supplied. Metrics you did not provide will remain blank.",
      recovery,
      nextSchedule: state.schedule,
      affectedWorkoutIds: [],
      warnings: [],
    };
  }
  const now = new Date().toISOString();
  const tomorrow = shiftDate(today, 1);
  const nextSchedule = deferAndReflow(state.schedule, todayWorkout.id, tomorrow, now, "sterling");
  const moved = nextSchedule.find((item) => item.replacesWorkoutId === todayWorkout.id && item.date === tomorrow);
  if (!moved) return null;
  if (wantsRuck(command)) nextSchedule.push(recoveryRuck(todayWorkout, command));
  nextSchedule.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const constrained = isSleepCompromised(command);
  return {
    id: `sterling-proposal-${Date.now()}`,
    command,
    createdAt: now,
    summary: constrained
      ? `Replace today’s strength work with an easy recovery ruck, move the intact strength prescription to ${tomorrow}, and reflow later sessions around recovery.`
      : `Move today’s workout to ${tomorrow} and reflow later sessions to avoid conflicting days.`,
    recovery,
    nextSchedule,
    affectedWorkoutIds: [todayWorkout.id, ...nextSchedule.filter((item) => item.history.at(-1)?.action === "reflowed").map((item) => item.id)],
    warnings: constrained ? ["About four hours of sleep and high fatigue support a reduced session; no injury is inferred."] : [],
  };
}

export function applySterlingProposal(state: PersonalState, proposal: SterlingProposal): PersonalState {
  const recovery = proposal.recovery ? {
    ...proposal.recovery,
    id: `recovery-${Date.now()}`,
    recordedAt: new Date().toISOString(),
    provenance: [...new Set([...proposal.recovery.provenance, "user_confirmed" as const])],
  } : null;
  return {
    ...state,
    schedule: proposal.nextSchedule,
    recoveryEntries: recovery ? [recovery, ...state.recoveryEntries.filter((item) => item.date !== recovery.date)] : state.recoveryEntries,
  };
}
