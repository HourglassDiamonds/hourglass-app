"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  conciergeProjectPath,
  isProjectIdParam,
} from "@/lib/continuum/client-memory/read/presentation";

export async function reviewProjectEvidence(formData: FormData): Promise<void> {
  const projectId = String(formData.get("projectId") ?? "").trim();
  const reviewKey = String(formData.get("reviewKey") ?? "").trim();
  const decision = String(formData.get("decision") ?? "").trim();
  const path = isProjectIdParam(projectId)
    ? conciergeProjectPath(projectId)
    : "/executive-dashboard/concierge/projects";
  if (decision !== "trust" && decision !== "reject") redirect(path);
  const { getAuthenticatedFounderProjectWriter } = await import(
    "@/lib/continuum/client-memory/founder-project/load-writer"
  );
  const auth = await getAuthenticatedFounderProjectWriter();
  if (!auth.ok) redirect(path);
  const { persistProjectEvidenceReview } = await import(
    "@/lib/continuum/project-evidence/write"
  );
  const result = await persistProjectEvidenceReview({
    projectId,
    reviewKey,
    decision,
    reviewedBy: auth.username,
  });
  revalidatePath(path);
  if (!result.ok) redirect(`${path}?evidence=${result.reason}`);
  redirect(`${path}?evidence=saved`);
}
