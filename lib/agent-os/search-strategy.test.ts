import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyQueryIntent,
  detectGscOpportunities,
  inspectGuideAuthority,
  isBrandQuery,
  isLocalIntent,
  isExecutiveOperational,
  isSmallSample,
  operationalExecutives,
  proposedActionImpliesWrite,
  redactSecretsAndPii,
  runAgentOsBrief,
  runSearchStrategy,
  emptySearchStrategyOutput,
  scaffoldExecutives,
  SEARCH_OPPORTUNITY_TYPES,
} from "./index";
import { createFixtureGscBundle, FIXTURE_REPORTING_PERIOD } from "./fixtures/sample-data";
import { loadAllSources } from "./adapters/load";
import { buildSourceHealth } from "./source-health";
import type { AgentOsDataBundle } from "./adapters/types";
import { createEvidence } from "./evidence";
import { buildRecommendation } from "./recommendation";
import { runChiefOfStaff } from "./executives/chief-of-staff";
import { runBusinessIntelligence } from "./executives/business-intelligence";

describe("Search Strategy operational status", () => {
  it("marks Search Strategy and Opportunity operational", () => {
    assert.equal(isExecutiveOperational("search-strategy"), true);
    assert.deepEqual(
      operationalExecutives().map((e) => e.id).includes("search-strategy"),
      true,
    );
    assert.equal(isExecutiveOperational("content"), true);
    assert.equal(isExecutiveOperational("opportunity"), true);
    assert.deepEqual(scaffoldExecutives().map((e) => e.id).sort(), []);
  });
});

describe("Search classification", () => {
  it("classifies branded vs non-branded", () => {
    assert.equal(isBrandQuery("hourglass diamonds charlotte"), true);
    assert.equal(isBrandQuery("oval engagement ring"), false);
    assert.ok(classifyQueryIntent("hourglass diamonds").includes("branded"));
    assert.ok(
      classifyQueryIntent("oval engagement ring").includes("non-branded"),
    );
  });

  it("classifies local intent", () => {
    assert.equal(isLocalIntent("custom jeweler waxhaw"), true);
    assert.equal(isLocalIntent("fort mill engagement rings"), true);
    assert.equal(isLocalIntent("diamond cut explained"), false);
    assert.ok(
      classifyQueryIntent("engagement rings charlotte").includes("local"),
    );
  });

  it("flags small samples", () => {
    assert.equal(isSmallSample(50, 2), true);
    assert.equal(isSmallSample(800, 40), false);
  });
});

describe("GSC opportunity detection", () => {
  it("does not fabricate GSC findings when unavailable", () => {
    const opps = detectGscOpportunities(null, { available: false });
    assert.equal(opps.length, 0);
    const empty = detectGscOpportunities(createFixtureGscBundle(), {
      available: false,
    });
    assert.equal(empty.length, 0);
  });

  it("classifies high-impression low-CTR and near-page-one", () => {
    const opps = detectGscOpportunities(createFixtureGscBundle(), {
      available: true,
    });
    assert.ok(opps.some((o) => o.type === "high-impression-low-ctr"));
    assert.ok(opps.some((o) => o.type === "near-page-one"));
    assert.ok(
      SEARCH_OPPORTUNITY_TYPES.includes(opps[0]!.type),
    );
  });

  it("detects query-page mismatch without overclaiming cannibalization", () => {
    const opps = detectGscOpportunities(createFixtureGscBundle(), {
      available: true,
    });
    const mismatch = opps.find((o) => o.type === "query-page-mismatch");
    if (mismatch) {
      assert.equal(mismatch.isInference, true);
      assert.ok(mismatch.confidence < 0.7);
    }
    const cannibal = opps.find((o) => o.type === "possible-cannibalization");
    if (cannibal) {
      assert.equal(cannibal.isInference, true);
      assert.ok(cannibal.confidence <= 0.45);
      assert.ok(
        cannibal.evidenceNotes.some((n) => /possible|not proof|overclaim/i.test(n)),
      );
    }
  });

  it("lowers confidence for small samples", () => {
    const tiny = createFixtureGscBundle();
    tiny.current!.topQueries = [
      {
        query: "rare obscure diamond term xyz",
        impressions: 60,
        clicks: 2,
        ctr: 0.033,
        position: 7,
      },
    ];
    tiny.current!.topPages = [];
    const opps = detectGscOpportunities(tiny, { available: true });
    const near = opps.find((o) => o.type === "near-page-one");
    if (near) {
      assert.ok(near.confidence < 0.7);
      assert.ok(near.evidenceNotes.some((n) => /sample|modest|directional/i.test(n)));
    }
  });
});

describe("Guide authority adapter", () => {
  it("runs without GSC and surfaces repository findings", () => {
    const snap = inspectGuideAuthority();
    assert.ok(snap.articleCount > 50);
    assert.equal(snap.charlotteHubMapped, false);
    assert.ok(
      snap.opportunities.some(
        (o) =>
          o.type === "local-intent-gap" ||
          o.type === "tool-handoff-gap" ||
          o.type === "internal-link-gap" ||
          o.type === "content-gap",
      ),
    );
  });

  it("content gap and internal-link gap carry evidence references", () => {
    const snap = inspectGuideAuthority();
    const contentGap = snap.opportunities.find((o) => o.type === "content-gap");
    const linkGap = snap.opportunities.find((o) => o.type === "internal-link-gap");
    if (contentGap) {
      assert.ok(contentGap.supportingReference.length > 0);
      assert.ok(contentGap.evidenceNotes.length > 0);
    }
    if (linkGap) {
      assert.match(linkGap.recommendedAction, /diamond-guide|diamond-intelligence/);
      assert.ok(linkGap.queryOrPage.startsWith("/diamond-guide/"));
    }
  });

  it("tool-handoff gaps point at Studio routes", () => {
    const mock = inspectGuideAuthority([
      {
        slug: "mock-shape-without-tools",
        title: "Mock Shape Guide",
        category: "Diamond Shapes",
        body: [
          {
            type: "paragraph",
            text: "Oval diamonds look elongated. See also [round diamonds](/diamond-guide/round-brilliant-diamond).",
          },
        ],
        related: [{ title: "Round", href: "/diamond-guide/round-brilliant-diamond" }],
      },
    ]);
    const handoff = mock.opportunities.find((o) => o.type === "tool-handoff-gap");
    assert.ok(handoff);
    assert.match(
      handoff!.recommendedAction,
      /See It On Your Hand|Diamond Studio|contextual link/i,
    );
    assert.doesNotMatch(
      handoff!.recommendedAction,
      /\/diamond-studio|\/diamond-shape-studio|and\/or/i,
    );
  });

  it("labels GEO readiness as readiness not performance", () => {
    const snap = inspectGuideAuthority();
    const geo = snap.opportunities.filter((o) => o.type === "geo-readiness-gap");
    for (const g of geo) {
      assert.equal(g.isInference, true);
      assert.ok(
        g.evidenceNotes.some((n) => /readiness|not verified AI/i.test(n)),
      );
      assert.equal(/ranking #|cited by chatgpt/i.test(g.title), false);
    }
  });
});

describe("Search Strategy executive", () => {
  it("requires evidence and stays read-only", async () => {
    const bundle = await loadAllSources("fixture");
    const out = runSearchStrategy(bundle, { ...FIXTURE_REPORTING_PERIOD });
    assert.ok(out.recommendations.length >= 1);
    for (const r of out.recommendations) {
      assert.equal(r.originatingExecutive, "search-strategy");
      assert.ok(r.evidence.length >= 1);
      assert.equal(proposedActionImpliesWrite(r.proposedAction), false);
      assert.match(r.title, /\[Search Strategy\]/);
    }
    assert.ok(out.dataGaps.some((g) => g.sourceId === "gbp"));
  });

  it("with GSC unavailable still returns repository findings and no fabricated GSC opps", () => {
    const bundle = emptyGscBundle();
    const out = runSearchStrategy(bundle, { ...FIXTURE_REPORTING_PERIOD });
    assert.ok(out.dataGaps.some((g) => g.id === "gap-search-gsc"));
    assert.equal(
      out.opportunities.some((o) => o.supportingReference.startsWith("gsc")),
      false,
    );
    assert.ok(
      out.opportunities.some((o) =>
        o.supportingReference.includes("articles.ts") ||
        o.supportingReference.includes("category-map"),
      ),
    );
  });

  it("zero-recommendation Search Strategy path remains healthy via CoS", async () => {
    const bundle = await loadAllSources("fixture");
    const bi = runBusinessIntelligence(bundle, { ...FIXTURE_REPORTING_PERIOD });
    const cos = runChiefOfStaff({
      bi,
      search: {
        recommendations: [],
        opportunities: [],
        dataGaps: [
          {
            id: "gap-search-gsc",
            sourceId: "gsc",
            description: "GSC unavailable",
            impactOnRecommendations: "No GSC findings",
            suggestedRemedy: "Configure GSC",
          },
        ],
        facts: ["Repository authority inspected"],
        inferences: [],
        guideAuthority: inspectGuideAuthority([]),
        localAuthority: emptySearchStrategyOutput().localAuthority,
      },
      reportingPeriod: { ...FIXTURE_REPORTING_PERIOD },
      warnings: [],
      mode: "fixture",
    });
    assert.ok(cos.brief.markdown.includes("What changed?"));
    assert.ok(Array.isArray(cos.recommendations));
  });

  it("Chief of Staff integrates and deduplicates Search + BI", async () => {
    const bundle = await loadAllSources("fixture");
    const bi = runBusinessIntelligence(bundle, { ...FIXTURE_REPORTING_PERIOD });
    const search = runSearchStrategy(bundle, { ...FIXTURE_REPORTING_PERIOD });
    const cos = runChiefOfStaff({
      bi,
      search,
      reportingPeriod: { ...FIXTURE_REPORTING_PERIOD },
      warnings: [],
      mode: "fixture",
    });
    assert.ok(
      cos.recommendations.some(
        (r) => r.originatingExecutive === "search-strategy",
      ),
    );
    assert.ok(
      cos.recommendations.some(
        (r) => r.originatingExecutive === "business-intelligence",
      ),
    );
    assert.ok(cos.brief.markdown.includes("[Search Strategy]") || cos.brief.markdown.includes("Search Strategy") || cos.recommendations.some((r) => r.title.includes("[Search Strategy]")));
  });

  it("stale GSC evidence is labeled through recommendation evidence", () => {
    const staleAt = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString();
    const rec = buildRecommendation({
      recommendationId: "stale-ss",
      originatingExecutive: "search-strategy",
      title: "[Search Strategy] Stale GSC item",
      plainLanguageExplanation: "stale",
      whyItMattersNow: "n/a",
      proposedAction: "Re-pull Search Console aggregates",
      expectedUpside: "freshness",
      effortEstimate: "low",
      urgency: "low",
      reversibility: "easily-reversed",
      baseConfidence: 0.8,
      evidence: [
        createEvidence({
          source: "gsc",
          sourceType: "search",
          collectedAt: staleAt,
          reportingPeriod: FIXTURE_REPORTING_PERIOD,
          metricOrObservation: "ctr=0.02",
        }),
      ],
      assumptions: [],
      risks: [],
      dependencies: [],
      approvalRequired: false,
      suggestedOwner: "Founder",
      rankingFactors: { expectedBusinessImpact: 5, strategicAlignment: 7 },
    });
    assert.equal(rec.evidence[0]?.freshness, "stale");
    assert.ok(rec.risks.some((r) => /stale/i.test(r)));
  });
});

describe("Fixture and live Search Strategy runs", () => {
  it("fixture runner outputs Search Strategy findings", async () => {
    const run = await runAgentOsBrief({ mode: "fixture" });
    assert.ok(run.executivesInvoked.includes("search-strategy"));
    assert.ok(
      run.recommendations.some(
        (r) => r.originatingExecutive === "search-strategy",
      ),
    );
    assert.ok(run.dataGaps.some((g) => g.sourceId === "gbp"));
    const json = JSON.stringify(run);
    assert.equal(json.includes("@example.com"), false);
    assert.equal(/Bearer\s+\w{10,}/.test(json), false);
    assert.equal(redactSecretsAndPii("api_key=abc123secret").includes("abc123secret"), false);
  });

  it("live mode never uses fixture GSC data", async () => {
    const run = await runAgentOsBrief({ mode: "live" });
    assert.equal(run.mode, "live");
    assert.equal(
      run.sourceHealth.some((h) => h.retrievalState === "fixture"),
      false,
    );
    assert.equal(
      run.recommendations.some((r) =>
        r.evidence.some(
          (e) =>
            e.source === "gsc" &&
            e.metricOrObservation.includes("oval engagement ring") &&
            e.supportingReference === "gsc.topQueries",
        ),
      ),
      false,
    );
  });
});

function emptyGscBundle(): AgentOsDataBundle {
  const failed = {
    sourceId: "gsc" as const,
    ok: false as const,
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
      errors: ["not configured"],
      retrievalState: "not-configured",
    }),
  };
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
    gsc: failed,
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
