"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getAuthenticatedProjectJobWriter } from "@/lib/continuum/client-memory/project-jobs/load-writer";
import { getAuthenticatedClientMemoryProjectSpecWriter } from "@/lib/continuum/client-memory/project-spec/load";
import { getAuthenticatedCandidateStore } from "@/lib/continuum/candidates/load";
import { CONCIERGE_HOME_PATH } from "@/lib/continuum/client-memory/read/presentation";
import { completeFounderActionable } from "@/lib/continuum/chief-of-staff/operating-loop/complete";
import { disposeDocketItem } from "@/lib/continuum/chief-of-staff/operating-loop/disposition";
import {
  isFounderVerb,
  isSnoozePreset,
  snoozeUntilForPreset,
} from "@/lib/continuum/chief-of-staff/operating-loop/founder-actions";
import type { CosDocketOrigin } from "@/lib/continuum/chief-of-staff/operating-loop/types";

function humanMessage(
  reason: string | undefined,
  unauthorized: boolean,
): string {
  if (unauthorized) return "Sign in to continue.";
  if (reason === "unsupported-writer" || reason === "unsupported-mutation") {
    return "This item cannot be completed from here.";
  }
  if (reason === "invalid-state") {
    return "That change is not available for this job.";
  }
  if (reason === "job-not-found" || reason === "project-not-found") {
    return "That open job could not be found.";
  }
  if (reason === "candidate-not-found") {
    return "That recommendation could not be found.";
  }
  return "Unable to complete this item.";
}

function isDocketOrigin(value: string): value is CosDocketOrigin {
  return (
    value === "brief" ||
    value === "open_job" ||
    value === "decision" ||
    value === "anomaly" ||
    value === "signal" ||
    value === "master_sprint"
  );
}

export async function completeTop5OpenJobAction(formData: FormData) {
  const auth = await getAuthenticatedProjectJobWriter();
  if (!auth.ok) {
    throw new Error(humanMessage(undefined, auth.reason === "unauthorized"));
  }
  const result = await completeFounderActionable(auth.writer, {
    sourceType: String(formData.get("sourceType") ?? "").trim(),
    projectId: String(formData.get("projectId") ?? "").trim(),
    jobId: String(formData.get("jobId") ?? "").trim(),
    mutationId: String(formData.get("mutationId") ?? "").trim(),
    actor: auth.username,
  });
  if (result.ok) {
    revalidatePath(CONCIERGE_HOME_PATH);
    redirect(CONCIERGE_HOME_PATH);
  }
  throw new Error(humanMessage(result.reason, false));
}

export async function disposeTodayDocketItemAction(formData: FormData) {
  const verbRaw = String(formData.get("verb") ?? "").trim();
  const originRaw = String(formData.get("origin") ?? "").trim();
  if (!isFounderVerb(verbRaw) || !isDocketOrigin(originRaw)) {
    throw new Error(humanMessage("invalid-input", false));
  }
  const presetRaw = String(formData.get("snoozePreset") ?? "").trim();
  const chosenDate = String(formData.get("snoozeDate") ?? "").trim();
  const nowIso = new Date().toISOString();
  const snoozeUntil = isSnoozePreset(presetRaw)
    ? snoozeUntilForPreset(presetRaw, nowIso, chosenDate)
    : String(formData.get("snoozeUntil") ?? "").trim() || null;

  const jobs = await getAuthenticatedProjectJobWriter();
  if (!jobs.ok) {
    throw new Error(humanMessage(undefined, jobs.reason === "unauthorized"));
  }
  const candidates = await getAuthenticatedCandidateStore();
  const specs = await getAuthenticatedClientMemoryProjectSpecWriter();
  const result = await disposeDocketItem(
    {
      nowIso: () => nowIso,
      candidates: candidates.ok ? candidates.store : null,
      jobs: jobs.writer,
      correctProjectSpec: specs.ok
        ? (input) => specs.writer.correctProjectSpec(input)
        : undefined,
    },
    {
      verb: verbRaw,
      origin: originRaw,
      itemId: String(formData.get("itemId") ?? "").trim(),
      projectId: String(formData.get("projectId") ?? "").trim() || null,
      jobId: String(formData.get("jobId") ?? "").trim() || null,
      candidateIds: String(formData.get("candidateIds") ?? "")
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean),
      specFieldName: String(formData.get("specFieldName") ?? "").trim() || null,
      specProposedValue: String(formData.get("specProposedValue") ?? "").trim() || null,
      specCanonicalValue: String(formData.get("specCanonicalValue") ?? "").trim() || null,
      mutationId: String(formData.get("mutationId") ?? "").trim() || randomUUID(),
      actor: jobs.username,
      snoozeUntil,
    },
  );
  if (result.ok) {
    revalidatePath(CONCIERGE_HOME_PATH);
    redirect(CONCIERGE_HOME_PATH);
  }
  throw new Error(humanMessage(result.reason, false));
}
