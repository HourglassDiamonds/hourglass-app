"use server";

import { revalidatePath } from "next/cache";
import { effectiveCandidatePayload, effectiveCandidateTarget } from "@/lib/continuum/candidates/review";
import { hashEmail } from "@/lib/continuum/client-memory/hashes";
import { confirmGmailPersonAssociation } from "@/lib/continuum/client-memory/founder-project/identity-gate";
import { CONCIERGE_HOME_PATH } from "@/lib/continuum/client-memory/read/presentation";
import {
  isWebsiteIntakeNextActionOwner,
  isWebsiteIntakeDisposition,
} from "@/lib/continuum/client-memory/website-intake-lifecycle";
import { transitionWebsiteIntakeWithWriters } from "@/lib/continuum/client-memory/website-intake-transition";

export type WebsiteIntakeActionState = {
  ok: boolean;
  message: string;
} | null;

function refreshWebsiteIntakeSurfaces() {
  revalidatePath(CONCIERGE_HOME_PATH);
  revalidatePath("/executive-dashboard/concierge/clients");
  revalidatePath("/executive-dashboard/concierge/projects");
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

export async function transitionWebsiteIntakeLifecycle(
  _previous: WebsiteIntakeActionState,
  formData: FormData,
): Promise<WebsiteIntakeActionState> {
  const intakeId = String(formData.get("intakeId") ?? "").trim();
  const disposition = String(formData.get("disposition") ?? "").trim();
  const nextActionOwnerValue = String(formData.get("nextActionOwner") ?? "").trim();
  if (!intakeId || !isWebsiteIntakeDisposition(disposition)) {
    return { ok: false, message: "Choose a valid intake disposition." };
  }
  const nextActionOwner = disposition === "contacted" && isWebsiteIntakeNextActionOwner(nextActionOwnerValue)
    ? nextActionOwnerValue
    : undefined;
  if (disposition === "contacted" && !nextActionOwner) {
    return { ok: false, message: "Choose who owns the next action before creating the contacted opportunity." };
  }
  const [{ getAuthenticatedProjectJobWriter }, { getAuthenticatedFounderProjectWriter }] = await Promise.all([
    import("@/lib/continuum/client-memory/project-jobs/load-writer"),
    import("@/lib/continuum/client-memory/founder-project/load-writer"),
  ]);
  const [intake, jobs, projects] = await Promise.all([
    authorizedIntake(intakeId),
    getAuthenticatedProjectJobWriter(),
    getAuthenticatedFounderProjectWriter(),
  ]);
  if (!intake || !jobs.ok || !projects.ok || !intake.personId) {
    return { ok: false, message: "Sign in again or reopen the intake before changing it." };
  }

  const result = await transitionWebsiteIntakeWithWriters({
    intake,
    disposition,
    jobs: jobs.writer,
    projects: projects.writer,
    actor: jobs.username,
    nextActionOwner,
  });
  if (!result.ok) {
    if (result.partialProjectId) {
      return { ok: false, message: "The opportunity exists, but lifecycle completion failed. New Concierge remains active for a safe retry." };
    }
    return { ok: false, message: "The intake stayed unchanged because the reviewed lifecycle transition could not be saved." };
  }
  refreshWebsiteIntakeSurfaces();
  return {
    ok: true,
    message: result.status === "already-present"
      ? "This inquiry already has that lifecycle state."
      : disposition === "new"
        ? "Restored to New Concierge. The prior disposition and audit history remain preserved."
        : disposition === "contacted"
      ? `Contacted opportunity created in Projects with ${nextActionOwner === "client" ? "Waiting on Client" : nextActionOwner === "founder" ? "Founder Action" : "Next Step Unresolved"}. The inquiry and correspondence review remain preserved.`
      : `Classified as ${disposition === "test_submission" ? "a test submission" : "a solicitation"}. It is out of New Concierge and can be restored here.`,
  };
}
