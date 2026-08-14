/**
 * At most ONE root website-health exception for the same underlying incident.
 * Healthy → zero founder recommendations.
 */

import { proposedActionImpliesWrite } from "../../permissions";
import { buildRecommendation } from "../../recommendation";
import { createEvidence } from "../../evidence";
import type { Recommendation } from "../../types";
import {
  classifyWebsiteQaPermissionTier,
} from "./permissions";
import { classifyRouteSeverity } from "./evidence";
import {
  WEBSITE_QA_ROOT_EXCEPTION_ID,
  type WebsiteQaException,
  type WebsiteQaHealthState,
  type WebsiteQaRouteProbe,
} from "./types";

export function buildWebsiteQaException(
  health: WebsiteQaHealthState,
  routes: readonly WebsiteQaRouteProbe[],
): WebsiteQaException | null {
  if (health !== "critical" && health !== "degraded") return null;

  const affected = routes.filter((r) => {
    const sev = classifyRouteSeverity(r);
    return sev === "critical" || sev === "degraded";
  });
  if (affected.length === 0) return null;

  const routeList = affected.map((r) => r.route).join(", ");
  const worst = affected.find(
    (r) => classifyRouteSeverity(r) === "critical",
  );
  const sample = worst ?? affected[0];
  const statusLabel =
    sample.status != null ? String(sample.status) : sample.probeOutcome;

  return {
    id: WEBSITE_QA_ROOT_EXCEPTION_ID,
    health,
    affectedRoutes: affected.map((r) => r.route),
    summary: `Production health regression: ${routeList} (${statusLabel}).`,
  };
}

export function websiteQaExceptionToRecommendation(
  exception: WebsiteQaException,
  reportingPeriod: { start: string; end: string },
  collectedAt: string,
): Recommendation | null {
  const action =
    "Verify production health for the affected route(s). Agent OS does not apply site edits.";
  if (
    proposedActionImpliesWrite(action) ||
    classifyWebsiteQaPermissionTier(action) !== "green"
  ) {
    return null;
  }

  const rec = buildRecommendation({
    recommendationId: WEBSITE_QA_ROOT_EXCEPTION_ID,
    originatingExecutive: "business-intelligence",
    title: "Production health regression",
    plainLanguageExplanation: exception.summary,
    whyItMattersNow:
      "A revenue/trust-critical production surface is not healthy. No exception = no founder task; this is the exception.",
    proposedAction: action,
    expectedUpside: "Restore a reachable production surface before other work.",
    effortEstimate: "low",
    urgency: exception.health === "critical" ? "critical" : "high",
    reversibility: "easily-reversed",
    baseConfidence: 0.9,
    evidence: [
      createEvidence({
        source: "weekly-intelligence",
        sourceType: "internal-report",
        collectedAt,
        reportingPeriod,
        metricOrObservation: exception.summary,
        reliability: "reliable",
        supportingReference: "lib/agent-os/bi/website-qa",
      }),
    ],
    assumptions: [
      "HTTP status is observed production evidence, not a copy/content assertion",
    ],
    risks: ["Agent OS does not repair or deploy"],
    dependencies: [],
    approvalRequired: false,
    suggestedOwner: "Founder / engineering",
    rankingFactors: {
      expectedBusinessImpact: exception.health === "critical" ? 10 : 8,
      strategicAlignment: 10,
    },
  });

  rec.priorityScore = exception.health === "critical" ? 500_000 : rec.priorityScore;
  return rec;
}
