/**
 * V1.1 fan-out question-universe expansion tests.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { loadAllSources } from "./adapters/load";
import { FIXTURE_REPORTING_PERIOD } from "./fixtures/sample-data";
import {
  FAN_OUT_ACTIVE_CANONICAL_MAX,
  FAN_OUT_ACTIVE_CANONICAL_MIN,
  FAN_OUT_SEED_QUESTIONS,
  MAX_FOUNDER_FACING_FAN_OUT,
  QUERY_FAMILIES,
  AUDIENCE_STAGES,
  buildFanOutUniverseStats,
  classifyGscCandidate,
  clusterGscCandidates,
  collectFixtureGscCandidates,
  dedupeQuestionsByCanonicalText,
  getActiveFanOutQuestions,
  isBrandGscQuery,
  normalizeGscQuery,
  resolveGapClusterId,
  runFanOutCoverageAnalyzer,
  runSearchStrategy,
  selectFounderFacingFanOut,
} from "./index";
import {
  MAX_ADDITIONAL_SURFACED_PRIORITIES,
  runChiefOfStaff,
} from "./executives/chief-of-staff";
import { runBusinessIntelligence } from "./executives/business-intelligence";
import { runContentExecutive } from "./executives/content";
import { runOpportunityExecutive } from "./executives/opportunity";

describe("Fan-out V1.1 universe size and identity", () => {
  it("keeps active canonicals within the V1.1 target band", () => {
    const active = getActiveFanOutQuestions();
    assert.ok(active.length >= FAN_OUT_ACTIVE_CANONICAL_MIN);
    assert.ok(active.length <= FAN_OUT_ACTIVE_CANONICAL_MAX);
  });

  it("assigns unique stable ids", () => {
    const ids = FAN_OUT_SEED_QUESTIONS.map((q) => q.id);
    assert.equal(new Set(ids).size, ids.length);
    assert.ok(ids.every((id) => id.startsWith("fan-out-q:")));
  });

  it("uses only valid families and stages on active questions", () => {
    const active = getActiveFanOutQuestions();
    for (const q of active) {
      assert.ok((QUERY_FAMILIES as readonly string[]).includes(q.queryFamily));
      assert.ok((AUDIENCE_STAGES as readonly string[]).includes(q.audienceStage));
    }
  });

  it("links duplicates to an existing canonical id", () => {
    const byId = new Map(FAN_OUT_SEED_QUESTIONS.map((q) => [q.id, q]));
    const duplicates = FAN_OUT_SEED_QUESTIONS.filter((q) => q.status === "duplicate");
    assert.ok(duplicates.length >= 1);
    for (const dup of duplicates) {
      assert.ok(dup.duplicateOfId);
      assert.ok(byId.has(dup.duplicateOfId!));
      assert.equal(byId.get(dup.duplicateOfId!)!.status, "active");
    }
  });

  it("excludes duplicates deferred and rejected from active coverage counts", () => {
    const stats = buildFanOutUniverseStats();
    assert.ok(stats.duplicates >= 1);
    assert.ok(stats.deferred >= 1);
    assert.ok(stats.rejected >= 1);
    const analyzed = runFanOutCoverageAnalyzer().summary.totalQuestionsAnalyzed;
    assert.equal(analyzed, stats.activeCanonical);
    assert.ok(analyzed < FAN_OUT_SEED_QUESTIONS.length);
  });
});

describe("Fan-out V1.1 distribution and provenance", () => {
  it("covers every family and stage with active questions", () => {
    const stats = buildFanOutUniverseStats();
    assert.equal(stats.familiesMissingActive.length, 0);
    for (const family of QUERY_FAMILIES) {
      const row = stats.byFamily.find((r) => r.key === family);
      assert.ok(row && row.count >= 1, `missing family ${family}`);
    }
    for (const stage of AUDIENCE_STAGES) {
      const row = stats.byStage.find((r) => r.key === stage);
      assert.ok(row && row.count >= 1, `missing stage ${stage}`);
    }
  });

  it("keeps pricing and maintenance meaningfully expanded", () => {
    const stats = buildFanOutUniverseStats();
    const pricing = stats.byFamily.find((r) => r.key === "pricing-and-budgeting")!;
    const maintenance = stats.byFamily.find(
      (r) => r.key === "maintenance-repairs-ownership",
    )!;
    assert.ok(pricing.count >= 10);
    assert.ok(maintenance.count >= 10);
  });

  it("preserves mixed provenance including gsc-fixture and expert-curated", () => {
    const stats = buildFanOutUniverseStats();
    const keys = new Set(
      stats.byProvenance.filter((r) => r.count > 0).map((r) => r.key),
    );
    assert.ok(keys.has("seed-curated"));
    assert.ok(keys.has("expert-curated") || keys.has("faq-derived"));
    assert.ok(keys.has("gsc-fixture") || keys.has("local-intent-expansion"));
  });
});

describe("Fan-out V1.1 GSC candidate normalization", () => {
  it("normalizes punctuation and casing", () => {
    assert.equal(
      normalizeGscQuery("  Oval Engagement Ring!! "),
      "oval engagement ring",
    );
  });

  it("flags brand navigational queries without inventing canonicals", () => {
    assert.equal(isBrandGscQuery(normalizeGscQuery("hourglass diamonds")), true);
    const brand = classifyGscCandidate("hourglass diamonds");
    assert.equal(brand.kind, "brand-navigational");
  });

  it("clusters near-duplicate local queries", () => {
    const groups = clusterGscCandidates([
      "custom engagement rings charlotte",
      "engagement rings charlotte nc",
      "hourglass diamonds",
    ]);
    assert.ok(groups.size >= 1);
    const fixture = collectFixtureGscCandidates();
    assert.ok(fixture.some((c) => c.kind === "local" || c.kind === "commercial"));
    assert.ok(fixture.some((c) => c.kind === "brand-navigational"));
  });
});

describe("Fan-out V1.1 clustering and caps", () => {
  it("maps pricing and maintenance questions into dedicated clusters", () => {
    assert.equal(
      resolveGapClusterId(
        "How should I split my budget between the setting and the diamond?",
      ),
      "pricing-budget-tradeoffs",
    );
    assert.equal(
      resolveGapClusterId(
        "How often should I get my engagement ring professionally cleaned?",
      ),
      "ownership-care-maintenance",
    );
  });

  it("keeps founder-facing fan-out at the three-item cap after expansion", () => {
    const snapshot = runFanOutCoverageAnalyzer();
    assert.ok(
      snapshot.founderFacingOpportunities.length <= MAX_FOUNDER_FACING_FAN_OUT,
    );
    const selected = selectFounderFacingFanOut(snapshot.opportunities);
    assert.ok(selected.length <= MAX_FOUNDER_FACING_FAN_OUT);
    assert.ok(selected.every((o) => o.clusterRole !== "supporting-faq"));
  });

  it("runs expanded coverage and Search Strategy with CoS fan-out cap", async () => {
    const snapshot = runFanOutCoverageAnalyzer();
    assert.ok(
      snapshot.summary.totalQuestionsAnalyzed >= FAN_OUT_ACTIVE_CANONICAL_MIN,
    );
    assert.equal(snapshot.status, "ok");

    const bundle = await loadAllSources("fixture");
    const search = runSearchStrategy(bundle, FIXTURE_REPORTING_PERIOD, {
      mode: "fixture",
    });
    assert.equal(search.fanOutCoverage.status, "ok");
    const fanOutRecs = search.recommendations.filter((r) =>
      r.recommendationId.includes("fan-out-coverage-gap"),
    );
    assert.ok(fanOutRecs.length <= MAX_FOUNDER_FACING_FAN_OUT);

    const bi = runBusinessIntelligence(bundle, FIXTURE_REPORTING_PERIOD, {
      mode: "fixture",
    });
    const content = runContentExecutive(bundle, FIXTURE_REPORTING_PERIOD, {
      search,
      bi,
    });
    const opportunity = runOpportunityExecutive(bundle, FIXTURE_REPORTING_PERIOD, {
      search,
      content,
      bi,
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
      briefCadenceIntent: "daily",
      briefLocalDate: "2026-07-28",
    });
    assert.ok(cos.surfacedInBriefCount <= MAX_ADDITIONAL_SURFACED_PRIORITIES + 1);
  });
});

describe("Fan-out V1.1 dedupe hygiene", () => {
  it("dedupes identical canonical text preferring active", () => {
    const active = getActiveFanOutQuestions()[0]!;
    const clone = {
      ...active,
      id: `${active.id}-clone`,
      status: "duplicate" as const,
      duplicateOfId: active.id,
    };
    const deduped = dedupeQuestionsByCanonicalText([clone, active]);
    assert.equal(deduped.length, 1);
    assert.equal(deduped[0]!.status, "active");
  });
});
