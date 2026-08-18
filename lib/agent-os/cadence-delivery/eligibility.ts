/**
 * Delivery eligibility — Chief of Staff owns synthesis; this gate decides send vs alert vs nothing.
 * Includes founder-facing brief quality gate (empty / duplicative / leaky briefs).
 */

import type { AgentRun, DeliveryGuidance } from "../types";
import {
  dailyTodayCall,
  isVagueMetricWithoutMagnitude,
} from "../brief-quality";
import {
  evaluateBriefQualityGate,
  isQuietDayFounderBrief,
  isQuietDayQualityFailure,
} from "../brief-quality-gate";

export type DeliveryEligibility =
  | {
      action: "send-founder-brief";
      degraded: boolean;
      allClear?: boolean;
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
  /** Cadence intent — quality rules are stricter for daily Morning Brief. */
  intent?: "daily" | "weekly";
}): DeliveryEligibility {
  const { run } = input;
  const intent = input.intent ?? "daily";

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

  const qualityInput = (forAllClear: boolean) => {
    const todayCall = dailyTodayCall({
      whyItMatters: run.brief.whyItMatters,
      highestRoiAction: run.brief.highestRoiAction,
      sprintOrientation: run.brief.sprintOrientation,
      dayOrientation: run.brief.dayOrientation,
      whatChanged: run.brief.whatChanged,
    });
    const watch = run.brief.opportunityToWatch;
    return evaluateBriefQualityGate({
      brief: forAllClear
        ? { ...run.brief, missingOrUnreliableData: [] }
        : run.brief,
      todayCall,
      opportunityWatch:
        watch && !isVagueMetricWithoutMagnitude(watch) ? watch : null,
      intent,
    });
  };

  const officialQuietAllClear = (): DeliveryEligibility => {
    const quality = qualityInput(true);
    if (!quality.ok && !isQuietDayQualityFailure(quality)) {
      return {
        action: "send-nothing",
        reason: `Morning Brief quality gate blocked send: ${quality.violations
          .map((v) => v.code)
          .join(", ")}`,
      };
    }
    return {
      action: "send-founder-brief",
      degraded: false,
      allClear: true,
      reason:
        intent === "weekly"
          ? "Official weekly all-clear — no major strategic change"
          : "Official daily all-clear — no material founder priorities",
    };
  };

  if (
    guidance === "send-nothing" ||
    isQuietDayFounderBrief(run.brief)
  ) {
    return officialQuietAllClear();
  }

  if (
    guidance === "send-degraded-partial-brief" ||
    guidance === "send-normal-brief"
  ) {
    if (intent === "daily") {
      const todayCall = dailyTodayCall({
        whyItMatters: run.brief.whyItMatters,
        highestRoiAction: run.brief.highestRoiAction,
        sprintOrientation: run.brief.sprintOrientation,
        dayOrientation: run.brief.dayOrientation,
        whatChanged: run.brief.whatChanged,
      });
      const watch = run.brief.opportunityToWatch;
      const quality = evaluateBriefQualityGate({
        brief: run.brief,
        todayCall,
        opportunityWatch:
          watch && !isVagueMetricWithoutMagnitude(watch) ? watch : null,
        intent: "daily",
      });
      if (!quality.ok) {
        if (isQuietDayQualityFailure(quality)) {
          return {
            action: "send-founder-brief",
            degraded: false,
            allClear: true,
            reason:
              "Official daily all-clear — no material founder priorities",
          };
        }
        return {
          action: "send-nothing",
          reason: `Morning Brief quality gate blocked send: ${quality.violations
            .map((v) => v.code)
            .join(", ")}`,
        };
      }
    }

    if (guidance === "send-degraded-partial-brief") {
      return {
        action: "send-founder-brief",
        degraded: true,
        reason:
          "Degraded but usable run — brief must identify degraded areas; source gaps are not deterioration",
      };
    }
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
