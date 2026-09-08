"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getAuthenticatedProjectJobWriter } from "@/lib/continuum/client-memory/project-jobs/load-writer";
import { CONCIERGE_HOME_PATH } from "@/lib/continuum/client-memory/read/presentation";
import { completeFounderActionable } from "@/lib/continuum/chief-of-staff/operating-loop/complete";

function humanMessage(
  reason: string | undefined,
  unauthorized: boolean,
): string {
  if (unauthorized) return "Sign in to continue.";
  if (reason === "unsupported-writer") {
    return "This item cannot be completed from here.";
  }
  if (reason === "invalid-state") {
    return "That change is not available for this job.";
  }
  if (reason === "job-not-found" || reason === "project-not-found") {
    return "That open job could not be found.";
  }
  return "Unable to complete this item.";
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
