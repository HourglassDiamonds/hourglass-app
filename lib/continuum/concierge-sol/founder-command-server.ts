/** Authenticated server adapter. Canonical writers remain the sole mutation boundary. */
import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { getAuthenticatedProjectJobWriter } from "@/lib/continuum/client-memory/project-jobs/load-writer";
import { getAuthenticatedClientMemoryNoteWriter } from "@/lib/continuum/client-memory/write/load";
import { getAuthenticatedProjectDeskReader } from "@/lib/continuum/client-memory/project-desk/load";
import { loadProjectJobs } from "@/lib/continuum/client-memory/project-jobs/load";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { getAuthenticatedClientMemoryReader } from "@/lib/continuum/client-memory/read/load";
import { getAuthenticatedCandidateStore } from "@/lib/continuum/candidates/load";
import {
  applyFounderOperation,
  correctionNote,
  type FounderOperation,
  type FounderCommandResult,
} from "./founder-command";

export type TodayCommandTarget = {
  itemId: string;
  label: string;
  projectId: string | null;
  jobId: string | null;
};

export async function executeAuthenticatedTargetedFounderOperation(
  operation: FounderOperation,
  target: TodayCommandTarget,
  refresh: () => Promise<void>,
): Promise<FounderCommandResult> {
  if (operation.kind === "clarify") {
    return { status: "clarify", text: operation.question, refresh: false };
  }
  const [jobs, notes] = await Promise.all([
    getAuthenticatedProjectJobWriter(),
    getAuthenticatedClientMemoryNoteWriter(),
  ]);
  if (!jobs.ok || !notes.ok) {
    return { status: "failed", text: "Unable to authorize this change. Sign in and try again.", refresh: false };
  }
  try {
    let changed = false;
    if (operation.kind === "correct") {
      if (!target.projectId) {
        return { status: "clarify", text: "Which existing project should I update?", refresh: false };
      }
      if (target.jobId && operation.truth.ballHolder !== "founder") {
        const job = await jobs.writer.getJob(target.projectId, target.jobId);
        if (job && (job.state === "open" || job.state === "snoozed")) {
          const resolved = await jobs.writer.mutateJob({
            mutationId: randomUUID(),
            projectId: target.projectId,
            jobId: target.jobId,
            action: "resolve",
            actor: jobs.username,
          });
          if (!resolved.ok) throw new Error("job-mutation-failed");
        }
      }
      const note = await notes.writer.addManualNote({
        submissionId: randomUUID(),
        projectId: target.projectId,
        personId: null,
        contextLayer: "client",
        noteText: correctionNote(operation),
        actor: jobs.username,
      });
      changed = note.ok;
    } else {
      if (!target.jobId) {
        return executeAuthenticatedFounderOperation(operation, refresh);
      }
      const job = await jobs.writer.getJob(target.projectId, target.jobId);
      if (!job || (job.state !== "open" && job.state !== "snoozed")) {
        return { status: "failed", text: "That active work item could not be found.", refresh: false };
      }
      if (operation.kind === "snooze" && (!operation.days || operation.days < 1 || operation.days > 365)) {
        return { status: "clarify", text: "When should I bring it back?", refresh: false };
      }
      const result = await jobs.writer.mutateJob({
        mutationId: randomUUID(),
        projectId: target.projectId,
        jobId: target.jobId,
        action: operation.kind,
        actor: jobs.username,
        ...(operation.kind === "snooze"
          ? { deferredUntil: new Date(Date.now() + operation.days! * 86_400_000).toISOString() }
          : {}),
      });
      changed = result.ok;
    }
    if (!changed) return { status: "failed", text: "The update failed. No successful change was confirmed.", refresh: false };
    try {
      await refresh();
    } catch {
      return { status: "applied", text: "Saved. Today is still refreshing.", refresh: true };
    }
    return { status: "applied", text: `${target.label} updated.`, refresh: true };
  } catch {
    return { status: "failed", text: "The update failed. No successful change was confirmed.", refresh: false };
  }
}

export async function executeAuthenticatedFounderOperation(
  operation: FounderOperation,
  refresh: () => Promise<void>,
): Promise<FounderCommandResult> {
  if (operation.kind === "clarify")
    return {
      status: "clarify",
      text: operation.question,
      refresh: false,
    };
  const [jobs, notes, desk, peopleReader, candidates] = await Promise.all([
    getAuthenticatedProjectJobWriter(),
    getAuthenticatedClientMemoryNoteWriter(),
    getAuthenticatedProjectDeskReader(),
    getAuthenticatedClientMemoryReader(),
    getAuthenticatedCandidateStore(),
  ]);
  if (!jobs.ok || !notes.ok || !desk.ok || !peopleReader.ok)
    return {
      status: "failed",
      text: "Unable to authorize this change. Sign in and try again.",
      refresh: false,
    };
  try {
    const client = getSupabaseAdmin();
    if (!client) throw new Error("unavailable");
    const canonicalJobs = await loadProjectJobs(client);
    if (!canonicalJobs) throw new Error("jobs-unavailable");
    let people = operation.kind === "correct"
      ? await peopleReader.reader.searchPeople(operation.target, { limit: 20 })
      : [];
    if (operation.kind === "correct" && people.length === 0) {
      const firstName = operation.target.replace(/[^a-z\s]/gi, " ").trim().split(/\s+/)[0] ?? "";
      if (firstName) people = await peopleReader.reader.searchPeople(firstName, { limit: 20 });
    }
    return await applyFounderOperation({
      operation,
      projects: await desk.reader.listProjects(),
      people,
      jobs: canonicalJobs,
      jobWriter: jobs.writer,
      noteWriter: notes.writer,
      candidateStore: candidates.ok ? candidates.store : null,
      actor: jobs.username,
      mutationId: operation.kind === "correct" ? deterministicMutationId(operation) : randomUUID(),
      now: new Date(),
      refresh,
    });
  } catch {
    return {
      status: "failed",
      text: "The update failed. No successful change was confirmed.",
      refresh: false,
    };
  }
}

function deterministicMutationId(operation: FounderOperation): string {
  const hex = createHash("sha256").update(JSON.stringify(operation)).digest("hex").slice(0, 32).split("");
  hex[12] = "5";
  hex[16] = ((Number.parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  const value = hex.join("");
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}
