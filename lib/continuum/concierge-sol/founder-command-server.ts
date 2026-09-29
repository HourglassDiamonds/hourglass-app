/** Authenticated server adapter. Canonical writers remain the sole mutation boundary. */
import "server-only";
import { randomUUID } from "node:crypto";
import { getAuthenticatedProjectJobWriter } from "@/lib/continuum/client-memory/project-jobs/load-writer";
import { getAuthenticatedClientMemoryNoteWriter } from "@/lib/continuum/client-memory/write/load";
import { getAuthenticatedProjectDeskReader } from "@/lib/continuum/client-memory/project-desk/load";
import { loadProjectJobs } from "@/lib/continuum/client-memory/project-jobs/load";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import {
  applyFounderOperation,
  type FounderOperation,
  type FounderCommandResult,
} from "./founder-command";

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
  const [jobs, notes, desk] = await Promise.all([
    getAuthenticatedProjectJobWriter(),
    getAuthenticatedClientMemoryNoteWriter(),
    getAuthenticatedProjectDeskReader(),
  ]);
  if (!jobs.ok || !notes.ok || !desk.ok)
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
    return await applyFounderOperation({
      operation,
      projects: await desk.reader.listProjects(),
      jobs: canonicalJobs,
      jobWriter: jobs.writer,
      noteWriter: notes.writer,
      actor: jobs.username,
      mutationId: randomUUID(),
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
