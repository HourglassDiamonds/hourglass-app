"use server";

import {
  SterlingApprovalService,
  type SterlingReviewTiming,
} from "@/lib/continuum/sterling/ledger/service";

export type SterlingProposalActionTiming = {
  totalMs: number;
  dependenciesMs: number;
  review: SterlingReviewTiming[];
};

export type SterlingProposalActionState = {
  ok: boolean;
  message: string;
  status?: string;
  timing?: SterlingProposalActionTiming;
} | null;

export async function reviewSterlingProposalAction(
  _previous: SterlingProposalActionState,
  formData: FormData,
): Promise<SterlingProposalActionState> {
  const started = performance.now();
  const proposalId = String(formData.get("proposalId") ?? "").trim();
  const reviewAction = String(formData.get("reviewAction") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim() || null;
  const reviewTiming: SterlingReviewTiming[] = [];
  let dependenciesMs = 0;
  const finish = (
    state: Omit<NonNullable<SterlingProposalActionState>, "timing">,
  ): SterlingProposalActionState => ({
    ...state,
    timing: {
      totalMs: Math.max(0, Math.round((performance.now() - started) * 10) / 10),
      dependenciesMs,
      review: reviewTiming,
    },
  });
  if (!proposalId || !["approve", "reject", "defer", "edit_and_approve"].includes(reviewAction)) {
    return finish({ ok: false, message: "Choose a valid review action." });
  }
  const dependenciesStarted = performance.now();
  const [ledgerModule, jobsModule, candidatesModule, holdsModule] = await Promise.all([
    import("@/lib/continuum/sterling/ledger/load"),
    import("@/lib/continuum/client-memory/project-jobs/load-writer"),
    import("@/lib/continuum/candidates/load"),
    import("@/lib/continuum/sterling/holds/load"),
  ]);
  const [ledger, jobs, candidates, holds] = await Promise.all([
    ledgerModule.getAuthenticatedSterlingProposalRepository(),
    jobsModule.getAuthenticatedProjectJobWriter(),
    candidatesModule.getAuthenticatedCandidateStore(),
    holdsModule.getAuthenticatedConditionalHoldRepository(),
  ]);
  dependenciesMs = Math.max(
    0,
    Math.round((performance.now() - dependenciesStarted) * 10) / 10,
  );
  if (!ledger.ok || !jobs.ok || !candidates.ok) {
    return finish({ ok: false, message: ledger.ok ? "Sterling approval service is unavailable." : ledger.reason === "not-activated" ? "Sterling approval storage has not been migrated yet." : "Sign in and try again." });
  }
  const service = new SterlingApprovalService({
    repository: ledger.repository,
    jobs: jobs.writer,
    candidates: candidates.store,
    actor: jobs.username,
    onTiming: (timing) => reviewTiming.push(timing),
    holds: holds.ok ? holds.repository : undefined,
  });

  let result;
  if (reviewAction === "approve") {
    result = await service.review({ action: "approve", proposalId, note });
  } else if (reviewAction === "reject") {
    result = await service.review({ action: "reject", proposalId, note });
  } else if (reviewAction === "defer") {
    const deferUntil = resolveDeferUntil(
      String(formData.get("deferPreset") ?? "tomorrow"),
      String(formData.get("deferUntil") ?? ""),
    );
    if (!deferUntil) return finish({ ok: false, message: "Choose a valid future defer time." });
    result = await service.review({ action: "defer", proposalId, deferUntil, note });
  } else if (reviewAction === "edit_and_approve") {
    result = await service.review({
      action: "edit_and_approve",
      proposalId,
      editedValue: String(formData.get("editedValue") ?? ""),
      note,
    });
  } else {
    return finish({ ok: false, message: "Choose a valid review action." });
  }

  if (result.ok) {
    if (result.status === "executed" && result.proposal.originalProposal.proposedAction.kind === "activate_hold") {
      const { refreshTodayAfterFounderMutation } = await import("@/lib/continuum/chief-of-staff/operating-loop/load");
      await refreshTodayAfterFounderMutation().catch(() => undefined);
    }
    const message = result.status === "executed"
      ? "Approved and applied through the canonical Continuum service."
      : result.status === "approved-unexecuted"
        ? "Approval recorded. This proposal type has no supported canonical executor."
        : result.status === "rejected"
          ? "Rejected. No canonical state changed."
          : "Deferred. No canonical state changed.";
    return finish({ ok: true, message, status: result.status });
  }
  return finish({ ok: false, message: result.message, status: result.status });
}

function resolveDeferUntil(preset: string, custom: string): string | null {
  const now = new Date();
  if (preset === "later-today") return new Date(now.getTime() + 4 * 60 * 60 * 1000).toISOString();
  if (preset === "tomorrow") return new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
  if (preset !== "custom") return null;
  const parsed = Date.parse(custom);
  return Number.isFinite(parsed) && parsed > now.getTime() ? new Date(parsed).toISOString() : null;
}
