import type {
  SterlingFounderDirectiveRecord,
  SterlingFounderObligationUpdate,
  SterlingProductionEstimate,
} from "./types";

export type FinalCadDecision = "delivered" | "revision_requested" | "approved";
export type ProductionLeadTimeQuote = {
  quantity: number;
  unit: "business_days" | "calendar_days" | "weeks";
  quotedText: string;
  sourceRef: string;
};

type FinalCadWorkflowProjection = Pick<
  SterlingFounderDirectiveRecord,
  "lifecycleStage" | "lifecycleEffectiveOn" | "operationalSubstage" | "productionEstimate" |
  "waitingOn" | "attentionPriority" | "disposition" | "obligationUpdates"
>;

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function requireDateOnly(value: string, field: string): string {
  if (!DATE_ONLY.test(value) || !Number.isFinite(Date.parse(`${value}T00:00:00Z`))) {
    throw new Error(`invalid-${field}`);
  }
  return value;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function completionOn(startOn: string, quote: ProductionLeadTimeQuote): string {
  if (!Number.isInteger(quote.quantity) || quote.quantity <= 0 || quote.quantity > 365 ||
      !quote.quotedText.trim() || quote.quotedText.length > 240 ||
      !quote.sourceRef.trim() || quote.sourceRef.length > 240) {
    throw new Error("invalid-production-lead-time");
  }
  const date = new Date(`${requireDateOnly(startOn, "approval-date")}T12:00:00Z`);
  if (quote.unit === "weeks") {
    date.setUTCDate(date.getUTCDate() + quote.quantity * 7);
    return isoDate(date);
  }
  if (quote.unit === "calendar_days") {
    date.setUTCDate(date.getUTCDate() + quote.quantity);
    return isoDate(date);
  }
  let remaining = quote.quantity;
  while (remaining > 0) {
    date.setUTCDate(date.getUTCDate() + 1);
    const day = date.getUTCDay();
    if (day !== 0 && day !== 6) remaining -= 1;
  }
  return isoDate(date);
}

function estimate(approvalOn: string, quote?: ProductionLeadTimeQuote): SterlingProductionEstimate {
  if (!quote) return { status: "pending", completionOn: null, quotedLeadTime: null, sourceRef: null };
  return {
    status: "estimated",
    completionOn: completionOn(approvalOn, quote),
    quotedLeadTime: quote.quotedText.trim(),
    sourceRef: quote.sourceRef.trim(),
  };
}

function obligation(
  obligationId: string,
  description: string,
  status: SterlingFounderObligationUpdate["status"],
  responsibleParty: SterlingFounderObligationUpdate["responsibleParty"],
): SterlingFounderObligationUpdate {
  return { obligationId, description, status, responsibleParty };
}

/**
 * General founder rule for final-CAD state changes. Delivery creates a founder
 * review turn; revision stays in CAD; approval itself starts Production and a
 * shop wait. No separate production-start message is required.
 */
export function projectFinalCadWorkflow(input: {
  decision: FinalCadDecision;
  eventOn: string;
  existingApprovalOn?: string | null;
  productionLeadTime?: ProductionLeadTimeQuote;
}): FinalCadWorkflowProjection {
  const eventOn = requireDateOnly(input.eventOn, "event-date");
  if (input.decision === "delivered") {
    return {
      lifecycleStage: "cad",
      lifecycleEffectiveOn: undefined,
      operationalSubstage: "Final CAD received · Founder review required",
      productionEstimate: undefined,
      waitingOn: "founder",
      attentionPriority: "action_now",
      disposition: "active",
      obligationUpdates: [
        obligation("shop-final-cad", "Shop delivered the final CAD.", "fulfilled", "vendor_shop"),
        obligation("founder-cad-review", "Founder reviews the final CAD.", "open", "founder"),
      ],
    };
  }
  if (input.decision === "revision_requested") {
    return {
      lifecycleStage: "cad",
      lifecycleEffectiveOn: undefined,
      operationalSubstage: "Final CAD revision requested",
      productionEstimate: undefined,
      waitingOn: "vendor_shop",
      attentionPriority: "monitor",
      disposition: "active",
      obligationUpdates: [
        obligation("shop-final-cad", "Shop delivers the revised final CAD.", "open", "vendor_shop"),
        obligation("founder-cad-review", "Founder reviews the revised final CAD after delivery.", "open", "founder"),
      ],
    };
  }
  const approvalOn = input.existingApprovalOn
    ? requireDateOnly(input.existingApprovalOn, "existing-approval-date")
    : eventOn;
  const productionEstimate = estimate(approvalOn, input.productionLeadTime);
  return {
    lifecycleStage: "production",
    lifecycleEffectiveOn: approvalOn,
    operationalSubstage: productionEstimate.status === "estimated"
      ? `In production · Estimated completion ${productionEstimate.completionOn}`
      : "In production · Production ETA pending",
    productionEstimate,
    waitingOn: "vendor_shop",
    attentionPriority: "monitor",
    disposition: "active",
    obligationUpdates: [
      obligation("shop-final-cad", "Shop delivered the final CAD.", "fulfilled", "vendor_shop"),
      obligation("founder-cad-review", "Founder approved the final CAD.", "fulfilled", "founder"),
      obligation("shop-production-completion", "Shop completes production and returns the finished piece.", "open", "vendor_shop"),
    ],
  };
}
