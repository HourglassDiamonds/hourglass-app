import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { loadAllSources } from "./adapters/load";
import { FIXTURE_REPORTING_PERIOD } from "./fixtures/sample-data";
import {
  AUDIENCE_STAGES,
  QUERY_FAMILIES,
  RECOMMENDED_ACTIONS,
  buildFanOutContentInventory,
  buildFanOutExecutiveSummary,
  computeFanOutPriorityScore,
  coverageBandFromScore,
  dedupeQuestionsByCanonicalText,
  FAN_OUT_SEED_QUESTIONS,
  formatFanOutReport,
  getActiveFanOutQuestions,
  matchQuestionToContent,
  prioritizeFanOutOpportunities,
  runFanOutCoverageAnalyzer,
  runSearchStrategy,
  scoreQuestionCoverage,
  selectFounderFacingFanOut,
  validateQueryFamily,
  MAX_FOUNDER_FACING_FAN_OUT,
} from "./index";
import {
  FIXTURE_FAN_OUT_INVENTORY,
  FIXTURE_FAN_OUT_QUESTIONS,
} from "./search/fan-out/fixtures";

describe("Fan-out question-family validation", () => {
  it("accepts all required query families", () => {
    assert.equal(QUERY_FAMILIES.length, 14);
    for (const family of QUERY_FAMILIES) {
      assert.equal(validateQueryFamily(family), true);
    }
    assert.equal(validateQueryFamily("not-a-family"), false);
  });

  it("seeds active questions across every family", () => {
    const active = getActiveFanOutQuestions();
    const families = new Set(active.map((q) => q.queryFamily));
    for (const family of QUERY_FAMILIES) {
      assert.ok(families.has(family), `missing family ${family}`);
    }
    assert.ok(active.length >= 35);
    assert.ok(active.length < 80);
  });

  it("includes required audience stages and action types", () => {
    assert.ok(AUDIENCE_STAGES.includes("ready-to-contact"));
    assert.ok(RECOMMENDED_ACTIONS.includes("expand-existing-page"));
    assert.ok(RECOMMENDED_ACTIONS.includes("no-action-needed"));
  });
});

describe("Fan-out content normalization", () => {
  it("inventories guides, faqs, core pages, and approach Q&A without scraping", () => {
    const inventory = buildFanOutContentInventory();
    const types = new Set(inventory.map((i) => i.contentType));
    assert.ok(types.has("diamond-guide-article"));
    assert.ok(types.has("faq"));
    assert.ok(types.has("core-page"));
    assert.ok(types.has("approach-qa"));
    assert.ok(inventory.some((i) => i.url.startsWith("/diamond-guide/")));
    assert.ok(inventory.some((i) => i.hasStructuredData));
    assert.ok(inventory.every((i) => i.id.startsWith("fan-out-content:")));
    assert.ok(inventory.length > 120);
  });
});

describe("Fan-out matching", () => {
  it("matches sparkle question to guide + FAQ with explainable reasons", () => {
    const question = FIXTURE_FAN_OUT_QUESTIONS[0]!;
    const matches = matchQuestionToContent(question, FIXTURE_FAN_OUT_INVENTORY);
    assert.ok(matches.length >= 1);
    assert.ok(matches[0]!.score >= 0.4);
    assert.ok(matches[0]!.reasons.length > 0);
    assert.ok(
      matches.some((m) => m.contentId.includes("sparkle") || m.contentId.includes("cut-faq")),
    );
  });

  it("matches local Waxhaw intent to Charlotte/Waxhaw FAQ", () => {
    const question = FIXTURE_FAN_OUT_QUESTIONS[1]!;
    const matches = matchQuestionToContent(question, FIXTURE_FAN_OUT_INVENTORY);
    assert.ok(matches.length >= 1);
    assert.ok(
      matches.some((m) => m.contentId.includes("charlotte")),
      "expected charlotte/waxhaw FAQ match",
    );
  });
});

describe("Fan-out coverage scoring", () => {
  it("scores covered sparkle question higher than uncovered care question", () => {
    const sparkle = FIXTURE_FAN_OUT_QUESTIONS[0]!;
    const care = FIXTURE_FAN_OUT_QUESTIONS[2]!;
    const sparkleCov = scoreQuestionCoverage(
      sparkle,
      matchQuestionToContent(sparkle, FIXTURE_FAN_OUT_INVENTORY),
      FIXTURE_FAN_OUT_INVENTORY,
    );
    const careCov = scoreQuestionCoverage(
      care,
      matchQuestionToContent(care, FIXTURE_FAN_OUT_INVENTORY),
      FIXTURE_FAN_OUT_INVENTORY,
    );
    assert.ok(sparkleCov.score > careCov.score);
    assert.ok(sparkleCov.factors.length === 10);
    assert.ok(sparkleCov.reasons.length > 0);
    assert.equal(coverageBandFromScore(80), "fully-covered");
    assert.equal(coverageBandFromScore(50), "partially-covered");
    assert.equal(coverageBandFromScore(20), "uncovered");
  });
});

describe("Fan-out priority scoring", () => {
  it("prioritizes high-commercial local gaps over low-commercial maintenance", () => {
    const waxhaw = FIXTURE_FAN_OUT_QUESTIONS[1]!;
    const care = FIXTURE_FAN_OUT_QUESTIONS[2]!;
    const waxhawCov = scoreQuestionCoverage(waxhaw, [], FIXTURE_FAN_OUT_INVENTORY);
    const careCov = scoreQuestionCoverage(care, [], FIXTURE_FAN_OUT_INVENTORY);
    const waxhawPri = computeFanOutPriorityScore({
      question: waxhaw,
      coverage: waxhawCov,
      canStrengthenExisting: true,
    });
    const carePri = computeFanOutPriorityScore({
      question: care,
      coverage: careCov,
      canStrengthenExisting: false,
    });
    assert.ok(waxhawPri.score > carePri.score);
    assert.ok(waxhawPri.reasons.some((r) => /Commercial/i.test(r)));
  });
});

describe("Fan-out duplicate-question handling", () => {
  it("dedupes identical canonical questions preferring active status", () => {
    const deduped = dedupeQuestionsByCanonicalText(FIXTURE_FAN_OUT_QUESTIONS);
    const trust = deduped.filter(
      (q) =>
        q.canonicalQuestion === "How can I tell whether a jeweler is trustworthy?",
    );
    assert.equal(trust.length, 1);
    assert.equal(trust[0]!.status, "active");
  });

  it("excludes duplicate-status seed from active analysis set", () => {
    const active = getActiveFanOutQuestions(FAN_OUT_SEED_QUESTIONS);
    assert.ok(active.every((q) => q.status === "active"));
    assert.ok(
      FAN_OUT_SEED_QUESTIONS.some((q) => q.status === "duplicate"),
      "seed should include a marked duplicate for regression",
    );
  });
});

describe("Fan-out local-intent handling", () => {
  it("applies local relevance factor for Charlotte/Waxhaw questions", () => {
    const waxhaw = FIXTURE_FAN_OUT_QUESTIONS[1]!;
    const matches = matchQuestionToContent(waxhaw, FIXTURE_FAN_OUT_INVENTORY);
    const coverage = scoreQuestionCoverage(waxhaw, matches, FIXTURE_FAN_OUT_INVENTORY);
    const localFactor = coverage.factors.find((f) => f.key === "localRelevance");
    assert.ok(localFactor);
    assert.ok(localFactor!.score >= 0.5);
  });
});

describe("Fan-out recommendation generation", () => {
  it("generates actionable opportunities with preferred expand-existing bias", () => {
    const active = getActiveFanOutQuestions(FIXTURE_FAN_OUT_QUESTIONS);
    const coverages = active.map((q) =>
      scoreQuestionCoverage(
        q,
        matchQuestionToContent(q, FIXTURE_FAN_OUT_INVENTORY),
        FIXTURE_FAN_OUT_INVENTORY,
      ),
    );
    const opps = prioritizeFanOutOpportunities(
      active,
      coverages,
      FIXTURE_FAN_OUT_INVENTORY,
    );
    assert.ok(opps.length >= 1);
    assert.ok(opps.every((o) => o.recommendedAction !== "no-action-needed"));
    assert.ok(opps[0]!.priorityScore >= opps[opps.length - 1]!.priorityScore);
    const founder = selectFounderFacingFanOut(opps);
    assert.ok(founder.length <= MAX_FOUNDER_FACING_FAN_OUT);
  });
});

describe("Fan-out executive-summary output", () => {
  it("builds summary and readable report from fixture run", () => {
    const snapshot = runFanOutCoverageAnalyzer({
      questions: FIXTURE_FAN_OUT_QUESTIONS,
      inventory: FIXTURE_FAN_OUT_INVENTORY,
      founderFacingLimit: 2,
    });
    assert.equal(snapshot.summary.totalQuestionsAnalyzed, 6); // active only
    assert.ok(snapshot.summary.averageCoverageScore >= 0);
    assert.ok(snapshot.founderFacingOpportunities.length <= 2);
    const report = formatFanOutReport(snapshot);
    assert.match(report, /Executive summary/);
    assert.match(report, /Top 10 prioritized opportunities/);
    const summary = buildFanOutExecutiveSummary({
      questions: getActiveFanOutQuestions(FIXTURE_FAN_OUT_QUESTIONS),
      coverages: snapshot.coverages,
      contentInventoryCount: FIXTURE_FAN_OUT_INVENTORY.length,
      opportunities: snapshot.opportunities,
    });
    assert.equal(
      summary.fullyCovered + summary.partiallyCovered + summary.uncovered,
      summary.totalQuestionsAnalyzed,
    );
  });
});

describe("Fan-out Search Strategy integration", () => {
  it("attaches fanOutCoverage and caps founder-facing opportunities", async () => {
    const bundle = await loadAllSources("fixture");
    const search = runSearchStrategy(bundle, FIXTURE_REPORTING_PERIOD, {
      mode: "fixture",
    });
    assert.ok(search.fanOutCoverage);
    assert.ok(search.fanOutCoverage.summary.totalQuestionsAnalyzed >= 35);
    assert.ok(
      search.fanOutCoverage.founderFacingOpportunities.length <=
        MAX_FOUNDER_FACING_FAN_OUT,
    );
    assert.ok(search.facts.some((f) => /Fan-out question universe/i.test(f)));
    const fanOutRecs = search.recommendations.filter((r) =>
      r.recommendationId.includes("fan-out-coverage-gap"),
    );
    assert.ok(fanOutRecs.length <= MAX_FOUNDER_FACING_FAN_OUT);
  });
});
