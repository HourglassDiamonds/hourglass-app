import { attentionModeOf } from "./attention";
import type { AttentionMode, ProjectJob } from "./types";

export type AttentionBoundaryJob = Pick<ProjectJob,
  "jobId" | "state" | "attentionMode" | "activationAt" | "checkpointAt" | "deferredUntil">;

export type AttentionBoundaryState = {
  next: string | null;
  elapsedToken: string;
};

/** Earliest future instant at which any unresolved Job's derived attention can change. */
export function nextAttentionBoundary(
  jobs: readonly AttentionBoundaryJob[] | null | undefined,
  now: Date,
): string | null {
  return attentionBoundaryState(jobs, now).next;
}

/** Shared state for cache expiry and watermarks; it is pure and performs no writes. */
export function attentionBoundaryState(
  jobs: readonly AttentionBoundaryJob[] | null | undefined,
  now: Date,
): AttentionBoundaryState {
  if (!jobs) return { next: null, elapsedToken: "" };
  const clock = now.getTime();
  if (!Number.isFinite(clock)) return { next: null, elapsedToken: "" };
  let next: number | null = null;
  const elapsed: string[] = [];
  const consider = (value: number | null) => {
    if (value != null && (next == null || value < next)) next = value;
  };
  for (const job of jobs) {
    if (job.state === "resolved" || job.state === "cancelled") continue;
    const values: Array<[string, string | null | undefined]> = [["deferred", job.deferredUntil]];
    const mode = attentionModeOf(job);
    if (mode === "reminder") values.push(["activation", job.activationAt]);
    if (mode === "watching") values.push(["checkpoint", job.checkpointAt]);
    for (const [kind, raw] of values) {
      const ms = Date.parse(raw ?? "");
      if (!Number.isFinite(ms)) continue;
      if (ms > clock) consider(ms);
      else elapsed.push(`${job.jobId}:${kind}:${new Date(ms).toISOString()}`);
    }
  }
  return {
    next: next == null ? null : new Date(next).toISOString(),
    elapsedToken: elapsed.sort().join(","),
  };
}

export function attentionBoundaryJobFromRow(row: Record<string, unknown>): AttentionBoundaryJob | null {
  const state = String(row.state ?? "");
  if (!["open", "snoozed", "resolved", "cancelled"].includes(state) || row.job_id == null) return null;
  const mode = String(row.attention_mode ?? "action") as AttentionMode;
  if (!["action", "reminder", "watching"].includes(mode)) return null;
  const text = (value: unknown) => value == null ? null : String(value);
  return {
    jobId: String(row.job_id),
    state: state as ProjectJob["state"],
    attentionMode: mode,
    activationAt: text(row.activation_at),
    checkpointAt: text(row.checkpoint_at),
    deferredUntil: text(row.deferred_until),
  };
}
