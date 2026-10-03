import type { ProjectJobWriter } from "@/lib/continuum/client-memory/project-jobs/writer";
import type { SourceCommunicationEvent } from "@/lib/continuum/source-events/types";
import { fingerprintCanonicalState } from "../fingerprint";
import { matchHoldCondition } from "./match";
import type { ConditionalHoldRepository, CreateConditionalHoldInput } from "./types";

export class ConditionalHoldService {
  constructor(private readonly deps: { repository: ConditionalHoldRepository; jobs: ProjectJobWriter }) {}
  async activate(input: CreateConditionalHoldInput, events: readonly SourceCommunicationEvent[] = []) {
    const job = await this.deps.jobs.getJob(input.projectId, input.entityId);
    if (!job || !["open", "snoozed"].includes(job.state)) return { ok: false as const, reason: "job-not-open" };
    if (job.updatedAt !== input.expectedEntityUpdatedAt || fingerprintCanonicalState(job) !== input.currentStateFingerprint) return { ok: false as const, reason: "stale-job" };
    if (matchHoldCondition({ condition: input.condition, activatedAt: input.activatedAt, events, now: new Date(input.activatedAt) })) return { ok: false as const, reason: "condition-already-met" };
    const created = await this.deps.repository.create(input); return { ok: true as const, ...created };
  }
  async evaluate(events: readonly SourceCommunicationEvent[], now: Date) {
    const changed = [];
    for (const hold of await this.deps.repository.listActive()) {
      const job = await this.deps.jobs.getJob(hold.projectId, hold.entityId);
      if (!job || !["open", "snoozed"].includes(job.state)) { changed.push((await this.deps.repository.close(hold.holdId, "closed_terminal", now.toISOString())).record); continue; }
      if (hold.status !== "active") continue;
      const evidence = matchHoldCondition({ condition: hold.condition, activatedAt: hold.activatedAt, events, now });
      if (evidence) changed.push((await this.deps.repository.markConditionMet(hold.holdId, now.toISOString(), evidence)).record);
    }
    return changed;
  }
  async confirmResume(holdId: string, now: Date) {
    const hold = await this.deps.repository.get(holdId); if (!hold) return { ok: false as const, reason: "not-found" };
    const job = await this.deps.jobs.getJob(hold.projectId, hold.entityId);
    if (!job || !["open", "snoozed"].includes(job.state)) { await this.deps.repository.close(holdId, "closed_terminal", now.toISOString()); return { ok: false as const, reason: "job-not-open" }; }
    if (hold.status !== "condition_met" && hold.status !== "resumed") return { ok: false as const, reason: "condition-not-met" };
    const result = await this.deps.repository.resume(holdId, now.toISOString(), hold.resumeEvidence ?? { sourceRef: "founder-confirmation", observedAt: now.toISOString(), summary: "Founder confirmed resume." });
    return { ok: true as const, ...result };
  }
  async resumeNow(holdId: string, now: Date) {
    const hold = await this.deps.repository.get(holdId); if (!hold) return { ok: false as const, reason: "not-found" };
    const job = await this.deps.jobs.getJob(hold.projectId, hold.entityId);
    if (!job || !["open", "snoozed"].includes(job.state)) { await this.deps.repository.close(holdId, "closed_terminal", now.toISOString()); return { ok: false as const, reason: "job-not-open" }; }
    const evidence = { sourceRef: "founder-confirmation", observedAt: now.toISOString(), summary: "Founder explicitly resumed this hold." };
    return { ok: true as const, ...(await this.deps.repository.resumeNow(holdId, now.toISOString(), evidence)) };
  }
}
