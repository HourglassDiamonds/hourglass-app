import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FULLY_COVERED_MIN_COMPLETENESS,
  FULLY_COVERED_MIN_DIRECT,
  buildFanOutContentInventory,
  consolidateOpportunityClusters,
  dedupeMatchesByCanonicalSource,
  matchQuestionToContent,
  prioritizeFanOutOpportunities,
  resolveCoverageBand,
  resolveGapClusterId,
  runFanOutCoverageAnalyzer,
  scoreContentMatch,
  scoreQuestionCoverage,
  summarizeCanonicalInventory,
} from "./index";
import {
  FIXTURE_FAN_OUT_INVENTORY,
  FIXTURE_FAN_OUT_QUESTIONS,
} from "./search/fan-out/fixtures";
import type { FanOutOpportunity, FanOutQuestion } from "./search/fan-out/types";

describe("Fan-out scoring integrity gates", () => {
  it("does not grant fully-covered without direct-answer and completeness minima", () => {
    const gated = resolveCoverageBand({
      rawScore: 85,
      directAnswer: 0.4,
      completeness: 0.9,
    });
    assert.equal(gated.band, "partially-covered");
    assert.equal(gated.gatedFromFullyCovered, true);

    const gated2 = resolveCoverageBand({
      rawScore: 85,
      directAnswer: 0.95,
      completeness: 0.3,
    });
    assert.equal(gated2.band, "partially-covered");

    const ok = resolveCoverageBand({
      rawScore: 85,
      directAnswer: FULLY_COVERED_MIN_DIRECT,
      completeness: FULLY_COVERED_MIN_COMPLETENESS,
    });
    assert.equal(ok.band, "fully-covered");
    assert.equal(ok.gatedFromFullyCovered, false);
  });

  it("does not credit unknown freshness as mid confidence on live inventory scoring", () => {
    const sparkle = FIXTURE_FAN_OUT_QUESTIONS[0]!;
    const matches = matchQuestionToContent(sparkle, FIXTURE_FAN_OUT_INVENTORY);
    const coverage = scoreQuestionCoverage(sparkle, matches, FIXTURE_FAN_OUT_INVENTORY);
    const freshness = coverage.factors.find((f) => f.key === "freshness");
    assert.ok(freshness);
    assert.ok(
      freshness!.score <= 0.25,
      `expected low freshness without dates, got ${freshness!.score}`,
    );
    assert.match(freshness!.reason, /not credited|No verified/i);
  });

  it("caps topic-only Charlotte FAQ fragments from becoming strong matches", () => {
    const lookFor: FanOutQuestion = {
      id: "fan-out-q:fixture-look-for-charlotte",
      canonicalQuestion: "What should I look for in a Charlotte jeweler?",
      queryFamily: "local-charlotte-intent",
      searchIntent: "local",
      audienceStage: "comparing",
      geography: "charlotte",
      commercialValue: 9,
      authorityValue: 9,
      source: "seed-curated",
      status: "active",
      matchTerms: ["charlotte jeweler", "look for", "charlotte"],
      entities: ["charlotte"],
      topics: ["local", "trust"],
      duplicateOfId: null,
      createdAt: "2026-07-27T00:00:00.000Z",
      updatedAt: "2026-07-27T00:00:00.000Z",
    };
    const weakFaq = FIXTURE_FAN_OUT_INVENTORY.find((c) =>
      c.id.includes("charlotte-weak-faq"),
    )!;
    const match = scoreContentMatch(lookFor, weakFaq);
    assert.ok(match);
    assert.ok(
      match!.score < 0.62,
      `weak showroom FAQ should not be strong for look-for question, got ${match!.score}`,
    );
  });

  it("does not let generic engagement-ring page strongly answer a specific buyer question", () => {
    const online = FIXTURE_FAN_OUT_QUESTIONS.find((q) =>
      q.canonicalQuestion.includes("online risky"),
    )!;
    const generic = FIXTURE_FAN_OUT_INVENTORY.find((c) =>
      c.id.includes("engagement-generic"),
    )!;
    const match = scoreContentMatch(online, generic);
    if (match) {
      assert.ok(
        match.score < 0.5,
        `generic engagement page should not strongly cover online-risk, got ${match.score}`,
      );
    }
  });

  it("dedupes FAQ siblings onto one canonical source for scoring", () => {
    const sparkle = FIXTURE_FAN_OUT_QUESTIONS[0]!;
    const raw = FIXTURE_FAN_OUT_INVENTORY.map((c) => scoreContentMatch(sparkle, c)).filter(
      (m): m is NonNullable<typeof m> => Boolean(m),
    );
    const deduped = dedupeMatchesByCanonicalSource(raw, FIXTURE_FAN_OUT_INVENTORY);
    const cutCanonical = deduped.filter((m) => {
      const c = FIXTURE_FAN_OUT_INVENTORY.find((x) => x.id === m.contentId);
      return c?.canonicalSourceId === "/diamond-guide/what-is-diamond-cut";
    });
    assert.equal(cutCanonical.length, 1);
  });

  it("awards schema only when a direct-answer asset has structured data", () => {
    const sparkle = FIXTURE_FAN_OUT_QUESTIONS[0]!;
    // Approach-only inventory: no schema on answering asset
    const approachOnly = FIXTURE_FAN_OUT_INVENTORY.filter((c) =>
      c.id.includes("approach"),
    );
    const matches = matchQuestionToContent(sparkle, approachOnly, { minScore: 0.2 });
    const coverage = scoreQuestionCoverage(sparkle, matches, approachOnly);
    const schema = coverage.factors.find((f) => f.key === "schemaSupport");
    assert.ok(schema);
    // Sparkle vs approach is weak; schema should not get high credit from unrelated pages
    assert.ok(schema!.score <= 0.2 || matches.length === 0);
  });
});

describe("Fan-out canonical inventory", () => {
  it("reports unique canonical assets below normalized record count", () => {
    const inventory = buildFanOutContentInventory();
    const stats = summarizeCanonicalInventory(inventory);
    assert.equal(stats.totalNormalizedRecords, inventory.length);
    assert.ok(stats.uniqueCanonicalAssets < stats.totalNormalizedRecords);
    assert.ok(stats.derivativeRecordCount > 40);
    assert.ok(
      stats.topCrowdedSources.some((s) => s.canonicalSourceId === "/our-approach"),
    );
  });
});

describe("Fan-out recommendation clustering", () => {
  it("maps overlapping buyer questions into the where-to-buy cluster", () => {
    assert.equal(
      resolveGapClusterId("Is buying a diamond online risky?"),
      "buyer-orientation-where-to-buy",
    );
    assert.equal(
      resolveGapClusterId("Do I need to see a diamond in person?"),
      "buyer-orientation-where-to-buy",
    );
    assert.equal(resolveGapClusterId("What makes one diamond sparkle more than another?"), null);
  });

  it("emits one flagship and supporting FAQs instead of competing create-article recs", () => {
    const active = FIXTURE_FAN_OUT_QUESTIONS.filter((q) => q.status === "active");
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
    const cluster = opps.filter(
      (o) => o.gapClusterId === "buyer-orientation-where-to-buy",
    );
    assert.ok(cluster.length >= 2);
    const flagships = cluster.filter((o) => o.clusterRole === "flagship");
    const supporting = cluster.filter((o) => o.clusterRole === "supporting-faq");
    assert.equal(flagships.length, 1);
    assert.ok(supporting.length >= 1);
    assert.ok(flagships[0]!.flagshipTitle?.includes("Where to Buy"));
    assert.ok(
      flagships[0]!.recommendedAction === "expand-existing-page" ||
        flagships[0]!.recommendedAction === "create-diamond-guide-article",
    );
    assert.ok(supporting.every((s) => s.recommendedAction === "add-faq"));
    assert.ok(
      supporting.every((s) => s.consolidatedIntoOpportunityId === flagships[0]!.id),
    );
  });

  it("consolidateOpportunityClusters is idempotent on already-distinct items", () => {
    const sample: FanOutOpportunity[] = [
      {
        id: "search-strategy:repository:fan-out-coverage-gap:sparkle",
        questionId: "fan-out-q:fixture-sparkle",
        question: "What makes one diamond sparkle more than another?",
        queryFamily: "cut-and-sparkle",
        audienceStage: "researching",
        geography: "unspecified",
        coverageScore: 50,
        coverageBand: "partially-covered",
        whyCoverageWeak: ["test"],
        recommendedAction: "expand-existing-page",
        recommendedFormat: "core-page-section",
        suggestedExistingPage: "/diamond-guide/diamond-sparkle-explained",
        commercialValue: 8,
        authorityValue: 10,
        priorityScore: 55,
        priorityReasons: ["test"],
        gapClusterId: null,
        clusterRole: "distinct",
        flagshipTitle: null,
        supportingQuestionIds: [],
        consolidatedIntoOpportunityId: null,
      },
    ];
    const out = consolidateOpportunityClusters(sample, FIXTURE_FAN_OUT_INVENTORY);
    assert.equal(out.length, 1);
    assert.equal(out[0]!.clusterRole, "distinct");
  });
});

describe("Fan-out integrity rerun smoke", () => {
  it("produces a gated live snapshot with canonical facts", () => {
    const snap = runFanOutCoverageAnalyzer();
    assert.ok(snap.summary.totalQuestionsAnalyzed >= 35);
    assert.ok(snap.facts.some((f) => /unique canonical/i.test(f)));
    assert.ok(snap.inferences.some((f) => /direct-answer and completeness gates/i.test(f)));
    // Supporting FAQs should not flood founder surface
    assert.ok(
      snap.founderFacingOpportunities.every((o) => o.clusterRole !== "supporting-faq"),
    );
  });
});
