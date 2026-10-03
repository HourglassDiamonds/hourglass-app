import type { SterlingPreferenceSignal, SterlingProposalKind } from "../types";
import type { SterlingProposalRecord } from "./types";

const MIN_EVIDENCE = 3;

export function deriveLedgerPreferenceSignals(
  history: readonly SterlingProposalRecord[],
  minimumEvidence = MIN_EVIDENCE,
): SterlingPreferenceSignal[] {
  const byType = new Map<SterlingProposalKind, SterlingProposalRecord[]>();
  for (const row of history) {
    if (!row.founderDecision) continue;
    byType.set(row.proposalType, [...(byType.get(row.proposalType) ?? []), row]);
  }
  const signals: SterlingPreferenceSignal[] = [];
  for (const [proposalType, rows] of byType) {
    if (rows.length < minimumEvidence) continue;
    const approvals = rows.filter((row) => row.founderDecision === "approved" || row.founderDecision === "edited_and_approved").length;
    const edits = rows.filter((row) => row.founderDecision === "edited_and_approved").length;
    const defers = rows.filter((row) => row.founderDecision === "deferred").length;
    const rejections = rows.filter((row) => row.founderDecision === "rejected").length;
    signals.push({
      key: `ledger:approval-rate:${proposalType}`,
      description: `${proposalType} proposals: ${approvals}/${rows.length} approved, ${rejections} rejected, ${defers} deferred.`,
      supportingDecisionCount: rows.length,
      confidence: rows.length >= 8 ? "high" : "medium",
      reviewable: true,
    });
    if (edits >= minimumEvidence) {
      signals.push({
        key: `ledger:frequent-edits:${proposalType}`,
        description: `${proposalType} proposals were edited before approval ${edits} times; original wording should be treated cautiously.`,
        supportingDecisionCount: edits,
        confidence: edits >= 8 ? "high" : "medium",
        reviewable: true,
      });
    }
    if (defers >= minimumEvidence) {
      signals.push({
        key: `ledger:repeated-defers:${proposalType}`,
        description: `${proposalType} proposals were deferred ${defers} times; timing should be justified explicitly.`,
        supportingDecisionCount: defers,
        confidence: defers >= 8 ? "high" : "medium",
        reviewable: true,
      });
    }
  }
  return signals;
}

export function decisionContextForProposal(
  proposalType: SterlingProposalKind,
  signals: readonly SterlingPreferenceSignal[],
): string | null {
  const relevant = signals.find((signal) =>
    signal.key === `ledger:frequent-edits:${proposalType}` ||
    signal.key === `ledger:repeated-defers:${proposalType}`,
  );
  return relevant?.description ?? null;
}
