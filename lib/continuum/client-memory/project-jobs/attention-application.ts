import { attentionModeOf } from "./attention";
import {
  reminderDispositionMutation,
  watchingDispositionMutation,
  type ReminderDisposition,
  type WatchingDisposition,
} from "./attention-disposition";
import type { ProjectJobWriter } from "./writer";

type Base = { mutationId: string; jobId: string; projectId: string | null; actor: string };
export type AttentionDispositionInput = Base & (
  | { mode: "reminder"; disposition: ReminderDisposition }
  | { mode: "watching"; disposition: WatchingDisposition }
);

export async function applyAttentionDisposition(
  writer: ProjectJobWriter,
  input: AttentionDispositionInput,
) {
  const job = await writer.getJob(input.projectId, input.jobId);
  if (!job || attentionModeOf(job) !== input.mode) {
    return { ok: false as const, reason: "job-not-found" as const };
  }
  const base = {
    mutationId: input.mutationId,
    jobId: input.jobId,
    projectId: input.projectId,
    actor: input.actor,
  };
  return writer.mutateJob(input.mode === "reminder"
    ? reminderDispositionMutation(base, input.disposition)
    : watchingDispositionMutation(base, input.disposition));
}
