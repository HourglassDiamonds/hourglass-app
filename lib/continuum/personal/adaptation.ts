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
  return /\bruck(?:ing)?\b/i.test(command);
}

function wantsMoveTomorrow(command: string): boolean {
  return /\b(move|push|defer|reschedule)\b[\s\S]{0,50}\b(tomorrow|next day)\b/i.test(command) || /\b(tomorrow|next day)\b[\s\S]{0,50}\b(weights?|strength|workout)\b/i.test(command);
}

function recoveryRuck(base: ScheduledWorkout, command: string): ScheduledWorkout {
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
    status: "planned",
    prescription,
    replacesWorkoutId: base.id,
    provenance: ["sterling"],
    history: [{ at: new Date().toISOString(), action: "replaced", actor: "sterling", note: `Proposed from founder command: ${command}` }],
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
    history: [...source.history, { at: now, action: "deferred", actor, note: `Original occurrence intentionally deferred to ${targetDate}; not failed.` }],
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

export function proposeSterlingAdjustment(state: PersonalState, command: string, today: string): SterlingProposal | null {
  const recovery = proposeRecoveryFromNarrative(command, today);
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
    sourceWorkoutId: todayWorkout.id,
    targetDate: tomorrow,
    confidence: "medium",
  };
}

export function buildSterlingScheduleAdjustment(input: {
  state: PersonalState;
  command: string;
  workoutId: string;
  targetDate: string;
  summary: string;
  warnings?: string[];
  confidence?: "low" | "medium" | "high";
  now?: string;
}): SterlingProposal | null {
  const workout = input.state.schedule.find((row) => row.id === input.workoutId);
  if (!workout || (workout.status !== "planned" && workout.status !== "unresolved")) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.targetDate) || input.targetDate <= workout.date) return null;
  const createdAt = input.now ?? new Date().toISOString();
  const nextSchedule = deferAndReflow(input.state.schedule, workout.id, input.targetDate, createdAt, "sterling");
  if (!nextSchedule.some((row) => row.replacesWorkoutId === workout.id && row.date === input.targetDate)) return null;
  return {
    id: `sterling-adjustment-${createdAt}-${workout.id}`,
    command: input.command,
    createdAt,
    summary: input.summary,
    nextSchedule,
    affectedWorkoutIds: [workout.id, ...nextSchedule.filter((row) => row.history.at(-1)?.action === "reflowed").map((row) => row.id)],
    warnings: (input.warnings ?? []).slice(0, 6),
    sourceWorkoutId: workout.id,
    targetDate: input.targetDate,
    confidence: input.confidence ?? "medium",
  };
}

export function retargetSterlingScheduleAdjustment(
  state: PersonalState,
  proposal: SterlingProposal,
  targetDate: string,
): SterlingProposal | null {
  if (!proposal.sourceWorkoutId) return null;
  return buildSterlingScheduleAdjustment({
    state,
    command: proposal.command,
    workoutId: proposal.sourceWorkoutId,
    targetDate,
    summary: proposal.summary,
    warnings: proposal.warnings,
    confidence: proposal.confidence,
    now: proposal.createdAt,
  });
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
