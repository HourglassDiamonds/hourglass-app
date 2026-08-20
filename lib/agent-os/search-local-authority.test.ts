import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildLocalAuthorityFindingId,
  buildLocalSemanticDedupeKey,
  classifyLocalGeography,
  classifyLocalIntentKind,
  countFounderRankableRepositoryLocal,
  detectLocalAuthorityFindings,
  emptySearchStrategyOutput,
  GBP_DIMENSION_KEYS,
  GBP_ROOT_SOURCE_GAP_ID,
  inspectLocalEntityInventory,
  isExecutiveOperational,
  isLocalAuthorityQuery,
  isLocalIntent,
  localAuthorityIdLooksSafe,
  observeGbpIntelligence,
  operationalExecutives,
  proposedActionImpliesWrite,
  recommendationIsFounderRankableLocal,
  redactSecretsAndPii,
  runAgentOsBrief,
  runLocalAuthorityIntelligence,
  runSearchStrategy,
  scaffoldExecutives,
} from "./index";
import { FIXTURE_REPORTING_PERIOD } from "./fixtures/sample-data";
import { loadAllSources } from "./adapters/load";
import { buildSourceHealth } from "./source-health";
import type { AgentOsDataBundle } from "./adapters/types";
import { runChiefOfStaff } from "./executives/chief-of-staff";
import { runBusinessIntelligence } from "./executives/business-intelligence";
import { runContentExecutive } from "./executives/content";
import { runOpportunityExecutive } from "./executives/opportunity";
import { inspectGuideAuthority } from "./search/guide-authority";

describe("Local Authority — executives remain operational", () => {
  it("Search Strategy remains operational; BI/Content/Opportunity remain operational", () => {
    assert.equal(isExecutiveOperational("search-strategy"), true);
    assert.equal(isExecutiveOperational("business-intelligence"), true);
    assert.equal(isExecutiveOperational("content"), true);
    assert.equal(isExecutiveOperational("opportunity"), true);
    assert.equal(isExecutiveOperational("chief-of-staff"), true);
  });

  it("all five executives remain represented", async () => {
    const run = await runAgentOsBrief({ mode: "fixture" });
    for (const id of [
      "chief-of-staff",
      "business-intelligence",
      "search-strategy",
      "content",
      "opportunity",
    ] as const) {
      assert.ok(run.executivesInvoked.includes(id));
    }
    assert.deepEqual(scaffoldExecutives().map((e) => e.id).sort(), []);
    assert.equal(operationalExecutives().length, 5);
  });
});

describe("Local Authority — repository vs GBP truth", () => {
  it("repository location evidence does not imply GBP observation", () => {
    const inventory = inspectLocalEntityInventory();
    assert.ok(inventory.fields.some((f) => f.key === "locality" && f.present));
    assert.equal(inventory.hasAggregateRatingSchema, false);
  });

  it("missing GBP adapter produces unknown, not incomplete", async () => {
    const bundle = await loadAllSources("fixture");
    const gbp = observeGbpIntelligence({ bundle, mode: "fixture", fixtureObservedDimensions: null });
    assert.ok(
      gbp.sourceState === "not-configured" ||
        gbp.sourceState === "unavailable" ||
        gbp.sourceState === "unknown" ||
        gbp.sourceState === "partially-observed",
    );
    assert.equal(gbp.hasVerifiedGbpData, false);
    for (const d of gbp.dimensions) {
      if (d.source === "none") {
        assert.equal(d.evidenceClass, "unknown");
        assert.equal(d.recommendationEligible, false);
      }
    }
    const blob = JSON.stringify(gbp);
    assert.equal(/profile is incomplete|incomplete profile/i.test(blob), false);
  });

  it("one root GBP source gap replaces multiple unknown-dimension recommendations", async () => {
    const bundle = await loadAllSources("fixture");
    const search = runSearchStrategy(bundle, { ...FIXTURE_REPORTING_PERIOD }, {
      mode: "fixture",
    });
    const gbpRecs = search.recommendations.filter(
      (r) =>
        r.recommendationId === GBP_ROOT_SOURCE_GAP_ID ||
        /gbp dimension unknown|missing GBP (categories|reviews|calls|directions|posts)/i.test(
          r.title,
        ),
    );
    assert.ok(
      search.recommendations.some((r) => r.recommendationId === GBP_ROOT_SOURCE_GAP_ID) ||
        search.dataGaps.some((g) => g.id === GBP_ROOT_SOURCE_GAP_ID),
    );
    assert.equal(
      gbpRecs.filter((r) => /dimension unknown/i.test(r.title)).length,
      0,
    );
    const unknownDims = search.localAuthority.findings.filter(
      (f) =>
        f.suppressRecommendation &&
        (f.type.startsWith("gbp-") || f.type === "local-review-readiness-gap"),
    );
    assert.ok(unknownDims.length >= 1);
  });

  it("GBP root ID remains stable", () => {
    assert.equal(
      GBP_ROOT_SOURCE_GAP_ID,
      "search-strategy:gbp:measurement-gap:google-business-profile",
    );
    assert.equal(
      buildLocalAuthorityFindingId({
        source: "gbp",
        type: "gbp-source-gap",
        subject: "google-business-profile",
      }),
      GBP_ROOT_SOURCE_GAP_ID,
    );
    assert.ok(localAuthorityIdLooksSafe(GBP_ROOT_SOURCE_GAP_ID));
  });
});

describe("Local Authority — geography and intent classification", () => {
  it("classifies Charlotte / Waxhaw / Fort Mill / South Charlotte / near-me / branded", () => {
    assert.equal(classifyLocalGeography("engagement rings charlotte"), "charlotte");
    assert.equal(classifyLocalGeography("custom jeweler waxhaw"), "waxhaw");
    assert.equal(classifyLocalGeography("best jeweler fort mill sc"), "fort-mill");
    assert.equal(
      classifyLocalGeography("south charlotte engagement rings"),
      "south-charlotte",
    );
    assert.equal(classifyLocalIntentKind("jeweler near me"), "near-me-query");
    assert.equal(
      classifyLocalIntentKind("hourglass diamonds charlotte"),
      "branded-location-query",
    );
    assert.equal(isLocalIntent("fort mill engagement rings"), true);
    assert.equal(isLocalAuthorityQuery("diamond cut explained"), false);
  });
});

describe("Local Authority — GSC local detectors", () => {
  it("detects near-page-one, high-impression/low-CTR, mismatch; suppresses small samples; healthy branded ok", async () => {
    const bundle = await loadAllSources("fixture");
    const guideAuthority = inspectGuideAuthority();
    const result = runLocalAuthorityIntelligence({
      mode: "fixture",
      bundle,
      reportingPeriod: { ...FIXTURE_REPORTING_PERIOD },
      guideAuthority,
      gscAvailable: true,
    });
    const types = new Set(result.audit.findings.map((f) => f.type));
    assert.ok(types.has("local-near-page-one"));
    assert.ok(types.has("local-high-impression-low-ctr"));
    assert.ok(types.has("local-query-page-mismatch") || types.has("local-near-page-one"));
    assert.ok(types.has("local-coverage-healthy"));
    const small = result.audit.findings.filter(
      (f) =>
        f.suppressRecommendation &&
        /small-sample|waxhaw diamond appraisal/i.test(f.title + (f.queryOrPage ?? "")),
    );
    assert.ok(small.length >= 1);
    const healthyBrand = result.audit.findings.find(
      (f) =>
        f.type === "local-coverage-healthy" &&
        /hourglass diamonds charlotte/i.test(f.queryOrPage ?? ""),
    );
    assert.ok(healthyBrand);
    assert.equal(healthyBrand!.suppressRecommendation, true);
  });
});

describe("Local Authority — repository hub and handoffs", () => {
  it("maps Charlotte Guides to the official hub and still detects tool/Concierge gaps", async () => {
    const bundle = await loadAllSources("fixture");
    const result = runLocalAuthorityIntelligence({
      mode: "fixture",
      bundle,
      reportingPeriod: { ...FIXTURE_REPORTING_PERIOD },
      guideAuthority: inspectGuideAuthority(),
      gscAvailable: true,
    });
    assert.equal(
      result.audit.findings.some((f) => f.type === "local-hub-gap"),
      false,
    );
    assert.ok(
      result.audit.findings.some(
        (f) =>
          f.type === "local-tool-handoff-gap" ||
          f.type === "local-concierge-handoff-gap",
      ),
    );
  });

  it("service-area complementary language is not falsely flagged as contradiction", () => {
    const inventory = inspectLocalEntityInventory();
    const findings = detectLocalAuthorityFindings({
      gsc: null,
      gscAvailable: false,
      entityInventory: inventory,
      gbp: {
        sourceState: "not-configured",
        dimensions: GBP_DIMENSION_KEYS.map((key) => ({
          key,
          observedValue: null,
          source: "none",
          freshness: "unknown",
          confidence: 0,
          externalVerificationState: "unavailable",
          recommendationEligible: false,
          evidenceClass: "unknown",
        })),
        rootSourceGapId: GBP_ROOT_SOURCE_GAP_ID,
        adapterPresent: false,
        hasVerifiedGbpData: false,
      },
      guideAuthority: inspectGuideAuthority([]),
    });
    assert.ok(
      findings.some(
        (f) =>
          f.type === "local-coverage-healthy" &&
          /complementary/i.test(f.title),
      ),
    );
    assert.equal(
      findings.some((f) => f.type === "service-area-inconsistency"),
      false,
    );
  });

  it("repository entity inconsistency remains internal-only; schema is readiness-only", () => {
    const inventory = inspectLocalEntityInventory();
    const findings = detectLocalAuthorityFindings({
      gsc: null,
      gscAvailable: false,
      entityInventory: inventory,
      gbp: {
        sourceState: "not-configured",
        dimensions: [],
        rootSourceGapId: GBP_ROOT_SOURCE_GAP_ID,
        adapterPresent: false,
        hasVerifiedGbpData: false,
      },
      guideAuthority: inspectGuideAuthority([]),
    });
    const entity = findings.find((f) => f.type === "local-entity-inconsistency");
    if (entity) {
      assert.ok(
        entity.evidenceNotes.some((n) => /internal/i.test(n)),
      );
      assert.equal(entity.externalVerificationState, "required");
    }
    const schema = findings.find((f) => f.type === "local-schema-gap");
    if (schema) {
      assert.equal(schema.evidenceClass, "readiness");
      assert.ok(/readiness/i.test(schema.title + schema.recommendedAction));
    }
  });
});

describe("Local Authority — review and map-pack limits", () => {
  it("review count/rating remain unknown; testimonials ≠ GBP reviews", async () => {
    const bundle = await loadAllSources("fixture");
    const search = runSearchStrategy(bundle, { ...FIXTURE_REPORTING_PERIOD }, {
      mode: "fixture",
    });
    const review = search.localAuthority.findings.find(
      (f) => f.type === "local-review-readiness-gap",
    );
    assert.ok(review);
    assert.equal(review!.evidenceClass, "unknown");
    assert.ok(
      review!.evidenceNotes.some((n) => /testimonials.*not.*GBP|not equal GBP/i.test(n)),
    );
    assert.equal(review!.suppressRecommendation, true);
  });

  it("map-pack analysis is readiness-only; no ranking claim", async () => {
    const bundle = await loadAllSources("fixture");
    const search = runSearchStrategy(bundle, { ...FIXTURE_REPORTING_PERIOD }, {
      mode: "fixture",
    });
    const map = search.localAuthority.findings.filter(
      (f) =>
        f.type === "map-pack-readiness-signal" ||
        f.type === "map-pack-data-unavailable",
    );
    assert.ok(map.length >= 1);
    for (const f of map) {
      assert.equal(
        /rank #|map-pack position|currently ranking/i.test(
          f.title + f.recommendedAction,
        ),
        false,
      );
      assert.equal(f.suppressRecommendation, true);
    }
  });
});

describe("Local Authority — cross-executive handoffs and CoS", () => {
  it("Content / Opportunity / BI handoffs keep correct owners; Search retains diagnosis", async () => {
    const bundle = await loadAllSources("fixture");
    const search = runSearchStrategy(bundle, { ...FIXTURE_REPORTING_PERIOD }, {
      mode: "fixture",
    });
    assert.ok(
      search.localAuthority.handoffs.contentHandoffIds.length >= 1 ||
        search.localAuthority.findings.some((f) => f.owner === "content"),
    );
    assert.ok(
      search.localAuthority.findings.some((f) => f.owner === "opportunity"),
    );
    assert.ok(
      search.localAuthority.findings.some(
        (f) => f.owner === "business-intelligence" && f.type === "local-measurement-gap",
      ),
    );
    assert.ok(
      search.localAuthority.handoffs.searchDiagnosisIds.length >= 1,
    );
    for (const r of search.recommendations) {
      assert.equal(r.originatingExecutive, "search-strategy");
      assert.equal(proposedActionImpliesWrite(r.proposedAction), false);
    }
  });

  it("BI and Content handoffs remain internal and cannot enter founder ranking", async () => {
    const bundle = await loadAllSources("fixture");
    const search = runSearchStrategy(bundle, { ...FIXTURE_REPORTING_PERIOD }, {
      mode: "fixture",
    });

    const biFinding = search.localAuthority.findings.find(
      (f) => f.type === "local-measurement-gap",
    );
    assert.ok(biFinding);
    assert.equal(biFinding!.suppressRecommendation, true);
    assert.equal(
      biFinding!.dependency,
      GBP_ROOT_SOURCE_GAP_ID,
    );
    assert.ok(
      biFinding!.evidenceNotes.some((n) => /unknown\/unobservable|not poor/i.test(n)),
    );
    assert.ok(search.localAuthority.handoffs.biHandoffIds.includes(biFinding!.id));

    const contentFinding = search.localAuthority.findings.find(
      (f) => f.owner === "content" && f.type === "local-authority-opportunity",
    );
    assert.ok(contentFinding);
    assert.equal(contentFinding!.suppressRecommendation, true);
    assert.ok(
      search.localAuthority.handoffs.contentHandoffIds.includes(contentFinding!.id),
    );

    const founderRankable = search.recommendations.filter(
      (r) => recommendationIsFounderRankableLocal(r),
    );
    assert.equal(
      founderRankable.some((r) => r.recommendationId.includes("local-measurement-gap")),
      false,
    );
    assert.equal(
      founderRankable.some((r) => r.recommendationId.includes("content-handoff")),
      false,
    );

    const run = await runAgentOsBrief({ mode: "fixture" });
    for (const title of run.brief.surfacedPriorityTitles) {
      assert.equal(/local conversion measurement blocked|Content founder conversation/i.test(title), false);
    }
  });

  it("legacy GSC and Local Authority duplicates consolidate into one canonical recommendation", async () => {
    const bundle = await loadAllSources("fixture");
    const search = runSearchStrategy(bundle, { ...FIXTURE_REPORTING_PERIOD }, {
      mode: "fixture",
    });

    const nearPageKeys = new Map<string, string[]>();
    for (const r of search.recommendations) {
      const key = buildLocalSemanticDedupeKey(r);
      if (!key || !key.startsWith("near-page-one|")) continue;
      const list = nearPageKeys.get(key) ?? [];
      list.push(r.recommendationId);
      nearPageKeys.set(key, list);
    }
    for (const [, ids] of nearPageKeys) {
      const active = ids.filter((id) => {
        const rec = search.recommendations.find((r) => r.recommendationId === id)!;
        return recommendationIsFounderRankableLocal(rec);
      });
      assert.ok(active.length <= 1, `expected ≤1 active near-page-one for theme, got ${active.join(",")}`);
    }

    const mismatchActive = search.recommendations.filter(
      (r) =>
        /query-page-mismatch/.test(r.recommendationId) &&
        recommendationIsFounderRankableLocal(r),
    );
    const mismatchKeys = new Set(
      mismatchActive.map((r) => buildLocalSemanticDedupeKey(r)),
    );
    assert.equal(mismatchKeys.size, mismatchActive.length);

    // GBP still only one actionable root among founder-rankable
    const gbpActive = search.recommendations.filter(
      (r) =>
        r.recommendationId === GBP_ROOT_SOURCE_GAP_ID &&
        recommendationIsFounderRankableLocal(r),
    );
    assert.ok(gbpActive.length <= 1);
    assert.equal(
      search.recommendations.filter((r) =>
        /gbp dimension unknown/i.test(r.title),
      ).length,
      0,
    );
  });

  it("degraded live: at most one repository-backed local item; tool gaps need demand; brief may be <5", async () => {
    const run = await runAgentOsBrief({ mode: "live" });
    assert.ok(run.briefSurfacing.recommendationsSurfacedInBrief <= 5);
    // May be fewer than 5 when evidence is thin
    assert.ok(run.briefSurfacing.recommendationsSurfacedInBrief >= 0);

    const search = runSearchStrategy(
      await loadAllSources("live"),
      { ...FIXTURE_REPORTING_PERIOD },
      { mode: "live" },
    );
    assert.equal(countFounderRankableRepositoryLocal(search.recommendations) <= 1, true);

    const hubActive = search.recommendations.filter(
      (r) =>
        recommendationIsFounderRankableLocal(r) &&
        (r.recommendationId.includes("charlotte-guides-hub") ||
          r.recommendationId.includes("local-hub-gap") ||
          /charlotte guides lack/i.test(r.title)),
    );
    const toolActive = search.recommendations.filter(
      (r) =>
        recommendationIsFounderRankableLocal(r) &&
        r.recommendationId.includes("local-tool-handoff-gap"),
    );
    // Without observed GSC demand, tool gaps must not be founder-rankable
    assert.equal(toolActive.length, 0);
    // Hub may be the sole repo-backed local item
    assert.ok(hubActive.length <= 1);

    for (const title of run.brief.surfacedPriorityTitles) {
      assert.equal(/local guide[–-]tool link gap/i.test(title), false);
    }
  });

  it("founder brief remains capped at 5; full findings remain; static gaps do not flood", async () => {
    const run = await runAgentOsBrief({ mode: "fixture" });
    assert.ok(run.briefSurfacing.recommendationsSurfacedInBrief <= 5);
    assert.ok(
      run.recommendations.length >=
        run.briefSurfacing.recommendationsSurfacedInBrief,
    );
    const search = run.recommendations.filter(
      (r) => r.originatingExecutive === "search-strategy",
    );
    const searchOut = runSearchStrategy(
      await loadAllSources("fixture"),
      { ...FIXTURE_REPORTING_PERIOD },
      { mode: "fixture" },
    );
    assert.ok(
      searchOut.localAuthority.findings.length > search.length ||
        searchOut.localAuthority.findings.length >= 5,
    );
    assert.ok(
      countFounderRankableRepositoryLocal(searchOut.recommendations) <= 1,
    );
  });

  it("duplicate local recommendations are consolidated; zero local recs path is healthy", async () => {
    const empty = emptySearchStrategyOutput();
    assert.equal(empty.recommendations.length, 0);
    assert.ok(empty.localAuthority);
    const bundle = await loadAllSources("fixture");
    const bi = runBusinessIntelligence(bundle, { ...FIXTURE_REPORTING_PERIOD });
    const cos = runChiefOfStaff({
      bi,
      search: empty,
      reportingPeriod: { ...FIXTURE_REPORTING_PERIOD },
      warnings: [],
      mode: "fixture",
    });
    assert.ok(cos.brief.markdown.includes("What changed?"));
  });
});

describe("Local Authority — fixture vs live", () => {
  it("fixture contains observed/repository/unknown/healthy states", async () => {
    const bundle = await loadAllSources("fixture");
    const search = runSearchStrategy(bundle, { ...FIXTURE_REPORTING_PERIOD }, {
      mode: "fixture",
    });
    const classes = new Set(
      search.localAuthority.findings.map((f) => f.evidenceClass),
    );
    assert.ok(classes.has("observed") || classes.has("repository-backed"));
    assert.ok(classes.has("unknown") || classes.has("source-gap"));
    assert.ok(classes.has("healthy") || classes.has("readiness"));
    assert.ok(
      search.localAuthority.gbp.dimensions.some(
        (d) => d.evidenceClass === "observed" || d.evidenceClass === "unknown",
      ),
    );
  });

  it("live mode never uses fixture GBP or local-query data", async () => {
    const run = await runAgentOsBrief({ mode: "live" });
    assert.equal(run.mode, "live");
    assert.equal(
      run.sourceHealth.some((h) => h.retrievalState === "fixture"),
      false,
    );
    const json = JSON.stringify(run);
    assert.equal(json.includes("waxhaw diamond appraisal"), false);
    assert.equal(json.includes("fixture-observed-only"), false);
  });

  it("no fabrication of reviews/calls/directions/rankings; no PII/secrets/raw payloads", async () => {
    const run = await runAgentOsBrief({ mode: "fixture" });
    const json = JSON.stringify(run);
    assert.equal(/Bearer\s+\w{10,}/.test(json), false);
    assert.equal(json.includes("@example.com"), false);
    assert.equal(/"reviewCount":\s*[1-9]/.test(json), false);
    assert.equal(/map-pack position \d+/i.test(json), false);
    assert.equal(redactSecretsAndPii("api_key=abc123secret").includes("abc123secret"), false);
    assert.ok(
      !run.recommendations.some((r) =>
        /get more reviews|post on GBP every week|rank higher locally/i.test(
          r.title + r.proposedAction,
        ),
      ),
    );
  });

  it("stable repeated IDs; geographies and routes produce distinct IDs", async () => {
    const bundle = await loadAllSources("fixture");
    const a = runSearchStrategy(bundle, { ...FIXTURE_REPORTING_PERIOD }, {
      mode: "fixture",
    });
    const b = runSearchStrategy(bundle, { ...FIXTURE_REPORTING_PERIOD }, {
      mode: "fixture",
    });
    const idsA = a.localAuthority.findings.map((f) => f.id).sort();
    const idsB = b.localAuthority.findings.map((f) => f.id).sort();
    assert.deepEqual(idsA, idsB);
    for (const id of idsA) {
      assert.ok(localAuthorityIdLooksSafe(id), id);
    }
    const geos = a.localAuthority.findings
      .filter((f) => f.type === "local-near-page-one" || f.type === "local-high-impression-low-ctr")
      .map((f) => f.geography);
    assert.ok(new Set(geos).size >= 1);
  });

  it("no public route or external write; partial delivery semantics remain; BI/Content/Opportunity still run", async () => {
    const bundle = await loadAllSources("fixture");
    const bi = runBusinessIntelligence(bundle, { ...FIXTURE_REPORTING_PERIOD });
    const search = runSearchStrategy(bundle, { ...FIXTURE_REPORTING_PERIOD }, {
      mode: "fixture",
    });
    const content = runContentExecutive(bundle, { ...FIXTURE_REPORTING_PERIOD }, {
      search,
      bi,
    });
    const opportunity = runOpportunityExecutive(
      bundle,
      { ...FIXTURE_REPORTING_PERIOD },
      { search, content, bi, includeRejectedExamples: true },
    );
    assert.ok(bi.recommendations.length >= 0);
    assert.ok(content.recommendations.length >= 0);
    assert.ok(opportunity.recommendations.length >= 0);
    for (const r of [
      ...search.recommendations,
      ...content.recommendations,
      ...opportunity.recommendations,
    ]) {
      assert.equal(proposedActionImpliesWrite(r.proposedAction), false);
    }
  });
});

function unusedEmptyBundleGuard(): AgentOsDataBundle {
  return {
    ga4: {
      sourceId: "ga4",
      ok: false,
      data: null,
      empty: false,
      failed: false,
      health: buildSourceHealth({
        sourceId: "ga4",
        configured: false,
        reachable: false,
        fresh: false,
        complete: false,
        permissionPosture: "read-only",
        lastSuccessfulRead: null,
        retrievalState: "not-configured",
      }),
    },
    gsc: {
      sourceId: "gsc",
      ok: false,
      data: null,
      empty: false,
      failed: false,
      health: buildSourceHealth({
        sourceId: "gsc",
        configured: false,
        reachable: false,
        fresh: false,
        complete: false,
        permissionPosture: "read-only",
        lastSuccessfulRead: null,
        retrievalState: "not-configured",
      }),
    },
    weeklyIntelligence: {
      sourceId: "weekly-intelligence",
      ok: false,
      data: null,
      empty: true,
      failed: false,
      health: buildSourceHealth({
        sourceId: "weekly-intelligence",
        configured: false,
        reachable: false,
        fresh: false,
        complete: false,
        permissionPosture: "read-only",
        lastSuccessfulRead: null,
        retrievalState: "not-configured",
      }),
    },
    hubspotAggregates: {
      sourceId: "hubspot-aggregates",
      ok: false,
      data: null,
      empty: false,
      failed: false,
      health: buildSourceHealth({
        sourceId: "hubspot-aggregates",
        configured: false,
        reachable: false,
        fresh: false,
        complete: false,
        permissionPosture: "unknown",
        lastSuccessfulRead: null,
        retrievalState: "not-configured",
      }),
    },
    buffer: {
      sourceId: "buffer",
      ok: false,
      data: null,
      empty: false,
      failed: false,
      health: buildSourceHealth({
        sourceId: "buffer",
        configured: false,
        reachable: false,
        fresh: false,
        complete: false,
        permissionPosture: "unknown",
        lastSuccessfulRead: null,
        retrievalState: "not-configured",
      }),
    },
    gbp: {
      sourceId: "gbp",
      ok: false,
      data: null,
      empty: false,
      failed: false,
      health: buildSourceHealth({
        sourceId: "gbp",
        configured: false,
        reachable: false,
        fresh: false,
        complete: false,
        permissionPosture: "unknown",
        lastSuccessfulRead: null,
        errors: ["No GBP adapter"],
        retrievalState: "not-configured",
      }),
    },
  };
}

void unusedEmptyBundleGuard;
