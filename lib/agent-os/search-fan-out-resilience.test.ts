/**
 * Fan-out production resilience — failures must not abort Search Strategy / CoS.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { loadAllSources } from "./adapters/load";
import { FIXTURE_REPORTING_PERIOD } from "./fixtures/sample-data";
import {
  emptyFanOutCoverageSnapshot,
  MAX_FOUNDER_FACING_FAN_OUT,
  runAgentOsBrief,
  runFanOutCoverageAnalyzer,
  runFanOutCoverageGuarded,
  runSearchStrategy,
  summarizeCanonicalInventory,
} from "./index";
import { runBusinessIntelligence } from "./executives/business-intelligence";
import {
  MAX_ADDITIONAL_SURFACED_PRIORITIES,
  runChiefOfStaff,
} from "./executives/chief-of-staff";
import { runContentExecutive } from "./executives/content";
import { runOpportunityExecutive } from "./executives/opportunity";
import type { FanOutFailureStage } from "./search/fan-out/types";

const STACK_OR_PATH_RE =
  /\bat\s+\S+\s+\(|[A-Za-z]:\\|\/Users\/|\/home\/|node_modules[\\/]|Error:\s|^\s+at\s+/m;

function fanOutRecs(recs: { recommendationId: string }[]) {
  return recs.filter((r) => r.recommendationId.includes("fan-out-coverage-gap"));
}

describe("Fan-out resilience — success path unchanged", () => {
  it("normal analyzer success remains status ok with baseline inventory shape", () => {
    const snapshot = runFanOutCoverageAnalyzer({
      now: () => "2026-07-28T12:00:00.000Z",
    });
    assert.equal(snapshot.status, "ok");
    assert.equal(snapshot.completedAt, "2026-07-28T12:00:00.000Z");
    assert.equal(snapshot.degradation, null);
    assert.ok(snapshot.internalEvents.some((e) => e.category === "ok"));

    const canonical = summarizeCanonicalInventory(snapshot.contentInventory);
    assert.equal(snapshot.contentInventory.length, 188);
    assert.equal(canonical.uniqueCanonicalAssets, 113);
    assert.equal(snapshot.summary.averageCoverageScore, 53.9);
    assert.equal(snapshot.summary.fullyCovered, 12);
    assert.equal(snapshot.summary.partiallyCovered, 22);
    assert.equal(snapshot.summary.uncovered, 10);
    assert.ok(
      snapshot.founderFacingOpportunities.length <= MAX_FOUNDER_FACING_FAN_OUT,
    );
    assert.ok(
      snapshot.founderFacingOpportunities.some(
        (o) =>
          o.clusterRole === "flagship" &&
          /How to Choose Where to Buy/i.test(o.flagshipTitle ?? ""),
      ),
    );
    assert.ok(
      snapshot.founderFacingOpportunities.every(
        (o) => o.clusterRole !== "supporting-faq",
      ),
    );
  });
});

describe("Fan-out resilience — guarded Search Strategy", () => {
  it("inventory failure does not abort Search Strategy", async () => {
    const bundle = await loadAllSources("fixture");
    const search = runSearchStrategy(bundle, FIXTURE_REPORTING_PERIOD, {
      mode: "fixture",
      fanOutOptions: { forceFailureAt: "inventory" },
    });
    assert.equal(search.fanOutCoverage.status, "failed");
    assert.equal(
      search.fanOutCoverage.degradation?.errorCategory,
      "inventory-construction",
    );
    assert.equal(search.fanOutCoverage.degradation?.failedStage, "inventory");
    assert.equal(
      search.fanOutCoverage.degradation?.recommendationsSuppressed,
      true,
    );
    assert.ok(search.recommendations.length > 0);
    assert.equal(fanOutRecs(search.recommendations).length, 0);
    assert.ok(
      search.dataGaps.some((g) => g.id === "gap-search-fan-out-coverage"),
    );
  });

  it("matching failure does not abort Search Strategy", async () => {
    const bundle = await loadAllSources("fixture");
    const search = runSearchStrategy(bundle, FIXTURE_REPORTING_PERIOD, {
      mode: "fixture",
      fanOutOptions: { forceFailureAt: "matching" },
    });
    assert.equal(search.fanOutCoverage.status, "failed");
    assert.equal(search.fanOutCoverage.degradation?.errorCategory, "matching");
    assert.equal(fanOutRecs(search.recommendations).length, 0);
    assert.ok(search.recommendations.length > 0);
  });

  it("coverage-scoring failure does not abort Search Strategy", async () => {
    const bundle = await loadAllSources("fixture");
    const search = runSearchStrategy(bundle, FIXTURE_REPORTING_PERIOD, {
      mode: "fixture",
      fanOutOptions: { forceFailureAt: "coverage-scoring" },
    });
    assert.equal(search.fanOutCoverage.status, "failed");
    assert.equal(
      search.fanOutCoverage.degradation?.errorCategory,
      "coverage-scoring",
    );
    assert.equal(fanOutRecs(search.recommendations).length, 0);
    assert.ok(
      search.recommendations.some(
        (r) => !r.recommendationId.includes("fan-out-coverage-gap"),
      ),
    );
  });

  it("failed fan-out produces zero fan-out recommendations while others remain", async () => {
    const bundle = await loadAllSources("fixture");
    const healthy = runSearchStrategy(bundle, FIXTURE_REPORTING_PERIOD, {
      mode: "fixture",
    });
    const failed = runSearchStrategy(bundle, FIXTURE_REPORTING_PERIOD, {
      mode: "fixture",
      fanOutOptions: { forceFailureAt: "prioritization" },
    });
    assert.ok(fanOutRecs(healthy.recommendations).length > 0);
    assert.equal(fanOutRecs(failed.recommendations).length, 0);
    assert.equal(failed.fanOutCoverage.founderFacingOpportunities.length, 0);
    const nonFanOutHealthy = healthy.recommendations.filter(
      (r) => !r.recommendationId.includes("fan-out-coverage-gap"),
    );
    const nonFanOutFailed = failed.recommendations.filter(
      (r) => !r.recommendationId.includes("fan-out-coverage-gap"),
    );
    assert.ok(nonFanOutFailed.length > 0);
    assert.equal(nonFanOutFailed.length, nonFanOutHealthy.length);
  });

  it("injected runner throw is caught and typed as unexpected", async () => {
    const bundle = await loadAllSources("fixture");
    const search = runSearchStrategy(bundle, FIXTURE_REPORTING_PERIOD, {
      mode: "fixture",
      runFanOutCoverage: () => {
        throw new Error(
          "boom at C:\\Users\\justi\\project\\lib\\agent-os\\search\\fan-out\\index.ts:42\n    at runFanOut (index.ts:42:11)",
        );
      },
    });
    assert.equal(search.fanOutCoverage.status, "failed");
    assert.equal(search.fanOutCoverage.degradation?.errorCategory, "unexpected");
    assert.equal(search.fanOutCoverage.degradation?.failedStage, "unknown");
    const safe = search.fanOutCoverage.degradation?.safeMessage ?? "";
    assert.equal(STACK_OR_PATH_RE.test(safe), false);
    assert.ok(!safe.includes("C:\\Users"));
  });
});

describe("Fan-out resilience — Chief of Staff and brief", () => {
  it("CoS aggregation still completes when fan-out fails", async () => {
    const bundle = await loadAllSources("fixture");
    const bi = runBusinessIntelligence(bundle, FIXTURE_REPORTING_PERIOD, {
      mode: "fixture",
    });
    const search = runSearchStrategy(bundle, FIXTURE_REPORTING_PERIOD, {
      mode: "fixture",
      fanOutOptions: { forceFailureAt: "summary" },
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
    assert.ok(cos.brief);
    assert.ok(cos.recommendations.length > 0);
    assert.equal(fanOutRecs(cos.recommendations).length, 0);
    assert.ok(cos.surfacedInBriefCount <= MAX_ADDITIONAL_SURFACED_PRIORITIES + 1);
    assert.ok(
      search.dataGaps.some((g) => g.id === "gap-search-fan-out-coverage"),
    );
    const blob = [
      cos.brief.whatChanged,
      cos.brief.whyItMatters,
      ...cos.brief.needsAttentionToday,
      cos.brief.highestRoiAction,
      ...cos.brief.missingOrUnreliableData,
      ...cos.brief.blocked,
      cos.brief.markdown,
    ].join("\n");
    assert.equal(STACK_OR_PATH_RE.test(blob), false);
    assert.ok(!/FanOutCoverageStageError|forceFailureAt/i.test(blob));
  });

  it("fixture executive run with injected fan-out failure still produces a brief", async () => {
    const run = await runAgentOsBrief({
      mode: "fixture",
      briefCadenceIntent: "daily",
      briefLocalDate: "2026-07-28",
      searchStrategyOptions: {
        fanOutOptions: { forceFailureAt: "inventory" },
      },
    });
    assert.ok(run.brief);
    assert.ok(
      run.dataGaps.some((g) => g.id === "gap-search-fan-out-coverage"),
    );
    assert.equal(fanOutRecs(run.recommendations).length, 0);
    assert.ok(
      (run.briefSurfacing?.recommendationsSurfacedInBrief ?? 0) <=
        MAX_ADDITIONAL_SURFACED_PRIORITIES + 1,
    );
    const blob = JSON.stringify({
      brief: run.brief,
      warnings: run.warnings,
    });
    assert.equal(STACK_OR_PATH_RE.test(blob), false);
  });
});

describe("Fan-out resilience — metadata and persistence hygiene", () => {
  it("internal degraded-state metadata is inspectable", () => {
    const stages: FanOutFailureStage[] = [
      "inventory",
      "question-loading",
      "matching",
      "coverage-scoring",
      "prioritization",
      "summary",
    ];
    for (const stage of stages) {
      const snapshot = runFanOutCoverageGuarded(() =>
        runFanOutCoverageAnalyzer({ forceFailureAt: stage }),
      );
      assert.equal(snapshot.status, "failed");
      assert.ok(snapshot.degradation);
      assert.equal(snapshot.degradation!.failedStage, stage);
      assert.equal(snapshot.degradation!.recommendationsSuppressed, true);
      assert.ok(snapshot.internalEvents.length >= 1);
      assert.equal(snapshot.internalEvents[0]!.stage, stage);
      assert.ok(snapshot.completedAt);
      assert.equal(STACK_OR_PATH_RE.test(snapshot.degradation!.safeMessage), false);
    }
  });

  it("intentionally unavailable is distinct from failed", () => {
    const unavailable = emptyFanOutCoverageSnapshot();
    assert.equal(unavailable.status, "unavailable");
    assert.equal(unavailable.degradation, null);
    assert.equal(unavailable.founderFacingOpportunities.length, 0);
  });

  it("later successful run returns to normal without contamination", async () => {
    const bundle = await loadAllSources("fixture");
    const failed = runSearchStrategy(bundle, FIXTURE_REPORTING_PERIOD, {
      mode: "fixture",
      fanOutOptions: { forceFailureAt: "inventory" },
    });
    assert.equal(failed.fanOutCoverage.status, "failed");

    const recovered = runSearchStrategy(bundle, FIXTURE_REPORTING_PERIOD, {
      mode: "fixture",
    });
    assert.equal(recovered.fanOutCoverage.status, "ok");
    assert.equal(recovered.fanOutCoverage.degradation, null);
    assert.ok(fanOutRecs(recovered.recommendations).length > 0);
    assert.ok(
      recovered.fanOutCoverage.summary.totalQuestionsAnalyzed >= 35,
    );
    assert.ok(
      !recovered.dataGaps.some((g) => g.id === "gap-search-fan-out-coverage"),
    );
  });

  it("founder-facing facts omit raw exception and stack traces", async () => {
    const bundle = await loadAllSources("fixture");
    const search = runSearchStrategy(bundle, FIXTURE_REPORTING_PERIOD, {
      mode: "fixture",
      runFanOutCoverage: () => {
        throw new Error(
          "TypeError: cannot read at C:\\Dev\\Hourglass\\lib\\x.ts:9\n    at Object.run (x.ts:9:3)",
        );
      },
    });
    const founderFacing = [
      ...search.facts,
      ...search.inferences,
      ...search.dataGaps.map((g) => `${g.description} ${g.impactOnRecommendations}`),
    ].join("\n");
    assert.equal(STACK_OR_PATH_RE.test(founderFacing), false);
    assert.ok(!founderFacing.includes("TypeError"));
    assert.ok(!founderFacing.includes("C:\\Dev"));
    assert.ok(!founderFacing.includes("at Object.run"));
    const safe = search.fanOutCoverage.degradation?.safeMessage ?? "";
    assert.equal(STACK_OR_PATH_RE.test(safe), false);
    assert.ok(!safe.includes("C:\\Dev"));
    assert.ok(!safe.includes("at Object.run"));
  });
});
