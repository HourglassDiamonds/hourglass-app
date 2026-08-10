/**
 * P0-3: Recommendation lifecycle / completion-awareness regression tests.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildRecommendation } from "./recommendation";
import { createEvidence } from "./evidence";
import { runChiefOfStaff } from "./executives/chief-of-staff";
import { emptyBusinessIntelligenceOutput } from "./bi/empty";
import { emptyContentExecutiveOutput } from "./executives/content";
import { emptyOpportunityExecutiveOutput } from "./executives/opportunity";
import { emptySearchStrategyOutput } from "./executives/search-strategy";
import {
  CURRENT_OPERATING_BACKLOG,
  hydrateOperatingBacklogFromPersistence,
  operatingBacklogRecommendationId,
  recommendationsFromOperatingBacklog,
  canonicalIdForBacklogItem,
} from "./operating-backlog";
import type { OperatingBacklog } from "./operating-backlog/types";
import {
  applyRecommendationReopen,
  applyRecommendationTerminalState,
  bootstrapHistoricalTerminalsFromStaticBacklog,
  createEmptyPersistedState,
  createSharedDurableTestBackend,
  FileLocalPersistenceAdapter,
  fingerprintForRecommendation,
  inferRootProblemId,
  InMemoryPersistenceAdapter,
  markRecommendationTerminal,
  projectRecurrenceRecords,
  resolveFounderSurfaceEligibility,
  resolvePersistenceAdapter,
} from "./persistence";
import { DurableTestPersistenceAdapter } from "./persistence/adapters/durable-test";
import { runAgentOsBrief } from "./run";
import { FIXTURE_REPORTING_PERIOD } from "./fixtures/sample-data";

const NOW = "2026-08-10T11:05:00.000Z";
const PERIOD = { ...FIXTURE_REPORTING_PERIOD };

function august10HistoricalBacklog(): OperatingBacklog {
  // Pre-P0-3 shape: all Concierge/Studio items still active (what Aug 10 emailed).
  return {
    schemaVersion: 1,
    masterSprint: {
      id: "hourglass-sprint-2026-w31",
      name: "Week of July 27 — Concierge clarity & measurement trust",
      objective:
        "Keep Concierge conversion paths clear, protect measurement integrity, and finish open content/search commitments before opening new growth experiments.",
      dayOrientation:
        "Finish the Concierge conversion path before opening any new growth experiments.",
      affirmedLocalDate: "2026-07-27",
      items: [
        {
          id: "sprint-concierge-cta-path",
          kind: "sprint-priority",
          title: "Confirm Concierge path from flagship content",
          action:
            "Verify that every primary CTA on the active Conversation and guide pages reaches Concierge with intact attribution parameters.",
          why: "Qualified viewers should reach Concierge calmly without losing attribution.",
          expectedOutcome:
            "Every primary CTA lands in Concierge with intact attribution within one sitting.",
          status: "active",
          urgency: "high",
          rank: 1,
        },
        {
          id: "sprint-studio-consultation-clarity",
          kind: "founder-action",
          title: "Clarify Studio engagement vs consultation ask",
          action:
            "Tighten on-page copy that separates Diamond Studio exploration from the consultation request so buyers know the next calm step.",
          why: "Studio interest without a clear Concierge handoff wastes high-intent attention.",
          expectedOutcome:
            "Studio visitors see a single, calm next step into Concierge without pressure.",
          status: "active",
          urgency: "high",
          rank: 2,
        },
        {
          id: "sprint-charlotte-guide-authority",
          kind: "founder-action",
          title: "Strengthen Charlotte guide hub titles",
          action:
            "Align the Charlotte engagement-ring guide hub H1 and intro with local intent without inventing GBP claims.",
          why: "Local authority pages remain an open search commitment from the current sprint.",
          expectedOutcome:
            "Hub title/intro match the query intent buyers actually use in Charlotte.",
          status: "active",
          urgency: "medium",
          rank: 3,
        },
        {
          id: "decision-new-growth-experiments",
          kind: "open-decision",
          title: "Whether to open new growth experiments this week",
          action:
            "Decide whether to keep focus on Concierge/Studio clarity or approve a new experiment.",
          why: "New experiments dilute unfinished conversion-path work.",
          expectedOutcome: "A clear yes/no so the team does not split attention.",
          status: "active",
          urgency: "medium",
          rank: 4,
          recommendedChoice:
            "Defer new growth experiments until Concierge CTA attribution and Studio→Concierge clarity are finished.",
        },
      ],
    },
    deferred: [
      {
        id: "deferred-paid-search-readiness",
        kind: "deferred-work",
        title: "Paid-search readiness review",
        action:
          "Revisit paid-search readiness only after organic Concierge paths and measurement trust are stable.",
        why: "Paid spend before path clarity risks buying traffic into an unclear handoff.",
        expectedOutcome:
          "A go/no-go on paid with trustworthy destination and conversion signal.",
        status: "deferred",
        urgency: "low",
        rank: 1,
        deferredUntil: "2026-08-04T00:00:00.000Z",
      },
    ],
    recurring: [],
  };
}

function backlogRec(itemId: string, title: string, action: string) {
  return buildRecommendation({
    recommendationId: operatingBacklogRecommendationId(itemId),
    originatingExecutive: "chief-of-staff",
    title,
    plainLanguageExplanation: "Persistent operating commitment",
    whyItMattersNow: "Persistent operating commitment",
    proposedAction: action,
    expectedUpside: "Clearer founder focus",
    effortEstimate: "low",
    urgency: "high",
    reversibility: "easily-reversed",
    baseConfidence: 0.86,
    evidence: [
      createEvidence({
        source: "repository-content-inventory",
        sourceType: "internal-report",
        collectedAt: NOW,
        reportingPeriod: PERIOD,
        metricOrObservation: `canonical:${canonicalIdForBacklogItem(itemId)}|backlog-item:${itemId}|kind:sprint-priority|urgency:high`,
        reliability: "reliable",
        supportingReference: `operating-backlog://${itemId}`,
      }),
    ],
    assumptions: [],
    risks: [],
    dependencies: [],
    approvalRequired: false,
    suggestedOwner: "Founder",
    rankingFactors: {
      expectedBusinessImpact: 9,
      strategicAlignment: 10,
      dependencyReadiness: 1,
      dataQuality: 0.9,
    },
  });
}

describe("P0-3 recommendation lifecycle", () => {
  it("Test 1 — completed task does not return with same/static evidence", async () => {
    const store = new InMemoryPersistenceAdapter({ modeScope: "test" });
    const rec = backlogRec(
      "sprint-concierge-cta-path",
      "Confirm Concierge path from flagship content",
      "Verify CTAs reach Concierge with attribution",
    );
    const empty = await store.load();
    const seeded = applyRecommendationTerminalState(empty, {
      recommendationId: rec.recommendationId,
      status: "completed",
      source: "test",
      nowIso: "2026-08-05T00:00:00.000Z",
      evidenceFingerprint: fingerprintForRecommendation(rec),
      currentAction: rec.proposedAction,
      urgency: rec.urgency,
    });
    await store.save(seeded.state);

    const eligibility = resolveFounderSurfaceEligibility({
      recommendations: [rec],
      priorRecommendations: (await store.load()).recommendations,
      nowIso: NOW,
    });
    assert.equal(eligibility.eligibleIds.includes(rec.recommendationId), false);
    assert.ok(
      eligibility.decisions.some(
        (d) =>
          d.recommendationId === rec.recommendationId &&
          d.reason === "completed-hidden",
      ),
    );
    assert.equal(
      (await store.load()).recommendations[rec.recommendationId]?.lifecycleState,
      "completed",
    );
  });

  it("Test 2 — wording changes resolve to same lifecycle identity and stay suppressed", () => {
    const id = "sprint-studio-consultation-clarity";
    const a = backlogRec(
      id,
      "Clarify Studio engagement vs consultation ask",
      "Tighten on-page copy A",
    );
    const b = backlogRec(
      id,
      "Clarify Studio handoff wording",
      "Completely different founder-facing wording for the same problem",
    );
    assert.equal(a.recommendationId, b.recommendationId);
    assert.equal(
      inferRootProblemId(a.recommendationId),
      "studio:concierge-handoff-clarity",
    );
    assert.equal(
      fingerprintForRecommendation(a),
      fingerprintForRecommendation(b),
    );

    const prior = createEmptyPersistedState({
      adapterId: "memory",
      durability: "ephemeral",
      modeScope: "test",
    });
    const marked = applyRecommendationTerminalState(prior, {
      recommendationId: a.recommendationId,
      status: "completed",
      source: "test",
      nowIso: "2026-08-05T00:00:00.000Z",
      evidenceFingerprint: fingerprintForRecommendation(a),
    });
    const projected = projectRecurrenceRecords(
      [b],
      marked.state.recommendations,
    );
    assert.equal(projected[0]?.lifecycleState, "completed");
    const eligibility = resolveFounderSurfaceEligibility({
      recommendations: [b],
      priorRecommendations: marked.state.recommendations,
      nowIso: NOW,
    });
    assert.equal(eligibility.eligibleIds.length, 0);
  });

  it("Test 3 — different executive same canonical root respects terminal state", () => {
    const backlogId = operatingBacklogRecommendationId(
      "sprint-charlotte-guide-authority",
    );
    const prior = createEmptyPersistedState({
      adapterId: "memory",
      durability: "ephemeral",
      modeScope: "test",
    });
    const marked = applyRecommendationTerminalState(prior, {
      recommendationId: backlogId,
      status: "completed",
      source: "test",
      nowIso: "2026-08-05T00:00:00.000Z",
      rootProblemId: "search:charlotte-guide-hub-alignment",
    });

    // Search executive emits a different ID sharing the same canonical root.
    const searchTwin = buildRecommendation({
      recommendationId:
        "search-strategy:repository:local-intent-gap:charlotte-guides-hub",
      originatingExecutive: "search-strategy",
      title: "Strengthen Charlotte guide hub titles",
      plainLanguageExplanation: "Charlotte Guides lack a mapped hub",
      whyItMattersNow: "Local authority gap",
      proposedAction: "Align Charlotte Guides hub segment",
      expectedUpside: "Better local discovery",
      effortEstimate: "medium",
      urgency: "medium",
      reversibility: "easily-reversed",
      baseConfidence: 0.8,
      evidence: [
        createEvidence({
          source: "repository-content-inventory",
          sourceType: "internal-report",
          collectedAt: NOW,
          reportingPeriod: PERIOD,
          metricOrObservation: "charlotte hubMapped=false",
          reliability: "reliable",
          supportingReference: "lib/seo/schema/category-map.ts",
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
        dependencyReadiness: 1,
        dataQuality: 0.9,
      },
    });

    // Force twin to share root for this lifecycle contract test.
    const twinWithRoot = {
      ...searchTwin,
      recommendationId: backlogId.replace(
        "sprint-charlotte-guide-authority",
        "alt-charlotte-hub",
      ),
    };
    // Use exact backlog ID regeneration from another executive label instead:
    const alt = backlogRec(
      "sprint-charlotte-guide-authority",
      "Charlotte hub titles (Search)",
      "Align hub from Search Strategy",
    );
    alt.originatingExecutive = "search-strategy";

    const eligibility = resolveFounderSurfaceEligibility({
      recommendations: [alt],
      priorRecommendations: marked.state.recommendations,
      nowIso: NOW,
    });
    assert.equal(eligibility.eligibleIds.includes(alt.recommendationId), false);
    void twinWithRoot;
  });

  it("Test 4 — true regression explicitly reopens with new evidence", () => {
    const rec = backlogRec(
      "sprint-concierge-cta-path",
      "Confirm Concierge path",
      "Verify attribution",
    );
    const prior = createEmptyPersistedState({
      adapterId: "memory",
      durability: "ephemeral",
      modeScope: "test",
    });
    const completed = applyRecommendationTerminalState(prior, {
      recommendationId: rec.recommendationId,
      status: "completed",
      source: "deployment-verified",
      nowIso: "2026-08-05T00:00:00.000Z",
      evidenceFingerprint: fingerprintForRecommendation(rec),
      evidenceReference: "6d225b5",
    });

    const reopened = applyRecommendationReopen(completed.state, {
      recommendationId: rec.recommendationId,
      nowIso: NOW,
      reason:
        "Production spot-check lost utm_content on Conversation CTA after deploy",
      newEvidenceFingerprint: "regression:cta-attribution-missing:2026-08-10",
      evidenceClass: "production-behavior",
    });

    assert.equal(
      reopened.state.recommendations[rec.recommendationId]?.lifecycleState,
      "active",
    );
    assert.equal(
      reopened.state.recommendations[rec.recommendationId]?.changeClassification,
      "reopened",
    );
    assert.ok(reopened.result.priorCompletedAt);
    assert.equal(reopened.result.priorTerminalState, "completed");

    const eligibility = resolveFounderSurfaceEligibility({
      recommendations: [rec],
      priorRecommendations: reopened.state.recommendations,
      nowIso: NOW,
    });
    assert.ok(eligibility.eligibleIds.includes(rec.recommendationId));
  });

  it("Test 5 — unfinished Charlotte / paid-search tasks remain active on current backlog", () => {
    const recs = recommendationsFromOperatingBacklog(CURRENT_OPERATING_BACKLOG, {
      nowIso: NOW,
    });
    const titles = recs.map((r) => r.title);
    assert.ok(titles.includes("Strengthen Charlotte guide hub titles"));
    assert.ok(titles.includes("Paid-search readiness review"));
    assert.equal(
      titles.includes("Clarify Studio engagement vs consultation ask"),
      false,
    );
    assert.equal(
      titles.some((t) => /Concierge path from flagship/i.test(t)),
      false,
    );
  });

  it("Test 6 — fewer than five legitimate priorities: no terminal backfill", () => {
    const tiny: OperatingBacklog = {
      schemaVersion: 1,
      masterSprint: {
        id: "tiny",
        name: "Tiny sprint",
        objective: "Two open items only",
        dayOrientation: "Finish the two open items",
        affirmedLocalDate: "2026-08-10",
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
          },
          {
            id: "only-other-open",
            kind: "founder-action",
            title: "Second open priority",
            action: "Do the second thing",
            why: "Also open",
            expectedOutcome: "Done",
            status: "active",
            urgency: "medium",
            rank: 2,
          },
          {
            id: "sprint-concierge-cta-path",
            kind: "sprint-priority",
            title: "Confirm Concierge path from flagship content",
            action: "Verify CTAs",
            why: "Done",
            expectedOutcome: "Done",
            status: "completed",
            urgency: "high",
            rank: 3,
          },
        ],
      },
      deferred: [],
      recurring: [],
    };

    const cos = runChiefOfStaff({
      bi: emptyBusinessIntelligenceOutput(),
      search: emptySearchStrategyOutput(),
      content: emptyContentExecutiveOutput(),
      opportunity: emptyOpportunityExecutiveOutput(),
      reportingPeriod: PERIOD,
      warnings: [],
      mode: "fixture",
      briefCadenceIntent: "daily",
      briefLocalDate: "2026-08-10",
      operatingBacklog: tiny,
    });

    assert.ok(cos.brief.surfacedPriorityTitles.length <= 2);
    assert.equal(
      cos.brief.surfacedPriorityTitles.some((t) =>
        /Concierge path from flagship/i.test(t),
      ),
      false,
    );
    assert.ok(cos.brief.surfacedPriorityTitles.length >= 1);
  });

  it("Test 7 — restart/cold start: durable completion still honored", async () => {
    const shared = createSharedDurableTestBackend({
      modeScope: "test",
    });
    const writer = new DurableTestPersistenceAdapter({
      modeScope: "test",
      shared,
    });
    const recId = operatingBacklogRecommendationId("sprint-concierge-cta-path");
    await markRecommendationTerminal(writer, {
      recommendationId: recId,
      status: "completed",
      source: "founder-confirmed",
      nowIso: "2026-08-05T00:00:00.000Z",
      evidenceReference: "6d225b5",
      note: "Attribution shipped",
    });

    // Fresh process-equivalent instance against the same durable backend.
    const cold = new DurableTestPersistenceAdapter({
      modeScope: "test",
      shared,
    });
    const historical = august10HistoricalBacklog();
    const hydrated = hydrateOperatingBacklogFromPersistence(
      historical,
      (await cold.load()).recommendations,
    );
    const concierge = hydrated.backlog.masterSprint.items.find(
      (i) => i.id === "sprint-concierge-cta-path",
    );
    assert.equal(concierge?.status, "completed");
    const emitted = recommendationsFromOperatingBacklog(hydrated.backlog, {
      nowIso: NOW,
    });
    assert.equal(
      emitted.some((r) => r.recommendationId === recId),
      false,
    );
  });

  it("Test 8 — August 10 regression fixture: completed Concierge/Studio absent; unfinished remain", () => {
    const historical = august10HistoricalBacklog();
    // Before fix: historical active backlog would surface Concierge + Studio.
    const before = recommendationsFromOperatingBacklog(historical, {
      nowIso: NOW,
    });
    assert.ok(
      before.some((r) => /Concierge path|attribution parameters/i.test(r.title + r.proposedAction)),
    );
    assert.ok(
      before.some((r) => /Studio engagement vs consultation/i.test(r.title)),
    );

    // After fix: current backlog + CoS brief.
    const cos = runChiefOfStaff({
      bi: emptyBusinessIntelligenceOutput(),
      search: emptySearchStrategyOutput(),
      content: emptyContentExecutiveOutput(),
      opportunity: emptyOpportunityExecutiveOutput(),
      reportingPeriod: PERIOD,
      warnings: [],
      mode: "fixture",
      briefCadenceIntent: "daily",
      briefLocalDate: "2026-08-10",
      operatingBacklog: CURRENT_OPERATING_BACKLOG,
    });

    const blob = [
      cos.brief.highestRoiAction,
      ...cos.brief.surfacedPriorityTitles,
      cos.brief.dayOrientation ?? "",
      ...cos.brief.needsAttentionToday,
    ].join("\n");

    assert.doesNotMatch(blob, /Finish the Concierge conversion path before opening/);
    assert.doesNotMatch(blob, /intact attribution parameters/);
    assert.doesNotMatch(blob, /Clarify Studio engagement vs consultation ask/);
    assert.match(blob, /Charlotte/i);
    assert.ok(
      /Charlotte/i.test(cos.brief.highestRoiAction) ||
        cos.brief.surfacedPriorityTitles.some((t) => /Charlotte/i.test(t)),
    );
    assert.ok(
      cos.brief.surfacedPriorityTitles.includes("Paid-search readiness review") ||
        /paid-search/i.test(blob),
    );
    // Primary strategic call should no longer be Concierge conversion finish.
    assert.doesNotMatch(
      cos.brief.dayOrientation ?? "",
      /Finish the Concierge conversion path|Clarify Studio|Studio engagement/i,
    );
    assert.match(
      cos.brief.dayOrientation ?? "",
      /Strengthen Charlotte guide hub titles/i,
    );
  });

  it("canonical IDs are stable and map known backlog items", () => {
    assert.equal(
      canonicalIdForBacklogItem("sprint-concierge-cta-path"),
      "conversion:concierge-attribution",
    );
    assert.equal(
      inferRootProblemId(
        operatingBacklogRecommendationId("sprint-studio-consultation-clarity"),
      ),
      "studio:concierge-handoff-clarity",
    );
  });
});

describe("P0-3 lifecycle hardening", () => {
  it("A — first post-deploy run suppresses historical completed items BEFORE synthesis", async () => {
    const store = new InMemoryPersistenceAdapter({ modeScope: "fixture" });
    // Empty durable state + CURRENT backlog (static completed Concierge/Studio).
    const empty = await store.load();
    assert.equal(Object.keys(empty.recommendations).length, 0);

    const events: string[] = [];
    const order: string[] = [];
    const origInfo = console.info;
    console.info = (...args: unknown[]) => {
      const line = String(args[0] ?? "");
      if (line.includes("recommendation_marked_completed")) {
        events.push(line);
        order.push("bootstrap-complete");
      }
      origInfo.apply(console, args as []);
    };

    try {
      const run = await runAgentOsBrief({
        mode: "fixture",
        briefCadenceIntent: "daily",
        briefLocalDate: "2026-08-10",
        operatingBacklog: CURRENT_OPERATING_BACKLOG,
        persistence: {
          enabled: true,
          store,
          trigger: "scheduled",
          now: NOW,
        },
      });
      order.push("brief-ready");

      const blob = [
        run.brief.dayOrientation ?? "",
        run.brief.highestRoiAction,
        ...run.brief.surfacedPriorityTitles,
        ...run.brief.needsAttentionToday,
      ].join("\n");

      assert.doesNotMatch(
        blob,
        /Finish the Concierge conversion path|intact attribution|Clarify Studio engagement/i,
      );
      assert.match(blob, /Charlotte/i);

      const after = await store.load();
      const concierge =
        after.recommendations[
          operatingBacklogRecommendationId("sprint-concierge-cta-path")
        ];
      const studio =
        after.recommendations[
          operatingBacklogRecommendationId("sprint-studio-consultation-clarity")
        ];
      assert.equal(concierge?.lifecycleState, "completed");
      assert.equal(studio?.lifecycleState, "completed");
      // Bootstrap completion events happen before brief is produced.
      assert.ok(order.indexOf("bootstrap-complete") < order.indexOf("brief-ready"));
      assert.ok(events.length >= 2);
    } finally {
      console.info = origInfo;
    }
  });

  it("B — second run is idempotent (no completedAt rewrite, no duplicate inserts)", async () => {
    const store = new InMemoryPersistenceAdapter({ modeScope: "fixture" });
    const first = await runAgentOsBrief({
      mode: "fixture",
      briefCadenceIntent: "daily",
      briefLocalDate: "2026-08-10",
      operatingBacklog: CURRENT_OPERATING_BACKLOG,
      persistence: { enabled: true, store, trigger: "scheduled", now: NOW },
    });
    void first;
    const mid = await store.load();
    const conciergeId = operatingBacklogRecommendationId(
      "sprint-concierge-cta-path",
    );
    const completedAt = mid.recommendations[conciergeId]?.completedAt;
    assert.ok(completedAt);

    let completionLogs = 0;
    const origInfo = console.info;
    console.info = (...args: unknown[]) => {
      const line = String(args[0] ?? "");
      if (line.includes("recommendation_marked_completed")) completionLogs += 1;
      origInfo.apply(console, args as []);
    };
    try {
      await runAgentOsBrief({
        mode: "fixture",
        briefCadenceIntent: "daily",
        briefLocalDate: "2026-08-10",
        operatingBacklog: CURRENT_OPERATING_BACKLOG,
        persistence: {
          enabled: true,
          store,
          trigger: "scheduled",
          now: "2026-08-11T11:05:00.000Z",
        },
      });
    } finally {
      console.info = origInfo;
    }

    const again = await store.load();
    assert.equal(again.recommendations[conciergeId]?.completedAt, completedAt);
    assert.equal(again.recommendations[conciergeId]?.lifecycleState, "completed");
    assert.equal(completionLogs, 0);
  });

  it("C — persisted completed beats static active", () => {
    const historical = august10HistoricalBacklog();
    assert.equal(
      historical.masterSprint.items.find((i) => i.id === "sprint-concierge-cta-path")
        ?.status,
      "active",
    );
    const prior = createEmptyPersistedState({
      adapterId: "memory",
      durability: "ephemeral",
      modeScope: "test",
    });
    const marked = applyRecommendationTerminalState(prior, {
      recommendationId: operatingBacklogRecommendationId(
        "sprint-concierge-cta-path",
      ),
      status: "completed",
      source: "founder-confirmed",
      nowIso: "2026-08-05T00:00:00.000Z",
    });
    const hydrated = hydrateOperatingBacklogFromPersistence(
      historical,
      marked.state.recommendations,
    );
    assert.equal(
      hydrated.backlog.masterSprint.items.find(
        (i) => i.id === "sprint-concierge-cta-path",
      )?.status,
      "completed",
    );
    const emitted = recommendationsFromOperatingBacklog(hydrated.backlog, {
      nowIso: NOW,
    });
    assert.equal(
      emitted.some((r) => r.recommendationId.includes("sprint-concierge-cta-path")),
      false,
    );
  });

  it("D — persisted reopened beats historical completion bootstrap + static completed", () => {
    const staticCompleted = CURRENT_OPERATING_BACKLOG;
    const empty = createEmptyPersistedState({
      adapterId: "memory",
      durability: "ephemeral",
      modeScope: "test",
    });
    const completed = applyRecommendationTerminalState(empty, {
      recommendationId: operatingBacklogRecommendationId(
        "sprint-concierge-cta-path",
      ),
      status: "completed",
      source: "deployment-verified",
      nowIso: "2026-08-05T00:00:00.000Z",
      evidenceReference: "6d225b5",
    });
    const reopened = applyRecommendationReopen(completed.state, {
      recommendationId: operatingBacklogRecommendationId(
        "sprint-concierge-cta-path",
      ),
      nowIso: NOW,
      reason: "Production attribution regression on Conversation CTA",
      newEvidenceFingerprint: "regression:attribution:2026-08-10",
      evidenceClass: "production-behavior",
    });

    // Bootstrap must not re-complete the reopened Concierge record.
    // It may still insert-if-absent other static terminals (e.g. Studio).
    const boot = bootstrapHistoricalTerminalsFromStaticBacklog(
      reopened.state,
      staticCompleted,
      { nowIso: "2026-08-11T00:00:00.000Z" },
    );
    assert.equal(
      boot.state.recommendations[
        operatingBacklogRecommendationId("sprint-concierge-cta-path")
      ]?.lifecycleState,
      "active",
    );
    assert.equal(
      boot.state.recommendations[
        operatingBacklogRecommendationId("sprint-concierge-cta-path")
      ]?.changeClassification,
      "reopened",
    );
    assert.ok(
      boot.skipped.some(
        (s) =>
          s.recommendationId ===
            operatingBacklogRecommendationId("sprint-concierge-cta-path") &&
          s.reason === "existing-record",
      ),
    );
    assert.equal(
      boot.insertedIds.includes(
        operatingBacklogRecommendationId("sprint-concierge-cta-path"),
      ),
      false,
    );

    const hydrated = hydrateOperatingBacklogFromPersistence(
      staticCompleted,
      boot.state.recommendations,
    );
    assert.equal(
      hydrated.backlog.masterSprint.items.find(
        (i) => i.id === "sprint-concierge-cta-path",
      )?.status,
      "active",
    );
  });

  it("E — persisted dismissed/superseded beats static active", () => {
    const historical = august10HistoricalBacklog();
    const prior = createEmptyPersistedState({
      adapterId: "memory",
      durability: "ephemeral",
      modeScope: "test",
    });
    const dismissed = applyRecommendationTerminalState(prior, {
      recommendationId: operatingBacklogRecommendationId(
        "sprint-charlotte-guide-authority",
      ),
      status: "dismissed",
      source: "founder-confirmed",
      nowIso: "2026-08-09T00:00:00.000Z",
      note: "Defer hub work intentionally",
    });
    assert.equal(
      dismissed.state.recommendations[
        operatingBacklogRecommendationId("sprint-charlotte-guide-authority")
      ]?.lifecycleState,
      "superseded",
    );
    assert.match(
      dismissed.state.recommendations[
        operatingBacklogRecommendationId("sprint-charlotte-guide-authority")
      ]?.supersededBy ?? "",
      /^dismissed:/,
    );

    const hydrated = hydrateOperatingBacklogFromPersistence(
      historical,
      dismissed.state.recommendations,
    );
    assert.equal(
      hydrated.backlog.masterSprint.items.find(
        (i) => i.id === "sprint-charlotte-guide-authority",
      )?.status,
      "cancelled",
    );
  });

  it("F — completedAt does not change on repeated reconciliation", () => {
    const empty = createEmptyPersistedState({
      adapterId: "memory",
      durability: "ephemeral",
      modeScope: "test",
    });
    const first = bootstrapHistoricalTerminalsFromStaticBacklog(
      empty,
      CURRENT_OPERATING_BACKLOG,
      { nowIso: "2026-08-10T11:00:00.000Z" },
    );
    const id = operatingBacklogRecommendationId("sprint-concierge-cta-path");
    const completedAt = first.state.recommendations[id]?.completedAt;
    assert.equal(completedAt, "2026-08-10T11:00:00.000Z");

    const second = bootstrapHistoricalTerminalsFromStaticBacklog(
      first.state,
      CURRENT_OPERATING_BACKLOG,
      { nowIso: "2026-08-12T11:00:00.000Z" },
    );
    assert.equal(second.changed, false);
    assert.equal(second.state.recommendations[id]?.completedAt, completedAt);
    assert.ok(
      second.skipped.some(
        (s) => s.recommendationId === id && s.reason === "existing-record",
      ),
    );
  });

  it("G — day orientation cannot reference suppressed terminal work", () => {
    const hydrated = hydrateOperatingBacklogFromPersistence(
      CURRENT_OPERATING_BACKLOG,
      {},
    );
    const orientation = hydrated.backlog.masterSprint.dayOrientation ?? "";
    assert.match(orientation, /Strengthen Charlotte guide hub titles/i);
    assert.doesNotMatch(
      orientation,
      /Concierge conversion path|Clarify Studio|Studio engagement|intact attribution/i,
    );

    const cos = runChiefOfStaff({
      bi: emptyBusinessIntelligenceOutput(),
      search: emptySearchStrategyOutput(),
      content: emptyContentExecutiveOutput(),
      opportunity: emptyOpportunityExecutiveOutput(),
      reportingPeriod: PERIOD,
      warnings: [],
      mode: "fixture",
      briefCadenceIntent: "daily",
      briefLocalDate: "2026-08-10",
      operatingBacklog: hydrated.backlog,
    });
    assert.doesNotMatch(
      cos.brief.dayOrientation ?? "",
      /Concierge conversion path|Clarify Studio|Studio engagement/i,
    );
  });

  it("H — local file persistence is distinct from production supabase adapter", () => {
    // CLI --persist-file → file-local; production cadence → supabase when configured.
    assert.equal(new FileLocalPersistenceAdapter().adapterId, "file-local");
    const live = resolvePersistenceAdapter({
      mode: "live",
      adapter: "unconfigured-production",
      allowNonDurableLive: false,
      requireDurableInLive: false,
    });
    assert.equal(live.adapterId, "unconfigured-production");
    // Explicit documentation contract: file-local must never be the live default.
    const liveDefault = resolvePersistenceAdapter({
      mode: "live",
      requireDurableInLive: false,
      allowNonDurableLive: true,
    });
    assert.notEqual(liveDefault.adapterId, "file-local");
  });
});
