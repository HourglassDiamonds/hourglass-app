/**
 * Founder completion adapter for Top 5 / recap confirmation.
 * Not a generic "complete anything" writer.
 * Open Jobs resolve only through mutateOpenJob({ action: "resolve" }).
 * Inference must never call this.
 */

import type { ProjectJobWriter } from "@/lib/continuum/client-memory/project-jobs/writer";
import type { OpenJobMutationRecord } from "@/lib/continuum/client-memory/project-jobs/mutate";
import type { ProjectJob } from "@/lib/continuum/client-memory/project-jobs/types";
import type { ActionableSourceType, CosCompletionWriter } from "./types";

export type CompleteActionableInput = {
  sourceType: string;
  projectId: string;
  jobId: string;
  mutationId: string;
  actor: string;
};

export type CompleteActionableResult =
  | {
      ok: true;
      writer: CosCompletionWriter;
      job: ProjectJob;
      resolvedAt: string;
      provenance: {
        mutationId: string;
        changedAt: string;
        changedBy: string;
        action: "resolve";
      };
    }
  | {
      ok: false;
      reason:
        | "unsupported-writer"
        | "invalid-input"
        | "job-not-found"
        | "project-not-found"
        | "unavailable"
        | "invalid-state";
    };

function isActionableSourceType(value: string): value is ActionableSourceType {
  return value === "open_job";
}

export function completionWriterFor(
  sourceType: string,
): CosCompletionWriter | null {
  if (sourceType === "open_job") return "open_job.resolve";
  return null;
}

export async function completeFounderActionable(
  writer: ProjectJobWriter,
  input: CompleteActionableInput,
): Promise<CompleteActionableResult> {
  if (!isActionableSourceType(input.sourceType)) {
    return { ok: false, reason: "unsupported-writer" };
  }
  const result = await writer.mutateJob({
    mutationId: input.mutationId,
    projectId: input.projectId,
    jobId: input.jobId,
    action: "resolve",
    actor: input.actor,
  });
  if (!result.ok) {
    if (result.reason === "job-not-found") return { ok: false, reason: "job-not-found" };
    if (result.reason === "project-not-found") {
      return { ok: false, reason: "project-not-found" };
    }
    if (result.code === "invalid-state") return { ok: false, reason: "invalid-state" };
    if (result.reason === "invalid-input") return { ok: false, reason: "invalid-input" };
    return { ok: false, reason: "unavailable" };
  }
  const resolvedAt = result.job.resolvedAt ?? result.job.updatedAt;
  return {
    ok: true,
    writer: "open_job.resolve",
    job: result.job,
    resolvedAt,
    provenance: {
      mutationId: input.mutationId,
      changedAt: resolvedAt,
      changedBy: input.actor,
      action: "resolve",
    },
  };
}

export function mutationProvenance(
  records: readonly OpenJobMutationRecord[],
  mutationId: string,
): OpenJobMutationRecord | null {
  return records.find((row) => row.mutationId === mutationId) ?? null;
}
