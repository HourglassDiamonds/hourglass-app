/**
 * P1-COS-2 — founder-attention alignment.
 * No live email. No Search Strategy / GSC retrieval changes.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildDataConfidenceNote,
  dailyTodayCall,
  isByDesignHealthySearchLimitation,
} from "./brief-quality";
import { renderFounderBriefEmail } from "./cadence-delivery/render-email";
import { runChiefOfStaff } from "./executives/chief-of-staff";
import { emptyBusinessIntelligenceOutput } from "./bi/empty";
import { emptyContentExecutiveOutput } from "./executives/content";
import { emptyOpportunityExecutiveOutput } from "./executives/opportunity";
import { emptySearchStrategyOutput } from "./executives/search-strategy";
import { createEvidence } from "./evidence";
import {
  CURRENT_OPERATING_BACKLOG,
  recommendationsFromOperatingBacklog,
  watchLinesFromOperatingBacklog,
} from "./operating-backlog";
import type { OperatingBacklog } from "./operating-backlog/types";
import { buildRecommendation } from "./recommendation";
import { FIXTURE_REPORTING_PERIOD } from "./fixtures/sample-data";
import type { AgentRun, FounderBrief, Recommendation } from "./types";

const PERIOD = { ...FIXTURE_REPORTING_PERIOD };
const NOW = "2026-08-14T11:05:00.000Z";

function evidence() {
  return [
    createEvidence({
      source: "repository-content-inventory",
      sourceType: "internal-report",
      collectedAt: NOW,
      reportingPeriod: PERIOD,
      metricOrObservation: "test",
      reliability: "reliable",
      supportingReference: "repo://test",
    }),
  ];
}

function searchBusywork(): Recommendation {
  return buildRecommendation({
    recommendationId: "search-strategy:tool-handoff:busywork",
    originatingExecutive: "search-strategy",
    title: '[Search Strategy] Add a tool handoff on “Do Fancy Shape Diamonds Have Cut Grades”',
    plainLanguageExplanation: "Repository tool-handoff gap",
    whyItMattersNow: "Size/shape education should connect to Studio tools.",
    proposedAction:
      "Add a contextual link from the article to See It On Your Hand.",
    expectedUpside: "Clearer tool path",
    effortEstimate: "low",
    urgency: "medium",
    reversibility: "easily-reversed",
    baseConfidence: 0.8,
    evidence: evidence(),
    assumptions: [],
    risks: [],
    dependencies: [],
    approvalRequired: false,
    suggestedOwner: "Founder / Search Strategy",
    rankingFactors: { expectedBusinessImpact: 9, strategicAlignment: 8 },
  });
}

function runDaily(backlog: OperatingBacklog | null, extra?: {
  searchRecs?: Recommendation[];
  contentRecs?: Recommendation[];
}) {
  return runChiefOfStaff({
    bi: emptyBusinessIntelligenceOutput(),
    search: {
      ...emptySearchStrategyOutput(),
      recommendations: extra?.searchRecs ?? [],
    },
    content: {
      ...emptyContentExecutiveOutput(),
      recommendations: extra?.contentRecs ?? [],
    },
    opportunity: emptyOpportunityExecutiveOutput(),
    reportingPeriod: PERIOD,
    warnings: [],
    mode: "fixture",
    briefCadenceIntent: "daily",
    briefLocalDate: "2026-08-14",
    operatingBacklog: backlog,
  });
}

function founderBlob(cos: ReturnType<typeof runDaily>): string {
  return [
    cos.brief.dayOrientation ?? "",
    cos.brief.highestRoiAction,
    ...cos.brief.surfacedPriorityTitles,
    ...cos.brief.needsAttentionToday,
    ...cos.brief.founderDecisionNeeded,
  ].join("\n");
}

function stubBrief(over: Partial<FounderBrief> = {}): FounderBrief {
  return {
    whatChanged: "Nothing material",
    whyItMatters: "Protect conversion gains.",
    needsAttentionToday: ["See highest-ROI action below"],
    highestRoiAction:
      "Advance the next client Case Study as Hourglass's primary sales-proof and publishing asset.",
    canSafelyWait: ["None"],
    blocked: ["None"],
    founderDecisionNeeded: [],
    missingOrUnreliableData: [],
    markdown: "# stub",
    surfacedPriorityTitles: ["Advance the next client Case Study"],
    ...over,
  };
}

function stubRun(briefOver: Partial<FounderBrief> = {}): AgentRun {
  return {
    runId: "test-run",
    generatedAt: NOW,
    mode: "fixture",
    reportingPeriod: PERIOD,
    executivesInvoked: ["chief-of-staff"],
    executivesNotOperational: [],
    sourcesAttempted: ["ga4", "gsc"],
    sourceHealth: [],
    recommendations: [],
    anomalies: [],
    dataGaps: [],
    escalationItems: [],
    brief: stubBrief(briefOver),
    runStatus: "completed",
    recommendationAvailability: "has-material-recommendations",
    executiveStatuses: [],
    briefEvidenceQuality: "full",
    deliveryGuidance: "send-normal-brief",
    briefSurfacing: {
      opportunitiesDetected: 0,
      recommendationsRanked: 1,
      recommendationsSurfacedInBrief: 1,
    },
    durationMs: 1,
    warnings: [],
    agentOsVersion: "1.0.0",
  };
}

function watchOnlyBacklog(): OperatingBacklog {
  return {
    schemaVersion: 1,
    masterSprint: {
      id: "quiet",
      name: "Quiet day",
      objective: "Protect conversion gains.",
      dayOrientation: null,
      affirmedLocalDate: "2026-08-14",
      items: [
        {
          id: "sprint-charlotte-guide-authority",
          kind: "founder-action",
          title: "Strengthen Charlotte guide hub titles",
          action: "Align hub titles",
          why: "Still open",
          expectedOutcome: "Aligned hub",
          status: "active",
          urgency: "medium",
          rank: 1,
          surfacePolicy: "watch",
          watchLine: "Charlotte guide hub — valid, not current founder priority",
        },
      ],
    },
    deferred: [
      {
        id: "deferred-paid-search-readiness",
        kind: "deferred-work",
        title: "Paid-search readiness review",
        action: "Revisit paid-search readiness",
        why: "Open, not current",
        expectedOutcome: "Go/no-go later",
        status: "deferred",
        urgency: "low",
        rank: 1,
        surfacePolicy: "watch",
        watchLine: "Paid-search readiness — open, not current priority",
        deferredUntil: "2026-08-04T00:00:00.000Z",
      },
    ],
    recurring: [],
  };
}

describe("P1-COS-2 founder-now Case Study", () => {
  it("Case Study produces Today's Call and Highest-ROI", () => {
    const cos = runDaily(CURRENT_OPERATING_BACKLOG);
    const today = dailyTodayCall({
      whyItMatters: cos.brief.whyItMatters,
      highestRoiAction: cos.brief.highestRoiAction,
      sprintOrientation: cos.brief.sprintOrientation,
      dayOrientation: cos.brief.dayOrientation,
    });
    assert.match(today, /Case Study/i);
    assert.doesNotMatch(today, /Strengthen Charlotte guide hub titles/i);
    assert.match(cos.brief.highestRoiAction, /Case Study/i);
    assert.match(
      cos.brief.highestRoiAction,
      /founder-affirmed|Affirm the next Case Study|sales-proof/i,
    );
  });
});

describe("P1-COS-2 Charlotte watch", () => {
  it("Charlotte cannot become Today's Call, Highest-ROI, or Top Priorities", () => {
    const cos = runDaily(CURRENT_OPERATING_BACKLOG, {
      searchRecs: [searchBusywork()],
    });
    const blob = founderBlob(cos);
    assert.doesNotMatch(blob, /Strengthen Charlotte guide hub titles/i);
    assert.doesNotMatch(cos.brief.highestRoiAction, /Charlotte/i);
    assert.equal(
      cos.brief.surfacedPriorityTitles.some((t) => /Charlotte/i.test(t)),
      false,
    );
    const watch = cos.brief.watchNoActionItems ?? [];
    assert.ok(watch.some((l) => /Charlotte guide hub/i.test(l)));
  });
});

describe("P1-COS-2 paid-search past deferredUntil stays watch", () => {
  it("does not auto-promote paid-search into founder-now slots", () => {
    const recs = recommendationsFromOperatingBacklog(CURRENT_OPERATING_BACKLOG, {
      nowIso: NOW,
    });
    assert.equal(
      recs.some((r) => /paid-search/i.test(r.title)),
      false,
    );
    const cos = runDaily(CURRENT_OPERATING_BACKLOG);
    const blob = founderBlob(cos);
    assert.doesNotMatch(blob, /Paid-search readiness review/i);
    assert.ok(
      (cos.brief.watchNoActionItems ?? []).some((l) => /Paid-search/i.test(l)),
    );
  });
});

describe("P1-COS-2 stale growth-experiment decision", () => {
  it("does not appear on the daily brief", () => {
    const cos = runDaily(CURRENT_OPERATING_BACKLOG);
    const decisions = cos.brief.founderDecisionNeeded.join("\n");
    assert.doesNotMatch(
      decisions,
      /Defer new growth experiments until Charlotte/i,
    );
    assert.doesNotMatch(
      decisions,
      /Whether to open new growth experiments this week/i,
    );
    assert.doesNotMatch(
      decisions,
      /restore trustworthy website and search reporting/i,
    );
  });

  it("does not mint a measurement-restore gate from V1 adapter or GSC UNKNOWN gaps", () => {
    const search = emptySearchStrategyOutput();
    search.dataGaps = [
      {
        id: "gap-search-gsc-unknown-1",
        sourceId: "gsc",
        description:
          "UNKNOWN: Bulk Pages / Coverage indexing reasons — Search Console API does not expose an equivalent to the Coverage/Pages report",
        impactOnRecommendations: "Do not treat as observed zero",
        suggestedRemedy: "Leave as unknown",
      },
    ];
    const opportunity = emptyOpportunityExecutiveOutput();
    opportunity.dataGaps = [
      {
        id: "gap-opportunity-external-targets",
        sourceId: "weekly-intelligence",
        description:
          "No verified external opportunity adapter (partners, podcasts, publications, CPC, remarketing audiences)",
        impactOnRecommendations: "External targets unverified",
        suggestedRemedy: "Keep research labels",
      },
      {
        id: "gap-opportunity-cpc",
        sourceId: "ga4",
        description: "Paid-search cost (CPC) evidence unavailable",
        impactOnRecommendations: "Paid-search is readiness-only",
        suggestedRemedy: "Do not estimate CPC",
      },
    ];
    const cos = runChiefOfStaff({
      bi: emptyBusinessIntelligenceOutput(),
      search,
      content: emptyContentExecutiveOutput(),
      opportunity,
      reportingPeriod: PERIOD,
      warnings: [],
      mode: "fixture",
      briefCadenceIntent: "daily",
      briefLocalDate: "2026-08-14",
      operatingBacklog: CURRENT_OPERATING_BACKLOG,
    });
    assert.doesNotMatch(
      cos.brief.founderDecisionNeeded.join("\n"),
      /restore trustworthy website and search reporting/i,
    );
  });

  it("still mints a measurement gate for genuine GA4 auth failure", () => {
    const bi = emptyBusinessIntelligenceOutput();
    bi.dataGaps = [
      {
        id: "gap-ga4-failed",
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
      briefLocalDate: "2026-08-14",
      operatingBacklog: CURRENT_OPERATING_BACKLOG,
    });
    assert.match(
      cos.brief.founderDecisionNeeded.join("\n"),
      /restore trustworthy website and search reporting|restore reliable website and search analytics/i,
    );
  });
});

describe("P1-COS-2 completed work remains suppressed", () => {
  it("keeps Concierge CTA and Size Studio implementation out of founder-now slots", () => {
    const recs = recommendationsFromOperatingBacklog(CURRENT_OPERATING_BACKLOG, {
      nowIso: NOW,
    });
    const titles = recs.map((r) => r.title);
    assert.equal(
      titles.some((t) => /Concierge path from flagship/i.test(t)),
      false,
    );
    assert.equal(
      titles.includes("Clarify Studio engagement vs consultation ask"),
      false,
    );
    const cos = runDaily(CURRENT_OPERATING_BACKLOG);
    const blob = founderBlob(cos);
    assert.doesNotMatch(blob, /intact attribution parameters/i);
    assert.doesNotMatch(blob, /Clarify Studio engagement vs consultation ask/i);
    const watch = cos.brief.watchNoActionItems ?? [];
    assert.ok(watch.some((l) => /Size Studio — measure only/i.test(l)));
  });
});

describe("P1-COS-2 quiet day does not backfill", () => {
  it("does not fill named slots with low-ROI Search recommendations", () => {
    const cos = runDaily(watchOnlyBacklog(), {
      searchRecs: [searchBusywork()],
    });
    const blob = founderBlob(cos);
    assert.doesNotMatch(blob, /tool handoff/i);
    assert.doesNotMatch(blob, /Fancy Shape/i);
    assert.doesNotMatch(cos.brief.highestRoiAction, /Charlotte/i);
    assert.equal(
      cos.brief.surfacedPriorityTitles.some((t) => /Charlotte|tool handoff/i.test(t)),
      false,
    );
  });
});

describe("P1-COS-2 Watch / No Action email", () => {
  it("renders useful capped watch items and omits an empty section", () => {
    const withWatch = renderFounderBriefEmail({
      run: stubRun({
        watchNoActionItems: [
          "Charlotte guide hub — valid, not current founder priority",
          "Weddington prominence — monitoring",
          "Size Studio — measure only",
          "Paid-search readiness — open, not current priority",
        ],
      }),
      cadenceId: "cos-daily-synthesis",
      cadenceWindow: "day:2026-08-14",
      degraded: false,
    });
    assert.match(withWatch.html, /Watch \/ no action/i);
    assert.match(withWatch.text, /Watch \/ no action/i);
    assert.match(withWatch.html, /Charlotte guide hub/);
    assert.match(withWatch.html, /Size Studio/);
    assert.doesNotMatch(withWatch.html, /Search\/GEO infrastructure/i);

    const empty = renderFounderBriefEmail({
      run: stubRun({ watchNoActionItems: null }),
      cadenceId: "cos-daily-synthesis",
      cadenceWindow: "day:2026-08-14",
      degraded: false,
    });
    assert.doesNotMatch(empty.html, /Watch \/ no action/i);
    assert.doesNotMatch(empty.text, /Watch \/ no action/i);

    const noBackfill = renderFounderBriefEmail({
      run: stubRun({
        surfacedPriorityTitles: [],
        needsAttentionToday: ["Sessions 1,840 (-270, -13%)"],
        sprintOrientation: "Advance the next client Case Study",
        opportunityToWatch: null,
        canSafelyWait: ["None"],
      }),
      cadenceId: "cos-daily-synthesis",
      cadenceWindow: "day:2026-08-14",
      degraded: false,
    });
    const priorityBlock =
      noBackfill.text.split("Priorities:")[1]?.split(/\n\n/)[0] ?? "";
    assert.doesNotMatch(priorityBlock, /Sessions 1,840/i);
    assert.match(priorityBlock, /Case Study/i);
    assert.doesNotMatch(
      noBackfill.html,
      /Top priorities[\s\S]{0,400}Sessions 1,840/i,
    );

    const lines = watchLinesFromOperatingBacklog(CURRENT_OPERATING_BACKLOG);
    assert.ok(lines.length > 0);
    assert.ok(lines.length <= 5);
    assert.equal(
      lines.some((l) => /Search\/GEO infrastructure/i.test(l)),
      false,
    );
  });
});

describe("P1-COS-2 data confidence", () => {
  it("does not warn Partial for healthy GSC known limitations", () => {
    assert.equal(
      isByDesignHealthySearchLimitation(
        "UNKNOWN: Bulk Pages / Coverage indexing reasons — Search Console API does not expose an equivalent to the Coverage/Pages report",
      ),
      true,
    );
    assert.equal(
      isByDesignHealthySearchLimitation(
        "UNKNOWN: URL Inspection index status — URL Inspection is out of V1 scope",
      ),
      true,
    );
    assert.equal(
      isByDesignHealthySearchLimitation(
        "Search Console processing delay within expected range",
      ),
      true,
    );
    const note = buildDataConfidenceNote({
      missingOrUnreliableData: [
        "UNKNOWN: Device and country Search Analytics — V1 does not request device or country dimensions",
        "Search Console newest finalized data is August 12 (2d processing delay; expected)",
      ],
      executiveNotes: [],
      briefEvidenceQuality: "full",
      intent: "daily",
    });
    assert.equal(note.level, "Full");
    assert.equal(note.renderInFounderEmail, false);
    assert.doesNotMatch(note.summary, /incomplete for this cycle/i);
  });

  it("still warns for genuine GA4/GSC failure", () => {
    assert.equal(
      isByDesignHealthySearchLimitation("Search Console OAuth authentication failed"),
      false,
    );
    const note = buildDataConfidenceNote({
      missingOrUnreliableData: ["GA4 OAuth authentication failed"],
      executiveNotes: [],
      briefEvidenceQuality: "full",
      intent: "daily",
    });
    assert.equal(note.level, "Partial");
    assert.equal(note.renderInFounderEmail, true);
    assert.match(note.summary, /Website or search|directional/i);

    const critical = buildDataConfidenceNote({
      missingOrUnreliableData: ["Search Console request failed"],
      executiveNotes: [],
      briefEvidenceQuality: "failed",
      criticalFailure: true,
      intent: "daily",
    });
    assert.equal(critical.level, "Critical");
    assert.equal(critical.renderInFounderEmail, true);
  });
});
