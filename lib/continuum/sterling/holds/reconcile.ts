import type { ProjectJob } from "@/lib/continuum/client-memory/project-jobs/types";
import type { SourceCommunicationEvent } from "@/lib/continuum/source-events/types";
import { matchHoldCondition } from "./match";
import type { ConditionalHoldRepository } from "./types";

/** Read-cycle reconciler. It may mark evidence found, but never resumes work. */
export async function reconcileConditionalHolds(input: {
  repository: ConditionalHoldRepository;
  jobs: readonly ProjectJob[];
  events: readonly SourceCommunicationEvent[];
  now: Date;
}) {
  const byId = new Map(input.jobs.map((job) => [job.jobId, job]));
  const changed = [];
  for (const hold of await input.repository.listActive()) {
    const job = byId.get(hold.entityId);
    if (!job || !["open", "snoozed"].includes(job.state)) {
      changed.push((await input.repository.close(hold.holdId, "closed_terminal", input.now.toISOString())).record);
      continue;
    }
    if (hold.status !== "active") continue;
    const evidence = matchHoldCondition({ condition: hold.condition, activatedAt: hold.activatedAt, events: input.events, now: input.now });
    if (evidence) changed.push((await input.repository.markConditionMet(hold.holdId, input.now.toISOString(), evidence)).record);
  }
  return changed;
}
