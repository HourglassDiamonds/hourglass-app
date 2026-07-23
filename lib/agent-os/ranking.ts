/**
 * Transparent recommendation ranking for Agent OS V1.
 *
 * priorityScore =
 *   impact * confidence * urgencyWeight * reversibilityBonus
 *   * alignment * dependencyReadiness * dataQuality
 *   / effortPenalty
 *
 * Strong penalties for weak evidence, stale data, missing dependencies,
 * out-of-authority recommendations, and write-implied actions.
 */

import { evidenceDataQuality, hasUsableEvidence } from "./evidence";
import { proposedActionImpliesWrite } from "./permissions";
import { isExecutiveOperational } from "./registry";
import type {
  EffortEstimate,
  RankingFactors,
  Recommendation,
  Reversibility,
  Urgency,
} from "./types";

export const RANKING_LOGIC_SUMMARY = `
Ranking combines eight explicit factors (never a single opaque score):
1. expectedBusinessImpact (0–10)
2. confidence (0–1) — lowered by missing/stale/weak evidence
3. urgency (mapped 0–10)
4. effort (0–10; higher effort lowers priority)
5. reversibility (0–10; easier reversal raises priority slightly)
6. strategicAlignment (0–10)
7. dependencyReadiness (0–1)
8. dataQuality (0–1 from evidence freshness/reliability)

Hard penalties / blocks:
- No usable evidence → status blocked or downgraded; confidence ≤ 0.25
- Stale evidence → dataQuality and confidence reduced
- Missing dependencies → dependencyReadiness = 0; status blocked
- Non-operational executive → cannot emit recommendations
- Proposed action implies external write → blocked (read-only V1)
- Outside executive authority → strategicAlignment capped and blocked
`.trim();

const URGENCY_SCORE: Record<Urgency, number> = {
  critical: 10,
  high: 8,
  medium: 5,
  low: 2,
};

const EFFORT_SCORE: Record<EffortEstimate, number> = {
  low: 2,
  medium: 5,
  high: 8,
};

const REVERSIBILITY_SCORE: Record<Reversibility, number> = {
  "easily-reversed": 9,
  "partially-reversed": 5,
  "hard-to-reverse": 2,
};

export function buildRankingFactors(input: {
  expectedBusinessImpact: number;
  confidence: number;
  urgency: Urgency;
  effortEstimate: EffortEstimate;
  reversibility: Reversibility;
  strategicAlignment: number;
  dependencyReadiness: number;
  dataQuality: number;
}): RankingFactors {
  return {
    expectedBusinessImpact: clamp(input.expectedBusinessImpact, 0, 10),
    confidence: clamp(input.confidence, 0, 1),
    urgency: URGENCY_SCORE[input.urgency],
    effort: EFFORT_SCORE[input.effortEstimate],
    reversibility: REVERSIBILITY_SCORE[input.reversibility],
    strategicAlignment: clamp(input.strategicAlignment, 0, 10),
    dependencyReadiness: clamp(input.dependencyReadiness, 0, 1),
    dataQuality: clamp(input.dataQuality, 0, 1),
  };
}

export function computePriorityScore(factors: RankingFactors): number {
  const effortPenalty = 1 + factors.effort / 10;
  const raw =
    (factors.expectedBusinessImpact / 10) *
    factors.confidence *
    (factors.urgency / 10) *
    (0.7 + 0.3 * (factors.reversibility / 10)) *
    (factors.strategicAlignment / 10) *
    factors.dependencyReadiness *
    factors.dataQuality *
    (1 / effortPenalty);
  return Math.round(raw * 1000) / 1000;
}

export function applyEvidenceToConfidence(
  baseConfidence: number,
  evidence: Recommendation["evidence"],
): { confidence: number; dataQuality: number; labels: string[] } {
  const labels: string[] = [];
  const dataQuality = evidenceDataQuality(evidence);
  let confidence = baseConfidence * (0.35 + 0.65 * dataQuality);

  if (!hasUsableEvidence(evidence)) {
    confidence = Math.min(confidence, 0.25);
    labels.push("Missing or unusable evidence — confidence capped");
  }
  for (const e of evidence) {
    if (e.freshness === "stale") {
      labels.push(`Stale data labeled from ${e.source}`);
      confidence *= 0.75;
    }
  }
  return {
    confidence: clamp(confidence, 0, 1),
    dataQuality,
    labels,
  };
}

export function finalizeRecommendation(
  draft: Omit<Recommendation, "priorityScore" | "rankingFactors" | "status" | "agendaBucket" | "confidence" | "blockedReasons"> & {
    rankingFactors?: Partial<RankingFactors>;
    baseConfidence: number;
    status?: Recommendation["status"];
    agendaBucket?: Recommendation["agendaBucket"];
    missingDependencies?: string[];
    outsideAuthority?: boolean;
  },
): Recommendation {
  const blockedReasons: string[] = [];
  const evidenceAdj = applyEvidenceToConfidence(
    draft.baseConfidence,
    draft.evidence,
  );

  let dependencyReadiness =
    draft.rankingFactors?.dependencyReadiness ??
    (draft.dependencies.length === 0 ? 1 : 0.8);
  const missing = draft.missingDependencies ?? [];
  if (missing.length > 0) {
    dependencyReadiness = 0;
    blockedReasons.push(
      `Missing dependencies: ${missing.join("; ")}`,
    );
  }

  if (!hasUsableEvidence(draft.evidence)) {
    blockedReasons.push("Recommendation requires evidence");
  }

  if (!isExecutiveOperational(draft.originatingExecutive)) {
    blockedReasons.push("Originating executive is not operational");
  }

  if (proposedActionImpliesWrite(draft.proposedAction)) {
    blockedReasons.push(
      "Proposed action requires write access prohibited in Agent OS V1",
    );
  }

  if (draft.outsideAuthority) {
    blockedReasons.push("Outside executive authority");
  }

  let strategicAlignment =
    draft.rankingFactors?.strategicAlignment ?? 8;
  if (draft.outsideAuthority) strategicAlignment = Math.min(strategicAlignment, 2);

  const factors = buildRankingFactors({
    expectedBusinessImpact:
      draft.rankingFactors?.expectedBusinessImpact ?? 5,
    confidence: evidenceAdj.confidence,
    urgency: draft.urgency,
    effortEstimate: draft.effortEstimate,
    reversibility: draft.reversibility,
    strategicAlignment,
    dependencyReadiness,
    dataQuality: evidenceAdj.dataQuality,
  });

  let status: Recommendation["status"] = draft.status ?? "proposed";
  let agendaBucket: Recommendation["agendaBucket"] =
    draft.agendaBucket ?? "schedule-next";

  if (blockedReasons.length > 0) {
    status = "blocked";
    agendaBucket = "ignore";
  } else if (evidenceAdj.confidence < 0.4) {
    status = "downgraded";
    agendaBucket = "monitor";
  } else if (factors.expectedBusinessImpact >= 7 && factors.effort <= 3) {
    agendaBucket = "do-now";
  } else if (draft.urgency === "low" && factors.expectedBusinessImpact < 4) {
    agendaBucket = "ignore";
    status = "ignore";
  }

  const priorityScore =
    status === "blocked" ? 0 : computePriorityScore(factors);

  return {
    recommendationId: draft.recommendationId,
    originatingExecutive: draft.originatingExecutive,
    title: draft.title,
    plainLanguageExplanation: draft.plainLanguageExplanation,
    whyItMattersNow: draft.whyItMattersNow,
    proposedAction: draft.proposedAction,
    expectedUpside: draft.expectedUpside,
    effortEstimate: draft.effortEstimate,
    urgency: draft.urgency,
    reversibility: draft.reversibility,
    confidence: Math.round(evidenceAdj.confidence * 100) / 100,
    evidence: draft.evidence,
    assumptions: draft.assumptions,
    risks: [...draft.risks, ...evidenceAdj.labels],
    dependencies: draft.dependencies,
    approvalRequired: draft.approvalRequired,
    suggestedOwner: draft.suggestedOwner,
    status,
    agendaBucket,
    rankingFactors: factors,
    priorityScore,
    blockedReasons: blockedReasons.length ? blockedReasons : undefined,
  };
}

export function compareRecommendations(
  a: Recommendation,
  b: Recommendation,
): number {
  if (b.priorityScore !== a.priorityScore) {
    return b.priorityScore - a.priorityScore;
  }
  if (b.confidence !== a.confidence) return b.confidence - a.confidence;
  return a.recommendationId.localeCompare(b.recommendationId);
}

export function rankRecommendations(
  items: Recommendation[],
): Recommendation[] {
  return [...items].sort(compareRecommendations);
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
