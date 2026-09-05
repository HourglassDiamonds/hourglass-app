"use server";

import { redirect } from "next/navigation";
import { getAuthenticatedProjectJobWriter } from "@/lib/continuum/client-memory/project-jobs/load-writer";
import type { CreateProjectJobResult } from "@/lib/continuum/client-memory/project-jobs/create";
import type { MutateOpenJobResult } from "@/lib/continuum/client-memory/project-jobs/mutate";
import { conciergeProjectPath } from "@/lib/continuum/client-memory/read/presentation";

export type SaveOpenJobState = { ok: false; message: string } | null;

function parseDateInput(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return `${trimmed}T00:00:00.000Z`;
  }
  return trimmed;
}

function humanCreateMessage(result: CreateProjectJobResult): string {
  if (result.ok) return "Unable to save the open job.";
  if (result.code === "invalid-kind" || result.code === "invalid-actor") {
    return "Choose a valid job type and actor.";
  }
  if (result.code === "invalid-subject") {
    return "Add a short subject.";
  }
  if (result.code === "person-not-on-project") {
    return "That person is not linked to this project.";
  }
  if (result.reason === "entity-kind-mismatch" || result.reason === "project-not-found") {
    return "That project could not be found.";
  }
  return "Unable to save the open job.";
}

function humanMutateMessage(result: MutateOpenJobResult): string {
  if (result.ok) return "Unable to update the open job.";
  if (result.code === "wrong-project") {
    return "That open job does not belong to this project.";
  }
  if (result.code === "invalid-state") {
    return "That change is not available for this job.";
  }
  if (result.code === "invalid-defer") {
    return "Choose a defer date.";
  }
  if (result.code === "person-not-on-project") {
    return "That person is not linked to this project.";
  }
  if (result.reason === "job-not-found" || result.reason === "project-not-found") {
    return "That open job could not be found.";
  }
  return "Unable to update the open job.";
}

export async function saveOpenJob(
  _prev: SaveOpenJobState,
  formData: FormData,
): Promise<SaveOpenJobState> {
  const auth = await getAuthenticatedProjectJobWriter();
  if (!auth.ok) {
    return {
      ok: false,
      message:
        auth.reason === "unauthorized"
          ? "Sign in to continue."
          : "Unable to save the open job.",
    };
  }
  const projectId = String(formData.get("projectId") ?? "").trim();
  const result = await auth.writer.createJob({
    mutationId: String(formData.get("mutationId") ?? "").trim(),
    projectId,
    kind: String(formData.get("kind") ?? "").trim(),
    subject: String(formData.get("subject") ?? ""),
    detail: String(formData.get("detail") ?? ""),
    waitingOnActor: String(formData.get("waitingOnActor") ?? "").trim(),
    associatedPersonId: String(formData.get("associatedPersonId") ?? "").trim() || null,
    dueAt: parseDateInput(String(formData.get("dueAt") ?? "")),
    actor: auth.username,
  });
  if (result.ok) {
    redirect(`${conciergeProjectPath(projectId)}?saved=job`);
  }
  return { ok: false, message: humanCreateMessage(result) };
}

export async function mutateOpenJobAction(
  _prev: SaveOpenJobState,
  formData: FormData,
): Promise<SaveOpenJobState> {
  const auth = await getAuthenticatedProjectJobWriter();
  if (!auth.ok) {
    return {
      ok: false,
      message:
        auth.reason === "unauthorized"
          ? "Sign in to continue."
          : "Unable to update the open job.",
    };
  }
  const projectId = String(formData.get("projectId") ?? "").trim();
  const associatedRaw = String(formData.get("associatedPersonId") ?? "");
  const dueRaw = String(formData.get("dueAt") ?? "");
  const result = await auth.writer.mutateJob({
    mutationId: String(formData.get("mutationId") ?? "").trim(),
    projectId,
    jobId: String(formData.get("jobId") ?? "").trim(),
    action: String(formData.get("action") ?? "").trim(),
    actor: auth.username,
    deferredUntil: parseDateInput(String(formData.get("deferredUntil") ?? "")),
    subject: String(formData.get("subject") ?? ""),
    detail: String(formData.get("detail") ?? ""),
    waitingOnActor: String(formData.get("waitingOnActor") ?? "").trim(),
    associatedPersonId: associatedRaw.trim() || null,
    clearAssociatedPerson: associatedRaw.trim() === "",
    dueAt: parseDateInput(dueRaw),
    clearDueAt: dueRaw.trim() === "",
  });
  if (result.ok) {
    redirect(`${conciergeProjectPath(projectId)}?saved=job`);
  }
  return { ok: false, message: humanMutateMessage(result) };
}
