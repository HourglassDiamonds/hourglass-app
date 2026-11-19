import type {
  OperationalBoardDisposition,
  OperationalBoardOwner,
} from "./operational-board-comparison";

type Obligation = {
  obligationId: string;
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
  reason: "evidence_incomplete" | "unsupported_founder_action" | "model_classification";
};

function normalizedOwner(value: string): OperationalBoardOwner {
  return value === "founder" || value === "client" || value === "vendor_shop" ? value :
    value === "none" ? "none" : "unknown";
}

function isOutstanding(obligation: Obligation): boolean {
  return obligation.status === "open" || obligation.status === "ambiguous";
}

function hasSpecificFounderAction(
  obligations: readonly Obligation[],
  recommendation: Recommendation,
): boolean {
  if (recommendation?.category !== "founder_actions") return false;
  const recommended = new Map(recommendation.obligations.map((row) => [row.obligationId, row]));
  return obligations.some((obligation) => {
    const echoed = recommended.get(obligation.obligationId);
    return isOutstanding(obligation) && obligation.responsibleParty === "founder" &&
      obligation.evidenceRefs.length > 0 && Boolean(echoed && isOutstanding(echoed) &&
        echoed.responsibleParty === "founder" && echoed.evidenceRefs.length > 0);
  });
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
    return { disposition: "ambiguous", owner: "unknown", reason: "evidence_incomplete" };
  }
  if (input.todayDisposition === "ambiguous") {
    return { disposition: "ambiguous", owner: "unknown", reason: "model_classification" };
  }
  const open = input.obligations.some(isOutstanding);
  if (!open && input.lifecycle === "completed") {
    return { disposition: "resolved", owner: "none", reason: "model_classification" };
  }
  if (!open && input.todayDisposition === "suppressed") {
    return { disposition: "suppressed", owner: "none", reason: "model_classification" };
  }
  if (input.nextStepOwner === "founder") {
    return hasSpecificFounderAction(input.obligations, input.recommendation)
      ? { disposition: "founder_action", owner: "founder", reason: "model_classification" }
      : { disposition: "ambiguous", owner: "unknown", reason: "unsupported_founder_action" };
  }
  const owner = normalizedOwner(input.nextStepOwner);
  if (owner === "client") return { disposition: "waiting_on_client", owner, reason: "model_classification" };
  if (owner === "vendor_shop") return { disposition: "waiting_on_shop", owner, reason: "model_classification" };
  return { disposition: "ambiguous", owner: "unknown", reason: "model_classification" };
}
