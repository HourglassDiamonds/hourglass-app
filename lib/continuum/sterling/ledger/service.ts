import type { CandidateStore, ContinuumCandidate } from "@/lib/continuum/candidates/types";
import type { ProjectJobWriter } from "@/lib/continuum/client-memory/project-jobs/writer";
import type { OpenJobActor, ProjectJob } from "@/lib/continuum/client-memory/project-jobs/types";
import { fingerprintCanonicalState } from "../fingerprint";
import type { SterlingProposedAction } from "../types";
import type { SterlingProposalRecord, SterlingProposalRepository } from "./types";
import { ConditionalHoldService } from "../holds/service";
import type { ConditionalHoldRepository } from "../holds/types";

export type SterlingReviewInput =
  | { action: "approve"; proposalId: string; note?: string | null }
  | { action: "edit_and_approve"; proposalId: string; editedValue: string; note?: string | null }
  | { action: "reject"; proposalId: string; note?: string | null }
  | { action: "defer"; proposalId: string; deferUntil: string; note?: string | null };

export type SterlingReviewResult =
  | { ok: true; status: "executed" | "approved-unexecuted" | "rejected" | "deferred"; proposal: SterlingProposalRecord; idempotent: boolean }
  | { ok: false; status: "not-found" | "invalid" | "stale" | "failed" | "conflict"; message: string; proposal?: SterlingProposalRecord };

export type SterlingReviewTimingStage =
  | "ledger-read"
  | "ledger-decision"
  | "currentness-check"
  | "ledger-claim"
  | "canonical-writer"
  | "ledger-finalize";

export type SterlingReviewTiming = {
  stage: SterlingReviewTimingStage;
  durationMs: number;
};

export class SterlingApprovalService {
  constructor(private readonly deps: {
    repository: SterlingProposalRepository;
    jobs: ProjectJobWriter;
    candidates: CandidateStore;
    actor: string;
    nowIso?: () => string;
    clockMs?: () => number;
    onTiming?: (timing: SterlingReviewTiming) => void;
    holds?: ConditionalHoldRepository;
  }) {}

  async review(input: SterlingReviewInput): Promise<SterlingReviewResult> {
    const now = (this.deps.nowIso ?? (() => new Date().toISOString()))();
    if (
      !isUuid(input.proposalId) ||
      (input.note?.length ?? 0) > 1000 ||
      (input.action === "edit_and_approve" && input.editedValue.length > 160)
    ) return invalid("Invalid proposal review input.");
    const existing = await this.timed("ledger-read", () =>
      this.deps.repository.get(input.proposalId));
    if (!existing) return { ok: false, status: "not-found", message: "Proposal not found." };

    if (input.action === "reject") {
      const decision = await this.timed("ledger-decision", () =>
        this.deps.repository.recordRejection(input.proposalId, { decidedAt: now, note: input.note }));
      return decision.ok
        ? { ok: true, status: "rejected", proposal: decision.record, idempotent: decision.idempotent }
        : conflict(decision.reason);
    }
    if (input.action === "defer") {
      if (!validFutureIso(input.deferUntil, now)) return invalid("Choose a future defer time.");
      const decision = await this.timed("ledger-decision", () =>
        this.deps.repository.recordDefer(input.proposalId, input.deferUntil, { decidedAt: now, note: input.note }));
      return decision.ok
        ? { ok: true, status: "deferred", proposal: decision.record, idempotent: decision.idempotent }
        : conflict(decision.reason);
    }

    const editedAction = input.action === "edit_and_approve"
      ? editSterlingAction(existing.originalProposal.proposedAction, input.editedValue)
      : null;
    if (input.action === "edit_and_approve" && !editedAction) return invalid("That edit is not valid for this proposal.");
    if (existing.status === "executed") {
      return { ok: true, status: "executed", proposal: existing, idempotent: true };
    }
    const resume = ["approved", "edited_and_approved", "executing", "failed"].includes(existing.status);
    if (resume && (
      (editedAction && existing.founderDecision !== "edited_and_approved") ||
      (!editedAction && existing.founderDecision !== "approved")
    )) return conflict("decision-conflict");
    const decision = resume
      ? { ok: true as const, record: existing, idempotent: true }
      : editedAction
        ? await this.timed("ledger-decision", () =>
          this.deps.repository.recordEditAndApproval(input.proposalId, editedAction, { decidedAt: now, note: input.note }))
        : await this.timed("ledger-decision", () =>
          this.deps.repository.recordApproval(input.proposalId, { decidedAt: now, note: input.note }));
    if (!decision.ok) return conflict(decision.reason);
    const decided = decision.record;
    const action = decided.founderEditedPayload ?? decided.originalProposal.proposedAction;

    if (action.kind === "unsupported") {
      const blocked = await this.timed("ledger-finalize", () =>
        this.deps.repository.markUnsupported(
          decided.proposalId,
          "unsupported-proposal-execution",
          now,
        ));
      if (!blocked.ok) return conflict(blocked.reason);
      return { ok: true, status: "approved-unexecuted", proposal: blocked.record, idempotent: decision.idempotent };
    }

    const current = await this.timed("currentness-check", () => this.currentEntity(action));
    if (!current || fingerprintCanonicalState(current) !== decided.currentStateFingerprint) {
      const stale = await this.timed("ledger-finalize", () =>
        this.deps.repository.supersede(
          decided.proposalId,
          null,
          current ? "current-state-fingerprint-mismatch" : "canonical-entity-missing",
          now,
        ));
      return {
        ok: false,
        status: "stale",
        message: current
          ? "The canonical item changed after Sterling proposed this action. Nothing was executed."
          : "The canonical item no longer exists. Nothing was executed.",
        proposal: stale.ok ? stale.record : decided,
      };
    }

    const claimed = await this.timed("ledger-claim", () =>
      this.deps.repository.markExecuting(decided.proposalId));
    if (!claimed.ok) return conflict(claimed.reason);
    const execution = await this.timed("canonical-writer", () =>
      this.execute(action, decided.proposalId));
    if (!execution.ok) {
      if (execution.category === "stale-write" || execution.category === "job-not-found") {
        const stale = await this.timed("ledger-finalize", () =>
          this.deps.repository.supersede(decided.proposalId, null, execution.category, now));
        return { ok: false, status: "stale", message: "The canonical item changed before execution. Nothing was applied.", proposal: stale.ok ? stale.record : claimed.record };
      }
      const failed = await this.timed("ledger-finalize", () =>
        this.deps.repository.markFailed(decided.proposalId, execution.category, now));
      return { ok: false, status: "failed", message: "The canonical writer failed. The failure is recorded and can be retried safely.", proposal: failed.ok ? failed.record : claimed.record };
    }
    const completed = await this.timed("ledger-finalize", () =>
      this.deps.repository.markExecuted(decided.proposalId, decided.proposalId, action, now));
    if (!completed.ok) return conflict(completed.reason);
    return { ok: true, status: "executed", proposal: completed.record, idempotent: decision.idempotent || claimed.idempotent || execution.idempotent };
  }

  private async currentEntity(action: SterlingProposedAction): Promise<ProjectJob | ContinuumCandidate | null> {
    if (action.kind === "update_job") return this.deps.jobs.getJob(action.projectId, action.jobId);
    if (action.kind === "activate_hold") return this.deps.jobs.getJob(action.projectId, action.jobId);
    if (action.kind === "create_projectless_job") return this.deps.candidates.get(action.candidateId);
    return null;
  }

  private async execute(action: Exclude<SterlingProposedAction, { kind: "unsupported" }>, mutationId: string) {
    if (action.kind === "update_job") {
      const result = await this.deps.jobs.mutateJob({
        mutationId,
        projectId: action.projectId,
        jobId: action.jobId,
        action: "update",
        actor: this.deps.actor,
        waitingOnActor: action.waitingOnActor,
        dueAt: action.dueAt,
        expectedUpdatedAt: action.expectedUpdatedAt,
      });
      if (!result.ok) return { ok: false as const, category: result.code ?? result.reason };
      return { ok: true as const, idempotent: result.status === "already-present" };
    }
    if (action.kind === "activate_hold") {
      if (!this.deps.holds) return { ok: false as const, category: "conditional-holds-not-activated" };
      const now = (this.deps.nowIso ?? (() => new Date().toISOString()))();
      const service = new ConditionalHoldService({ repository: this.deps.holds, jobs: this.deps.jobs });
      const result = await service.activate({
        holdId: action.holdId, entityType: "job", entityId: action.jobId, projectId: action.projectId,
        createdAt: now, createdBy: this.deps.actor, reason: action.reason, condition: action.condition,
        sourceRefs: action.sourceRefs, approvalProposalId: mutationId, provenance: "sterling-founder-approved",
        activatedAt: now, expectedEntityUpdatedAt: action.expectedUpdatedAt,
        currentStateFingerprint: fingerprintCanonicalState(await this.deps.jobs.getJob(action.projectId, action.jobId)),
      });
      return result.ok ? { ok: true as const, idempotent: result.idempotent } : { ok: false as const, category: result.reason };
    }
    const result = await this.deps.jobs.createJob({
      mutationId,
      projectId: null,
      kind: action.jobKind,
      subject: action.subject,
      detail: action.detail,
      waitingOnActor: action.waitingOnActor,
      dueAt: action.dueAt,
      actor: this.deps.actor,
      sourceSystem: "continuum",
      sourceRef: action.sourceRef,
    });
    if (!result.ok) return { ok: false as const, category: result.code ?? result.reason };
    return { ok: true as const, idempotent: result.status === "already-present" };
  }

  private async timed<T>(stage: SterlingReviewTimingStage, task: () => Promise<T>): Promise<T> {
    const clock = this.deps.clockMs ?? (() => performance.now());
    const started = clock();
    try {
      return await task();
    } finally {
      this.deps.onTiming?.({
        stage,
        durationMs: Math.max(0, Math.round((clock() - started) * 10) / 10),
      });
    }
  }
}

export function editSterlingAction(
  original: SterlingProposedAction,
  value: string,
): SterlingProposedAction | null {
  const edited = value.trim();
  if (!edited) return null;
  if (original.kind === "update_job") {
    if (!isActor(edited)) return null;
    return { ...original, waitingOnActor: edited };
  }
  if (original.kind === "create_projectless_job") {
    if (edited.length > 160) return null;
    return { ...original, subject: edited };
  }
  if (original.kind === "activate_hold") return null;
  return null;
}

function isActor(value: string): value is OpenJobActor {
  return ["founder", "hourglass", "client", "vendor", "unknown"].includes(value);
}

function validFutureIso(value: string, now: string): boolean {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && parsed > Date.parse(now);
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function invalid(message: string): SterlingReviewResult {
  return { ok: false, status: "invalid", message };
}

function conflict(reason: string): SterlingReviewResult {
  return { ok: false, status: "conflict", message: `Proposal transition rejected: ${reason}.` };
}
