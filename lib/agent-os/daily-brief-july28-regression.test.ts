/**
 * July 28 Morning Brief regression + quality-gate product tests.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildDataConfidenceNote,
  dailyTodayCall,
  isVagueMetricWithoutMagnitude,
} from "./brief-quality";
import { evaluateBriefQualityGate } from "./brief-quality-gate";
import { renderFounderBriefEmail } from "./cadence-delivery/render-email";
import { evaluateDeliveryEligibility } from "./cadence-delivery/eligibility";
import { runChiefOfStaff } from "./executives/chief-of-staff";
import { emptyBusinessIntelligenceOutput } from "./bi/empty";
import { emptyContentExecutiveOutput } from "./executives/content";
import { emptyOpportunityExecutiveOutput } from "./executives/opportunity";
import { emptySearchStrategyOutput } from "./executives/search-strategy";
import {
  JULY_28_FAILED_BRIEF,
  JULY_28_LOCAL_DATE,
  JULY_28_OPERATING_BACKLOG,
} from "./fixtures/july-28-failed-brief";
import { CURRENT_OPERATING_BACKLOG } from "./operating-backlog";
import { FIXTURE_REPORTING_PERIOD } from "./fixtures/sample-data";
import type { AgentRun, FounderBrief, SourceHealth } from "./types";
import { createEvidence } from "./evidence";
import { buildRecommendation } from "./recommendation";

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
      lastSuccessfulRead: "2026-07-28T11:00:00.000Z",
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
      lastSuccessfulRead: "2026-07-28T11:00:00.000Z",
      errors: [],
      effectOnConfidence: "full",
      retrievalState: "ok",
      healthCode: "ok",
      founderLabel: "Search Console healthy",
    },
  ];
}

function stubRun(brief: FounderBrief, over: Partial<AgentRun> = {}): AgentRun {
  return {
    runId: "run-july28-regression",
    generatedAt: "2026-07-28T11:05:00.000Z",
    mode: "fixture",
    reportingPeriod: { start: "2026-07-20", end: "2026-07-26" },
    executivesInvoked: [
      "chief-of-staff",
      "business-intelligence",
      "search-strategy",
      "content",
      "opportunity",
    ],
    executivesNotOperational: [],
    sourcesAttempted: ["ga4", "gsc", "weekly-intelligence", "buffer"],
    sourceHealth: healthyGa4Gsc(),
    recommendations: [],
    anomalies: [],
    dataGaps: [],
    escalationItems: [],
    brief,
    runStatus: "completed-with-warnings",
    recommendationAvailability: "has-material-recommendations",
    executiveStatuses: [],
    briefEvidenceQuality: "full",
    deliveryGuidance: "send-normal-brief",
    briefSurfacing: {
      opportunitiesDetected: 0,
      recommendationsRanked: 2,
      recommendationsSurfacedInBrief: 0,
    },
    durationMs: 10,
    warnings: [],
    agentOsVersion: "1.0.0",
    ...over,
    brief: over.brief ? { ...brief, ...over.brief } : brief,
  };
}

describe("July 28 failed brief regression", () => {
  it("quality gate blocks the failed July 28 empty brief", () => {
    const todayCall = dailyTodayCall({
      whyItMatters: JULY_28_FAILED_BRIEF.whyItMatters,
      highestRoiAction: JULY_28_FAILED_BRIEF.highestRoiAction,
    });
    const gate = evaluateBriefQualityGate({
      brief: JULY_28_FAILED_BRIEF,
      todayCall,
      opportunityWatch: JULY_28_FAILED_BRIEF.opportunityToWatch,
      intent: "daily",
    });
    assert.equal(gate.ok, false);
    const codes = new Set(gate.violations.map((v) => v.code));
    assert.ok(codes.has("empty-no-action-brief") || codes.has("no-named-priority"));
    assert.ok(codes.has("decision-missing-recommendation"));
    assert.ok(codes.has("metric-missing-magnitude"));
    assert.ok(codes.has("internal-adapter-terminology"));
  });

  it("delivery eligibility send-nothings the failed July 28 shape", () => {
    const el = evaluateDeliveryEligibility({
      run: stubRun(JULY_28_FAILED_BRIEF),
      persistenceOk: true,
      intent: "daily",
    });
    assert.equal(el.action, "send-nothing");
    assert.match(el.reason, /quality gate/i);
  });

  it("vague metric without numeric delta is omitted", () => {
    assert.equal(
      isVagueMetricWithoutMagnitude("Sessions softened week-over-week"),
      true,
    );
    assert.equal(
      isVagueMetricWithoutMagnitude(
        "Sessions 1,420 → 1,235 (−13% WoW) on comparable week ranges",
      ),
      false,
    );
  });

  it("missing Buffer/social data does not appear in founder-facing copy", () => {
    const bi = emptyBusinessIntelligenceOutput();
    bi.dataGaps = [
      {
        id: "gap-buffer",
        sourceId: "buffer",
        description: "Buffer/social unavailable — no verified adapter",
        impactOnRecommendations: "Do not fabricate social metrics",
        suggestedRemedy: "Leave social ROI unclaimed",
      },
    ];
    bi.incompleteAttribution = true;
    const cos = runChiefOfStaff({
      bi,
      search: emptySearchStrategyOutput(),
      content: emptyContentExecutiveOutput(),
      opportunity: emptyOpportunityExecutiveOutput(),
      reportingPeriod: PERIOD,
      warnings: [],
      mode: "fixture",
      briefCadenceIntent: "daily",
      briefLocalDate: JULY_28_LOCAL_DATE,
      sourceHealth: healthyGa4Gsc(),
      operatingBacklog: JULY_28_OPERATING_BACKLOG,
    });
    const rendered = renderFounderBriefEmail({
      run: stubRun(cos.brief, {
        briefEvidenceQuality: "full",
        deliveryGuidance: "send-normal-brief",
        recommendationAvailability: "has-material-recommendations",
      }),
      cadenceId: "cos-daily-synthesis",
      cadenceWindow: `day:${JULY_28_LOCAL_DATE}`,
      degraded: false,
    });
    assert.doesNotMatch(rendered.html, /Buffer/i);
    assert.doesNotMatch(rendered.html, /adapter/i);
    assert.doesNotMatch(rendered.text, /rely on repository/i);
    assert.doesNotMatch(rendered.html, /HubSpot/i);
  });

  it("persistent priorities survive a day with no fresh analytics", () => {
    const bi = emptyBusinessIntelligenceOutput();
    // Healthy analytics, no material anomalies — overnight evidence thin.
    bi.keyMetricChanges = [];
    bi.recommendations = [];
    const cos = runChiefOfStaff({
      bi,
      search: emptySearchStrategyOutput(),
      content: emptyContentExecutiveOutput(),
      opportunity: emptyOpportunityExecutiveOutput(),
      reportingPeriod: PERIOD,
      warnings: [],
      mode: "live",
      briefCadenceIntent: "daily",
      briefLocalDate: JULY_28_LOCAL_DATE,
      sourceHealth: healthyGa4Gsc(),
      operatingBacklog: JULY_28_OPERATING_BACKLOG,
    });
    assert.ok(cos.brief.highestRoiAction.length > 20);
    assert.doesNotMatch(
      cos.brief.highestRoiAction,
      /no high-confidence founder action required/i,
    );
    assert.ok(
      cos.brief.surfacedPriorityTitles.length >= 1 ||
        /Concierge|Studio/i.test(cos.brief.highestRoiAction),
    );
    assert.match(cos.brief.highestRoiAction, /Concierge|Studio|Expected outcome|Completion/i);
    assert.ok(
      cos.brief.founderDecisionNeeded.every((d) =>
        /Recommendation:/i.test(d),
      ),
    );
  });

  it("useful carry-forward brief is generated from persistent sprint state", () => {
    const cos = runChiefOfStaff({
      bi: emptyBusinessIntelligenceOutput(),
      search: emptySearchStrategyOutput(),
      content: emptyContentExecutiveOutput(),
      opportunity: emptyOpportunityExecutiveOutput(),
      reportingPeriod: PERIOD,
      warnings: [],
      mode: "fixture",
      briefCadenceIntent: "daily",
      briefLocalDate: JULY_28_LOCAL_DATE,
      sourceHealth: healthyGa4Gsc(),
      operatingBacklog: JULY_28_OPERATING_BACKLOG,
    });
    const todayCall = dailyTodayCall({
      whyItMatters: cos.brief.whyItMatters,
      highestRoiAction: cos.brief.highestRoiAction,
      sprintOrientation: cos.brief.sprintOrientation,
      dayOrientation: cos.brief.dayOrientation,
      whatChanged: cos.brief.whatChanged,
    });
    const gate = evaluateBriefQualityGate({
      brief: cos.brief,
      todayCall,
      opportunityWatch: cos.brief.opportunityToWatch,
      intent: "daily",
    });
    assert.equal(gate.ok, true, JSON.stringify(gate.violations));
    assert.notEqual(todayCall, cos.brief.highestRoiAction);
    assert.doesNotMatch(todayCall, /no high-confidence/i);

    const rendered = renderFounderBriefEmail({
      run: stubRun(cos.brief),
      cadenceId: "cos-daily-synthesis",
      cadenceWindow: `day:${JULY_28_LOCAL_DATE}`,
      degraded: false,
    });
    assert.match(rendered.subject, /July 28, 2026/);
    assert.match(rendered.html, /Today’s call/i);
    assert.match(rendered.html, /Highest-ROI move/i);
    assert.match(rendered.html, /Top priorities/i);
    assert.doesNotMatch(rendered.html, /No named priorities this cycle/i);
    assert.doesNotMatch(rendered.html, /Sessions softened week-over-week(?![^<]*\d)/);
    // Mobile-friendly padding / max-width retained
    assert.match(rendered.html, /max-width:560px/);
    assert.match(rendered.html, /padding:28px 24px|padding:0 24px/);
  });

  it("duplicate Today’s Call / Highest-ROI sections fail validation", () => {
    const dup: FounderBrief = {
      ...JULY_28_FAILED_BRIEF,
      whyItMatters:
        "Confirm Concierge path from flagship content — ensure CTA attribution.",
      highestRoiAction:
        "Confirm Concierge path from flagship content — ensure CTA attribution.",
      surfacedPriorityTitles: ["Clarify Studio engagement vs consultation ask"],
      founderDecisionNeeded: [
        "Decide: Growth experiments. Recommendation: Defer. Why: Focus. Cost of delay: Split attention.",
      ],
      missingOrUnreliableData: [],
      opportunityToWatch: null,
    };
    const gate = evaluateBriefQualityGate({
      brief: dup,
      todayCall: dup.whyItMatters,
      intent: "daily",
    });
    assert.equal(gate.ok, false);
    assert.ok(
      gate.violations.some((v) => v.code === "duplicative-today-call-and-roi"),
    );
  });

  it("decisions always include a recommendation", () => {
    const cos = runChiefOfStaff({
      bi: emptyBusinessIntelligenceOutput(),
      search: emptySearchStrategyOutput(),
      content: emptyContentExecutiveOutput(),
      opportunity: emptyOpportunityExecutiveOutput(),
      reportingPeriod: PERIOD,
      warnings: [],
      mode: "fixture",
      briefCadenceIntent: "daily",
      briefLocalDate: JULY_28_LOCAL_DATE,
      operatingBacklog: JULY_28_OPERATING_BACKLOG,
      sourceHealth: healthyGa4Gsc(),
    });
    assert.ok(cos.brief.founderDecisionNeeded.length >= 1);
    for (const d of cos.brief.founderDecisionNeeded) {
      assert.match(d, /Recommendation:/i);
    }
  });

  it("empty no-action briefs are blocked even when JSON has material recs", () => {
    const bi = emptyBusinessIntelligenceOutput();
    bi.recommendations = [
      buildRecommendation({
        recommendationId: "bi-verify-tracking-before-decline",
        originatingExecutive: "business-intelligence",
        title: "Verify measurement before treating traffic drop as demand decline",
        plainLanguageExplanation: "Analytics maintenance",
        whyItMattersNow: "Confirm analytics gates",
        proposedAction:
          "Confirm analytics gates are still recording cleanly before treating traffic drop as demand.",
        expectedUpside: "Avoid false decline",
        effortEstimate: "low",
        urgency: "high",
        reversibility: "easily-reversed",
        baseConfidence: 0.7,
        evidence: [
          createEvidence({
            source: "ga4",
            sourceType: "analytics",
            collectedAt: "2026-07-28T11:00:00.000Z",
            reportingPeriod: PERIOD,
            metricOrObservation: "sessions soft",
            reliability: "reliable",
            supportingReference: "ga4.sessions",
          }),
        ],
        assumptions: [],
        risks: [],
        dependencies: [],
        approvalRequired: false,
        suggestedOwner: "Founder",
        rankingFactors: { expectedBusinessImpact: 8, strategicAlignment: 7 },
      }),
    ];
    // No backlog → analytics maintenance suppressed on healthy GA4+GSC → empty
    const cos = runChiefOfStaff({
      bi,
      search: emptySearchStrategyOutput(),
      content: emptyContentExecutiveOutput(),
      opportunity: emptyOpportunityExecutiveOutput(),
      reportingPeriod: PERIOD,
      warnings: [],
      mode: "live",
      briefCadenceIntent: "daily",
      briefLocalDate: JULY_28_LOCAL_DATE,
      sourceHealth: healthyGa4Gsc(),
      operatingBacklog: null,
    });
    const el = evaluateDeliveryEligibility({
      run: stubRun(cos.brief, {
        deliveryGuidance: "send-normal-brief",
        recommendationAvailability: "has-material-recommendations",
      }),
      persistenceOk: true,
      intent: "daily",
    });
    assert.equal(el.action, "send-nothing");
  });

  it("current operating backlog is available for local preview", () => {
    assert.ok(CURRENT_OPERATING_BACKLOG.masterSprint.items.length >= 2);
    assert.equal(CURRENT_OPERATING_BACKLOG.schemaVersion, 1);
  });
});

describe("daily data confidence founder language", () => {
  it("does not expose adapter inventory on daily briefs", () => {
    const note = buildDataConfidenceNote({
      missingOrUnreliableData: [
        "HubSpot aggregates unavailable",
        "Buffer/social unavailable",
        "GA4 OAuth authentication failed",
      ],
      executiveNotes: [],
      briefEvidenceQuality: "partial-degraded",
      intent: "daily",
    });
    assert.equal(note.level, "Partial");
    assert.doesNotMatch(note.summary, /HubSpot|Buffer|adapter|repository/i);
    assert.match(note.summary, /Website or search|directional/i);
    assert.equal(note.renderInFounderEmail, true);
  });

  it("omits data confidence when only secondary sources are missing", () => {
    const note = buildDataConfidenceNote({
      missingOrUnreliableData: ["Buffer/social unavailable"],
      executiveNotes: [],
      briefEvidenceQuality: "full",
      intent: "daily",
    });
    assert.equal(note.renderInFounderEmail, false);
  });
});
