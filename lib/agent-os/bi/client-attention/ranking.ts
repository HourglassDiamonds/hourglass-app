/**
 * Explainable founder-value ranking for Client Attention signals.
 * Deal amount alone never determines rank. Low confidence is penalized.
 */

import type {
  ClientAttentionScoreDimensions,
  ClientAttentionSignal,
  RankedClientAttentionSignal,
} from "./types";
import { MAX_CLIENT_ATTENTION_FOUNDER_PRIORITIES } from "./types";

const URGENCY_SCORE: Record<ClientAttentionSignal["urgency"], number> = {
  critical: 10,
  high: 8,
  medium: 5,
  low: 2,
};

const CONFIDENCE_ADJ: Record<ClientAttentionSignal["confidence"], number> = {
  high: 1,
  medium: 0.85,
  low: 0.55,
};

export function rankClientAttentionSignals(
  signals: ClientAttentionSignal[],
): RankedClientAttentionSignal[] {
  const scored = signals
    .filter((s) => s.founderRankable !== false)
    .map((signal) => scoreSignal(signal))
    .sort((a, b) => {
      if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
      return a.signal.id.localeCompare(b.signal.id);
    });

  // Prevent same client flooding top slots unless materially different urgent issues
  const seenSubjects = new Map<string, number>();
  const filtered: RankedClientAttentionSignal[] = [];
  for (const ranked of scored) {
    const count = seenSubjects.get(ranked.signal.subjectKey) ?? 0;
    const allowSecond =
      count === 1 &&
      (ranked.signal.urgency === "critical" || ranked.signal.urgency === "high") &&
      ranked.signal.signalType !==
        filtered.find((f) => f.signal.subjectKey === ranked.signal.subjectKey)
          ?.signal.signalType;
    if (count === 0 || allowSecond) {
      filtered.push(ranked);
      seenSubjects.set(ranked.signal.subjectKey, count + 1);
    }
  }

  // Annotate why #1 outranks others
  if (filtered.length > 1) {
    const top = filtered[0];
    const runner = filtered[1];
    top.outranksReason = explainOutrank(top, runner);
  } else if (filtered[0]) {
    filtered[0].outranksReason = "Only rankable client-attention signal.";
  }

  return filtered;
}

export function selectTopClientAttentionForBrief(
  ranked: RankedClientAttentionSignal[],
  max = MAX_CLIENT_ATTENTION_FOUNDER_PRIORITIES,
): RankedClientAttentionSignal[] {
  return ranked.slice(0, max);
}

function scoreSignal(signal: ClientAttentionSignal): RankedClientAttentionSignal {
  const dimensions: ClientAttentionScoreDimensions = {
    responseDelay: scoreResponseDelay(signal),
    deadlineProximity: scoreDeadline(signal),
    stageSensitivity: scoreStage(signal),
    conversionLikelihood: scoreConversion(signal),
    relationshipImportance: scoreRelationship(signal),
    missingNextStep: signal.signalType === "missing-next-step" ? 7 : signal.signalType === "stalled-conversation" ? 6 : 2,
    explicitUrgency: URGENCY_SCORE[signal.urgency],
    reputationalRisk:
      signal.signalType === "reply-overdue" || signal.signalType === "new-inquiry"
        ? 8
        : signal.signalType === "data-discrepancy"
          ? 4
          : 2,
    easeOfResolvingToday:
      signal.signalType === "buyer-concern-pattern" ? 2 : 7,
    dataConfidence:
      signal.confidence === "high" ? 9 : signal.confidence === "medium" ? 6 : 3,
    sourceCorroboration: Math.min(10, signal.sourceTypes.length * 4),
  };

  const raw =
    dimensions.responseDelay * 1.2 +
    dimensions.deadlineProximity * 1.1 +
    dimensions.stageSensitivity * 0.9 +
    dimensions.conversionLikelihood * 0.8 +
    dimensions.relationshipImportance * 0.7 +
    dimensions.missingNextStep * 0.9 +
    dimensions.explicitUrgency * 1.3 +
    dimensions.reputationalRisk * 1.0 +
    dimensions.easeOfResolvingToday * 0.6 +
    dimensions.dataConfidence * 0.8 +
    dimensions.sourceCorroboration * 0.9;

  // Never invent or overweight deal amount — amount is intentionally absent from dimensions.

  const confidenceAdjustment = CONFIDENCE_ADJ[signal.confidence];
  const totalScore = Math.round(raw * confidenceAdjustment * 10) / 10;

  const appliedThresholds: string[] = [];
  if (signal.signalType === "reply-overdue" || signal.signalType === "new-inquiry") {
    appliedThresholds.push("newInquiryMediumHours/High/Critical");
  }
  if (signal.signalType === "unanswered-inbound") {
    appliedThresholds.push("unansweredInboundHours");
  }
  if (signal.signalType === "stalled-conversation") {
    appliedThresholds.push("stalledEarlyDays/stalledAdvancedDays");
  }
  if (signal.signalType === "proposal-date-approaching") {
    appliedThresholds.push("proposalApproachingDays");
  }

  return {
    signal,
    totalScore,
    dimensions,
    confidenceAdjustment,
    appliedThresholds,
    evidenceSources: [
      ...new Set(
        signal.evidence.map((e) =>
          e.sourceType === "derived" ? "derived" : e.sourceType,
        ),
      ),
    ],
    outranksReason: "",
  };
}

function scoreResponseDelay(signal: ClientAttentionSignal): number {
  if (
    signal.signalType !== "reply-overdue" &&
    signal.signalType !== "new-inquiry" &&
    signal.signalType !== "unanswered-inbound"
  ) {
    return 2;
  }
  if (signal.urgency === "critical") return 10;
  if (signal.urgency === "high") return 8;
  if (signal.urgency === "medium") return 5;
  return 2;
}

function scoreDeadline(signal: ClientAttentionSignal): number {
  if (!signal.targetDate) return 1;
  if (
    signal.signalType === "proposal-date-approaching" ||
    signal.signalType === "deal-stage-risk" ||
    signal.signalType === "appointment-approaching"
  ) {
    return signal.urgency === "critical" ? 10 : signal.urgency === "high" ? 8 : 5;
  }
  return 3;
}

function scoreStage(signal: ClientAttentionSignal): number {
  if (
    signal.signalType === "deal-stage-risk" ||
    signal.signalType === "stalled-conversation"
  ) {
    return 7;
  }
  return 3;
}

function scoreConversion(signal: ClientAttentionSignal): number {
  if (signal.signalType === "buyer-concern-pattern") return 2;
  if (signal.sourceTypes.includes("concierge")) return 7;
  if (signal.sourceTypes.includes("hubspot")) return 6;
  return 4;
}

function scoreRelationship(signal: ClientAttentionSignal): number {
  return signal.sourceTypes.length >= 2 ? 7 : 4;
}

function explainOutrank(
  top: RankedClientAttentionSignal,
  runner: RankedClientAttentionSignal,
): string {
  const dims = Object.entries(top.dimensions) as Array<
    [keyof ClientAttentionScoreDimensions, number]
  >;
  const runnerDims = runner.dimensions;
  const best = dims
    .map(([k, v]) => ({ k, delta: v - runnerDims[k] }))
    .sort((a, b) => b.delta - a.delta)[0];
  return `Scores ${top.totalScore} vs ${runner.totalScore}; strongest edge on ${best.k} (${best.delta > 0 ? "+" : ""}${best.delta}). Confidence×${top.confidenceAdjustment}.`;
}
