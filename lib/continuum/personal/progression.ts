import type { ExercisePrescription, PerformedSet, ProgressionProposal } from "./types";

export function proposeProgression(exercise: ExercisePrescription, sets: PerformedSet[]): ProgressionProposal {
  const performed = sets.filter((set) => set.completed && !set.skipped);
  const id = `progression-${exercise.id}-${Date.now()}`;
  if (sets.some((set) => set.pain)) return { id, exerciseId: exercise.id, action: "regress", proposedLoad: exercise.targetLoad ? Math.max(0, exercise.targetLoad - 5) : undefined, reason: "Pain/discomfort was flagged. Use a pain-free regression and review before progressing.", status: "pending" };
  if (!performed.length) return { id, exerciseId: exercise.id, action: "hold", proposedLoad: exercise.targetLoad, reason: "Skipped or unperformed sets are not counted as failure.", status: "pending" };
  const top = performed.length >= exercise.sets && performed.every((set) => set.reps >= exercise.targetReps[1] && (set.rir === undefined || set.rir >= 2));
  if (top && exercise.targetLoad !== undefined) return { id, exerciseId: exercise.id, action: "increase", proposedLoad: exercise.targetLoad + (exercise.targetLoad < 30 ? 2.5 : 5), reason: "All sets reached the top of the range with reps in reserve.", status: "pending" };
  const missed = performed.length < exercise.sets || performed.some((set) => set.reps < exercise.targetReps[0]);
  return { id, exerciseId: exercise.id, action: missed ? "reduce" : "hold", proposedLoad: missed && exercise.targetLoad ? Math.max(0, exercise.targetLoad - 5) : exercise.targetLoad, reason: missed ? "The minimum prescription was missed; reduce one small step." : "The work landed inside the target range.", status: "pending" };
}
