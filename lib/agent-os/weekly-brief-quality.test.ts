/**
 * Weekly Chief of Staff founder brief — date range, diagnostics hygiene,
 * ROI completeness, section uniqueness, and daily-path non-regression.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  cleanFounderFacingAction,
  composeHighestRoiAction,
  dedupePrioritiesAgainstHighestRoi,
  filterGenuineFounderDecisions,
  formatWeeklyFounderRangeLabel,
  isGenuineFounderDecision,
  isWeakAnalyticalObservation,
  isoWeekKeyToDateRange,
  summarizeFounderAction,
  toFounderFacingBlocker,
  toFounderFacingPriorityAction,
  weeklyLowConfidenceHighestRoi,
  weeklyRangeFromCadenceWindow,
} from "./brief-quality";
import { renderFounderBriefEmail } from "./cadence-delivery/render-email";
import { buildRecommendation } from "./recommendation";
import { createEvidence } from "./evidence";
import { FIXTURE_REPORTING_PERIOD } from "./fixtures/sample-data";
import type { AgentRun, FounderBrief, Recommendation } from "./types";
import { runChiefOfStaff } from "./executives/chief-of-staff";
import { emptyBusinessIntelligenceOutput } from "./bi/empty";
import { emptyContentExecutiveOutput } from "./executives/content";
import { emptyOpportunityExecutiveOutput } from "./executives/opportunity";
import { emptySearchStrategyOutput } from "./executives/search-strategy";

const PERIOD = { ...FIXTURE_REPORTING_PERIOD };

function evidenceFor(topic: string) {
  return [
    createEvidence({
      source: "repository-content-inventory",
      sourceType: "internal-report",
      collectedAt: "2026-07-25T14:00:00.000Z",
      reportingPeriod: PERIOD,
      metricOrObservation: `content-gap: ${topic}`,
      reliability: "reliable",
      supportingReference: `repo://${topic}`,
    }),
  ];
}

function stubBrief(over: Partial<FounderBrief> = {}): FounderBrief {
  return {
    whatChanged: "Publishing continued; verified traffic signal remained thin.",
    whyItMatters:
      "Qualified viewers should reach Concierge calmly without inventing urgency from incomplete analytics.",
    needsAttentionToday: ["See highest-ROI action below"],
    highestRoiAction:
      "[Content] Broad theme concentration in “why-we’re-here” source material rather than treating one long-form item as proof of strategic coverage across the full buyer journey from education through Concierge handoff",
    canSafelyWait: ["None"],
    blocked: [
      "Missing dependencies: Blocks opportunity until measurement prerequisite closes",
      "None",
    ],
    founderDecisionNeeded: [
      "Whether to spend founder time on the highest-ROI action above before new experiments",
    ],
    missingOrUnreliableData: [
      "GA4 retrieval failed",
      "Search Console retrieval failed",
      "HubSpot aggregates unavailable",
    ],
    markdown: "# stub",
    surfacedPriorityTitles: [
      "[Content] Broad theme concentration in “why-we’re-here” source material",
      "[Search] Strengthen Charlotte guide hub titles",
    ],
    ...over,
  };
}

function stubRun(over: Partial<AgentRun> = {}): AgentRun {
  const brief = { ...stubBrief(), ...(over.brief ?? {}) };
  return {
    runId: "run-weekly-quality-test-uuid-do-not-show",
    generatedAt: "2026-07-25T14:10:00.000Z",
    mode: "live",
    reportingPeriod: { start: "2026-07-13", end: "2026-07-19" },
    executivesInvoked: [
      "chief-of-staff",
      "business-intelligence",
      "search-strategy",
      "content",
      "opportunity",
    ],
    executivesNotOperational: [],
    sourcesAttempted: ["ga4", "gsc"],
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
        materialRecommendationCount: 0,
      },
      {
        executiveId: "search-strategy",
        status: "completed-with-warnings",
        materialRecommendationCount: 1,
      },
      {
        executiveId: "content",
        status: "completed",
        materialRecommendationCount: 2,
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
      opportunitiesDetected: 3,
      recommendationsRanked: 3,
      recommendationsSurfacedInBrief: 2,
    },
    durationMs: 10,
    warnings: [],
    agentOsVersion: "1.0.0",
    ...over,
    brief: over.brief ? { ...stubBrief(), ...over.brief } : brief,
  };
}

describe("ISO week date range (founder-facing)", () => {
  it("maps 2026-W29 to Jul 13–19", () => {
    assert.deepEqual(isoWeekKeyToDateRange("2026-W29"), {
      start: "2026-07-13",
      end: "2026-07-19",
    });
  });

  it("maps 2026-W30 to Jul 20–26", () => {
    assert.deepEqual(isoWeekKeyToDateRange("2026-W30"), {
      start: "2026-07-20",
      end: "2026-07-26",
    });
  });

  it("handles a week crossing a month boundary", () => {
    // 2026-W05: Mon Jan 26 – Sun Feb 1
    const range = isoWeekKeyToDateRange("2026-W05");
    assert.equal(range.start, "2026-01-26");
    assert.equal(range.end, "2026-02-01");
    assert.match(
      formatWeeklyFounderRangeLabel(range.start, range.end),
      /January 26 – February 1, 2026/,
    );
  });

  it("handles ISO week/year boundary (week belonging to prior calendar year)", () => {
    // 2026-W01 starts Mon Dec 29, 2025
    const range = isoWeekKeyToDateRange("2026-W01");
    assert.equal(range.start, "2025-12-29");
    assert.equal(range.end, "2026-01-04");
    assert.match(
      formatWeeklyFounderRangeLabel(range.start, range.end),
      /December 29, 2025 – January 4, 2026/,
    );
  });

  it("derives range from week:YYYY-Www cadence window, ignoring stale reportingPeriod", () => {
    const range = weeklyRangeFromCadenceWindow("week:2026-W30", {
      start: "2026-07-13",
      end: "2026-07-19",
    });
    assert.deepEqual(range, { start: "2026-07-20", end: "2026-07-26" });
  });
});

describe("weekly founder email quality", () => {
  it("uses founder-facing subject and ISO-correct range for W30", () => {
    const rendered = renderFounderBriefEmail({
      run: stubRun(),
      cadenceId: "cos-weekly-founder-brief",
      cadenceWindow: "week:2026-W30",
      degraded: true,
    });
    assert.equal(
      rendered.subject,
      "Hourglass Weekly Brief · Partial data · July 20–26, 2026",
    );
    assert.match(rendered.html, /July 20–26, 2026/);
    assert.match(rendered.text, /2026-07-20 — 2026-07-26/);
    assert.doesNotMatch(rendered.html, /2026-07-13/);
    assert.doesNotMatch(rendered.text, /2026-07-13 — 2026-07-19/);
  });

  it("suppresses internal diagnostics from weekly HTML and text", () => {
    const rendered = renderFounderBriefEmail({
      run: stubRun({
        brief: stubBrief({
          missingOrUnreliableData: [
            "GA4 retrieval failed",
            "Search Console retrieval failed",
            "HubSpot aggregates unavailable",
            "Buffer/social unavailable",
            "GBP unavailable",
            "No verified HubSpot aggregate weekly read adapter in Agent OS V1",
          ],
          highestRoiAction:
            "Compare Studio session_engaged and consultation_cta_clicked rates; inspect CTA visibility on mobile.",
        }),
      }),
      cadenceId: "cos-weekly-founder-brief",
      cadenceWindow: "week:2026-W30",
      degraded: true,
    });
    const banned = [
      /cos-weekly-founder-brief/,
      /week:2026-W30/,
      /Source gaps/,
      /Degraded areas/,
      /completed-with-warnings/,
      /run-weekly-quality-test-uuid/,
      /Agent OS 1\.0\.0/,
      /Not for external distribution/,
      /GA4 retrieval failed/,
      /Search Console retrieval failed/,
      /HubSpot aggregates unavailable/,
      /Missing dependencies/,
      /measurement prerequisite/,
      /\bHubSpot\b/,
      /\bBuffer\b/,
      /\bGBP\b/,
      /Google Business Profile/,
      /\bGA4\b/,
      /\bGSC\b/,
      /Search Console retrieval/,
      /connector/i,
      /adapter/i,
      /unavailable in Agent OS/i,
      /Buffer\/social unavailable/,
      /HubSpot unavailable/,
      /GBP unavailable/,
      /session_engaged/,
      /consultation_cta_clicked/,
      /studio_session_engaged/,
      /diamond_studio_view/,
    ];
    for (const re of banned) {
      assert.doesNotMatch(rendered.html, re, `html matched ${re}`);
      assert.doesNotMatch(rendered.text, re, `text matched ${re}`);
    }
    assert.match(rendered.html, /Data confidence/);
    assert.match(rendered.html, /Partial/);
    assert.match(
      rendered.text,
      /website and search|directional until broader conversion|Partial\./i,
    );
  });

  it("translates raw analytics event keys into plain business language", () => {
    const line = composeHighestRoiAction({
      title: "Investigate Studio engagement vs consultation CTA divergence",
      proposedAction:
        "Compare Studio session_engaged and consultation_cta_clicked rates; inspect CTA visibility on mobile.",
      intent: "weekly",
      plainLanguageExplanation:
        "Diamond Studio views rose while consultation CTA clicks fell.",
      expectedUpside:
        "Recover qualified consultation inquiries from existing Studio traffic without paid spend",
      whyItMattersNow:
        "If the CTA is under-firing, consultation intent is being lost despite healthy Studio use.",
    });
    assert.doesNotMatch(line, /session_engaged/);
    assert.doesNotMatch(line, /consultation_cta_clicked/);
    assert.doesNotMatch(line, /\b[a-z]+_[a-z0-9_]+\b/);
    assert.match(line, /Studio|consultation|CTA|mobile|inquir/i);

    const rendered = renderFounderBriefEmail({
      run: stubRun({
        brief: stubBrief({
          highestRoiAction: line,
          missingOrUnreliableData: [
            "HubSpot aggregates unavailable",
            "Buffer/social unavailable",
            "GBP unavailable",
          ],
        }),
      }),
      cadenceId: "cos-weekly-founder-brief",
      cadenceWindow: "week:2026-W30",
      degraded: true,
    });
    assert.doesNotMatch(
      rendered.text,
      /session_engaged|consultation_cta_clicked|\b[a-z]+_[a-z0-9_]+\b/,
    );
    assert.doesNotMatch(rendered.html, /\bHubSpot\b|\bBuffer\b|\bGBP\b|\bGA4\b/);
    assert.match(
      rendered.text,
      /Recommendations are based primarily on website and search signals/i,
    );
  });

  it("uses decisive founder language — no raw routes, and/or, or taxonomy labels", () => {
    const roi = composeHighestRoiAction({
      title: "search-strategy:repository:tool-handoff-gap:diamond-guide-do-fancy-shape-diamonds-have-cut-grades",
      proposedAction:
        "Propose an editorial link from /diamond-guide/do-fancy-shape-diamonds-have-cut-grades to /diamond-studio and/or /diamond-shape-studio (Agent OS does not edit content).",
      intent: "weekly",
      whyItMattersNow:
        "Size/shape education should connect to visualization when readers are ready.",
      expectedUpside: "Move shape-intent readers toward a qualified consultation.",
    });
    assert.doesNotMatch(roi, /\/diamond-/);
    assert.doesNotMatch(roi, /and\/or/i);
    assert.doesNotMatch(roi, /^Propose\b/i);
    assert.match(roi, /Add a contextual link|See It On Your Hand|Diamond Studio/i);

    const priorities = [
      "content:repository:repurposing-gap:why-we-re-here:short-form-clip",
      "search-strategy:repository:local-intent-gap:charlotte-guides-hub",
      "content:repository:video-to-concierge-handoff:why-we-re-here",
      "content:bi:trust-building-content:studio-to-conversation",
    ].map((t) => toFounderFacingPriorityAction(t));
    for (const p of priorities) {
      assert.match(p, /^(Turn|Strengthen|Add|Use|Design|Finish|Prioritize|Review)\b/);
      assert.doesNotMatch(p, /Repurposing gap|Local intent gap|Video to Concierge handoff|Trust building content/i);
      assert.doesNotMatch(p, /\/[a-z]/);
      assert.doesNotMatch(p, /why-we-re-here|charlotte-guides-hub/);
    }

    const rendered = renderFounderBriefEmail({
      run: stubRun({
        brief: stubBrief({
          highestRoiAction: roi,
          whyItMatters:
            "This week produced useful content and search opportunities, but incomplete analytics mean the evidence does not yet support a major strategic change.",
          whatChanged:
            "A review of the website and content surfaced concrete opportunities to improve search visibility and guide more visitors toward a conversation, while incomplete performance data limited the strength of this week’s conclusions.",
          surfacedPriorityTitles: priorities,
        }),
      }),
      cadenceId: "cos-weekly-founder-brief",
      cadenceWindow: "week:2026-W30",
      degraded: true,
    });
    const banned = [
      /\/diamond-guide\//,
      /\/diamond-studio/,
      /\/diamond-shape-studio/,
      /\/concierge/,
      /and\/or/i,
      /week:2026-W30/,
      /reconstructed/i,
      /persisted/i,
      /delivery ledger/i,
      /fixture/i,
      /repository review/i,
      /\brepository\b/i,
      /Repurposing gap/i,
      /Local intent gap/i,
      /Trust building content/i,
    ];
    for (const re of banned) {
      assert.doesNotMatch(rendered.html, re, `html matched ${re}`);
      assert.doesNotMatch(rendered.text, re, `text matched ${re}`);
    }
    const exec = /Executive summary:\s*(.+)/i.exec(rendered.text)?.[1] ?? "";
    const action = /Highest-ROI action:\s*(.+)/i.exec(rendered.text)?.[1] ?? "";
    assert.ok(exec.length > 20);
    assert.ok(action.length > 20);
    assert.notEqual(exec.trim().toLowerCase(), action.trim().toLowerCase());
    assert.ok(
      !exec.toLowerCase().includes(action.toLowerCase().slice(0, 48)),
      "executive summary should not near-copy the highest-ROI action",
    );
  });

  it("sanitizes repository-review phrasing out of weekly what-changed", () => {
    const rendered = renderFounderBriefEmail({
      run: stubRun({
        brief: stubBrief({
          whatChanged:
            "Repository review surfaced concrete content and search handoff opportunities, while website and search analytics remained too incomplete for a major performance read.",
          whyItMatters:
            "This week produced useful content and search opportunities, but incomplete analytics mean the evidence does not yet support a major strategic change.",
        }),
      }),
      cadenceId: "cos-weekly-founder-brief",
      cadenceWindow: "week:2026-W30",
      degraded: false,
    });
    assert.doesNotMatch(rendered.text, /repository review/i);
    assert.doesNotMatch(rendered.html, /repository review/i);
    assert.doesNotMatch(rendered.text, /\brepository\b/i);
    assert.match(
      rendered.text,
      /review of the website and content|website and content/i,
    );
  });

  it("keeps replay methodology out of founder-facing what-changed", () => {
    const rendered = renderFounderBriefEmail({
      run: stubRun({
        brief: stubBrief({
          whatChanged:
            "Reconstructed from the Jul 25 persisted live recommendations for week:2026-W30. The original email narrative body was not stored in the delivery ledger.",
          whyItMatters:
            "This week produced useful content and search opportunities, but the evidence does not yet support a major strategic change.",
        }),
      }),
      cadenceId: "cos-weekly-founder-brief",
      cadenceWindow: "week:2026-W30",
      degraded: false,
    });
    assert.doesNotMatch(rendered.text, /reconstructed|persisted|delivery ledger|week:2026-W30|fixture/i);
    assert.doesNotMatch(rendered.html, /reconstructed|persisted|delivery ledger|week:2026-W30|fixture/i);
    assert.doesNotMatch(rendered.html, /What changed this week/);
  });

  it("renders Why it matters / Executive summary at most once", () => {
    const rendered = renderFounderBriefEmail({
      run: stubRun(),
      cadenceId: "cos-weekly-founder-brief",
      cadenceWindow: "week:2026-W30",
      degraded: false,
    });
    const whyCount = (rendered.html.match(/Why it matters/gi) || []).length;
    const execCount = (rendered.html.match(/Executive summary/gi) || []).length;
    assert.equal(whyCount, 0);
    assert.equal(execCount, 1);
    const major = [
      "Executive summary",
      "What changed this week",
      "Highest-ROI action",
      "Priorities for the coming week",
      "Data confidence",
    ];
    for (const heading of major) {
      const count = (rendered.html.match(new RegExp(heading, "gi")) || [])
        .length;
      assert.equal(count, 1, `heading "${heading}" appeared ${count} times`);
    }
  });

  it("does not character-truncate highest-ROI with an ellipsis", () => {
    const long =
      "Confirm Concierge path from Why We’re Here so each long-form asset hands the buyer to a calm next step rather than treating one published piece as proof of full-funnel coverage across education, consideration, and consultation.";
    const summarized = summarizeFounderAction(long, 160);
    assert.doesNotMatch(summarized, /…$/);
    assert.doesNotMatch(summarized, /\.\.\.$/);
    assert.ok(summarized.length <= 170);
    assert.match(summarized, /[.!?]$/);

    const rendered = renderFounderBriefEmail({
      run: stubRun({
        brief: stubBrief({
          highestRoiAction: `[Content] ${long}`,
        }),
      }),
      cadenceId: "cos-weekly-founder-brief",
      cadenceWindow: "week:2026-W30",
      degraded: false,
    });
    assert.doesNotMatch(rendered.html, /s…</);
    assert.doesNotMatch(rendered.html, /…<\/p>/);
    assert.doesNotMatch(rendered.text, /…$/m);
  });

  it("omits generic approval filler and engineering blockers", () => {
    assert.equal(
      isGenuineFounderDecision(
        "Whether to spend founder time on the highest-ROI action above before new experiments",
      ),
      false,
    );
    assert.equal(
      toFounderFacingBlocker(
        "Missing dependencies: Blocks opportunity until measurement prerequisite closes",
      ),
      null,
    );
    const rendered = renderFounderBriefEmail({
      run: stubRun(),
      cadenceId: "cos-weekly-founder-brief",
      cadenceWindow: "week:2026-W30",
      degraded: false,
    });
    assert.doesNotMatch(
      rendered.html,
      /Whether to spend founder time on the highest-ROI/,
    );
    assert.match(rendered.html, /No founder approvals required this week/);
    assert.doesNotMatch(rendered.html, /Missing dependencies/);
  });

  it("does not repeat the highest-ROI action under priorities", () => {
    const highest =
      "Confirm Concierge path from Why We’re Here — Ensure CTA uses attribution";
    const priorities = dedupePrioritiesAgainstHighestRoi(
      [
        "Confirm Concierge path from Why We’re Here",
        "Strengthen Charlotte guide hub titles",
      ],
      highest,
      5,
    );
    assert.deepEqual(priorities, ["Strengthen Charlotte guide hub titles"]);
  });
});

describe("weekly synthesis ranking quality", () => {
  it("treats theme-concentration inventory as a weak analytical observation", () => {
    const rec: Recommendation = buildRecommendation({
      recommendationId: "content:theme",
      originatingExecutive: "content",
      title:
        '[Content] Broad theme concentration in “why-we’re-here” source material',
      plainLanguageExplanation: "Theme inventory observation",
      whyItMattersNow: "Internal analytical signal only",
      proposedAction:
        "Do not treat one long-form item as proof of strategic coverage",
      expectedUpside: "Clearer inventory",
      effortEstimate: "low",
      urgency: "low",
      reversibility: "easily-reversed",
      baseConfidence: 0.4,
      evidence: evidenceFor("why-were-here"),
      assumptions: [],
      risks: [],
      dependencies: [],
      approvalRequired: false,
      suggestedOwner: "Founder",
      rankingFactors: {
        expectedBusinessImpact: 5,
        strategicAlignment: 5,
      },
    });
    assert.equal(isWeakAnalyticalObservation(rec), true);
  });

  it("surfaces an honest low-confidence weekly ROI when only weak signals exist", () => {
    const bi = emptyBusinessIntelligenceOutput();
    const out = runChiefOfStaff({
      bi,
      search: emptySearchStrategyOutput(),
      content: emptyContentExecutiveOutput(),
      opportunity: emptyOpportunityExecutiveOutput(),
      reportingPeriod: PERIOD,
      warnings: [],
      mode: "live",
      briefCadenceIntent: "weekly",
      briefEvidenceQuality: "partial-degraded",
    });
    assert.match(
      out.brief.highestRoiAction,
      /Evidence this week is too thin|Measurement coverage is too incomplete/i,
    );
    assert.doesNotMatch(out.brief.highestRoiAction, /…/);
    assert.doesNotMatch(out.brief.highestRoiAction, /confidence 0\./);
    assert.ok(
      filterGenuineFounderDecisions(out.brief.founderDecisionNeeded).length ===
        0 ||
        out.brief.founderDecisionNeeded.includes(
          "No founder approvals required this week.",
        ),
    );
  });

  it("composeHighestRoiAction never ends with an ellipsis", () => {
    const line = composeHighestRoiAction({
      title:
        "[Content] Broad theme concentration in why-we’re-here source material across the full buyer journey",
      proposedAction:
        "Rather than treating one long-form item as proof of strategic coverage, map each asset to a Concierge handoff and confirm the CTA path is consistent.",
      intent: "weekly",
    });
    assert.doesNotMatch(line, /…/);
    assert.ok(line.length > 40);
  });

  it("weeklyLowConfidenceHighestRoi is complete and non-urgent", () => {
    const line = weeklyLowConfidenceHighestRoi({
      briefEvidenceQuality: "partial-degraded",
    });
    assert.doesNotMatch(line, /…/);
    assert.match(line, /publishing cadence|performance data|direction/i);
  });
});

describe("daily path non-regression after weekly quality pass", () => {
  it("keeps Morning Brief subject and diagnostic suppression", () => {
    const rendered = renderFounderBriefEmail({
      run: stubRun({
        brief: stubBrief({
          highestRoiAction:
            "[Content] Confirm Concierge path — Ensure CTA uses attribution",
          surfacedPriorityTitles: [
            "Strengthen Charlotte guide hub titles",
          ],
        }),
      }),
      cadenceId: "cos-daily-synthesis",
      cadenceWindow: "day:2026-07-26",
      degraded: true,
    });
    assert.match(rendered.subject, /^Hourglass Morning Brief · /);
    assert.match(rendered.subject, /July 26, 2026/);
    assert.match(rendered.html, /Morning Brief/);
    assert.match(rendered.html, /Data confidence/);
    assert.doesNotMatch(rendered.html, /Source gaps/);
    assert.doesNotMatch(rendered.html, /Degraded areas/);
    assert.doesNotMatch(rendered.html, /completed-with-warnings/);
    assert.doesNotMatch(rendered.html, /run-weekly-quality-test-uuid/);
    assert.doesNotMatch(rendered.html, /Weekly Brief/);
  });

  it("still strips operator wording from actions", () => {
    assert.equal(
      cleanFounderFacingAction(
        "Ensure CTA uses attribution — do not invent CRM metrics.",
      ),
      "Ensure CTA uses attribution",
    );
  });
});
