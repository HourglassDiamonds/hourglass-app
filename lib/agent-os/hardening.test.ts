/**
 * Final hardening checks: volume, delivery, stable IDs, partial runs.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { loadAllSources } from "./adapters/load";
import {
  resolveBiExecutiveStatus,
  resolveBriefEvidenceQuality,
  resolveDeliveryGuidance,
  resolveSearchExecutiveStatus,
} from "./delivery";
import { runBusinessIntelligence } from "./executives/business-intelligence";
import {
  MAX_ADDITIONAL_SURFACED_PRIORITIES,
  runChiefOfStaff,
} from "./executives/chief-of-staff";
import { emptySearchStrategyOutput, runSearchStrategy } from "./executives/search-strategy";
import { FIXTURE_REPORTING_PERIOD } from "./fixtures/sample-data";
import { isExecutiveOperational } from "./registry";
import { runAgentOsBrief } from "./run";
import {
  buildSearchOpportunityId,
  searchIdLooksSafe,
} from "./search/ids";
import { inspectGuideAuthority } from "./search/guide-authority";

describe("Recommendation volume control", () => {
  it("distinguishes opportunities, ranked recs, and brief surfacing", async () => {
    const run = await runAgentOsBrief({ mode: "fixture" });
    assert.ok(run.briefSurfacing.opportunitiesDetected >= 1);
    assert.ok(run.briefSurfacing.recommendationsRanked >= 1);
    assert.ok(
      run.briefSurfacing.recommendationsSurfacedInBrief <=
        1 + MAX_ADDITIONAL_SURFACED_PRIORITIES,
    );
    assert.ok(
      run.recommendations.length >=
        run.briefSurfacing.recommendationsSurfacedInBrief,
      "JSON retains full ranked set beyond Markdown surfacing",
    );
    assert.ok(run.brief.markdown.includes("Surfacing:"));
    assert.ok(
      run.brief.markdown.includes("full ranked set retained in JSON") ||
        run.brief.canSafelyWait.some((l) => /deferred|None/i.test(l)),
    );
  });
});

describe("Partial-run and delivery semantics", () => {
  it("BI blocked + Search completed with findings → degraded partial delivery", () => {
    const bi = resolveBiExecutiveStatus({
      skipped: false,
      criticalAnalyticsDown: true,
      dataGapCount: 3,
      recommendations: [],
    });
    const search = resolveSearchExecutiveStatus({
      skipped: false,
      gscAvailable: false,
      recommendations: [
        {
          recommendationId: "x",
          originatingExecutive: "search-strategy",
          status: "proposed",
          agendaBucket: "do-now",
        } as never,
      ],
      opportunityCount: 2,
    });
    assert.equal(bi.status, "blocked");
    assert.equal(search.status, "completed-with-warnings");
    assert.ok((search.materialRecommendationCount ?? 0) >= 1);

    const quality = resolveBriefEvidenceQuality({
      runStatus: "blocked",
      criticalSourcesDown: true,
      materialCount: 2,
    });
    assert.equal(quality, "partial-degraded");
    assert.equal(
      resolveDeliveryGuidance({
        runStatus: "blocked",
        recommendationAvailability: "has-material-recommendations",
        briefEvidenceQuality: quality,
      }),
      "send-degraded-partial-brief",
    );
  });

  it("Search blocked + BI completed", () => {
    const bi = resolveBiExecutiveStatus({
      skipped: false,
      criticalAnalyticsDown: false,
      dataGapCount: 0,
      recommendations: [
        {
          recommendationId: "bi1",
          originatingExecutive: "business-intelligence",
          status: "proposed",
          agendaBucket: "do-now",
        } as never,
      ],
    });
    const search = resolveSearchExecutiveStatus({
      skipped: true,
      gscAvailable: false,
      recommendations: [],
      opportunityCount: 0,
    });
    assert.equal(bi.status, "completed");
    assert.equal(search.status, "blocked");
    assert.equal(
      resolveDeliveryGuidance({
        runStatus: "completed-with-warnings",
        recommendationAvailability: "has-material-recommendations",
        briefEvidenceQuality: "full",
      }),
      "send-normal-brief",
    );
  });

  it("both blocked → failure alert, not all-clear", () => {
    const quality = resolveBriefEvidenceQuality({
      runStatus: "blocked",
      criticalSourcesDown: true,
      materialCount: 0,
    });
    assert.equal(quality, "none-blocked");
    assert.equal(
      resolveDeliveryGuidance({
        runStatus: "blocked",
        recommendationAvailability: "none-blocked-by-sources",
        briefEvidenceQuality: quality,
      }),
      "send-failure-alert",
    );
  });

  it("both completed with no material changes → send nothing", () => {
    assert.equal(
      resolveDeliveryGuidance({
        runStatus: "completed",
        recommendationAvailability: "none-material",
        briefEvidenceQuality: "full",
      }),
      "send-nothing",
    );
  });

  it("partial findings are clearly labeled degraded in live-style brief", async () => {
    const bundle = await loadAllSources("fixture");
    // Simulate BI analytics down while Search still has fixture GSC + repo
    const bi = runBusinessIntelligence(bundle, FIXTURE_REPORTING_PERIOD);
    const search = runSearchStrategy(bundle, FIXTURE_REPORTING_PERIOD);
    const cos = runChiefOfStaff({
      bi: {
        ...bi,
        dataGaps: [
          ...bi.dataGaps,
          {
            id: "gap-ga4-sim",
            sourceId: "ga4",
            description: "GA4 simulated unavailable",
            impactOnRecommendations: "BI degraded",
            suggestedRemedy: "n/a",
          },
        ],
      },
      search,
      reportingPeriod: FIXTURE_REPORTING_PERIOD,
      warnings: [],
      mode: "live",
      briefEvidenceQuality: "partial-degraded",
    });
    assert.match(cos.brief.markdown, /DEGRADED|PARTIAL/i);
    assert.equal(cos.brief.markdown.toLowerCase().includes("all clear"), false);
    assert.ok(cos.recommendations.some((r) => r.originatingExecutive === "search-strategy"));
  });
});

describe("Stable Search opportunity identifiers", () => {
  it("stable repeated ID for unchanged inputs", () => {
    const a = buildSearchOpportunityId({
      source: "repository",
      type: "tool-handoff-gap",
      subject: "/diamond-guide/oval-cut-diamond",
    });
    const b = buildSearchOpportunityId({
      source: "repository",
      type: "tool-handoff-gap",
      subject: "/diamond-guide/oval-cut-diamond",
    });
    assert.equal(a, b);
    assert.ok(searchIdLooksSafe(a));
  });

  it("distinct IDs for distinct routes", () => {
    const a = buildSearchOpportunityId({
      source: "repository",
      type: "tool-handoff-gap",
      subject: "/diamond-guide/route-a",
    });
    const b = buildSearchOpportunityId({
      source: "repository",
      type: "tool-handoff-gap",
      subject: "/diamond-guide/route-b",
    });
    assert.notEqual(a, b);
  });

  it("distinct IDs for distinct opportunity types", () => {
    const a = buildSearchOpportunityId({
      source: "gsc",
      type: "near-page-one",
      subject: "oval engagement ring",
    });
    const b = buildSearchOpportunityId({
      source: "gsc",
      type: "high-impression-low-ctr",
      subject: "oval engagement ring",
    });
    assert.notEqual(a, b);
  });

  it("IDs contain no customer data or secret values", () => {
    const id = buildSearchOpportunityId({
      source: "gsc",
      type: "rising-query",
      subject: "lab grown vs natural diamonds",
    });
    assert.equal(searchIdLooksSafe(id), true);
    assert.equal(/@|api_key|sk-|password|bearer/i.test(id), false);
    const snap = inspectGuideAuthority();
    for (const o of snap.opportunities) {
      assert.ok(searchIdLooksSafe(o.id), o.id);
    }
  });
});

describe("Hardening invariants", () => {
  it("keeps Content and Opportunity non-operational", () => {
    assert.equal(isExecutiveOperational("content"), false);
    assert.equal(isExecutiveOperational("opportunity"), false);
    assert.equal(isExecutiveOperational("search-strategy"), true);
  });

  it("empty Search output helper stays healthy", () => {
    const empty = emptySearchStrategyOutput();
    assert.equal(empty.recommendations.length, 0);
    assert.equal(empty.opportunities.length, 0);
  });
});
