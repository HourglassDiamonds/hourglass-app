/**
 * Delivery eligibility — Chief of Staff owns synthesis; this gate decides send vs alert vs nothing.
 */

import type { AgentRun, DeliveryGuidance } from "../types";

export type DeliveryEligibility =
  | {
      action: "send-founder-brief";
      degraded: boolean;
      reason: string;
    }
  | {
      action: "send-failure-alert";
      reason: string;
    }
  | {
      action: "send-nothing";
      reason: string;
    }
  | {
      action: "block";
      reason: string;
    };

const MAX_FOUNDER_PRIORITIES = 5;

/**
 * Determine whether a completed Agent OS run may deliver a normal/degraded brief,
 * a failure alert, or nothing. Never fabricates delivery state.
 */
export function evaluateDeliveryEligibility(input: {
  run: AgentRun;
  /** When persistence was required and failed. */
  persistenceOk: boolean;
  dryRun?: boolean;
}): DeliveryEligibility {
  const { run } = input;

  if (!input.persistenceOk) {
    return {
      action: "block",
      reason: "Durable persistence unavailable or failed — fail closed, no email",
    };
  }

  if (run.brief.surfacedPriorityTitles.length > MAX_FOUNDER_PRIORITIES) {
    return {
      action: "block",
      reason: `Five-priority contract violated (${run.brief.surfacedPriorityTitles.length} titles)`,
    };
  }

  if (run.runStatus === "failed") {
    return {
      action: "send-failure-alert",
      reason: "Agent OS run failed — not a normal founder brief",
    };
  }

  // Materially incomplete: blocked with no usable recommendations
  if (
    run.runStatus === "blocked" &&
    run.recommendationAvailability === "none-blocked-by-sources"
  ) {
    return {
      action: "send-failure-alert",
      reason: "Materially incomplete run — critical sources blocked recommendations",
    };
  }

  if (run.briefEvidenceQuality === "failed") {
    return {
      action: "send-failure-alert",
      reason: "Chief of Staff brief evidence quality failed",
    };
  }

  const guidance: DeliveryGuidance = run.deliveryGuidance;

  if (guidance === "send-failure-alert") {
    return {
      action: "send-failure-alert",
      reason: "deliveryGuidance=send-failure-alert",
    };
  }

  if (guidance === "send-nothing") {
    return {
      action: "send-nothing",
      reason: "Healthy quiet cycle — no material founder priorities",
    };
  }

  if (guidance === "send-degraded-partial-brief") {
    return {
      action: "send-founder-brief",
      degraded: true,
      reason:
        "Degraded but usable run — brief must identify degraded areas; source gaps are not deterioration",
    };
  }

  if (guidance === "send-normal-brief") {
    return {
      action: "send-founder-brief",
      degraded: false,
      reason: "Normal founder brief eligible",
    };
  }

  return {
    action: "block",
    reason: `Unrecognized deliveryGuidance: ${guidance}`,
  };
}
