export type TodayMutationPhase = "visible" | "pending" | "settled" | "failed";

export type TodayMutationEvent =
  | { type: "begin" }
  | { type: "succeed" }
  | { type: "fail" };

export function transitionTodayMutationPhase(
  phase: TodayMutationPhase,
  event: TodayMutationEvent,
): TodayMutationPhase {
  if (event.type === "begin") return "pending";
  if (event.type === "succeed") return "settled";
  if (event.type === "fail") return "failed";
  return phase;
}

export function isTodayItemVisible(phase: TodayMutationPhase): boolean {
  return phase === "visible" || phase === "failed";
}
