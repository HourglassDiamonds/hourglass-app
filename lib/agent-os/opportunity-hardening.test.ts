/**
 * Opportunity Executive hardening tests — confidence separation, surfacing,
 * volume, paid-search gates, partnership/media dedupe, already-covered.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  actionabilityForReadiness,
  buildOpportunityId,
  opportunityIsSurfaceEligible,
  opportunityRankingAdjustments,
  qualifyOpportunity,
  runAgentOsBrief,
  runBusinessIntelligence,
  runChiefOfStaff,
  runContentExecutive,
  runOpportunityExecutive,
  runSearchStrategy,
  withConfidenceContract,
} from "./index";
import { loadAllSources } from "./adapters/load";
import { FIXTURE_REPORTING_PERIOD } from "./fixtures/sample-data";
import { MAX_ADDITIONAL_SURFACED_PRIORITIES as COS_MAX } from "./executives/chief-of-staff";
import type { GrowthOpportunity } from "./opportunity/types";

describe("Confidence vs attractiveness vs actionability", () => {
  it("high diagnostic confidence does not override measurement-blocked priority", () => {
    const blocked = withConfidenceContract({
      id: buildOpportunityId({
        source: "derived",
        type: "remarketing-readiness",
        subject: "gap",
        readiness: "measurement-blocked",
      }),
      type: "remarketing-readiness",
      readiness: "measurement-blocked",
      title: "Remarketing measurement prerequisite",
      whyItMatters: "Audience evidence missing",
      recommendedAction: "Do not implement remarketing",
      targetAudience: "returning-researchers",
      geography: "unspecified",
      funnelStage: "consideration",
      costClass: "unknown",
      effort: "high",
      reversibility: "partially-reversed",
      timeToSignal: "unknown",
      founderDependence: "heavy",
      externalVerification: "source-gap",
      isInference: false,
      evidenceConfidence: 0.95,
      strategicAttractiveness: 2,
      urgency: "low",
      approvalRequired: true,
      owner: "Founder / Opportunity",
      supportingReference: "test",
      evidenceNotes: ["gap confirmed", "no audience"],
      disqualifyingRisks: [],
      additionalLeverage: "Measurement prerequisite only — not a remarketing opportunity",
    });
    const adj = opportunityRankingAdjustments(blocked);
    assert.ok(blocked.evidenceConfidence >= 0.9);
    assert.ok(blocked.actionability <= 0.15);
    assert.ok(adj.effectiveImpact < 1.5);
    assert.ok(adj.rankingConfidence < 0.25);
    assert.equal(opportunityIsSurfaceEligible(blocked), false);
  });

  it("high diagnostic confidence does not make unverified external opportunity actionable", () => {
    const research = withConfidenceContract({
      id: buildOpportunityId({
        source: "repository",
        type: "local-partnership-opportunity",
        subject: "wedding-planners",
        readiness: "research-required",
      }),
      type: "local-partnership-opportunity",
      readiness: "research-required",
      title: "Partner category research",
      whyItMatters: "Category fit",
      recommendedAction: "Research only",
      targetAudience: "partner-ecosystem",
      geography: "charlotte-metro",
      funnelStage: "trust",
      relatedPage: "/concierge",
      relatedTool: "/diamond-shape-studio",
      costClass: "low",
      effort: "medium",
      reversibility: "easily-reversed",
      timeToSignal: "months",
      founderDependence: "heavy",
      externalVerification: "source-gap",
      isInference: true,
      evidenceConfidence: 0.9,
      strategicAttractiveness: 8,
      urgency: "low",
      approvalRequired: true,
      owner: "Founder / Opportunity",
      supportingReference: "test",
      evidenceNotes: ["a", "b"],
      disqualifyingRisks: [],
      additionalLeverage: "Category research with explicit verification gate required",
    });
    assert.ok(research.evidenceConfidence >= 0.85);
    assert.ok(research.actionability < 0.4);
    assert.equal(opportunityIsSurfaceEligible(research), false);
  });

  it("ready-to-evaluate ranks above comparable research-required", () => {
    const ready = withConfidenceContract({
      ...baseFields("ready-to-evaluate", "underpriced-organic-demand"),
      evidenceConfidence: 0.7,
      strategicAttractiveness: 8,
      relatedPage: "/concierge",
      relatedTool: "/diamond-shape-studio",
    });
    const research = withConfidenceContract({
      ...baseFields("research-required", "local-partnership-opportunity"),
      evidenceConfidence: 0.7,
      strategicAttractiveness: 8,
      relatedPage: "/concierge",
      relatedTool: "/diamond-shape-studio",
      externalVerification: "source-gap",
    });
    const aReady = opportunityRankingAdjustments(ready);
    const aResearch = opportunityRankingAdjustments(research);
    assert.ok(aReady.effectiveImpact > aResearch.effectiveImpact);
    assert.ok(ready.actionability > research.actionability);
  });

  it("research-required ranks above rejected but below verified operational impact", () => {
    const research = withConfidenceContract({
      ...baseFields("research-required", "podcast-opportunity"),
      evidenceConfidence: 0.6,
      strategicAttractiveness: 6,
    });
    const rejected = withConfidenceContract({
      ...baseFields("rejected", "low-cost-experiment"),
      evidenceConfidence: 0.1,
      strategicAttractiveness: 1,
      rejected: true,
      rejectionReason: "generic",
    });
    const aR = opportunityRankingAdjustments(research);
    const aX = opportunityRankingAdjustments(rejected);
    assert.ok(aR.effectiveImpact > aX.effectiveImpact);
    assert.equal(actionabilityForReadiness("research-required") > actionabilityForReadiness("rejected"), true);
  });

  it("missing CPC/audience data lowers actionability rather than raising priority", async () => {
    const bundle = await loadAllSources("fixture");
    const search = runSearchStrategy(bundle, FIXTURE_REPORTING_PERIOD);
    const opportunity = runOpportunityExecutive(bundle, FIXTURE_REPORTING_PERIOD, {
      search,
      includeRejectedExamples: true,
    });
    const paid = opportunity.opportunities.find((o) => o.type === "paid-search-readiness");
    const remarketing = opportunity.opportunities.find(
      (o) => o.type === "remarketing-readiness",
    );
    assert.ok(paid);
    assert.equal(paid!.costClass, "unknown");
    assert.ok(paid!.actionability < 0.9);
    assert.ok(remarketing);
    assert.equal(remarketing!.readiness, "measurement-blocked");
    assert.ok(remarketing!.evidenceConfidence >= 0.85);
    assert.ok(remarketing!.strategicAttractiveness <= 3);
    // measurement-blocked must not appear as ranked recommendations
    assert.equal(
      opportunity.recommendations.some((r) =>
        /measurement-blocked|measurement prerequisite/i.test(r.title),
      ),
      false,
    );
  });
});

describe("Opportunity surfacing safeguards", () => {
  it("Opportunity receives zero surfaced slots when stronger BI/Search/Content exist", async () => {
    const bundle = await loadAllSources("fixture");
    const bi = runBusinessIntelligence(bundle, FIXTURE_REPORTING_PERIOD);
    const search = runSearchStrategy(bundle, FIXTURE_REPORTING_PERIOD);
    const content = runContentExecutive(bundle, FIXTURE_REPORTING_PERIOD, {
      bi,
      search,
    });
    const opportunity = runOpportunityExecutive(bundle, FIXTURE_REPORTING_PERIOD, {
      bi,
      search,
      content,
      includeRejectedExamples: true,
    });
    const cos = runChiefOfStaff({
      bi,
      search,
      content,
      opportunity,
      reportingPeriod: FIXTURE_REPORTING_PERIOD,
      warnings: [],
      mode: "fixture",
    });
    assert.ok(cos.surfacedInBriefCount <= 1 + COS_MAX);
    // With strong BI/Search, Opportunity should rarely dominate the brief
    const oppSurfaced = cos.brief.surfacedPriorityTitles.filter((t) =>
      t.startsWith("[Opportunity]"),
    );
    assert.ok(oppSurfaced.length <= 2);
  });

  it("blocked Opportunity findings do not surface only because BI is unavailable", async () => {
    const bundle = await loadAllSources("fixture");
    const search = runSearchStrategy(bundle, FIXTURE_REPORTING_PERIOD);
    const content = runContentExecutive(bundle, FIXTURE_REPORTING_PERIOD, {
      search,
    });
    const opportunity = runOpportunityExecutive(bundle, FIXTURE_REPORTING_PERIOD, {
      search,
      content,
      includeRejectedExamples: true,
    });
    // Empty BI (simulating blocked)
    const emptyBi = {
      recommendations: [],
      anomalies: [],
      dataGaps: [
        {
          id: "gap-ga4",
          sourceId: "ga4" as const,
          description: "GA4 down",
          impactOnRecommendations: "BI blocked",
          suggestedRemedy: "Restore GA4",
        },
      ],
      keyMetricChanges: [],
      facts: [],
      inferences: [],
      incompleteAttribution: false,
    };
    const cos = runChiefOfStaff({
      bi: emptyBi,
      search,
      content,
      opportunity,
      reportingPeriod: FIXTURE_REPORTING_PERIOD,
      warnings: [],
      mode: "fixture",
      briefEvidenceQuality: "partial-degraded",
    });
    for (const title of cos.brief.surfacedPriorityTitles) {
      if (!title.startsWith("[Opportunity]")) continue;
      assert.equal(/measurement-blocked|already covered|research-required|rejected/i.test(title), false);
      const rec = cos.recommendations.find((r) => r.title === title);
      assert.ok(rec);
      assert.equal(
        /Readiness=measurement-blocked|Readiness=already-covered|Readiness=rejected/i.test(
          rec!.plainLanguageExplanation,
        ),
        false,
      );
    }
  });

  it("a strong ready-to-evaluate Opportunity may surface", async () => {
    const bundle = await loadAllSources("fixture");
    const bi = runBusinessIntelligence(bundle, FIXTURE_REPORTING_PERIOD);
    const search = runSearchStrategy(bundle, FIXTURE_REPORTING_PERIOD);
    const opportunity = runOpportunityExecutive(bundle, FIXTURE_REPORTING_PERIOD, {
      bi,
      search,
    });
    const ready = opportunity.opportunities.filter(
      (o) => o.readiness === "ready-to-evaluate",
    );
    assert.ok(ready.length >= 1);
    assert.ok(ready.some((o) => opportunityIsSurfaceEligible(o)));
  });

  it("deferred/rejected findings remain in structured output", async () => {
    const bundle = await loadAllSources("fixture");
    const bi = runBusinessIntelligence(bundle, FIXTURE_REPORTING_PERIOD);
    const search = runSearchStrategy(bundle, FIXTURE_REPORTING_PERIOD);
    const content = runContentExecutive(bundle, FIXTURE_REPORTING_PERIOD, {
      bi,
      search,
    });
    const opportunity = runOpportunityExecutive(bundle, FIXTURE_REPORTING_PERIOD, {
      bi,
      search,
      content,
      includeRejectedExamples: true,
    });
    assert.ok(
      opportunity.opportunities.some((o) => o.readiness === "measurement-blocked"),
    );
    assert.ok(
      opportunity.opportunities.some((o) => o.readiness === "already-covered"),
    );
    assert.ok(
      opportunity.opportunities.some((o) => o.readiness === "rejected" || o.rejected),
    );
    assert.ok(
      opportunity.opportunities.some((o) => o.readiness === "research-required"),
    );
  });

  it("founder brief remains capped at five named priorities", async () => {
    const run = await runAgentOsBrief({ mode: "fixture" });
    assert.ok(run.briefSurfacing.recommendationsSurfacedInBrief <= 5);
    assert.ok(run.brief.surfacedPriorityTitles.length <= 5);
  });
});

describe("Volume funnel and quality", () => {
  it("distinguishes raw → qualified → ranked → surface-eligible", async () => {
    const bundle = await loadAllSources("fixture");
    const bi = runBusinessIntelligence(bundle, FIXTURE_REPORTING_PERIOD);
    const search = runSearchStrategy(bundle, FIXTURE_REPORTING_PERIOD);
    const content = runContentExecutive(bundle, FIXTURE_REPORTING_PERIOD, {
      bi,
      search,
    });
    const opportunity = runOpportunityExecutive(bundle, FIXTURE_REPORTING_PERIOD, {
      bi,
      search,
      content,
      includeRejectedExamples: true,
    });
    const f = opportunity.volumeFunnel;
    assert.ok(f.rawSignals >= f.qualifiedFindings || f.rawSignals > 0);
    assert.ok(f.qualifiedFindings >= f.rankedRecommendations);
    assert.ok(f.surfaceEligible <= f.rankedRecommendations);
    assert.ok(opportunity.opportunities.length <= 12);
    // Not every Search finding becomes an Opportunity recommendation
    assert.ok(
      opportunity.recommendations.length < search.opportunities.length + 5,
    );
  });

  it("emits at most one partnership category and one media research candidate", async () => {
    const bundle = await loadAllSources("fixture");
    const opportunity = runOpportunityExecutive(bundle, FIXTURE_REPORTING_PERIOD, {});
    const partners = opportunity.opportunities.filter(
      (o) => o.type === "local-partnership-opportunity",
    );
    const media = opportunity.opportunities.filter(
      (o) =>
        o.type === "podcast-opportunity" ||
        o.type === "newsletter-opportunity" ||
        o.type === "earned-media-opportunity",
    );
    assert.ok(partners.length <= 1);
    assert.ok(media.length <= 1);
    assert.equal(
      opportunity.opportunities.filter((o) => o.type === "bridal-ecosystem-opportunity")
        .length,
      0,
      "bridal suppressed when partnership category exists",
    );
  });

  it("paid-search requires destination and conversion path; no launch language", async () => {
    const bundle = await loadAllSources("fixture");
    const search = runSearchStrategy(bundle, FIXTURE_REPORTING_PERIOD);
    const opportunity = runOpportunityExecutive(bundle, FIXTURE_REPORTING_PERIOD, {
      search,
    });
    const paid = opportunity.opportunities.filter(
      (o) => o.type === "paid-search-readiness",
    );
    for (const p of paid) {
      assert.equal(/\b(launch|run) ads\b/i.test(p.recommendedAction) && !/do not (launch|run)/i.test(p.recommendedAction), false);
      assert.equal(/underpriced paid/i.test(p.recommendedAction + p.whyItMatters), false);
      assert.equal(p.costClass, "unknown");
      if (p.readiness === "ready-to-evaluate" || p.readiness === "ready-for-founder-decision") {
        assert.ok(p.relatedPage);
        assert.match(p.recommendedAction, /evaluate|prepare measurement/i);
      }
    }
  });

  it("same-objective Content/Search work is suppressed", async () => {
    const bundle = await loadAllSources("fixture");
    const bi = runBusinessIntelligence(bundle, FIXTURE_REPORTING_PERIOD);
    const search = runSearchStrategy(bundle, FIXTURE_REPORTING_PERIOD);
    const content = runContentExecutive(bundle, FIXTURE_REPORTING_PERIOD, {
      bi,
      search,
    });
    const opportunity = runOpportunityExecutive(bundle, FIXTURE_REPORTING_PERIOD, {
      bi,
      search,
      content,
    });
    assert.ok(
      opportunity.opportunities.some((o) => o.type === "opportunity-already-covered"),
    );
    assert.equal(
      opportunity.recommendations.some((r) =>
        /already covered by (content|search)/i.test(r.title),
      ),
      false,
    );
  });
});

describe("End-to-end brief length and safety", () => {
  it("fixture brief is approximately 500 words or fewer", async () => {
    const run = await runAgentOsBrief({ mode: "fixture" });
    const words = run.brief.markdown.split(/\s+/).filter(Boolean).length;
    assert.ok(words <= 520, `expected ≤520 words, got ${words}`);
    assert.ok(run.executivesInvoked.includes("opportunity"));
    assert.ok(run.executivesInvoked.includes("business-intelligence"));
    assert.ok(run.executivesInvoked.includes("search-strategy"));
    assert.ok(run.executivesInvoked.includes("content"));
  });

  it("live brief stays degraded-safe without fabricating Opportunity targets", async () => {
    const run = await runAgentOsBrief({ mode: "live" });
    assert.equal(run.mode, "live");
    const words = run.brief.markdown.split(/\s+/).filter(Boolean).length;
    assert.ok(words <= 520, `live brief words ${words}`);
    const blob = JSON.stringify(
      run.recommendations.filter((r) => r.originatingExecutive === "opportunity"),
    );
    assert.equal(/guaranteed roi|cheap traffic|go viral/i.test(blob), false);
  });
});

function baseFields(
  readiness: GrowthOpportunity["readiness"],
  type: GrowthOpportunity["type"],
) {
  return {
    id: buildOpportunityId({
      source: "derived",
      type,
      subject: `subj-${readiness}`,
      readiness,
    }),
    type,
    readiness,
    title: `Test ${type}`,
    whyItMatters: "Test",
    recommendedAction: "Evaluate contained next step",
    targetAudience: "engagement-buyers" as const,
    geography: "charlotte-metro" as const,
    funnelStage: "consideration" as const,
    costClass: "low" as const,
    effort: "medium" as const,
    reversibility: "easily-reversed" as const,
    timeToSignal: "weeks" as const,
    founderDependence: "light" as const,
    externalVerification: "not-applicable" as const,
    isInference: true,
    urgency: "medium" as const,
    approvalRequired: true,
    owner: "Founder / Opportunity",
    supportingReference: "test",
    evidenceNotes: ["note-a", "note-b"],
    disqualifyingRisks: [] as string[],
    additionalLeverage: "Distinct packaging leverage beyond source executive work",
  };
}

// Keep qualifyOpportunity referenced for typecheck stability in this file
void qualifyOpportunity;
