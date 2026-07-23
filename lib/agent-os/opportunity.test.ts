/**
 * Focused Opportunity Executive tests.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildOpportunityId,
  collectOpportunitySignals,
  consolidateDuplicates,
  detectGrowthOpportunities,
  emptyOpportunityExecutiveOutput,
  isExecutiveOperational,
  operationalExecutives,
  opportunityIdLooksSafe,
  proposedActionImpliesWrite,
  qualifyOpportunity,
  redactSecretsAndPii,
  runAgentOsBrief,
  runBusinessIntelligence,
  runChiefOfStaff,
  runContentExecutive,
  runOpportunityExecutive,
  runSearchStrategy,
  scaffoldExecutives,
  withConfidenceContract,
} from "./index";
import { loadAllSources } from "./adapters/load";
import { FIXTURE_REPORTING_PERIOD } from "./fixtures/sample-data";
import { MAX_ADDITIONAL_SURFACED_PRIORITIES } from "./executives/chief-of-staff";
import type { GrowthOpportunity } from "./opportunity/types";

describe("Opportunity Executive operational status", () => {
  it("marks Opportunity operational with Search and Content", () => {
    assert.equal(isExecutiveOperational("opportunity"), true);
    assert.equal(isExecutiveOperational("search-strategy"), true);
    assert.equal(isExecutiveOperational("content"), true);
    assert.equal(isExecutiveOperational("business-intelligence"), true);
    assert.equal(isExecutiveOperational("chief-of-staff"), true);
    const ops = operationalExecutives().map((e) => e.id);
    assert.deepEqual(ops, [
      "chief-of-staff",
      "business-intelligence",
      "search-strategy",
      "content",
      "opportunity",
    ]);
    assert.deepEqual(scaffoldExecutives(), []);
  });
});

describe("Internal synthesis without external adapters", () => {
  it("synthesizes from BI/Search/Content/repository without external targets", async () => {
    const bundle = await loadAllSources("fixture");
    const bi = runBusinessIntelligence(bundle, FIXTURE_REPORTING_PERIOD);
    const search = runSearchStrategy(bundle, FIXTURE_REPORTING_PERIOD);
    const content = runContentExecutive(bundle, FIXTURE_REPORTING_PERIOD, {
      bi,
      search,
    });
    const opportunity = runOpportunityExecutive(
      bundle,
      FIXTURE_REPORTING_PERIOD,
      { bi, search, content, includeRejectedExamples: true },
    );
    assert.ok(opportunity.opportunities.length >= 1);
    assert.equal(opportunity.strategy.verifiedExternalTargetsAvailable, false);
    assert.ok(
      opportunity.dataGaps.some((g) => g.id === "gap-opportunity-external-targets"),
    );
  });

  it("does not fabricate external targets, CPC, audience size, or ROI", async () => {
    const bundle = await loadAllSources("fixture");
    const bi = runBusinessIntelligence(bundle, FIXTURE_REPORTING_PERIOD);
    const search = runSearchStrategy(bundle, FIXTURE_REPORTING_PERIOD);
    const content = runContentExecutive(bundle, FIXTURE_REPORTING_PERIOD, {
      bi,
      search,
    });
    const opportunity = runOpportunityExecutive(
      bundle,
      FIXTURE_REPORTING_PERIOD,
      { bi, search, content, includeRejectedExamples: true },
    );
    const blob = JSON.stringify(
      opportunity.opportunities.filter((o) => !o.rejected && o.readiness !== "rejected"),
    );
    assert.equal(/\$\d[\d,]*(?:\.\d+)?\s*cpc/i.test(blob), false);
    assert.equal(
      /\bguaranteed roi\b|\bcheap traffic\b|\bgo viral\b|\bhuge audience\b/i.test(blob),
      false,
    );
    assert.equal(
      opportunity.opportunities.some((o) =>
        /acme bridal|specific podcast accepts|competitors are failing/i.test(
          `${o.title} ${o.recommendedAction} ${o.evidenceNotes.join(" ")}`,
        ),
      ),
      false,
    );
    for (const o of opportunity.opportunities) {
      if (o.type === "local-partnership-opportunity") {
        assert.equal(o.readiness, "research-required");
        assert.equal(o.externalVerification, "source-gap");
      }
    }
  });
});

describe("Readiness and qualification rules", () => {
  it("labels category-level partner opportunity as research-required", async () => {
    const bundle = await loadAllSources("fixture");
    const opportunity = runOpportunityExecutive(
      bundle,
      FIXTURE_REPORTING_PERIOD,
      { includeRejectedExamples: true },
    );
    const partner = opportunity.opportunities.find(
      (o) => o.type === "local-partnership-opportunity",
    );
    assert.ok(partner);
    assert.equal(partner!.readiness, "research-required");
    assert.match(partner!.evidenceNotes.join(" "), /no specific business/i);
  });

  it("paid-search readiness requires destination evidence and withholds CPC claims", async () => {
    const bundle = await loadAllSources("fixture");
    const search = runSearchStrategy(bundle, FIXTURE_REPORTING_PERIOD);
    const opportunity = runOpportunityExecutive(
      bundle,
      FIXTURE_REPORTING_PERIOD,
      { search, includeRejectedExamples: true },
    );
    const paid = opportunity.opportunities.find(
      (o) => o.type === "paid-search-readiness",
    );
    assert.ok(paid);
    assert.ok(
      paid!.relatedPage || paid!.readiness === "not-ready",
      "destination or not-ready",
    );
    assert.equal(paid!.costClass, "unknown");
    assert.match(paid!.evidenceNotes.join(" "), /CPC data unavailable/i);
    assert.equal(/inexpensive cpc|cheap cpc/i.test(paid!.recommendedAction), false);
  });

  it("remarketing readiness is measurement-blocked without audience evidence", async () => {
    const bundle = await loadAllSources("fixture");
    const opportunity = runOpportunityExecutive(
      bundle,
      FIXTURE_REPORTING_PERIOD,
      { includeRejectedExamples: true },
    );
    const remarketing = opportunity.opportunities.find(
      (o) => o.type === "remarketing-readiness",
    );
    assert.ok(remarketing);
    assert.equal(remarketing!.readiness, "measurement-blocked");
    assert.match(remarketing!.recommendedAction, /do not implement/i);
    assert.ok(remarketing!.evidenceConfidence >= 0.85);
    assert.ok(remarketing!.strategicAttractiveness <= 3);
  });

  it("high-intent local demand can create an Opportunity finding", async () => {
    const bundle = await loadAllSources("fixture");
    const search = runSearchStrategy(bundle, FIXTURE_REPORTING_PERIOD);
    const opportunity = runOpportunityExecutive(
      bundle,
      FIXTURE_REPORTING_PERIOD,
      { search, includeRejectedExamples: true },
    );
    const localOrDemand = opportunity.opportunities.find(
      (o) =>
        o.type === "local-authority-opportunity" ||
        o.type === "underpriced-organic-demand",
    );
    assert.ok(localOrDemand);
    assert.ok(
      localOrDemand!.readiness === "ready-to-evaluate" ||
        localOrDemand!.readiness === "research-required",
    );
    assert.match(localOrDemand!.additionalLeverage, /leverage/i);
  });

  it("does not steal Search technical or Content production ownership", async () => {
    const bundle = await loadAllSources("fixture");
    const bi = runBusinessIntelligence(bundle, FIXTURE_REPORTING_PERIOD);
    const search = runSearchStrategy(bundle, FIXTURE_REPORTING_PERIOD);
    const content = runContentExecutive(bundle, FIXTURE_REPORTING_PERIOD, {
      bi,
      search,
    });
    const opportunity = runOpportunityExecutive(
      bundle,
      FIXTURE_REPORTING_PERIOD,
      { bi, search, content, includeRejectedExamples: true },
    );
    const covered = opportunity.opportunities.filter(
      (o) => o.type === "opportunity-already-covered",
    );
    assert.ok(covered.length >= 1);
    assert.ok(covered.every((o) => o.readiness === "already-covered"));
    // Material recommendations must not include already-covered duplicates
    assert.equal(
      opportunity.recommendations.some((r) =>
        /already covered by (content|search)/i.test(r.title),
      ),
      false,
    );
  });

  it("adds distinct leverage rather than duplicating source work", async () => {
    const bundle = await loadAllSources("fixture");
    const bi = runBusinessIntelligence(bundle, FIXTURE_REPORTING_PERIOD);
    const search = runSearchStrategy(bundle, FIXTURE_REPORTING_PERIOD);
    const content = runContentExecutive(bundle, FIXTURE_REPORTING_PERIOD, {
      bi,
      search,
    });
    const opportunity = runOpportunityExecutive(
      bundle,
      FIXTURE_REPORTING_PERIOD,
      { bi, search, content },
    );
    for (const o of opportunity.opportunities.filter(
      (x) => x.readiness === "ready-to-evaluate",
    )) {
      assert.ok(o.additionalLeverage.length > 10);
      assert.equal(/edit schema|add faq schema|fix metadata/i.test(o.recommendedAction), false);
    }
  });

  it("rejects generic speculative ideas", async () => {
    const bundle = await loadAllSources("fixture");
    const opportunity = runOpportunityExecutive(
      bundle,
      FIXTURE_REPORTING_PERIOD,
      { includeRejectedExamples: true },
    );
    const rejected = opportunity.opportunities.find(
      (o) => o.readiness === "rejected" || o.rejected,
    );
    assert.ok(rejected);
    assert.match(rejected!.title, /generic|network more|viral/i);
    const q = qualifyOpportunity(rejected!);
    assert.equal(q.ok, false);
  });
});

describe("Ranking preferences", () => {
  it("penalizes founder burden and large spend; rewards asset reuse, local, conversion proximity", () => {
    const base = minimalOpp({
      readiness: "ready-to-evaluate",
      relatedPage: "/concierge",
      relatedTool: "/diamond-shape-studio",
      geography: "charlotte-metro",
      funnelStage: "decision",
      costClass: "low",
      founderDependence: "light",
      strategicFit: 8,
      confidence: 0.7,
      likelyImpact: 7,
    });
    const heavy = minimalOpp({
      ...base,
      id: buildOpportunityId({
        source: "derived",
        type: "low-cost-experiment",
        subject: "heavy-founder",
        readiness: "ready-to-evaluate",
      }),
      founderDependence: "heavy",
      costClass: "high",
      relatedPage: null,
      relatedTool: null,
      geography: "unspecified",
      funnelStage: "awareness",
    });
    const qGood = qualifyOpportunity(base);
    const qBad = qualifyOpportunity(heavy);
    assert.ok(qGood.score > qBad.score);
    assert.ok(qGood.reasons.includes("connected-to-existing-asset"));
    assert.ok(qGood.reasons.includes("regional-relevance"));
    assert.ok(qGood.reasons.includes("conversion-proximity"));
    assert.ok(qBad.penalties.includes("large-spend") || qBad.penalties.includes("high-founder-burden"));
  });

  it("research-required ranks below verified operational issues via CoS", async () => {
    const bundle = await loadAllSources("fixture");
    const bi = runBusinessIntelligence(bundle, FIXTURE_REPORTING_PERIOD);
    const search = runSearchStrategy(bundle, FIXTURE_REPORTING_PERIOD);
    const content = runContentExecutive(bundle, FIXTURE_REPORTING_PERIOD, {
      bi,
      search,
    });
    const opportunity = runOpportunityExecutive(
      bundle,
      FIXTURE_REPORTING_PERIOD,
      { bi, search, content },
    );
    const cos = runChiefOfStaff({
      bi,
      search,
      content,
      opportunity,
      reportingPeriod: FIXTURE_REPORTING_PERIOD,
      warnings: [],
      mode: "fixture",
    });
    const top = cos.recommendations.find(
      (r) =>
        r.status === "proposed" ||
        r.agendaBucket === "do-now" ||
        r.agendaBucket === "schedule-next",
    );
    assert.ok(top);
    // Research-required Opportunity should not outrank strong operational BI/Search when present
    const researchOpp = cos.recommendations.filter(
      (r) =>
        r.originatingExecutive === "opportunity" &&
        /research-required|research angle|partnership category/i.test(r.title),
    );
    if (top && researchOpp[0]) {
      assert.ok(top.priorityScore >= researchOpp[0].priorityScore);
    }
  });
});

describe("Stable IDs and safety", () => {
  it("stable repeated ID and distinct types/readiness", () => {
    const a = buildOpportunityId({
      source: "search",
      type: "underpriced-organic-demand",
      subject: "custom engagement rings charlotte",
      readiness: "ready-to-evaluate",
    });
    const b = buildOpportunityId({
      source: "search",
      type: "underpriced-organic-demand",
      subject: "custom engagement rings charlotte",
      readiness: "ready-to-evaluate",
    });
    const c = buildOpportunityId({
      source: "search",
      type: "paid-search-readiness",
      subject: "custom engagement rings charlotte",
      readiness: "ready-to-evaluate",
    });
    const d = buildOpportunityId({
      source: "search",
      type: "underpriced-organic-demand",
      subject: "custom engagement rings charlotte",
      readiness: "research-required",
    });
    assert.equal(a, b);
    assert.notEqual(a, c);
    assert.notEqual(a, d);
    assert.ok(opportunityIdLooksSafe(a));
  });

  it("IDs contain no PII, contacts, secrets, or timestamps", () => {
    assert.equal(
      opportunityIdLooksSafe(
        "opportunity:search:underpriced-organic-demand:x:ready-to-evaluate",
      ),
      true,
    );
    assert.equal(
      opportunityIdLooksSafe(
        "opportunity:search:x:user@example.com:ready-to-evaluate",
      ),
      false,
    );
    assert.equal(
      opportunityIdLooksSafe(
        "opportunity:search:x:sk-secretkey:ready-to-evaluate",
      ),
      false,
    );
    assert.equal(
      opportunityIdLooksSafe(
        "opportunity:search:x:2026-07-20t14:00:00:ready-to-evaluate",
      ),
      false,
    );
  });

  it("can return zero recommendations without failing", () => {
    const empty = emptyOpportunityExecutiveOutput();
    assert.equal(empty.recommendations.length, 0);
    assert.equal(empty.opportunities.length, 0);
  });
});

describe("Chief of Staff + fixture/live invariants", () => {
  it("deduplicates Opportunity against BI/Search/Content and caps brief at 5", async () => {
    const bundle = await loadAllSources("fixture");
    const bi = runBusinessIntelligence(bundle, FIXTURE_REPORTING_PERIOD);
    const search = runSearchStrategy(bundle, FIXTURE_REPORTING_PERIOD);
    const content = runContentExecutive(bundle, FIXTURE_REPORTING_PERIOD, {
      bi,
      search,
    });
    const opportunity = runOpportunityExecutive(
      bundle,
      FIXTURE_REPORTING_PERIOD,
      { bi, search, content, includeRejectedExamples: true },
    );
    const merged = consolidateDuplicates([
      ...bi.recommendations,
      ...search.recommendations,
      ...content.recommendations,
      ...opportunity.recommendations,
    ]);
    const cos = runChiefOfStaff({
      bi,
      search,
      content,
      opportunity,
      reportingPeriod: FIXTURE_REPORTING_PERIOD,
      warnings: [],
      mode: "fixture",
    });
    assert.ok(cos.surfacedInBriefCount <= 1 + MAX_ADDITIONAL_SURFACED_PRIORITIES);
    assert.ok(cos.brief.surfacedPriorityTitles.length <= 5);
    assert.ok(merged.length >= cos.recommendations.filter((r) => r.status !== "consolidated").length - 5);
    assert.ok(cos.recommendations.length >= 1);
    // Full structured opportunity set remains available
    assert.ok(opportunity.opportunities.length >= 5);
  });

  it("fixture contains ready, research-required, measurement-blocked, already-covered, rejected", async () => {
    const bundle = await loadAllSources("fixture");
    const bi = runBusinessIntelligence(bundle, FIXTURE_REPORTING_PERIOD);
    const search = runSearchStrategy(bundle, FIXTURE_REPORTING_PERIOD);
    const content = runContentExecutive(bundle, FIXTURE_REPORTING_PERIOD, {
      bi,
      search,
    });
    const opportunity = runOpportunityExecutive(
      bundle,
      FIXTURE_REPORTING_PERIOD,
      { bi, search, content, includeRejectedExamples: true },
    );
    const states = new Set(opportunity.opportunities.map((o) => o.readiness));
    assert.ok(states.has("ready-to-evaluate") || states.has("ready-for-founder-decision"));
    assert.ok(states.has("research-required"));
    assert.ok(states.has("measurement-blocked"));
    assert.ok(states.has("already-covered"));
    assert.ok(states.has("rejected"));
  });

  it("live mode never uses fixture opportunity data", async () => {
    const run = await runAgentOsBrief({ mode: "live" });
    assert.equal(run.mode, "live");
    assert.equal(
      run.sourceHealth.some((h) => h.retrievalState === "fixture"),
      false,
    );
    // Live may have zero opportunity recs when sources down — still must not invent
    const oppRecs = run.recommendations.filter(
      (r) => r.originatingExecutive === "opportunity",
    );
    for (const r of oppRecs) {
      assert.equal(/fixture sample/i.test(r.plainLanguageExplanation), false);
    }
  });

  it("full fixture brief keeps Opportunity read-only and no public route", async () => {
    const run = await runAgentOsBrief({ mode: "fixture" });
    assert.ok(run.executivesInvoked.includes("opportunity"));
    assert.deepEqual(run.executivesNotOperational, []);
    assert.ok(run.briefSurfacing.recommendationsSurfacedInBrief <= 5);
    assert.ok(run.briefSurfacing.recommendationsRanked >= 1);
    for (const r of run.recommendations) {
      assert.equal(proposedActionImpliesWrite(r.proposedAction), false);
    }
    const redacted = redactSecretsAndPii(JSON.stringify(run));
    assert.equal(/sk-[a-z0-9]{10,}/i.test(redacted), false);
    assert.equal(
      /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(redacted) &&
        /customer@|lead@|prospect@/i.test(redacted),
      false,
    );
    assert.ok(run.executiveStatuses.some((e) => e.executiveId === "opportunity"));
  });

  it("no competitor weakness claim without evidence", async () => {
    const bundle = await loadAllSources("fixture");
    const opportunity = runOpportunityExecutive(
      bundle,
      FIXTURE_REPORTING_PERIOD,
      {},
    );
    const pos = opportunity.opportunities.find(
      (o) => o.type === "competitor-positioning-gap",
    );
    assert.ok(pos);
    assert.match(pos!.evidenceNotes.join(" "), /not a verified competitor weakness/i);
    assert.equal(
      /\bcompetitors (are|were) (weak|failing|lacking)\b/i.test(
        `${pos!.title} ${pos!.whyItMatters}`,
      ),
      false,
    );
    assert.match(
      pos!.recommendedAction,
      /do not claim competitors lack/i,
    );
  });

  it("signal adapter caps and stays deployment-safe", async () => {
    const bundle = await loadAllSources("fixture");
    const bi = runBusinessIntelligence(bundle, FIXTURE_REPORTING_PERIOD);
    const search = runSearchStrategy(bundle, FIXTURE_REPORTING_PERIOD);
    const content = runContentExecutive(bundle, FIXTURE_REPORTING_PERIOD, {
      bi,
      search,
    });
    const signals = collectOpportunitySignals({ bi, search, content });
    assert.ok(signals.signals.length <= 40);
    assert.ok(signals.strategy.partnerCategories.length >= 1);
  });

  it("detectGrowthOpportunities works from signal bundle alone", async () => {
    const bundle = await loadAllSources("fixture");
    const search = runSearchStrategy(bundle, FIXTURE_REPORTING_PERIOD);
    const signals = collectOpportunitySignals({ search });
    const opps = detectGrowthOpportunities({
      signals,
      includeRejectedExamples: true,
    });
    assert.ok(opps.length >= 1);
  });
});

function minimalOpp(
  overrides: Partial<GrowthOpportunity> & {
    readiness: GrowthOpportunity["readiness"];
  },
): GrowthOpportunity {
  const evidenceConfidence = overrides.evidenceConfidence ?? overrides.confidence ?? 0.7;
  const strategicAttractiveness =
    overrides.strategicAttractiveness ?? overrides.strategicFit ?? 8;
  return withConfidenceContract({
    id:
      overrides.id ??
      buildOpportunityId({
        source: "derived",
        type: "conversion-leverage-opportunity",
        subject: "base",
        readiness: overrides.readiness,
      }),
    type: overrides.type ?? "conversion-leverage-opportunity",
    readiness: overrides.readiness,
    title: overrides.title ?? "Test opportunity",
    whyItMatters: overrides.whyItMatters ?? "Evidence-backed test",
    recommendedAction: overrides.recommendedAction ?? "Evaluate a contained test",
    targetAudience: overrides.targetAudience ?? "engagement-buyers",
    geography: overrides.geography ?? "charlotte-metro",
    funnelStage: overrides.funnelStage ?? "decision",
    relatedQuery: overrides.relatedQuery ?? null,
    relatedPage: overrides.relatedPage ?? "/concierge",
    relatedContent: overrides.relatedContent ?? null,
    relatedTool: overrides.relatedTool ?? "/diamond-shape-studio",
    costClass: overrides.costClass ?? "low",
    effort: overrides.effort ?? "medium",
    reversibility: overrides.reversibility ?? "easily-reversed",
    timeToSignal: overrides.timeToSignal ?? "weeks",
    strategicFit: strategicAttractiveness,
    founderDependence: overrides.founderDependence ?? "light",
    externalVerification: overrides.externalVerification ?? "not-applicable",
    isInference: overrides.isInference ?? true,
    evidenceConfidence,
    strategicAttractiveness,
    urgency: overrides.urgency ?? "medium",
    approvalRequired: overrides.approvalRequired ?? true,
    owner: overrides.owner ?? "Founder / Opportunity",
    supportingReference: overrides.supportingReference ?? "test",
    evidenceNotes: overrides.evidenceNotes ?? ["note-a", "note-b"],
    disqualifyingRisks: overrides.disqualifyingRisks ?? [],
    additionalLeverage:
      overrides.additionalLeverage ??
      "Adds distinct packaging leverage beyond source executive",
    rejected: overrides.rejected,
    rejectionReason: overrides.rejectionReason,
  });
}
