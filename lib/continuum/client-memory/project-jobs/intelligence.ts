/**
 * Deterministic Project Desk work intelligence from canonical Open Jobs.
 * Not Chief of Staff ranking. Not an LLM. Not Gmail. Not note prose.
 *
 * Exact rules:
 * 1. Only unresolved jobs (open | snoozed) on the requested Project.
 * 2. Resolved and cancelled are excluded from every count and flag.
 * 3. Snoozed with deferredUntil in the future is deferred: counted as
 *    unresolved, but excluded from waiting-on, blocked, due, stale, and
 *    forgotten-risk. Snooze is not resolution.
 * 4. Snoozed with deferredUntil missing or already elapsed is defer-elapsed:
 *    treated as active for those signals. State is not rewritten.
 * 5. Waiting-on is the canonical waitingOnActor of active jobs. Never inferred
 *    from subject, detail, or Person display names.
 * 6. Blocked means at least one active job whose kind is blocked_issue.
 *    Vendor-waiting without that kind is not blocked.
 * 7. Past due means an active job with an explicit dueAt earlier than now.
 *    Never inferred. The word is "past due", not an SLA health score.
 * 8. Due soon means an active job with now <= dueAt <= now + 7 days.
 *    A past-due job is not also due-soon.
 * 9. Forgotten-risk is conservative. A job can be old without being a problem.
 *    Only founder or Hourglass active jobs qualify, and only when they are
 *    past due or untouched for 14 days. Client-waiting stays quiet even when
 *    old. Vendor-waiting is not founder forgotten-work. Unknown actor is not
 *    forgotten-risk from age alone.
 * 10. No health score. No red / yellow / green.
 */

import { isUnresolvedOpenJobState } from "./validate";
import type { OpenJobActor, ProjectJob } from "./types";

export const OPEN_JOB_DUE_SOON_MS = 7 * 24 * 60 * 60 * 1000;
export const OPEN_JOB_STALE_MS = 14 * 24 * 60 * 60 * 1000;

export type ProjectWorkWaitingOn = Record<OpenJobActor, number>;

export type ProjectWorkSummary =
  | { connected: false }
  | {
      connected: true;
      unresolvedCount: number;
      activeCount: number;
      deferredCount: number;
      waitingOn: ProjectWorkWaitingOn;
      blocked: boolean;
      dueSoonCount: number;
      pastDueCount: number;
      forgottenRiskCount: number;
      nextDueAt: string | null;
    };

function emptyWaitingOn(): ProjectWorkWaitingOn {
  return {
    founder: 0,
    hourglass: 0,
    client: 0,
    vendor: 0,
    unknown: 0,
  };
}

export function disconnectedProjectWork(): ProjectWorkSummary {
  return { connected: false };
}

function isDeferredQuiet(job: ProjectJob, nowMs: number): boolean {
  if (job.state !== "snoozed") return false;
  if (!job.deferredUntil) return true;
  const until = Date.parse(job.deferredUntil);
  if (!Number.isFinite(until)) return true;
  return until > nowMs;
}

function lastTouchMs(job: ProjectJob): number {
  const updated = Date.parse(job.updatedAt);
  if (Number.isFinite(updated)) return updated;
  const created = Date.parse(job.createdAt);
  return Number.isFinite(created) ? created : Number.NaN;
}

function dueDelta(job: ProjectJob, nowMs: number): number | null {
  if (!job.dueAt) return null;
  const due = Date.parse(job.dueAt);
  if (!Number.isFinite(due)) return null;
  return due - nowMs;
}

export function summarizeProjectWork(
  jobs: readonly ProjectJob[] | null | undefined,
  projectId: string,
  nowIso: string,
): ProjectWorkSummary {
  if (jobs == null) return disconnectedProjectWork();
  const nowMs = Date.parse(nowIso);
  const clock = Number.isFinite(nowMs) ? nowMs : Date.now();
  const unresolved = jobs.filter(
    (row) => row.projectId === projectId && isUnresolvedOpenJobState(row.state),
  );
  const waitingOn = emptyWaitingOn();
  let activeCount = 0;
  let deferredCount = 0;
  let blocked = false;
  let dueSoonCount = 0;
  let pastDueCount = 0;
  let forgottenRiskCount = 0;
  let nextDueAt: string | null = null;

  for (const job of unresolved) {
    if (isDeferredQuiet(job, clock)) {
      deferredCount += 1;
      continue;
    }
    activeCount += 1;
    waitingOn[job.waitingOnActor] += 1;
    if (job.kind === "blocked_issue") blocked = true;
    const delta = dueDelta(job, clock);
    const pastDue = delta != null && delta < 0;
    const dueSoon =
      delta != null && delta >= 0 && delta <= OPEN_JOB_DUE_SOON_MS;
    if (pastDue) pastDueCount += 1;
    if (dueSoon) dueSoonCount += 1;
    if (job.dueAt && delta != null) {
      if (nextDueAt == null || Date.parse(job.dueAt) < Date.parse(nextDueAt)) {
        nextDueAt = job.dueAt;
      }
    }
    const ours =
      job.waitingOnActor === "founder" || job.waitingOnActor === "hourglass";
    const touched = lastTouchMs(job);
    const stale =
      Number.isFinite(touched) && clock - touched >= OPEN_JOB_STALE_MS;
    if (ours && (pastDue || stale)) forgottenRiskCount += 1;
  }

  return {
    connected: true,
    unresolvedCount: unresolved.length,
    activeCount,
    deferredCount,
    waitingOn,
    blocked,
    dueSoonCount,
    pastDueCount,
    forgottenRiskCount,
    nextDueAt,
  };
}
