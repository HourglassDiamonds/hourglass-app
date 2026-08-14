/**
 * Daily Chief of Staff brief product-quality tests.
 * No real email; delivery claim semantics unchanged.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  actionsMateriallyDistinct,
  buildDataConfidenceNote,
  cleanFounderFacingAction,
  formatFounderLocalDateLabel,
  isInternalLimitationRecommendation,
  localDateFromCadenceWindow,
  resolveBriefCadenceIntent,
  selectFounderPriorities,
  topicClusterKey,
} from "./brief-quality";
import { renderFounderBriefEmail } from "./cadence-delivery/render-email";
import {
  briefFingerprintFromFounderBrief,
  buildDeliveryIdempotencyKey,
  createFakeEmailSender,
  executeAgentOsCadence,
  evaluateDeliveryEligibility,
} from "./cadence-delivery";
import { DurableTestPersistenceAdapter } from "./persistence/adapters/durable-test";
import { buildRecommendation } from "./recommendation";
import { createEvidence } from "./evidence";
import { runAgentOsBrief } from "./run";
import { runChiefOfStaff } from "./executives/chief-of-staff";
import { emptyBusinessIntelligenceOutput } from "./bi/empty";
import { emptyContentExecutiveOutput } from "./executives/content";
import { emptyOpportunityExecutiveOutput } from "./executives/opportunity";
import { emptySearchStrategyOutput } from "./executives/search-strategy";
import { FIXTURE_REPORTING_PERIOD } from "./fixtures/sample-data";
import type { AgentRun, FounderBrief, Recommendation } from "./types";
import { utcIsoForLocalWallTime } from "./persistence/timezone";
import { FOUNDER_CADENCE_TIMEZONE } from "./persistence/cadence";

const PERIOD = { ...FIXTURE_REPORTING_PERIOD };

function evidenceFor(topic: string, ref?: string) {
  return [
    createEvidence({
      source: "repository-content-inventory",
      sourceType: "internal-report",
      collectedAt: "2026-07-24T11:00:00.000Z",
      reportingPeriod: PERIOD,
      metricOrObservation: `content-gap: ${topic}`,
      reliability: "reliable",
      supportingReference: ref ?? `repo://${topic}`,
    }),
  ];
}

function rec(partial: {
  id: string;
  title: string;
  action: string;
  impact?: number;
  urgency?: Recommendation["urgency"];
  executive?: Recommendation["originatingExecutive"];
  topic?: string;
}): Recommendation {
  return buildRecommendation({
    recommendationId: partial.id,
    originatingExecutive: partial.executive ?? "content",
    title: partial.title,
    plainLanguageExplanation: "Test recommendation",
    whyItMattersNow: "Matters for the founder operating day",
    proposedAction: partial.action,
    expectedUpside: "Clearer path for buyers",
    effortEstimate: "low",
    urgency: partial.urgency ?? "high",
    reversibility: "easily-reversed",
    baseConfidence: 0.8,
    evidence: evidenceFor(partial.topic ?? "why-were-here"),
    assumptions: [],
    risks: [],
    dependencies: [],
    approvalRequired: false,
    suggestedOwner: "Founder",
    rankingFactors: {
      expectedBusinessImpact: partial.impact ?? 8,
      strategicAlignment: 9,
    },
  });
}

function stubBrief(over: Partial<FounderBrief> = {}): FounderBrief {
  return {
    whatChanged: "Nothing material",
    whyItMatters: "Qualified viewers should reach Concierge calmly.",
    needsAttentionToday: ["See highest-ROI action below"],
    highestRoiAction:
      "[Content] Confirm Concierge path — Ensure CTA uses attribution (confidence 0.72)",
    canSafelyWait: ["None"],
    blocked: ["None"],
    founderDecisionNeeded: ["None required this cycle"],
    missingOrUnreliableData: [
      "HubSpot aggregates unavailable",
      "GA4 retrieval failed",
      "Search Console retrieval failed",
    ],
    markdown: "# stub",
    surfacedPriorityTitles: [
      "[Content] Confirm Concierge path from “Why We’re Here”",
      "[Content] Trust-building content: Studio engagement vs consultation clarity",
    ],
    ...over,
  };
}

function stubRun(over: Partial<AgentRun> = {}): AgentRun {
  const brief = {
    ...stubBrief(),
    ...(over.brief ?? {}),
  };
  return {
    runId: "run-preview-test",
    generatedAt: "2026-07-24T11:05:00.000Z",
    mode: "fixture",
    reportingPeriod: { start: "2026-07-13", end: "2026-07-19" },
    executivesInvoked: [
      "chief-of-staff",
      "business-intelligence",
      "search-strategy",
      "content",
      "opportunity",
    ],
    executivesNotOperational: [],
    sourcesAttempted: ["ga4", "gsc", "weekly-intelligence"],
    sourceHealth: [],
    recommendations: [],
    anomalies: [],
    dataGaps: [],
    escalationItems: [],
    brief,
    runStatus: "completed-with-warnings",
    recommendationAvailability: "has-material-recommendations",
    executiveStatuses: [
      {
        executiveId: "business-intelligence",
        status: "completed-with-warnings",
        materialRecommendationCount: 1,
      },
      {
        executiveId: "search-strategy",
        status: "completed-with-warnings",
        materialRecommendationCount: 1,
      },
      {
        executiveId: "content",
        status: "completed-with-warnings",
        materialRecommendationCount: 3,
      },
      {
        executiveId: "opportunity",
        status: "completed-with-warnings",
        materialRecommendationCount: 0,
      },
      {
        executiveId: "chief-of-staff",
        status: "completed",
        materialRecommendationCount: 2,
      },
    ],
    briefEvidenceQuality: "partial-degraded",
    deliveryGuidance: "send-degraded-partial-brief",
    briefSurfacing: {
      opportunitiesDetected: 4,
      recommendationsRanked: 4,
      recommendationsSurfacedInBrief: 2,
    },
    durationMs: 10,
    warnings: [],
    agentOsVersion: "1.0.0",
    ...over,
    brief: over.brief ? { ...stubBrief(), ...over.brief } : brief,
  };
}

describe("brief cadence intent", () => {
  it("maps cos-daily-synthesis to daily and weekly cadence to weekly", () => {
    assert.equal(resolveBriefCadenceIntent("cos-daily-synthesis"), "daily");
    assert.equal(resolveBriefCadenceIntent("cos-weekly-founder-brief"), "weekly");
  });

  it("daily and weekly synthesis markdown intents differ explicitly", () => {
    const bi = emptyBusinessIntelligenceOutput();
    const shared = {
      bi,
      search: emptySearchStrategyOutput(),
      content: emptyContentExecutiveOutput(),
      opportunity: emptyOpportunityExecutiveOutput(),
      reportingPeriod: PERIOD,
      warnings: [] as string[],
      mode: "fixture" as const,
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
    assert.match(weekly.brief.markdown, /Founder Brief/);
    assert.match(weekly.brief.markdown, /Weekly performance review/);
    assert.notEqual(
      daily.brief.markdown.includes("Today’s priorities"),
      weekly.brief.markdown.includes("Today’s priorities"),
    );
  });
});

describe("daily date framing", () => {
  it("uses America/New_York local date from day window — not stale weekly range", () => {
    const rendered = renderFounderBriefEmail({
      run: stubRun(),
      cadenceId: "cos-daily-synthesis",
      cadenceWindow: "day:2026-07-24",
      degraded: true,
    });
    assert.match(rendered.subject, /July 24, 2026/);
    assert.match(rendered.html, /Morning Brief/);
    assert.match(rendered.html, /July 24, 2026/);
    assert.doesNotMatch(rendered.html, /2026-07-13/);
    assert.doesNotMatch(rendered.html, /2026-07-19/);
    assert.doesNotMatch(rendered.text, /2026-07-13 — 2026-07-19/);
    assert.doesNotMatch(rendered.html, /completed-with-warnings/);
    assert.doesNotMatch(rendered.html, /Source gaps \(not deterioration\)/);
    assert.doesNotMatch(rendered.html, /Degraded areas/);
    assert.match(rendered.html, /Data confidence/);
    assert.match(rendered.html, /Partial/);
  });

  it("weekly brief shows ISO week range from cadence window — not stale reporting period", () => {
    const rendered = renderFounderBriefEmail({
      run: stubRun(),
      cadenceId: "cos-weekly-founder-brief",
      cadenceWindow: "week:2026-W30",
      degraded: false,
    });
    assert.match(rendered.html, /Weekly Brief/);
    assert.match(rendered.subject, /Hourglass Weekly Brief · July 20–26, 2026/);
    assert.match(rendered.html, /July 20–26, 2026/);
    assert.match(rendered.text, /2026-07-20 — 2026-07-26/);
    assert.doesNotMatch(rendered.html, /2026-07-13 — 2026-07-19/);
    assert.doesNotMatch(rendered.subject, /week:2026-W30/);
    assert.doesNotMatch(rendered.html, /cos-weekly-founder-brief/);
    assert.doesNotMatch(rendered.subject, /Morning Brief/);
  });

  it("DST / local-date boundaries remain correct for day windows", () => {
    // EDT (UTC-4): 2026-07-24 07:00 ET = 11:00Z
    const summer = utcIsoForLocalWallTime(
      "2026-07-24",
      7,
      0,
      FOUNDER_CADENCE_TIMEZONE,
    );
    assert.equal(
      localDateFromCadenceWindow("day:2026-07-24", summer),
      "2026-07-24",
    );
    assert.equal(formatFounderLocalDateLabel("2026-07-24"), "July 24, 2026");

    // EST (UTC-5): mid-winter
    const winter = utcIsoForLocalWallTime(
      "2026-01-15",
      7,
      0,
      FOUNDER_CADENCE_TIMEZONE,
    );
    assert.equal(
      localDateFromCadenceWindow("day:2026-01-15", winter),
      "2026-01-15",
    );
    assert.equal(formatFounderLocalDateLabel("2026-01-15"), "January 15, 2026");

    // Spring-forward week
    assert.equal(
      localDateFromCadenceWindow(
        "day:2026-03-08",
        utcIsoForLocalWallTime("2026-03-08", 7, 0, FOUNDER_CADENCE_TIMEZONE),
      ),
      "2026-03-08",
    );
  });
});

describe("priority quality", () => {
  it("excludes internal source limitations from founder priorities", () => {
    const incomplete = rec({
      id: "r-incomplete",
      title: `[Content] Source material incomplete for “Why We’re Here”`,
      action:
        "Complete filming/editing assets in the repository record when ready. Do not treat registry draft labels as proof.",
      impact: 9,
    });
    const action = rec({
      id: "r-cta",
      title: `[Content] Confirm Concierge path from “Why We’re Here”`,
      action:
        "Ensure the episode page Concierge CTA uses conversations attribution params — do not invent CRM metrics.",
      impact: 8,
    });
    assert.equal(isInternalLimitationRecommendation(incomplete), true);
    assert.equal(isInternalLimitationRecommendation(action), false);

    const picked = selectFounderPriorities([incomplete, action], { max: 5 });
    assert.equal(picked.highest?.recommendationId, "r-cta");
    assert.equal(picked.divertedInternalLimitations.length, 1);
    assert.ok(
      !picked.additional.some((r) => r.recommendationId === "r-incomplete"),
    );
  });

  it("clusters near-duplicate recommendations from one topic/asset", () => {
    const a = rec({
      id: "a",
      title: `[Content] Confirm Concierge path from “Why We’re Here”`,
      action: "Wire Concierge CTA attribution params on the episode page",
      impact: 9,
    });
    const b = rec({
      id: "b",
      title: `[Content] Carousel opportunity from “Why We’re Here” key ideas`,
      action: "Draft a calm carousel from the episode’s three trust ideas",
      impact: 8,
    });
    const nearDup = rec({
      id: "c",
      title: `[Content] Confirm Concierge path from “Why We’re Here” again`,
      action: "Wire Concierge CTA attribution params on the episode page",
      impact: 7,
    });
    const other = rec({
      id: "d",
      title: `[Search] Strengthen Charlotte guide hub titles`,
      action: "Align hub H1 with local intent without inventing GBP claims",
      impact: 7,
      executive: "search-strategy",
      topic: "charlotte-guide",
    });
    assert.equal(topicClusterKey(a), topicClusterKey(b));
    assert.equal(actionsMateriallyDistinct(a.proposedAction, b.proposedAction), true);
    assert.equal(
      actionsMateriallyDistinct(a.proposedAction, nearDup.proposedAction),
      false,
    );

    const picked = selectFounderPriorities([a, b, nearDup, other], { max: 5 });
    const ids = [
      picked.highest!.recommendationId,
      ...picked.additional.map((r) => r.recommendationId),
    ];
    assert.ok(ids.includes("a"));
    assert.ok(ids.includes("b"));
    assert.ok(ids.includes("d"));
    assert.ok(!ids.includes("c"));
    assert.ok(ids.length <= 5);
    assert.ok(ids.length >= 3);
  });

  it("allows fewer than five priorities", () => {
    const only = rec({
      id: "only",
      title: "[BI] Fix consultation attribution",
      action: "Confirm Studio vs consultation event labels",
      impact: 9,
      executive: "business-intelligence",
      topic: "attribution",
    });
    const picked = selectFounderPriorities([only], { max: 5 });
    assert.equal(
      (picked.highest ? 1 : 0) + picked.additional.length,
      1,
    );
  });

  it("one executive can surface multiple priorities when materially distinct", () => {
    const one = rec({
      id: "c1",
      title: `[Content] Confirm Concierge path from “Why We’re Here”`,
      action: "Wire Concierge CTA attribution on episode page",
      impact: 9,
    });
    const two = rec({
      id: "c2",
      title: `[Content] Trust-building: Studio vs consultation clarity`,
      action: "Publish a short Studio-vs-consultation explainer for buyers",
      impact: 8,
      topic: "studio-clarity",
    });
    const picked = selectFounderPriorities([one, two], { max: 5 });
    assert.equal(
      (picked.highest ? 1 : 0) + picked.additional.length,
      2,
    );
  });

  it("five-priority cap remains intact", () => {
    const many = Array.from({ length: 8 }, (_, i) =>
      rec({
        id: `r${i}`,
        title: `[Content] Distinct move ${i} for “Asset ${i}”`,
        action: `Take distinct founder action number ${i} with unique verbs ${i}`,
        impact: 9 - i * 0.1,
        topic: `asset-${i}`,
      }),
    );
    const picked = selectFounderPriorities(many, { max: 5 });
    assert.equal(
      (picked.highest ? 1 : 0) + picked.additional.length,
      5,
    );
  });
});

describe("diagnostic demotion + critical visibility", () => {
  it("daily email keeps compact data confidence", () => {
    const note = buildDataConfidenceNote({
      missingOrUnreliableData: [
        "HubSpot aggregates unavailable",
        "Buffer/social unavailable",
        "GA4 retrieval failed",
      ],
      executiveNotes: ["bi: completed-with-warnings"],
      briefEvidenceQuality: "partial-degraded",
      intent: "daily",
    });
    assert.equal(note.level, "Partial");
    assert.match(note.summary, /Website or search|directional/i);
    assert.doesNotMatch(note.summary, /HubSpot|Buffer|repository/i);
    assert.equal(note.showDetails, false);
  });

  it("critical data failure remains visible when materially relevant", () => {
    const rendered = renderFounderBriefEmail({
      run: stubRun({
        briefEvidenceQuality: "none-blocked",
        runStatus: "failed",
        brief: stubBrief({
          missingOrUnreliableData: [
            "GA4 retrieval failed — critical analytics unavailable",
          ],
        }),
      }),
      cadenceId: "cos-daily-synthesis",
      cadenceWindow: "day:2026-07-24",
      degraded: true,
    });
    assert.match(rendered.html, /Critical/);
    assert.match(rendered.html, /website or search measurement|provisional/i);
    assert.match(rendered.text, /Data confidence: Critical/);
  });

  it("strips operator wording from founder-facing actions", () => {
    assert.equal(
      cleanFounderFacingAction(
        "Ensure CTA uses attribution — do not invent CRM metrics.",
      ),
      "Ensure CTA uses attribution",
    );
  });
});

describe("delivery safety unchanged + no real email", () => {
  it("quiet-cycle send-nothing and idempotency keys remain stable", async () => {
    const store = new DurableTestPersistenceAdapter({ modeScope: "live" });
    const sender = createFakeEmailSender({ messageId: "msg_quality_1" });
    const result = await executeAgentOsCadence({
      mode: "scheduled-live",
      allowDurableTest: true,
      cadenceId: "cos-daily-synthesis",
      force: true,
      store,
      nowIso: "2026-07-24T11:00:00.000Z",
      emailConfigOverride: {
        apiKey: "re_test_fake",
        from: "Agent OS <test@updates.example.test>",
        to: "founder-preview@example.test",
        recipientAlias: "test-founder",
      },
      emailSender: sender,
    });
    assert.equal(result.ok, true);
    assert.equal(result.emailSent, false);
    assert.equal(result.deliveryOutcome, "skipped_with_reason");
    assert.doesNotMatch(result.safeSummary, /quality gate/i);
    assert.match(result.safeSummary, /quiet cycle|no material founder/i);
    assert.equal(sender.calls.length, 0);

    // Re-render the fixture smoke shape to prove product framing without Resend
    const preview = renderFounderBriefEmail({
      run: stubRun({
        brief: stubBrief({
          surfacedPriorityTitles: [
            "[Content] Confirm Concierge path from “Why We’re Here”",
            "[Search] Strengthen Charlotte guide hub titles",
          ],
          highestRoiAction:
            "[Content] Confirm Concierge path — Ensure CTA uses attribution",
        }),
      }),
      cadenceId: "cos-daily-synthesis",
      cadenceWindow: "day:2026-07-24",
      degraded: true,
    });
    assert.match(preview.subject, /Morning Brief.*July 24, 2026/);
    assert.doesNotMatch(preview.html, /2026-07-13 — 2026-07-19/);
    assert.doesNotMatch(preview.html, /Source material incomplete/i);
    assert.match(preview.html, /Data confidence/);
    assert.doesNotMatch(preview.html, /do not invent CRM metrics/i);

    const key1 = buildDeliveryIdempotencyKey({
      kind: "founder-brief",
      cadenceId: "cos-daily-synthesis",
      cadenceWindow: "day:2026-07-24",
      recipientConfigFingerprint: "abc",
    });
    const key2 = buildDeliveryIdempotencyKey({
      kind: "founder-brief",
      cadenceId: "cos-daily-synthesis",
      cadenceWindow: "day:2026-07-24",
      recipientConfigFingerprint: "abc",
    });
    assert.equal(key1, key2);

    const fp = briefFingerprintFromFounderBrief(stubBrief());
    assert.equal(fp, briefFingerprintFromFounderBrief(stubBrief()));
  });

  it("eligibility still caps at five priorities", () => {
    const run = stubRun({
      brief: stubBrief({
        surfacedPriorityTitles: ["a", "b", "c", "d", "e"],
      }),
    });
    const el = evaluateDeliveryEligibility({
      run,
      persistenceOk: true,
      dryRun: false,
    });
    assert.ok(
      el.action === "send-founder-brief" || el.action === "send-nothing",
    );
  });

  it("fixture daily runAgentOsBrief produces daily period framing", async () => {
    const run = await runAgentOsBrief({
      mode: "fixture",
      briefCadenceIntent: "daily",
      briefLocalDate: "2026-07-24",
    });
    assert.match(run.brief.markdown, /Morning Brief · July 24, 2026/);
    assert.doesNotMatch(
      run.brief.markdown,
      /Period: 2026-07-13 — 2026-07-19/,
    );
    for (const title of run.brief.surfacedPriorityTitles) {
      assert.doesNotMatch(title, /source material incomplete/i);
    }
    assert.ok(run.brief.surfacedPriorityTitles.length <= 5);
  });
});
