"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAuthenticatedFounderProjectWriter } from "@/lib/continuum/client-memory/founder-project/load-writer";
import {
  createSupabaseFounderAssociationDecisionStore,
  persistFounderAssociationDecision,
} from "@/lib/continuum/today-sterling/founder-association-decision";
import { isVerifiedSterlingTodayPreviewRuntime } from "@/lib/continuum/today-sterling/server-config";
import { getSupabaseAdmin } from "@/lib/supabase/client";

const PATH = "/executive-dashboard/concierge/sterling-today/associations";

export async function reviewFounderCorrespondenceAssociation(formData: FormData): Promise<void> {
  if (!isVerifiedSterlingTodayPreviewRuntime()) redirect(`${PATH}?association=not-preview`);
  const auth = await getAuthenticatedFounderProjectWriter();
  const client = getSupabaseAdmin();
  if (!auth.ok || !client) redirect(`${PATH}?association=unauthorized`);
  const decision = String(formData.get("decision") ?? "");
  if (decision !== "confirm" && decision !== "reject") redirect(`${PATH}?association=invalid`);
  const result = await persistFounderAssociationDecision({
    threadId: String(formData.get("threadId") ?? ""),
    personId: String(formData.get("personId") ?? ""),
    projectId: String(formData.get("projectId") ?? ""),
    jobId: String(formData.get("jobId") ?? "").trim() || null,
    reviewKey: String(formData.get("reviewKey") ?? ""),
    decision,
    reviewedBy: auth.username,
    store: createSupabaseFounderAssociationDecisionStore(client),
  });
  revalidatePath(PATH);
  redirect(`${PATH}?association=${result.ok ? result.status : result.reason}`);
}
