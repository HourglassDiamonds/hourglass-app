/**
 * Founder Today disposition adapter.
 * Reuses CandidateStore review, correctProjectSpec, and Open Job mutate.
 * Inference must never call this. Does not mint Persons or duplicate Projects.
 */

import type { CandidateStore, ContinuumCandidate } from "@/lib/continuum/candidates/types";
import { payloadOf } from "@/lib/continuum/candidates/founder-attention";
import { candidateProjectId } from "@/lib/continuum/chief-of-staff/operating-loop/evidence";
import type {
  CorrectProjectSpecInput,
  CorrectProjectSpecResult,
} from "@/lib/continuum/client-memory/project-spec/correct";
import { isEditableProjectSpecField } from "@/lib/continuum/client-memory/contracts";
import { validateProjectSpecCorrection } from "@/lib/continuum/client-memory/project-spec/validate";
import type { ProjectJobWriter } from "@/lib/continuum/client-memory/project-jobs/writer";
import { completeFounderActionable } from "./complete";
import type { CosFounderVerb } from "./founder-actions";
import { canMutateSpecConflict } from "./founder-actions";
import type { CosDocketOrigin } from "./types";

export type DisposeDocketItemInput = {
  verb: CosFounderVerb;
  origin: CosDocketOrigin;
  itemId: string;
  projectId: string | null;
  jobId: string | null;
  candidateIds: readonly string[];
  specFieldName?: string | null;
  specProposedValue?: string | null;
  specCanonicalValue?: string | null;
  mutationId: string;
  actor: string;
  snoozeUntil?: string | null;
};

export type DisposeDocketItemResult =
  | {
      ok: true;
      verb: CosFounderVerb;
      resolvedAt: string;
      mutatedSpec: boolean;
      reviewedCandidateIds: string[];
      jobAction: "resolve" | "snooze" | "cancel" | null;
    }
  | {
      ok: false;
      reason:
        | "invalid-input"
        | "unsupported-mutation"
        | "candidate-not-found"
        | "job-not-found"
        | "unavailable"
        | "invalid-state";
    };

export type DisposeDocketItemDeps = {
  nowIso: () => string;
  candidates?: CandidateStore | null;
  jobs?: ProjectJobWriter | null;
  correctProjectSpec?: (
    input: CorrectProjectSpecInput,
  ) => Promise<CorrectProjectSpecResult>;
};

function uniqueIds(ids: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    const trimmed = id.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

async function loadCandidates(
  store: CandidateStore,
  ids: readonly string[],
): Promise<ContinuumCandidate[]> {
  const rows: ContinuumCandidate[] = [];
  for (const id of uniqueIds(ids)) {
    const row = await store.get(id);
    if (row) rows.push(row);
  }
  return rows;
}

function specTargets(
  rows: readonly ContinuumCandidate[],
  fieldName: string | null | undefined,
): ContinuumCandidate[] {
  return rows.filter((row) => {
    const payload = payloadOf(row);
    if (payload.kind !== "structured_spec") return false;
    if (fieldName && payload.fieldName !== fieldName) return false;
    return payload.conflict || row.candidateState === "conflict";
  });
}

async function reviewCandidates(
  store: CandidateStore,
  ids: readonly string[],
  input: { action: "approve" | "discard" | "defer"; until?: string | null },
  reviewedAt: string,
): Promise<{ ok: true; ids: string[] } | { ok: false; reason: "candidate-not-found" }> {
  const reviewed: string[] = [];
  for (const id of uniqueIds(ids)) {
    const result = await store.applyReview(
      id,
      input.action === "defer"
        ? { action: "defer", until: input.until ?? null }
        : { action: input.action },
      reviewedAt,
    );
    if (!result.ok) return { ok: false, reason: "candidate-not-found" };
    reviewed.push(id);
  }
  return { ok: true, ids: reviewed };
}

async function resolveJob(
  writer: ProjectJobWriter,
  input: DisposeDocketItemInput,
): Promise<DisposeDocketItemResult> {
  if (!input.jobId || !input.projectId) {
    return { ok: false, reason: "unsupported-mutation" };
  }
  const completed = await completeFounderActionable(writer, {
    sourceType: "open_job",
    projectId: input.projectId,
    jobId: input.jobId,
    mutationId: input.mutationId,
    actor: input.actor,
  });
  if (!completed.ok) {
    if (completed.reason === "job-not-found") return { ok: false, reason: "job-not-found" };
    if (completed.reason === "invalid-state") return { ok: false, reason: "invalid-state" };
    if (completed.reason === "unsupported-writer") {
      return { ok: false, reason: "unsupported-mutation" };
    }
    return { ok: false, reason: "unavailable" };
  }
  return {
    ok: true,
    verb: input.verb,
    resolvedAt: completed.resolvedAt,
    mutatedSpec: false,
    reviewedCandidateIds: [],
    jobAction: "resolve",
  };
}

async function snoozeJob(
  writer: ProjectJobWriter,
  input: DisposeDocketItemInput,
  until: string,
): Promise<DisposeDocketItemResult> {
  if (!input.jobId || !input.projectId) {
    return { ok: false, reason: "unsupported-mutation" };
  }
  const result = await writer.mutateJob({
    mutationId: input.mutationId,
    projectId: input.projectId,
    jobId: input.jobId,
    action: "snooze",
    actor: input.actor,
    deferredUntil: until,
  });
  if (!result.ok) {
    if (result.reason === "job-not-found") return { ok: false, reason: "job-not-found" };
    if (result.code === "invalid-state") return { ok: false, reason: "invalid-state" };
    if (result.reason === "invalid-input") return { ok: false, reason: "invalid-input" };
    return { ok: false, reason: "unavailable" };
  }
  return {
    ok: true,
    verb: input.verb,
    resolvedAt: result.job.updatedAt,
    mutatedSpec: false,
    reviewedCandidateIds: [],
    jobAction: "snooze",
  };
}

async function cancelJob(
  writer: ProjectJobWriter,
  input: DisposeDocketItemInput,
): Promise<DisposeDocketItemResult> {
  if (!input.jobId || !input.projectId) {
    return { ok: false, reason: "unsupported-mutation" };
  }
  const result = await writer.mutateJob({
    mutationId: input.mutationId,
    projectId: input.projectId,
    jobId: input.jobId,
    action: "cancel",
    actor: input.actor,
  });
  if (!result.ok) {
    if (result.reason === "job-not-found") return { ok: false, reason: "job-not-found" };
    if (result.code === "invalid-state") return { ok: false, reason: "invalid-state" };
    return { ok: false, reason: "unavailable" };
  }
  return {
    ok: true,
    verb: input.verb,
    resolvedAt: result.job.updatedAt,
    mutatedSpec: false,
    reviewedCandidateIds: [],
    jobAction: "cancel",
  };
}

export async function disposeDocketItem(
  deps: DisposeDocketItemDeps,
  input: DisposeDocketItemInput,
): Promise<DisposeDocketItemResult> {
  const actor = input.actor.trim();
  const mutationId = input.mutationId.trim();
  if (!actor || !mutationId) return { ok: false, reason: "invalid-input" };
  const now = deps.nowIso();
  const candidateIds = uniqueIds(input.candidateIds);
  const until = input.snoozeUntil?.trim() || null;

  try {
    if (input.verb === "keep_canonical") {
      if (!deps.candidates) return { ok: false, reason: "unavailable" };
      const rows = await loadCandidates(deps.candidates, candidateIds);
      const targets = specTargets(rows, input.specFieldName);
      if (targets.length === 0) return { ok: false, reason: "candidate-not-found" };
      const reviewed = await reviewCandidates(
        deps.candidates,
        targets.map((row) => row.candidateId),
        { action: "discard" },
        now,
      );
      if (!reviewed.ok) return reviewed;
      return {
        ok: true,
        verb: input.verb,
        resolvedAt: now,
        mutatedSpec: false,
        reviewedCandidateIds: reviewed.ids,
        jobAction: null,
      };
    }

    if (input.verb === "adopt_evidence") {
      if (!deps.candidates || !deps.correctProjectSpec) {
        return { ok: false, reason: "unavailable" };
      }
      const rows = await loadCandidates(deps.candidates, candidateIds);
      const targets = specTargets(rows, input.specFieldName);
      const primary = targets[0];
      if (!primary) return { ok: false, reason: "candidate-not-found" };
      const payload = payloadOf(primary);
      if (payload.kind !== "structured_spec") {
        return { ok: false, reason: "unsupported-mutation" };
      }
      const projectId =
        input.projectId?.trim() || candidateProjectId(primary);
      const proposed = input.specProposedValue?.trim() || payload.proposedValue;
      if (
        !projectId ||
        !canMutateSpecConflict(
          { fieldName: payload.fieldName, proposedValue: proposed },
          projectId,
        )
      ) {
        return { ok: false, reason: "unsupported-mutation" };
      }
      if (!isEditableProjectSpecField(payload.fieldName)) {
        return { ok: false, reason: "unsupported-mutation" };
      }
      const parsed = validateProjectSpecCorrection(payload.fieldName, proposed);
      if (!parsed.ok) return { ok: false, reason: "unsupported-mutation" };
      const spec = await deps.correctProjectSpec({
        mutationId,
        projectId,
        fieldName: parsed.field,
        newValue: parsed.value,
        actor,
      });
      if (!spec.ok) return { ok: false, reason: "unsupported-mutation" };
      const reviewed = await reviewCandidates(
        deps.candidates,
        targets.map((row) => row.candidateId),
        { action: "approve" },
        now,
      );
      if (!reviewed.ok) {
        return { ok: false, reason: "unavailable" };
      }
      return {
        ok: true,
        verb: input.verb,
        resolvedAt: now,
        mutatedSpec: true,
        reviewedCandidateIds: reviewed.ids,
        jobAction: null,
      };
    }

    if (input.verb === "need_to_verify") {
      if (!until) return { ok: false, reason: "invalid-input" };
      if (!deps.candidates) return { ok: false, reason: "unavailable" };
      const rows = await loadCandidates(deps.candidates, candidateIds);
      const targets = specTargets(rows, input.specFieldName);
      const ids = (targets.length > 0 ? targets : rows).map((row) => row.candidateId);
      if (ids.length === 0) return { ok: false, reason: "candidate-not-found" };
      const reviewed = await reviewCandidates(
        deps.candidates,
        ids,
        { action: "defer", until },
        now,
      );
      if (!reviewed.ok) return reviewed;
      return {
        ok: true,
        verb: input.verb,
        resolvedAt: now,
        mutatedSpec: false,
        reviewedCandidateIds: reviewed.ids,
        jobAction: null,
      };
    }

    if (input.verb === "request_changes" || input.verb === "follow_up" || input.verb === "snooze") {
      if (!until) return { ok: false, reason: "invalid-input" };
      if (input.jobId && input.projectId && deps.jobs) {
        return snoozeJob(deps.jobs, input, until);
      }
      if (!deps.candidates || candidateIds.length === 0) {
        return { ok: false, reason: "unsupported-mutation" };
      }
      const reviewed = await reviewCandidates(
        deps.candidates,
        candidateIds,
        { action: "defer", until },
        now,
      );
      if (!reviewed.ok) return reviewed;
      return {
        ok: true,
        verb: input.verb,
        resolvedAt: now,
        mutatedSpec: false,
        reviewedCandidateIds: reviewed.ids,
        jobAction: null,
      };
    }

    if (input.verb === "complete" || input.verb === "approve" || input.verb === "responded" || input.verb === "resolved") {
      if (input.jobId && input.projectId && deps.jobs) {
        return resolveJob(deps.jobs, input);
      }
      if (!deps.candidates || candidateIds.length === 0) {
        return { ok: false, reason: "unsupported-mutation" };
      }
      const reviewed = await reviewCandidates(
        deps.candidates,
        candidateIds,
        { action: "discard" },
        now,
      );
      if (!reviewed.ok) return reviewed;
      return {
        ok: true,
        verb: input.verb,
        resolvedAt: now,
        mutatedSpec: false,
        reviewedCandidateIds: reviewed.ids,
        jobAction: null,
      };
    }

    if (input.verb === "disregard") {
      if (input.origin === "open_job" && input.jobId && input.projectId && deps.jobs) {
        return cancelJob(deps.jobs, input);
      }
      if (!deps.candidates || candidateIds.length === 0) {
        return { ok: false, reason: "unsupported-mutation" };
      }
      const rows = await loadCandidates(deps.candidates, candidateIds);
      const existing = rows.map((row) => row.candidateId);
      if (existing.length === 0) return { ok: false, reason: "candidate-not-found" };
      const reviewed = await reviewCandidates(
        deps.candidates,
        existing,
        { action: "discard" },
        now,
      );
      if (!reviewed.ok) return reviewed;
      return {
        ok: true,
        verb: input.verb,
        resolvedAt: now,
        mutatedSpec: false,
        reviewedCandidateIds: reviewed.ids,
        jobAction: null,
      };
    }

    return { ok: false, reason: "invalid-input" };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}
