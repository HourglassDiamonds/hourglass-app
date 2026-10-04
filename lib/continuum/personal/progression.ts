import type { ExercisePrescription, PerformedSet, ProgressionProposal } from "./types";

type ProgressionInput = { exercise: ExercisePrescription; sets: PerformedSet[]; recentMisses?: number; readiness?: number; soreness?: number };
function roundedLoad(load: number, direction: 1 | -1) { return Math.max(0, load + (load < 30 ? 2.5 : 5) * direction); }

export function proposeProgression({ exercise, sets, recentMisses = 0, readiness, soreness }: ProgressionInput): ProgressionProposal {
  const performed = sets.filter((set) => set.completed && !set.skipped);
  const skippedOnly = sets.length > 0 && performed.length === 0 && sets.every((set) => set.skipped);
  const base = { id: `proposal-${exercise.id}-${Date.now()}`, exerciseId: exercise.id, exerciseName: exercise.name, status: "pending" as const };
  if (sets.some((set) => set.pain)) return { ...base, action: "regress", proposedLoad: exercise.targetLoad ? roundedLoad(exercise.targetLoad, -1) : undefined, reason: "Pain was flagged. Stop that movement, use a pain-free regression, and review before progressing." };
  if (skippedOnly || performed.length === 0) return { ...base, action: "hold", proposedLoad: exercise.targetLoad, proposedReps: exercise.targetReps, reason: "This was skipped, so it is not counted as a performance failure." };
  if ((readiness !== undefined && readiness <= 2) || (soreness !== undefined && soreness >= 4)) return { ...base, action: "hold", proposedLoad: exercise.targetLoad, proposedReps: exercise.targetReps, reason: "Recovery signals are poor. Hold the prescription and reassess next session." };
  const allAtTop = performed.length >= exercise.sets && performed.every((set) => set.reps >= exercise.targetReps[1] && (set.rir === undefined || set.rir >= 2));
  if (allAtTop && exercise.progressionMode === "amrap-rounds") {
    const stage = exercise.progressionStage ?? 1;
    if (stage < 4) {
      const proposedStage = (stage + 1) as 2 | 3 | 4;
      const proposedSets = stage === 1 ? 4 : 5;
      const reason = stage === 1
        ? "Three clean 5 / 10 / 15 rounds are complete. Add one round next time."
        : stage === 2
          ? "Four clean rounds are complete. Build to five rounds next time."
          : "Five clean rounds are established. Keep 5 / 10 / 15, use the next pain-free movement version, and enter the controlled AMRAP stage.";
      return { ...base, action: "increase", proposedReps: exercise.targetReps, proposedSets, proposedStage, reason };
    }
    return { ...base, action: "hold", proposedReps: exercise.targetReps, proposedSets: exercise.sets, proposedStage: 4, reason: "The controlled AMRAP stage is established. Hold the 5 / 10 / 15 structure and add no load or failure reps." };
  }
  if (allAtTop) return exercise.targetLoad !== undefined
    ? { ...base, action: "increase", proposedLoad: roundedLoad(exercise.targetLoad, 1), proposedReps: exercise.targetReps, reason: `All ${exercise.sets} sets reached the top of the range with reps in reserve. Add the smallest practical load next time.` }
    : { ...base, action: "increase", proposedReps: [exercise.targetReps[0] + 1, exercise.targetReps[1] + 1], reason: "Every set was clean at the top of the range. Progress the easiest variable next time." };
  const missedMinimum = performed.length < exercise.sets || performed.some((set) => set.reps < exercise.targetReps[0]);
  if (missedMinimum && recentMisses >= 1) return { ...base, action: "reduce", proposedLoad: exercise.targetLoad ? roundedLoad(exercise.targetLoad, -1) : undefined, proposedReps: exercise.targetReps, reason: "The minimum target was missed in repeated sessions. Reduce one small step and rebuild clean reps." };
  return { ...base, action: "hold", proposedLoad: exercise.targetLoad, proposedReps: exercise.targetReps, reason: missedMinimum ? "The target was missed once. Hold steady; one difficult day is not a trend." : "The work landed inside the target range. Keep the prescription and build consistency." };
}
