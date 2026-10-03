import type { SterlingResponse, SterlingTruth } from "../types";
import type { SterlingProposalRepository } from "./types";

export async function persistSterlingResponse(
  repository: SterlingProposalRepository,
  response: SterlingResponse,
  truth: SterlingTruth,
  replacesProposalId: string | null = null,
): Promise<SterlingResponse> {
  if (response.proposals.length === 0) return { ...response, ledgerStatus: "not-applicable" };
  const persisted = new Set<string>();
  try {
    for (const proposal of response.proposals) {
      await repository.create({
        proposalId: proposal.proposalId,
        proposalType: proposal.kind,
        affectedEntityType: proposal.affectedEntity.kind,
        affectedEntityId: proposal.affectedEntity.id,
        currentStateFingerprint: proposal.currentStateFingerprint,
        currentStateSnapshot: proposal.currentStateSnapshot,
        entityVersion: entityVersionOf(proposal.proposedAction, proposal.currentStateSnapshot),
        originalProposal: { ...proposal, persistence: "pending" },
        evidenceRefs: proposal.evidence,
        reasoningSummary: proposal.reason,
        confidence: proposal.confidence,
        sourceWorkflow: response.kind,
        sourceWatermark: truth.sourceWatermark,
        provider: response.telemetry.provider,
        model: response.telemetry.model,
        modelConfiguration: response.telemetry.modelConfiguration,
        runId: response.telemetry.runId,
        traceId: null,
        replacesProposalId,
        createdAt: truth.generatedAt,
        contractVersion: response.telemetry.contractVersion,
        promptVersion: response.telemetry.promptVersion,
      });
      persisted.add(proposal.proposalId);
    }
    return markPersistence(response, persisted, "persisted");
  } catch {
    return markPersistence(response, persisted, "unavailable");
  }
}

export async function persistRegeneratedSterlingResponse(
  repository: SterlingProposalRepository,
  response: SterlingResponse,
  truth: SterlingTruth,
  replacesProposalId: string,
): Promise<SterlingResponse> {
  const persisted = await persistSterlingResponse(repository, response, truth, replacesProposalId);
  const replacement = persisted.proposals.find((proposal) => proposal.persistence === "persisted");
  if (replacement) {
    await repository.supersede(replacesProposalId, replacement.proposalId, "regenerated-from-current-truth", truth.generatedAt);
  }
  return persisted;
}

export function markSterlingLedgerUnavailable(
  response: SterlingResponse,
  status: "not-activated" | "unavailable",
): SterlingResponse {
  return markPersistence(response, new Set(), status);
}

function markPersistence(
  response: SterlingResponse,
  persisted: ReadonlySet<string>,
  ledgerStatus: SterlingResponse["ledgerStatus"],
): SterlingResponse {
  const proposals = response.proposals.map((proposal) => ({
    ...proposal,
    persistence: persisted.has(proposal.proposalId) ? "persisted" as const :
      ledgerStatus === "not-activated" ? "not-activated" as const : "unavailable" as const,
  }));
  const byId = new Map(proposals.map((proposal) => [proposal.proposalId, proposal]));
  return {
    ...response,
    proposals,
    findings: response.findings.map((finding) => ({
      ...finding,
      proposal: finding.proposal ? byId.get(finding.proposal.proposalId) ?? finding.proposal : null,
    })),
    ledgerStatus,
  };
}

function entityVersionOf(action: { kind: string; expectedUpdatedAt?: string }, snapshot: unknown): string | null {
  if (action.kind === "update_job" && action.expectedUpdatedAt) return action.expectedUpdatedAt;
  if (snapshot && typeof snapshot === "object") {
    const value = snapshot as Record<string, unknown>;
    if (typeof value.reviewedAt === "string") return value.reviewedAt;
    if (typeof value.createdAt === "string") return value.createdAt;
  }
  return null;
}
