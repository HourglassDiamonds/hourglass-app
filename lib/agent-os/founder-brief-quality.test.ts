/**
 * Founder brief quality — live-measurement synthesis guards.
 * No email, no persistence, no cron.
 */

import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  isAnalyticsMaintenanceRecommendation,
  primaryAnalyticsSourcesHealthy,
  resolveBriefCadenceIntent,
  shouldSuppressAnalyticsMaintenanceHighestRoi,
} from "./brief-quality";
import { runChiefOfStaff } from "./executives/chief-of-staff";
import { emptyBusinessIntelligenceOutput } from "./bi/empty";
import { emptyContentExecutiveOutput } from "./executives/content";
import { emptyOpportunityExecutiveOutput } from "./executives/opportunity";
import { emptySearchStrategyOutput } from "./executives/search-strategy";
import { FIXTURE_REPORTING_PERIOD } from "./fixtures/sample-data";
import { buildRecommendation } from "./recommendation";
import { createEvidence } from "./evidence";
import {
  loadEnvLocalForPreview,
  parseBriefCadenceIntent,
} from "./preview-cli";
import {
  assessChange,
  formatFounderMetricChange,
  judgeChange,
} from "./measurement/change-math";
import type { Recommendation, SourceHealth } from "./types";
import { runAgentOsBrief } from "./run";

const PERIOD = { ...FIXTURE_REPORTING_PERIOD };

function healthyGa4Gsc(): SourceHealth[] {
  return [
    {
      sourceId: "ga4",
      configured: true,
      reachable: true,
      fresh: true,
      complete: true,
      permissionPosture: "read-only",
      lastSuccessfulRead: "2026-07-26T12:00:00.000Z",
      errors: [],
      effectOnConfidence: "full",
      retrievalState: "ok",
      healthCode: "ok",
      founderLabel: "GA4 healthy",
    },
    {
      sourceId: "gsc",
      configured: true,
      reachable: true,
      fresh: true,
      complete: true,
      permissionPosture: "read-only",
      lastSuccessfulRead: "2026-07-26T12:00:00.000Z",
      errors: [],
      effectOnConfidence: "full",
      retrievalState: "ok",
      healthCode: "stale-within-normal-delay",
      founderLabel: "GSC within normal delay",
    },
  ];
}

function unhealthyGa4(): SourceHealth[] {
  return [
    {
      sourceId: "ga4",
      configured: true,
      reachable: false,
      fresh: false,
      complete: false,
      permissionPosture: "unknown",
      lastSuccessfulRead: null,
      errors: ["oauth"],
      effectOnConfidence: "blocked",
      retrievalState: "failed",
      healthCode: "oauth-auth-failed",
      founderLabel: "GA4 OAuth authentication failed",
    },
    {
      sourceId: "gsc",
      configured: true,
      reachable: true,
      fresh: true,
      complete: true,
      permissionPosture: "read-only",
      lastSuccessfulRead: "2026-07-26T12:00:00.000Z",
      errors: [],
      effectOnConfidence: "full",
      retrievalState: "ok",
      healthCode: "ok",
      founderLabel: "GSC healthy",
    },
  ];
}

function bothUnhealthy(): SourceHealth[] {
  return [
    {
      sourceId: "ga4",
      configured: false,
      reachable: false,
      fresh: false,
      complete: false,
      permissionPosture: "unknown",
      lastSuccessfulRead: null,
      errors: [],
      effectOnConfidence: "blocked",
      retrievalState: "not-configured",
      healthCode: "not-configured",
      founderLabel: "GA4 not configured",
    },
    {
      sourceId: "gsc",
      configured: false,
      reachable: false,
      fresh: false,
      complete: false,
      permissionPosture: "unknown",
      lastSuccessfulRead: null,
      errors: [],
      effectOnConfidence: "blocked",
      retrievalState: "not-configured",
      healthCode: "not-configured",
      founderLabel: "GSC not configured",
    },
  ];
}

function analyticsGateRec(): Recommendation {
  return buildRecommendation({
    recommendationId: "bi-verify-tracking-before-decline",
    originatingExecutive: "business-intelligence",
    title: "Verify measurement before treating traffic drop as demand decline",
    plainLanguageExplanation: "Sessions fell; confirm analytics gates.",
    whyItMattersNow: "Avoid false decline response.",
    proposedAction:
      "Review consultation-request counts; confirm analytics gates are still recording cleanly.",
    expectedUpside: "Trustworthy funnel signal",
    effortEstimate: "low",
    urgency: "high",
    reversibility: "easily-reversed",
    baseConfidence: 0.8,
    evidence: [
      createEvidence({
        source: "ga4",
        sourceType: "analytics",
        collectedAt: "2026-07-26T12:00:00.000Z",
        reportingPeriod: PERIOD,
        metricOrObservation: "sessions soft",
        reliability: "reliable",
        supportingReference: "ga4.traffic.sessions",
      }),
    ],
    assumptions: [],
    risks: [],
    dependencies: [],
    approvalRequired: false,
    suggestedOwner: "Founder",
    rankingFactors: {
      expectedBusinessImpact: 9,
      strategicAlignment: 9,
    },
  });
}

function studioCtaDivergenceRec(): Recommendation {
  return buildRecommendation({
    recommendationId: "bi-studio-cta-divergence",
    originatingExecutive: "business-intelligence",
    title: "Investigate Studio engagement vs consultation CTA divergence",
    plainLanguageExplanation:
      "Diamond Studio views rose while consultation CTA clicks fell.",
    whyItMattersNow:
      "If the CTA is under-firing, consultation intent is being lost.",
    proposedAction:
      "Review the mobile path from Diamond Studio engagement to consultation requests, and improve CTA visibility where most sessions occur.",
    expectedUpside: "Recover qualified consultation inquiries",
    effortEstimate: "low",
    urgency: "high",
    reversibility: "easily-reversed",
    baseConfidence: 0.7,
    evidence: [
      createEvidence({
        source: "ga4",
        sourceType: "analytics",
        collectedAt: "2026-07-26T12:00:00.000Z",
        reportingPeriod: PERIOD,
        metricOrObservation: "studioViews up; ctaClicks down",
        reliability: "reliable",
        supportingReference: "ga4.studio-vs-cta",
      }),
    ],
    assumptions: [],
    risks: [],
    dependencies: [],
    approvalRequired: false,
    suggestedOwner: "Founder",
    rankingFactors: {
      expectedBusinessImpact: 8,
      strategicAlignment: 9,
    },
  });
}

function toolHandoffRec(): Recommendation {
  return buildRecommendation({
    recommendationId: "search:repository:tool-handoff-gap:guide-to-tool",
    originatingExecutive: "search-strategy",
    title: "Add a tool handoff on a Diamond Guide article",
    plainLanguageExplanation:
      "Guide readers reach shape/cut education without a verified next-step tool path.",
    whyItMattersNow:
      "Size/shape education should connect to Diamond Studio or See It On Your Hand when readers are ready.",
    proposedAction:
      "Add a contextual link from the Diamond Guide article to See It On Your Hand.",
    expectedUpside: "Higher tool engagement from guide traffic",
    effortEstimate: "low",
    urgency: "high",
    reversibility: "easily-reversed",
    baseConfidence: 0.72,
    evidence: [
      createEvidence({
        source: "repository-content-inventory",
        sourceType: "internal-report",
        collectedAt: "2026-07-26T12:00:00.000Z",
        reportingPeriod: PERIOD,
        metricOrObservation:
          "tool-handoff-gap: guide missing See It On Your Hand link",
        reliability: "reliable",
        supportingReference: "guides/diamond-guide/tool-handoff",
      }),
    ],
    assumptions: [],
    risks: [],
    dependencies: [],
    approvalRequired: false,
    suggestedOwner: "Founder",
    rankingFactors: {
      expectedBusinessImpact: 7,
      strategicAlignment: 8,
    },
  });
}

function commercialRec(): Recommendation {
  return buildRecommendation({
    recommendationId: "search:gsc:high-ctr-opportunity",
    originatingExecutive: "search-strategy",
    title: "Strengthen title for high-impression query",
    plainLanguageExplanation: "Impressions are strong; CTR is soft.",
    whyItMattersNow: "Commercial search demand is visible.",
    proposedAction:
      "Rewrite the meta title for the diamond guide landing page to match the query intent.",
    expectedUpside: "More qualified organic clicks",
    effortEstimate: "low",
    urgency: "high",
    reversibility: "easily-reversed",
    baseConfidence: 0.75,
    evidence: [
      createEvidence({
        source: "gsc",
        sourceType: "analytics",
        collectedAt: "2026-07-26T12:00:00.000Z",
        reportingPeriod: PERIOD,
        metricOrObservation: "impressions high, ctr soft",
        reliability: "reliable",
        supportingReference: "gsc.queries",
      }),
    ],
    assumptions: [],
    risks: [],
    dependencies: [],
    approvalRequired: false,
    suggestedOwner: "Founder",
    rankingFactors: {
      expectedBusinessImpact: 7,
      strategicAlignment: 8,
    },
  });
}

describe("analytics-maintenance highest-ROI suppression", () => {
  it("classifies confirm-analytics-gates as analytics maintenance", () => {
    assert.equal(isAnalyticsMaintenanceRecommendation(analyticsGateRec()), true);
    assert.equal(isAnalyticsMaintenanceRecommendation(commercialRec()), false);
  });

  it("treats GA4+GSC ok / normal lag as healthy", () => {
    assert.equal(primaryAnalyticsSourcesHealthy(healthyGa4Gsc()), true);
    assert.equal(primaryAnalyticsSourcesHealthy(unhealthyGa4()), false);
    assert.equal(primaryAnalyticsSourcesHealthy(bothUnhealthy()), false);
  });

  it("GA4 and GSC healthy → analytics-gate cannot win highest-ROI", () => {
    const bi = emptyBusinessIntelligenceOutput();
    bi.recommendations = [analyticsGateRec(), commercialRec()];
    bi.keyMetricChanges = [
      "Sessions 182 (+12 absolute; directional only)",
    ];
    const cos = runChiefOfStaff({
      bi,
      search: emptySearchStrategyOutput(),
      content: emptyContentExecutiveOutput(),
      opportunity: emptyOpportunityExecutiveOutput(),
      reportingPeriod: PERIOD,
      warnings: [],
      mode: "live",
      briefCadenceIntent: "daily",
      sourceHealth: healthyGa4Gsc(),
    });
    assert.doesNotMatch(cos.brief.highestRoiAction, /confirm analytics gates/i);
    assert.doesNotMatch(cos.brief.highestRoiAction, /verify measurement/i);
    assert.match(
      cos.brief.highestRoiAction,
      /meta title|diamond guide|organic|Strengthen|Rewrite/i,
    );
  });

  it("one source unhealthy → measurement repair may surface", () => {
    const bi = emptyBusinessIntelligenceOutput();
    bi.recommendations = [analyticsGateRec()];
    bi.dataGaps = [
      {
        id: "gap-ga4",
        sourceId: "ga4",
        description: "GA4 OAuth authentication failed",
        impactOnRecommendations: "Cannot trust traffic",
        suggestedRemedy: "Reauth Google OAuth",
      },
    ];
    const cos = runChiefOfStaff({
      bi,
      search: emptySearchStrategyOutput(),
      content: emptyContentExecutiveOutput(),
      opportunity: emptyOpportunityExecutiveOutput(),
      reportingPeriod: PERIOD,
      warnings: [],
      mode: "live",
      briefCadenceIntent: "daily",
      sourceHealth: unhealthyGa4(),
    });
    assert.equal(
      shouldSuppressAnalyticsMaintenanceHighestRoi({
        recommendation: analyticsGateRec(),
        sourceHealth: unhealthyGa4(),
      }),
      false,
    );
    assert.match(
      cos.brief.highestRoiAction,
      /confirm analytics|verify measurement|analytics gates/i,
    );
  });

  it("both sources unhealthy → measurement prerequisite can surface", () => {
    assert.equal(
      shouldSuppressAnalyticsMaintenanceHighestRoi({
        recommendation: analyticsGateRec(),
        sourceHealth: bothUnhealthy(),
      }),
      false,
    );
  });

  it("healthy quiet day without backlog → empty brief blocked by quality gate", () => {
    const bi = emptyBusinessIntelligenceOutput();
    bi.keyMetricChanges = [
      "Sessions 182 (within ordinary variance; treat as directional only)",
    ];
    bi.recommendations = [analyticsGateRec()];
    const cos = runChiefOfStaff({
      bi,
      search: emptySearchStrategyOutput(),
      content: emptyContentExecutiveOutput(),
      opportunity: emptyOpportunityExecutiveOutput(),
      reportingPeriod: PERIOD,
      warnings: [],
      mode: "live",
      briefCadenceIntent: "daily",
      sourceHealth: healthyGa4Gsc(),
      operatingBacklog: null,
    });
    assert.match(
      cos.brief.highestRoiAction,
      /no durable operating priority|no high-confidence/i,
    );
    assert.doesNotMatch(cos.brief.markdown, /completed-with-warnings/);
  });
});

describe("cadence intent framing", () => {
  it("daily and weekly intents produce different framing", () => {
    const shared = {
      bi: emptyBusinessIntelligenceOutput(),
      search: emptySearchStrategyOutput(),
      content: emptyContentExecutiveOutput(),
      opportunity: emptyOpportunityExecutiveOutput(),
      reportingPeriod: PERIOD,
      warnings: [] as string[],
      mode: "fixture" as const,
      sourceHealth: healthyGa4Gsc(),
    };
    const daily = runChiefOfStaff({
      ...shared,
      briefCadenceIntent: "daily",
      briefLocalDate: "2026-07-24",
    });
    const weekly = runChiefOfStaff({
      ...shared,
      briefCadenceIntent: "weekly",
    });
    assert.match(daily.brief.markdown, /Morning Brief/);
    assert.match(daily.brief.markdown, /Today’s priorities/);
    assert.match(weekly.brief.markdown, /Weekly performance review/);
    assert.notEqual(
      daily.brief.markdown.includes("Today’s priorities"),
      weekly.brief.markdown.includes("Today’s priorities"),
    );
  });

  it("direct preview CLI does not silently use weekly intent", () => {
    assert.equal(parseBriefCadenceIntent([]), "daily");
    assert.equal(parseBriefCadenceIntent(["--live"]), "daily");
    assert.equal(parseBriefCadenceIntent(["--cadence=weekly"]), "weekly");
    assert.equal(parseBriefCadenceIntent(["--weekly"]), "weekly");
    assert.equal(parseBriefCadenceIntent(["--cadence=daily"]), "daily");
  });
});

describe("what-changed content discipline", () => {
  it("repository findings do not populate What changed", () => {
    const bi = emptyBusinessIntelligenceOutput();
    bi.keyMetricChanges = ["Sessions 182 (within ordinary variance)"];
    const search = emptySearchStrategyOutput();
    search.opportunities = [
      {
        id: "search:repository:content-gap:repo-only",
        type: "content-gap",
        title: "Repository content-map gap for /guides/inventory-draft",
        whyItMatters: "Internal inventory",
        recommendedAction: "Ignore for founder What changed",
        queryOrPage: "/guides/inventory-draft",
        metric: "n/a",
        currentValue: "missing",
        sampleSize: 0,
        classifications: ["informational"],
        isInference: true,
        confidence: 0.4,
        likelyImpact: 2,
        effort: "high",
        urgency: "low",
        approvalRequired: false,
        supportingReference: "repo://content-map",
        evidenceNotes: ["repository inventory"],
      },
    ];
    const content = emptyContentExecutiveOutput();
    const cos = runChiefOfStaff({
      bi,
      search,
      content,
      opportunity: emptyOpportunityExecutiveOutput(),
      reportingPeriod: PERIOD,
      warnings: [],
      mode: "fixture",
      briefCadenceIntent: "weekly",
      sourceHealth: healthyGa4Gsc(),
    });
    assert.doesNotMatch(cos.brief.whatChanged, /content-map|inventory-draft|repository/i);
    assert.match(cos.brief.whatChanged, /Sessions|No material/i);
  });
});

describe("change-language noise guards", () => {
  it("tiny baseline with large percentage → suppress or qualify", () => {
    const a = assessChange(8, 2, { minPriorForPercent: 20, smallSampleCombined: 40 });
    assert.equal(a.percentClaimSafe, false);
    assert.ok(judgeChange(a) === "suppress" || judgeChange(a) === "qualify");
    const line = formatFounderMetricChange("Sessions", 8, 2, {
      minPriorForPercent: 20,
      smallSampleCombined: 40,
    });
    assert.doesNotMatch(line, /\+\d+%/);
    assert.doesNotMatch(line, /-\d+%/);
  });

  it("moderate volume ordinary variance → qualify", () => {
    const a = assessChange(105, 100, {
      minPriorForPercent: 20,
      ordinaryNoisePercent: 8,
      ordinaryNoiseAbsolute: 5,
      smallSampleCombined: 40,
    });
    assert.equal(judgeChange(a), "qualify");
  });

  it("large absolute and percentage movement → elevate or state normally", () => {
    const a = assessChange(300, 150, {
      minPriorForPercent: 50,
      smallSampleCombined: 80,
    });
    const j = judgeChange(a);
    assert.ok(j === "elevate-as-material" || j === "state-normally");
    const line = formatFounderMetricChange("Sessions", 300, 150, {
      minPriorForPercent: 50,
      smallSampleCombined: 80,
    });
    assert.match(line, /%/);
  });

  it("missing comparison and zero baseline are guarded", () => {
    assert.equal(judgeChange(assessChange(50, null)), "suppress");
    const zero = assessChange(12, 0, { minPriorForPercent: 20 });
    assert.equal(zero.percentClaimSafe, false);
    assert.match(
      formatFounderMetricChange("CTA", 12, 0),
      /suppressed|limited|unavailable|variance/i,
    );
  });

  it("reduced-confidence / small-sample path still uses guarded summaries", () => {
    const line = formatFounderMetricChange("Sessions", 40, 10, {
      minPriorForPercent: 50,
      smallSampleCombined: 80,
    });
    assert.doesNotMatch(line, /300%/);
    assert.match(line, /Sessions 40/);
  });

  it("healthy quiet period language is directional", () => {
    const line = formatFounderMetricChange("Sessions", 182, 190, {
      minPriorForPercent: 50,
      smallSampleCombined: 80,
      ordinaryNoiseAbsolute: 15,
      ordinaryNoisePercent: 10,
    });
    assert.match(line, /ordinary variance|directional|Sessions 182/i);
  });
});

describe("preview CLI env precedence and safety defaults", () => {
  it(".env.local does not override explicitly supplied process variables", () => {
    const dir = mkdtempSync(join(tmpdir(), "agent-os-env-"));
    try {
      writeFileSync(
        join(dir, ".env.local"),
        "AGENT_OS_TEST_SECRET=from-file\nAGENT_OS_TEST_GAP=from-file\n",
        "utf8",
      );
      process.env.AGENT_OS_TEST_SECRET = "from-shell";
      delete process.env.AGENT_OS_TEST_GAP;
      const result = loadEnvLocalForPreview(dir);
      assert.equal(result.loaded, true);
      assert.equal(process.env.AGENT_OS_TEST_SECRET, "from-shell");
      assert.equal(process.env.AGENT_OS_TEST_GAP, "from-file");
    } finally {
      delete process.env.AGENT_OS_TEST_SECRET;
      delete process.env.AGENT_OS_TEST_GAP;
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("fixture preview default remains non-persisting", async () => {
    const run = await runAgentOsBrief({
      mode: "fixture",
      briefCadenceIntent: "daily",
      briefLocalDate: "2026-07-24",
    });
    assert.ok(!run.persistence);
    assert.match(run.brief.markdown, /Morning Brief/);
    assert.doesNotMatch(run.brief.markdown, /confirm analytics gates/i);
    const whyCount = (
      run.brief.markdown.match(/## 2\. Why does it matter\?/g) ?? []
    ).length;
    assert.equal(whyCount, 1);
    assert.doesNotMatch(run.brief.markdown, /completed-with-warnings/);
  });
});

describe("production cadence intent wiring", () => {
  it("maps known production cadence IDs explicitly", () => {
    assert.equal(resolveBriefCadenceIntent("cos-daily-synthesis"), "daily");
    assert.equal(
      resolveBriefCadenceIntent("cos-weekly-founder-brief"),
      "weekly",
    );
  });

  it("executeAgentOsCadence always resolves and forwards briefCadenceIntent", () => {
    const src = readFileSync(
      join(process.cwd(), "lib/agent-os/cadence-delivery/execute.ts"),
      "utf8",
    );
    assert.match(
      src,
      /const briefCadenceIntent = resolveBriefCadenceIntent\(cadenceId\)/,
    );
    assert.match(
      src,
      /runAgentOsBrief\(\{[\s\S]*?briefCadenceIntent,/,
    );
  });

  it("production daily path does not depend on CoS weekly fallback", async () => {
    const run = await runAgentOsBrief({
      mode: "fixture",
      briefCadenceIntent: resolveBriefCadenceIntent("cos-daily-synthesis"),
      briefLocalDate: "2026-07-24",
    });
    assert.match(run.brief.markdown, /Morning Brief/);
    assert.match(run.brief.markdown, /Today’s priorities/);
    assert.doesNotMatch(run.brief.markdown, /Weekly performance review/);
  });

  it("production weekly path does not inherit CLI daily default", async () => {
    const run = await runAgentOsBrief({
      mode: "fixture",
      briefCadenceIntent: resolveBriefCadenceIntent("cos-weekly-founder-brief"),
    });
    assert.match(run.brief.markdown, /Weekly performance review/);
    assert.doesNotMatch(run.brief.markdown, /Today’s priorities/);
    // CLI default is daily — weekly scheduled must never look like morning brief
    assert.doesNotMatch(run.brief.markdown, /Morning Brief/);
  });

  it("preview CLI weekly flag cannot be overridden by CoS fallback", () => {
    assert.equal(parseBriefCadenceIntent(["--cadence=weekly"]), "weekly");
    assert.equal(
      resolveBriefCadenceIntent("cos-weekly-founder-brief"),
      "weekly",
    );
  });
});

describe("highest-ROI supported actions", () => {
  it("real Studio/CTA instrumentation contradiction can still surface when healthy", () => {
    const bi = emptyBusinessIntelligenceOutput();
    bi.recommendations = [analyticsGateRec(), studioCtaDivergenceRec()];
    const cos = runChiefOfStaff({
      bi,
      search: emptySearchStrategyOutput(),
      content: emptyContentExecutiveOutput(),
      opportunity: emptyOpportunityExecutiveOutput(),
      reportingPeriod: PERIOD,
      warnings: [],
      mode: "live",
      briefCadenceIntent: "daily",
      sourceHealth: healthyGa4Gsc(),
    });
    assert.doesNotMatch(cos.brief.highestRoiAction, /confirm analytics gates/i);
    assert.match(
      cos.brief.highestRoiAction,
      /Studio|consultation CTA|mobile path/i,
    );
  });

  it("tool-handoff highest-ROI carries normalized evidence, not title-only", () => {
    const bi = emptyBusinessIntelligenceOutput();
    bi.recommendations = [toolHandoffRec()];
    const cos = runChiefOfStaff({
      bi,
      search: emptySearchStrategyOutput(),
      content: emptyContentExecutiveOutput(),
      opportunity: emptyOpportunityExecutiveOutput(),
      reportingPeriod: PERIOD,
      warnings: [],
      mode: "live",
      briefCadenceIntent: "weekly",
      sourceHealth: healthyGa4Gsc(),
    });
    assert.match(cos.brief.highestRoiAction, /See It On Your Hand|tool handoff/i);
    const winner = cos.recommendations.find(
      (r) =>
        r.recommendationId === "search:repository:tool-handoff-gap:guide-to-tool",
    );
    assert.ok(winner);
    assert.ok((winner!.evidence?.length ?? 0) > 0);
    assert.match(
      winner!.evidence![0]!.metricOrObservation,
      /tool-handoff-gap/i,
    );
    assert.ok(winner!.evidence![0]!.supportingReference);
    assert.doesNotMatch(cos.brief.whatChanged, /content-map|inventory-draft/i);
  });

  it("daily does not treat tiny-window percent noise as elevate-as-material", () => {
    const a = assessChange(12, 10, {
      minPriorForPercent: 50,
      smallSampleCombined: 80,
      ordinaryNoiseAbsolute: 5,
    });
    assert.notEqual(judgeChange(a), "elevate-as-material");
  });

  it("weekly can retain a material high-volume trend", () => {
    const a = assessChange(400, 200, {
      minPriorForPercent: 50,
      smallSampleCombined: 80,
    });
    const j = judgeChange(a);
    assert.ok(j === "elevate-as-material" || j === "state-normally");
  });
});
