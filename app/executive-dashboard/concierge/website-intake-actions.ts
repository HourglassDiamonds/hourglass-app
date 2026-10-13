"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { effectiveCandidatePayload, effectiveCandidateTarget } from "@/lib/continuum/candidates/review";
import { hashEmail } from "@/lib/continuum/client-memory/hashes";
import { confirmGmailPersonAssociation } from "@/lib/continuum/client-memory/founder-project/identity-gate";
import { CONCIERGE_HOME_PATH } from "@/lib/continuum/client-memory/read/presentation";

export type WebsiteIntakeActionState = {
  ok: boolean;
  message: string;
} | null;

function refreshWebsiteIntakeSurfaces() {
  revalidatePath(CONCIERGE_HOME_PATH);
  revalidatePath("/executive-dashboard/concierge/clients");
}

async function authorizedIntake(intakeId: string) {
  const { getAuthenticatedClientWebsiteIntakeReader } = await import("@/lib/continuum/client-memory/read/website-intake-load");
  const access = await getAuthenticatedClientWebsiteIntakeReader();
  if (!access.ok) return null;
  const rows = await access.reader.listRecent({ limit: 25 });
  return rows.find((row) => row.intakeId === intakeId) ?? null;
}

export async function confirmWebsiteIntakeCorrespondence(
  _previous: WebsiteIntakeActionState,
  formData: FormData,
): Promise<WebsiteIntakeActionState> {
  const intakeId = String(formData.get("intakeId") ?? "").trim();
  const candidateId = String(formData.get("candidateId") ?? "").trim();
  if (!intakeId || !candidateId) return { ok: false, message: "That intake association is no longer available." };
  const [{ getAuthenticatedCandidateStore }, { getAuthenticatedClientMemoryReader }] = await Promise.all([
    import("@/lib/continuum/candidates/load"),
    import("@/lib/continuum/client-memory/read/load"),
  ]);
  const [intake, candidates, people] = await Promise.all([
    authorizedIntake(intakeId),
    getAuthenticatedCandidateStore(),
    getAuthenticatedClientMemoryReader(),
  ]);
  if (!intake || !candidates.ok || !people.ok || !intake.personId) {
    return { ok: false, message: "Sign in again or reopen the intake before confirming correspondence." };
  }
  const candidate = await candidates.store.get(candidateId);
  const payload = candidate ? effectiveCandidatePayload(candidate) : null;
  const target = candidate ? effectiveCandidateTarget(candidate) : null;
  const expectedHash = hashEmail(intake.email);
  if (
    !candidate ||
    candidate.candidateType !== "person_association" ||
    candidate.sourceSystem !== "gmail" ||
    candidate.candidateState === "superseded" ||
    payload?.kind !== "person_association" ||
    !expectedHash ||
    payload.emailHash !== expectedHash
  ) {
    return { ok: false, message: "The indexed correspondence does not safely match this intake." };
  }
  if (candidate.reviewStatus === "approved") {
    if (target?.kind !== "person" || target.personId !== intake.personId) {
      return { ok: false, message: "That correspondence was approved for a different Person." };
    }
    return { ok: true, message: "Correspondence is already linked to this prospect." };
  }
  if (candidate.reviewStatus !== "pending") {
    return { ok: false, message: "That correspondence review is no longer pending." };
  }
  const result = await confirmGmailPersonAssociation({
    store: candidates.store,
    personExists: async (personId) => {
      if (personId !== intake.personId) return false;
      return (await people.reader.getPersonProfile(personId)).ok;
    },
    body: { candidateId, personId: intake.personId, actor: "founder" },
  });
  if (!result.ok) return { ok: false, message: "The correspondence association was not saved." };
  refreshWebsiteIntakeSurfaces();
  return { ok: true, message: "Correspondence linked to the existing prospect. No Project was created." };
}

export async function closeWebsiteIntake(
  _previous: WebsiteIntakeActionState,
  formData: FormData,
): Promise<WebsiteIntakeActionState> {
  const intakeId = String(formData.get("intakeId") ?? "").trim();
  const disposition = String(formData.get("disposition") ?? "").trim();
  if (!intakeId || (disposition !== "dismiss" && disposition !== "established")) {
    return { ok: false, message: "Choose a valid intake disposition." };
  }
  const { getAuthenticatedProjectJobWriter } = await import("@/lib/continuum/client-memory/project-jobs/load-writer");
  const [intake, jobs] = await Promise.all([
    authorizedIntake(intakeId),
    getAuthenticatedProjectJobWriter(),
  ]);
  if (!intake || !jobs.ok || !intake.jobId) {
    return { ok: false, message: "Sign in again or reopen the intake before changing it." };
  }
  const job = await jobs.writer.getJob(null, intake.jobId);
  if (!job || (job.state !== "open" && job.state !== "snoozed")) {
    return { ok: true, message: "This intake is already out of the active queue." };
  }
  if (disposition === "established" && intake.correspondenceReview?.status !== "approved") {
    return { ok: false, message: "Confirm the trusted correspondence association first." };
  }
  const result = await jobs.writer.mutateJob({
    mutationId: randomUUID(),
    projectId: null,
    jobId: intake.jobId,
    action: disposition === "dismiss" ? "cancel" : "resolve",
    actor: jobs.username,
  });
  if (!result.ok) return { ok: false, message: "The intake stayed active because the reviewed change could not be saved." };
  refreshWebsiteIntakeSurfaces();
  return {
    ok: true,
    message: disposition === "dismiss"
      ? "Dismissed from active intake. The original submission and audit history remain preserved."
      : "Moved out of New Intake. The prospect and linked correspondence remain preserved.",
  };
}
