import type { AttentionMetadata } from "./types";
import type { MutateOpenJobInput } from "./mutate";

type MutationBase = Pick<MutateOpenJobInput, "mutationId" | "jobId" | "projectId" | "actor">;

export type ReminderDisposition =
  | { kind: "done" }
  | { kind: "cancel" }
  | { kind: "snooze"; deferredUntil: string }
  | { kind: "reschedule"; activationAt: string; metadata: AttentionMetadata };

export type WatchingDisposition =
  | { kind: "checked-still-waiting"; checkpointAt?: string | null; metadata?: AttentionMetadata }
  | { kind: "stop-watching" }
  | { kind: "dependency-resolved" };

export function reminderDispositionMutation(base: MutationBase, disposition: ReminderDisposition): MutateOpenJobInput {
  if (disposition.kind === "done") return { ...base, action: "resolve" };
  if (disposition.kind === "cancel") return { ...base, action: "cancel" };
  if (disposition.kind === "snooze") return { ...base, action: "snooze", deferredUntil: disposition.deferredUntil };
  return { ...base, action: "reschedule_attention", attentionMode: "reminder",
    activationAt: disposition.activationAt, checkpointAt: null, attentionMetadata: disposition.metadata };
}

export function watchingDispositionMutation(base: MutationBase, disposition: WatchingDisposition): MutateOpenJobInput {
  if (disposition.kind === "stop-watching") return { ...base, action: "stop_watching" };
  if (disposition.kind === "dependency-resolved") return { ...base, action: "dependency_resolved" };
  const metadata = disposition.metadata && disposition.checkpointAt == null
    ? { ...disposition.metadata, unscheduledConfirmed: true as const }
    : disposition.metadata;
  return { ...base, action: "watch_checked", attentionMode: "watching",
    checkpointAt: disposition.checkpointAt ?? null, attentionMetadata: metadata };
}
