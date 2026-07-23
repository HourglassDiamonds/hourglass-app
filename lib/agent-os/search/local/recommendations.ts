/**
 * Local Authority findings → Search Strategy recommendations.
 * One GBP root source gap; unknown dimensions stay suppressed.
 * Static repository gaps soft-dedupe so they do not flood the founder brief.
 */

import { createEvidence } from "../../evidence";
import { buildRecommendation } from "../../recommendation";
import type { Recommendation } from "../../types";
import { buildLocalAuthorityRecommendationId } from "./ids";
import { GBP_ROOT_SOURCE_GAP_ID } from "./types";
import type {
  LocalAuthorityFinding,
  LocalAuthorityHandoff,
  LocalAuthorityVolumeFunnel,
} from "./types";

export function localFindingsToRecommendations(
  findings: LocalAuthorityFinding[],
  reportingPeriod: { start: string; end: string },
  collectedAt: string,
): Recommendation[] {
  const actionable = findings.filter(
    (f) =>
      !f.suppressRecommendation &&
      f.type !== "local-coverage-healthy" &&
      f.type !== "map-pack-readiness-signal",
  );

  // Consolidate any stray GBP dimension recs into the root gap only
  const gbpRoot = actionable.filter(
    (f) => f.id === GBP_ROOT_SOURCE_GAP_ID || f.type === "gbp-source-gap",
  );
  const nonGbpDimension = actionable.filter(
    (f) =>
      f.type !== "gbp-review-measurement-gap" &&
      f.type !== "gbp-engagement-measurement-gap" &&
      f.type !== "gbp-category-verification-required" &&
      f.type !== "gbp-service-area-verification-required" &&
      f.type !== "gbp-appointment-link-verification-required" &&
      f.type !== "gbp-profile-readiness" &&
      f.type !== "map-pack-data-unavailable",
  );

  const withSingleGbpRoot =
    gbpRoot.length > 0
      ? [
          ...nonGbpDimension.filter((f) => f.type !== "gbp-source-gap"),
          gbpRoot[0]!,
        ]
      : nonGbpDimension;

  const deduped = softDedupeLocalFindings(withSingleGbpRoot);

  return deduped.map((f) => findingToRecommendation(f, reportingPeriod, collectedAt));
}

function softDedupeLocalFindings(
  findings: LocalAuthorityFinding[],
): LocalAuthorityFinding[] {
  const out: LocalAuthorityFinding[] = [];
  const seenSubjects = new Set<string>();

  for (const f of findings) {
    // Prefer GSC-observed demand over static repository duplicates
    const key = `${f.type}:${f.geography}:${f.queryOrPage ?? f.route ?? f.id}`;
    if (seenSubjects.has(key)) continue;
    seenSubjects.add(key);

    // Cap static repository hub/link findings so they don't flood
    if (
      f.evidenceClass === "repository-backed" &&
      (f.type === "local-tool-handoff-gap" ||
        f.type === "local-concierge-handoff-gap")
    ) {
      const already = out.filter(
        (x) => x.type === f.type && x.evidenceClass === "repository-backed",
      ).length;
      if (already >= 1) continue;
    }

    out.push(f);
  }

  return out;
}

function findingToRecommendation(
  f: LocalAuthorityFinding,
  reportingPeriod: { start: string; end: string },
  collectedAt: string,
): Recommendation {
  const sourceType =
    f.source === "gsc"
      ? ("search" as const)
      : f.source === "gbp"
        ? ("internal-report" as const)
        : ("internal-report" as const);

  const evidenceSource =
    f.source === "gsc"
      ? "gsc"
      : f.source === "gbp"
        ? "gbp"
        : "repository-local-authority";

  const ownerLabel =
    f.owner === "search-strategy"
      ? "Founder / Search Strategy"
      : f.owner === "content"
        ? "Founder / Content"
        : f.owner === "opportunity"
          ? "Founder / Opportunity"
          : "Founder / Business Intelligence";

  // Soften static repository-only findings in ranking
  const impact =
    f.evidenceClass === "repository-backed" &&
    (f.type === "local-hub-gap" ||
      f.type === "local-tool-handoff-gap" ||
      f.type === "local-concierge-handoff-gap")
      ? Math.min(f.likelyImpact, 5)
      : f.likelyImpact;

  return buildRecommendation({
    recommendationId: buildLocalAuthorityRecommendationId(f.id),
    originatingExecutive: "search-strategy",
    title: `[Search Strategy] ${f.title}`,
    plainLanguageExplanation: [
      `Evidence class: ${f.evidenceClass}`,
      `Geography: ${f.geography}`,
      f.evidenceNotes[0] ?? f.whyItMatters,
      f.executionOwnedElsewhere
        ? `Execution owner: ${f.owner} (Search retains diagnosis)`
        : "Search owns diagnosis and recommendation framing",
    ].join(". "),
    whyItMattersNow: f.whyItMatters,
    proposedAction: f.recommendedAction,
    expectedUpside:
      f.evidenceClass === "observed"
        ? `Improve local query/page clarity where Search Console already shows demand (${f.geography})`
        : f.evidenceClass === "source-gap"
          ? "Unblock local authority decisions by verifying the missing source — no performance claim until observed"
          : `Strengthen repository local authority readiness for ${f.geography} (no traffic impact claimed without GSC)`,
    effortEstimate: f.effort,
    urgency: f.urgency,
    reversibility: "easily-reversed",
    baseConfidence: f.confidence,
    evidence: [
      createEvidence({
        source: evidenceSource,
        sourceType,
        collectedAt,
        reportingPeriod,
        metricOrObservation: `${f.type}: ${f.queryOrPage ?? f.route ?? f.id}`,
        priorComparison: f.dependency,
        reliability: f.isInference ? "unverified" : "reliable",
        supportingReference: f.supportingReference,
      }),
    ],
    assumptions: [
      ...(f.isInference
        ? ["Includes inference — not a direct measured claim"]
        : []),
      "Repository evidence does not imply observed GBP state",
      "Read-only recommendation; founder/editorial implements any site or GBP change",
    ],
    risks: [
      ...(f.sampleSize != null && f.sampleSize < 200
        ? ["Small sample size — confidence reduced"]
        : []),
      "Do not fabricate rankings, reviews, calls, directions, or map-pack positions",
      "Do not treat unknown GBP dimensions as incomplete profile proof",
    ],
    dependencies: f.dependency ? [f.dependency] : [],
    approvalRequired: f.founderApprovalRequired,
    suggestedOwner: ownerLabel,
    rankingFactors: {
      expectedBusinessImpact: impact,
      strategicAlignment: f.evidenceClass === "observed" ? 8 : 6,
    },
  });
}

export function buildLocalHandoffs(
  findings: LocalAuthorityFinding[],
): LocalAuthorityHandoff {
  return {
    contentHandoffIds: findings
      .filter((f) => f.owner === "content")
      .map((f) => f.id),
    opportunityHandoffIds: findings
      .filter((f) => f.owner === "opportunity")
      .map((f) => f.id),
    biHandoffIds: findings
      .filter((f) => f.owner === "business-intelligence")
      .map((f) => f.id),
    searchDiagnosisIds: findings
      .filter((f) => f.owner === "search-strategy")
      .map((f) => f.id),
  };
}

export function buildLocalVolumeFunnel(input: {
  findings: LocalAuthorityFinding[];
  recommendations: Recommendation[];
}): LocalAuthorityVolumeFunnel {
  const { findings, recommendations } = input;
  const gbpUnknown = findings.filter(
    (f) =>
      f.evidenceClass === "unknown" &&
      (f.type.startsWith("gbp-") || f.type === "local-review-readiness-gap"),
  ).length;
  const qualified = findings.filter(
    (f) =>
      !f.suppressRecommendation &&
      f.type !== "local-coverage-healthy" &&
      f.confidence >= 0.5,
  ).length;
  const deferred = findings.filter((f) => f.suppressRecommendation).length;
  const surfacedEligible = recommendations.filter(
    (r) =>
      r.status !== "consolidated" &&
      r.status !== "ignore" &&
      r.status !== "blocked" &&
      r.priorityScore >= 0.35,
  ).length;

  return {
    rawFindings: findings.length,
    qualifiedFindings: qualified,
    gbpUnknownDimensions: gbpUnknown,
    monitorDeferredFindings: deferred,
    rankedRecommendations: recommendations.length,
    surfacedEligible,
  };
}

/** Soft-dedupe local recommendations against existing Search opportunities. */
export function dedupeLocalAgainstSearchRecommendations(
  localRecs: Recommendation[],
  existingSearchRecs: Recommendation[],
): Recommendation[] {
  return localRecs.filter((local) => {
    const localKey = normalize(local.title + local.proposedAction);
    const duplicate = existingSearchRecs.some((ex) => {
      const exKey = normalize(ex.title + ex.proposedAction);
      return (
        tokenOverlap(localKey, exKey) >= 0.55 &&
        ((local.title.includes("Charlotte Guides") &&
          ex.title.includes("Charlotte Guides")) ||
          (local.recommendationId.includes("local-intent") &&
            ex.recommendationId.includes("local-intent")) ||
          similarQuerySubject(local.recommendationId, ex.recommendationId))
      );
    });
    return !duplicate;
  });
}

function similarQuerySubject(a: string, b: string): boolean {
  const ta = a.split(":").slice(-1)[0] ?? "";
  const tb = b.split(":").slice(-1)[0] ?? "";
  if (ta.length < 8 || tb.length < 8) return false;
  return ta === tb || ta.includes(tb) || tb.includes(ta);
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, " ");
}

function tokenOverlap(a: string, b: string): number {
  const ta = new Set(a.split(/\s+/).filter((t) => t.length > 3));
  const tb = new Set(b.split(/\s+/).filter((t) => t.length > 3));
  if (ta.size === 0 || tb.size === 0) return 0;
  let hit = 0;
  for (const t of ta) {
    if (tb.has(t)) hit += 1;
  }
  return hit / Math.max(ta.size, tb.size);
}
