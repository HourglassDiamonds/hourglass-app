"use server";

import { revalidatePath } from "next/cache";
import { CONCIERGE_HOME_PATH } from "@/lib/continuum/client-memory/read/presentation";
import { editSterlingAction, SterlingApprovalService } from "@/lib/continuum/sterling/ledger/service";

export type SterlingProposalActionState = {
  ok: boolean;
  message: string;
  status?: string;
} | null;

export async function reviewSterlingProposalAction(
  _previous: SterlingProposalActionState,
  formData: FormData,
): Promise<SterlingProposalActionState> {
  const [ledgerModule, jobsModule, candidatesModule] = await Promise.all([
    import("@/lib/continuum/sterling/ledger/load"),
    import("@/lib/continuum/client-memory/project-jobs/load-writer"),
    import("@/lib/continuum/candidates/load"),
  ]);
  const [ledger, jobs, candidates] = await Promise.all([
    ledgerModule.getAuthenticatedSterlingProposalRepository(),
    jobsModule.getAuthenticatedProjectJobWriter(),
    candidatesModule.getAuthenticatedCandidateStore(),
  ]);
  if (!ledger.ok || !jobs.ok || !candidates.ok) {
    return { ok: false, message: ledger.ok ? "Sterling approval service is unavailable." : ledger.reason === "not-activated" ? "Sterling approval storage has not been migrated yet." : "Sign in and try again." };
  }
  const proposalId = String(formData.get("proposalId") ?? "").trim();
  const action = String(formData.get("reviewAction") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim() || null;
  const service = new SterlingApprovalService({
    repository: ledger.repository,
    jobs: jobs.writer,
    candidates: candidates.store,
    actor: jobs.username,
  });

  let result;
  if (action === "approve") {
    result = await service.review({ action: "approve", proposalId, note });
  } else if (action === "reject") {
    result = await service.review({ action: "reject", proposalId, note });
  } else if (action === "defer") {
    const deferUntil = resolveDeferUntil(
      String(formData.get("deferPreset") ?? "tomorrow"),
      String(formData.get("deferUntil") ?? ""),
    );
    if (!deferUntil) return { ok: false, message: "Choose a valid future defer time." };
    result = await service.review({ action: "defer", proposalId, deferUntil, note });
  } else if (action === "edit_and_approve") {
    const record = await ledger.repository.get(proposalId);
    if (!record) return { ok: false, message: "Proposal not found." };
    const editedAction = editSterlingAction(
      record.originalProposal.proposedAction,
      String(formData.get("editedValue") ?? ""),
    );
    if (!editedAction) return { ok: false, message: "That edit is not valid for this proposal." };
    result = await service.review({ action: "edit_and_approve", proposalId, editedAction, note });
  } else {
    return { ok: false, message: "Choose a valid review action." };
  }

  if (result.ok) {
    revalidatePath(CONCIERGE_HOME_PATH);
    const message = result.status === "executed"
      ? "Approved and applied through the canonical Continuum writer."
      : result.status === "approved-unexecuted"
        ? "Approval recorded. This proposal type has no supported canonical executor."
        : result.status === "rejected"
          ? "Rejected. No canonical state changed."
          : "Deferred. No canonical state changed.";
    return { ok: true, message, status: result.status };
  }
  return { ok: false, message: result.message, status: result.status };
}

function resolveDeferUntil(preset: string, custom: string): string | null {
  const now = new Date();
  if (preset === "later-today") return new Date(now.getTime() + 4 * 60 * 60 * 1000).toISOString();
  if (preset === "tomorrow") return new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
  if (preset !== "custom") return null;
  const parsed = Date.parse(custom);
  return Number.isFinite(parsed) && parsed > now.getTime() ? new Date(parsed).toISOString() : null;
}
