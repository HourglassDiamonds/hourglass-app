import type {
  OperationalBoardDisposition,
  OperationalBoardOwner,
} from "./operational-board-comparison";

type Obligation = {
  obligationId: string;
  description: string;
  status: string;
  responsibleParty: string;
  evidenceRefs: readonly string[];
};

type Recommendation = {
  category: string;
  obligations: readonly Obligation[];
} | null;

export type OperationalBoardDecision = {
  disposition: OperationalBoardDisposition;
  owner: OperationalBoardOwner;
  reason: "evidence_incomplete" | "unsupported_founder_action" | "unsupported_next_step" | "model_classification";
  outstandingObligations: readonly Obligation[];
};

function normalizedOwner(value: string): OperationalBoardOwner {
  return value === "founder" || value === "client" || value === "vendor_shop" ? value :
    value === "none" ? "none" : "unknown";
}

function isOutstanding(obligation: Obligation): boolean {
  return obligation.status === "open" || obligation.status === "ambiguous";
}

function supportedOutstandingObligations(
  obligations: readonly Obligation[],
  owner: OperationalBoardOwner,
): Obligation[] {
  const terminalIds = new Set(obligations
    .filter((row) => row.status === "fulfilled" || row.status === "superseded")
    .map((row) => row.obligationId));
  return obligations.filter((obligation) =>
    isOutstanding(obligation) && !terminalIds.has(obligation.obligationId) &&
    obligation.responsibleParty === owner && obligation.description.trim().length > 0 &&
    obligation.evidenceRefs.length > 0);
}

function supportedFounderObligations(
  obligations: readonly Obligation[],
  recommendation: Recommendation,
): Obligation[] {
  if (recommendation?.category !== "founder_actions") return [];
  const recommended = new Map(
    supportedOutstandingObligations(recommendation.obligations, "founder")
      .map((row) => [row.obligationId, row]),
  );
  return supportedOutstandingObligations(obligations, "founder")
    .filter((obligation) => recommended.has(obligation.obligationId));
}

/**
 * A founder alert is an evidence-backed action, not merely a model-selected owner.
 * Missing live evidence remains visible as unresolved instead of becoming a move.
 */
export function decideOperationalBoardRow(input: {
  nextStepOwner: string;
  todayDisposition: string;
  lifecycle: string | null;
  obligations: readonly Obligation[];
  recommendation: Recommendation;
  evidenceComplete: boolean;
}): OperationalBoardDecision {
  if (!input.evidenceComplete) {
    return { disposition: "ambiguous", owner: "unknown", reason: "evidence_incomplete",
      outstandingObligations: [] };
  }
  if (input.todayDisposition === "ambiguous") {
    return { disposition: "ambiguous", owner: "unknown", reason: "model_classification",
      outstandingObligations: [] };
  }
  const open = input.obligations.some((row) => isOutstanding(row) &&
    !input.obligations.some((other) => other.obligationId === row.obligationId &&
      (other.status === "fulfilled" || other.status === "superseded")));
  if (!open && input.lifecycle === "completed") {
    return { disposition: "resolved", owner: "none", reason: "model_classification",
      outstandingObligations: [] };
  }
  if (!open && input.todayDisposition === "suppressed") {
    return { disposition: "suppressed", owner: "none", reason: "model_classification",
      outstandingObligations: [] };
  }
  if (input.nextStepOwner === "founder") {
    const obligations = supportedFounderObligations(input.obligations, input.recommendation);
    return obligations.length > 0
      ? { disposition: "founder_action", owner: "founder", reason: "model_classification",
          outstandingObligations: obligations }
      : { disposition: "ambiguous", owner: "unknown", reason: "unsupported_founder_action",
          outstandingObligations: [] };
  }
  const owner = normalizedOwner(input.nextStepOwner);
  if (owner === "client" || owner === "vendor_shop") {
    const obligations = supportedOutstandingObligations(input.obligations, owner);
    return obligations.length > 0
      ? { disposition: owner === "client" ? "waiting_on_client" : "waiting_on_shop", owner,
          reason: "model_classification", outstandingObligations: obligations }
      : { disposition: "ambiguous", owner: "unknown", reason: "unsupported_next_step",
          outstandingObligations: [] };
  }
  return { disposition: "ambiguous", owner: "unknown", reason: "model_classification",
    outstandingObligations: [] };
}
