/**
 * Convert evidence-supported tech-SEO findings into Agent OS Recommendations.
 * Textual only — no apply/fix path. YELLOW/RED ⇒ approvalRequired.
 */

import { createEvidence } from "../../evidence";
import { buildRecommendation } from "../../recommendation";
import type { Recommendation } from "../../types";
import { recommendationStatusForTier } from "./permissions";
import type { TechSeoEvidenceRow } from "./types";

function slug(raw: string): string {
  return (
    raw
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "item"
  );
}

export function recommendationsFromEvidenceRows(
  rows: TechSeoEvidenceRow[],
  reportingPeriod: { start: string; end: string },
): Recommendation[] {
  const actionable = rows.filter(
    (r) => r.severity === "P0" || r.severity === "P1" || r.severity === "P2",
  );
  const collectedAt = new Date().toISOString();

  return actionable.map((r) => {
    const tier = r.permissionTier;
    const status = recommendationStatusForTier(tier);
    const impact = r.severity === "P0" ? 8 : r.severity === "P1" ? 6 : 3;
    const urgency =
      r.severity === "P0"
        ? ("critical" as const)
        : r.severity === "P1"
          ? ("high" as const)
          : ("medium" as const);

    const rec = buildRecommendation({
      recommendationId: `search-strategy:repository:tech-seo-${r.severity.toLowerCase()}:${slug(r.area)}-${slug(r.urlOrFile)}`,
      originatingExecutive: "search-strategy",
      title: `[Tech SEO] ${r.area}: ${r.urlOrFile}`,
      plainLanguageExplanation: `${r.observedState} (expected: ${r.expectedState})`,
      whyItMattersNow: r.evidence,
      proposedAction: r.recommendedAction,
      expectedUpside:
        "Improve indexability / canonical clarity when approved",
      effortEstimate: r.severity === "P2" ? "low" : "medium",
      urgency,
      reversibility: "easily-reversed",
      baseConfidence: 0.75,
      evidence: [
        createEvidence({
          source: "repository",
          sourceType: "internal-report",
          collectedAt,
          reportingPeriod,
          metricOrObservation: `${r.area}|${r.severity}|${r.urlOrFile}|${r.observedState}`,
          reliability: "reliable",
          supportingReference: r.urlOrFile,
        }),
      ],
      assumptions: [
        "Audit-only finding — no autonomous remediation",
        `Permission tier: ${tier}`,
      ],
      risks: [
        tier === "red"
          ? "RED action — no execution path in Search & GEO module"
          : "Site edits require Justin / Chief-of-Staff approval",
      ],
      dependencies: [],
      approvalRequired: r.approvalRequired || tier !== "green",
      suggestedOwner: "Search Strategy / Justin",
      status,
      agendaBucket: status === "blocked" ? "ignore" : "schedule-next",
      rankingFactors: {
        expectedBusinessImpact: impact,
        dependencyReadiness: 1,
        strategicAlignment: 7,
      },
    });

    // Preserve explicit YELLOW approval + RED blocked status after finalize
    return {
      ...rec,
      approvalRequired: r.approvalRequired || tier !== "green",
      status: status === "blocked" ? "blocked" : rec.status,
      agendaBucket:
        status === "blocked" ? "ignore" : rec.agendaBucket,
    };
  });
}
