import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  EXECUTIVE_REGISTRY,
  listExecutives,
  operationalExecutives,
  isExecutiveOperational,
  assertOperationalForRecommendations,
  assertScaffoldCannotRecommend,
  registerConnector,
  clearRegisteredConnectors,
  isActionProhibited,
  assertActionAllowed,
  getProhibitedActions,
  createEvidence,
  classifyFreshness,
  hasUsableEvidence,
  buildRecommendation,
  consolidateDuplicates,
  rankRecommendations,
  computePriorityScore,
  buildRankingFactors,
  validateDecisionJournalEntry,
  InMemoryDecisionJournal,
  redactSecretsAndPii,
  runAgentOsBrief,
  REQUIRED_BRIEF_QUESTIONS,
  runBusinessIntelligence,
  V1_PROHIBITED_ACTIONS,
  AGENT_RUN_STATUSES,
  resolveRunStatus,
  resolveRecommendationAvailability,
} from "./index";
import { loadAllSources } from "./adapters/load";
import { buildSourceHealth } from "./source-health";
import type { AgentOsDataBundle } from "./adapters/types";
import { createFixtureGa4Bundle, createFixtureGscBundle, createFixtureWeeklyReport, FIXTURE_REPORTING_PERIOD } from "./fixtures/sample-data";

describe("Agent OS registry", () => {
  it("contains exactly the five locked executives in order", () => {
    const ids = listExecutives().map((e) => e.id);
    assert.deepEqual(ids, [
      "chief-of-staff",
      "business-intelligence",
      "search-strategy",
      "content",
      "opportunity",
    ]);
    assert.equal(EXECUTIVE_REGISTRY.length, 5);
  });

  it("only Chief of Staff, BI, and Search Strategy are operational", () => {
    const ops = operationalExecutives().map((e) => e.id);
    assert.deepEqual(ops, [
      "chief-of-staff",
      "business-intelligence",
      "search-strategy",
    ]);
    assert.equal(isExecutiveOperational("search-strategy"), true);
    assert.equal(isExecutiveOperational("content"), false);
    assert.equal(isExecutiveOperational("opportunity"), false);
  });
});

describe("permissions", () => {
  it("enforces prohibited actions", () => {
    for (const action of getProhibitedActions()) {
      assert.equal(isActionProhibited(action), true);
    }
    assert.throws(() => assertActionAllowed("modify-hubspot"));
    assert.doesNotThrow(() => assertActionAllowed("generate-internal-brief"));
    assert.ok(V1_PROHIBITED_ACTIONS.includes("write-external-systems"));
  });

  it("refuses write-capable connector registration", () => {
    clearRegisteredConnectors();
    assert.throws(() =>
      registerConnector({
        id: "evil-hubspot-write",
        capability: "write-capable",
        description: "should fail",
      }),
    );
    registerConnector({
      id: "safe-ga4-read",
      capability: "read-only",
      description: "ok",
    });
  });
});

describe("evidence and confidence", () => {
  it("recommendations without evidence are blocked or downgraded", () => {
    const blocked = buildRecommendation({
      recommendationId: "no-evidence",
      originatingExecutive: "business-intelligence",
      title: "Do something",
      plainLanguageExplanation: "No proof",
      whyItMattersNow: "n/a",
      proposedAction: "Review aggregate dashboards only",
      expectedUpside: "unclear",
      effortEstimate: "low",
      urgency: "medium",
      reversibility: "easily-reversed",
      baseConfidence: 0.9,
      evidence: [],
      assumptions: [],
      risks: [],
      dependencies: [],
      approvalRequired: false,
      suggestedOwner: "Founder",
      rankingFactors: { expectedBusinessImpact: 8, strategicAlignment: 8 },
    });
    assert.equal(blocked.status, "blocked");
    assert.ok((blocked.blockedReasons ?? []).some((r) => /evidence/i.test(r)));
  });

  it("missing data lowers confidence", () => {
    const weak = buildRecommendation({
      recommendationId: "weak",
      originatingExecutive: "business-intelligence",
      title: "Weak evidence item",
      plainLanguageExplanation: "degraded",
      whyItMattersNow: "n/a",
      proposedAction: "Inspect aggregate metrics",
      expectedUpside: "small",
      effortEstimate: "low",
      urgency: "medium",
      reversibility: "easily-reversed",
      baseConfidence: 0.9,
      evidence: [
        createEvidence({
          source: "ga4",
          sourceType: "analytics",
          collectedAt: new Date().toISOString(),
          reportingPeriod: FIXTURE_REPORTING_PERIOD,
          metricOrObservation: "partial",
          reliability: "degraded",
        }),
      ],
      assumptions: [],
      risks: [],
      dependencies: [],
      approvalRequired: false,
      suggestedOwner: "Founder",
      rankingFactors: { expectedBusinessImpact: 5, strategicAlignment: 5 },
    });
    assert.ok(weak.confidence < 0.9);
  });

  it("stale data is labeled", () => {
    const staleAt = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString();
    assert.equal(classifyFreshness(staleAt), "stale");
    const rec = buildRecommendation({
      recommendationId: "stale-rec",
      originatingExecutive: "business-intelligence",
      title: "Stale-backed item",
      plainLanguageExplanation: "old",
      whyItMattersNow: "n/a",
      proposedAction: "Re-pull aggregate metrics",
      expectedUpside: "clarity",
      effortEstimate: "low",
      urgency: "low",
      reversibility: "easily-reversed",
      baseConfidence: 0.8,
      evidence: [
        createEvidence({
          source: "ga4",
          sourceType: "analytics",
          collectedAt: staleAt,
          reportingPeriod: FIXTURE_REPORTING_PERIOD,
          metricOrObservation: "sessions=1",
          reliability: "reliable",
        }),
      ],
      assumptions: [],
      risks: [],
      dependencies: [],
      approvalRequired: false,
      suggestedOwner: "Founder",
      rankingFactors: { expectedBusinessImpact: 5, strategicAlignment: 5 },
    });
    assert.ok(rec.risks.some((r) => /stale/i.test(r)));
    assert.equal(rec.evidence[0]?.freshness, "stale");
  });
});

describe("ranking and consolidation", () => {
  it("consolidates duplicate recommendations", () => {
    const mk = (id: string, impact: number) =>
      buildRecommendation({
        recommendationId: id,
        originatingExecutive: "business-intelligence",
        title: "Same Title Action",
        plainLanguageExplanation: "dup",
        whyItMattersNow: "n/a",
        proposedAction: "Inspect the same funnel metric",
        expectedUpside: "x",
        effortEstimate: "low",
        urgency: "high",
        reversibility: "easily-reversed",
        baseConfidence: 0.8,
        evidence: [
          createEvidence({
            source: "ga4",
            sourceType: "analytics",
            collectedAt: new Date().toISOString(),
            reportingPeriod: FIXTURE_REPORTING_PERIOD,
            metricOrObservation: "x=1",
          }),
        ],
        assumptions: [],
        risks: [],
        dependencies: [],
        approvalRequired: false,
        suggestedOwner: "Founder",
        rankingFactors: {
          expectedBusinessImpact: impact,
          strategicAlignment: 8,
        },
      });
    const result = consolidateDuplicates([mk("a", 5), mk("b", 9)]);
    const active = result.filter((r) => r.status !== "consolidated");
    const merged = result.filter((r) => r.status === "consolidated");
    assert.equal(active.length, 1);
    assert.equal(merged.length, 1);
    assert.equal(active[0]?.recommendationId, "b");
  });

  it("ranking is deterministic", () => {
    const a = buildRecommendation({
      recommendationId: "rank-a",
      originatingExecutive: "business-intelligence",
      title: "A",
      plainLanguageExplanation: "a",
      whyItMattersNow: "n/a",
      proposedAction: "Review A metrics",
      expectedUpside: "a",
      effortEstimate: "low",
      urgency: "high",
      reversibility: "easily-reversed",
      baseConfidence: 0.8,
      evidence: [
        createEvidence({
          source: "ga4",
          sourceType: "analytics",
          collectedAt: new Date().toISOString(),
          reportingPeriod: FIXTURE_REPORTING_PERIOD,
          metricOrObservation: "a",
        }),
      ],
      assumptions: [],
      risks: [],
      dependencies: [],
      approvalRequired: false,
      suggestedOwner: "Founder",
      rankingFactors: { expectedBusinessImpact: 8, strategicAlignment: 8 },
    });
    const b = buildRecommendation({
      recommendationId: "rank-b",
      originatingExecutive: "business-intelligence",
      title: "B",
      plainLanguageExplanation: "b",
      whyItMattersNow: "n/a",
      proposedAction: "Review B metrics",
      expectedUpside: "b",
      effortEstimate: "high",
      urgency: "low",
      reversibility: "hard-to-reverse",
      baseConfidence: 0.5,
      evidence: [
        createEvidence({
          source: "ga4",
          sourceType: "analytics",
          collectedAt: new Date().toISOString(),
          reportingPeriod: FIXTURE_REPORTING_PERIOD,
          metricOrObservation: "b",
        }),
      ],
      assumptions: [],
      risks: [],
      dependencies: [],
      approvalRequired: false,
      suggestedOwner: "Founder",
      rankingFactors: { expectedBusinessImpact: 3, strategicAlignment: 3 },
    });
    const r1 = rankRecommendations([a, b]).map((x) => x.recommendationId);
    const r2 = rankRecommendations([b, a]).map((x) => x.recommendationId);
    assert.deepEqual(r1, r2);
    assert.deepEqual(r1, ["rank-a", "rank-b"]);
  });

  it("high-impact low-effort outranks cosmetic work", () => {
    const high = buildRecommendation({
      recommendationId: "high-roi",
      originatingExecutive: "business-intelligence",
      title: "Fix CTA measurement",
      plainLanguageExplanation: "important",
      whyItMattersNow: "funnel",
      proposedAction: "Verify consultation CTA events",
      expectedUpside: "trustworthy funnel",
      effortEstimate: "low",
      urgency: "high",
      reversibility: "easily-reversed",
      baseConfidence: 0.85,
      evidence: [
        createEvidence({
          source: "ga4",
          sourceType: "analytics",
          collectedAt: new Date().toISOString(),
          reportingPeriod: FIXTURE_REPORTING_PERIOD,
          metricOrObservation: "cta divergence",
        }),
      ],
      assumptions: [],
      risks: [],
      dependencies: [],
      approvalRequired: false,
      suggestedOwner: "Founder",
      rankingFactors: { expectedBusinessImpact: 9, strategicAlignment: 9 },
    });
    const cosmetic = buildRecommendation({
      recommendationId: "cosmetic",
      originatingExecutive: "business-intelligence",
      title: "Nav polish",
      plainLanguageExplanation: "cosmetic",
      whyItMattersNow: "not really",
      proposedAction: "Tweak secondary nav labels",
      expectedUpside: "negligible",
      effortEstimate: "high",
      urgency: "low",
      reversibility: "easily-reversed",
      baseConfidence: 0.6,
      evidence: [
        createEvidence({
          source: "ga4",
          sourceType: "analytics",
          collectedAt: new Date().toISOString(),
          reportingPeriod: FIXTURE_REPORTING_PERIOD,
          metricOrObservation: "no lift",
          reliability: "unverified",
        }),
      ],
      assumptions: [],
      risks: [],
      dependencies: [],
      approvalRequired: false,
      suggestedOwner: "Founder",
      rankingFactors: { expectedBusinessImpact: 2, strategicAlignment: 2 },
    });
    const ranked = rankRecommendations([cosmetic, high]);
    assert.equal(ranked[0]?.recommendationId, "high-roi");
    assert.ok(high.priorityScore > cosmetic.priorityScore);
  });

  it("missing dependencies block unsafe recommendations", () => {
    const blocked = buildRecommendation({
      recommendationId: "deps",
      originatingExecutive: "business-intelligence",
      title: "Needs GSC",
      plainLanguageExplanation: "blocked",
      whyItMattersNow: "n/a",
      proposedAction: "Prioritize query cluster expansion",
      expectedUpside: "seo",
      effortEstimate: "medium",
      urgency: "medium",
      reversibility: "partially-reversed",
      baseConfidence: 0.7,
      evidence: [
        createEvidence({
          source: "ga4",
          sourceType: "analytics",
          collectedAt: new Date().toISOString(),
          reportingPeriod: FIXTURE_REPORTING_PERIOD,
          metricOrObservation: "landing momentum",
        }),
      ],
      assumptions: [],
      risks: [],
      dependencies: ["GSC detail"],
      missingDependencies: ["GSC detail"],
      approvalRequired: false,
      suggestedOwner: "Founder",
      rankingFactors: { expectedBusinessImpact: 7, strategicAlignment: 7 },
    });
    assert.equal(blocked.status, "blocked");
    assert.equal(blocked.priorityScore, 0);
  });
});

describe("redaction", () => {
  it("redacts customer PII", () => {
    const out = redactSecretsAndPii(
      "Lead jane.doe@example.com called +1 (704) 555-0199",
    );
    assert.equal(out.includes("jane.doe@example.com"), false);
    assert.equal(out.includes("555-0199"), false);
    assert.match(out, /REDACTED_EMAIL/);
    assert.match(out, /REDACTED_PHONE/);
  });

  it("redacts secrets", () => {
    const out = redactSecretsAndPii(
      "Authorization: Bearer super-secret-token-value api_key=abc123",
    );
    assert.equal(out.includes("super-secret-token-value"), false);
    assert.match(out, /REDACTED/);
  });
});

describe("adapters", () => {
  it("distinguishes empty data from failed retrieval", () => {
    const empty = buildSourceHealth({
      sourceId: "ga4",
      configured: true,
      reachable: true,
      fresh: true,
      complete: false,
      permissionPosture: "read-only",
      lastSuccessfulRead: new Date().toISOString(),
      retrievalState: "empty",
    });
    const failed = buildSourceHealth({
      sourceId: "ga4",
      configured: true,
      reachable: false,
      fresh: false,
      complete: false,
      permissionPosture: "read-only",
      lastSuccessfulRead: null,
      errors: ["timeout"],
      retrievalState: "failed",
    });
    assert.equal(empty.retrievalState, "empty");
    assert.equal(failed.retrievalState, "failed");
    assert.notEqual(empty.effectOnConfidence, failed.effectOnConfidence);
  });

  it("adapter failure does not crash the full run", async () => {
    const run = await runAgentOsBrief({ mode: "fixture" });
    assert.ok(run.runId);
    assert.ok(
      run.runStatus === "completed" ||
        run.runStatus === "completed-with-warnings" ||
        run.runStatus === "blocked" ||
        run.runStatus === "failed",
    );
  });
});

describe("fixture vs live separation", () => {
  it("fixture mode is explicit and may use fixture retrieval states", async () => {
    const run = await runAgentOsBrief({ mode: "fixture" });
    assert.equal(run.mode, "fixture");
    assert.ok(
      run.sourceHealth.some((h) => h.retrievalState === "fixture"),
      "fixture mode should mark fixture retrieval",
    );
    assert.ok(run.brief.markdown.includes("Fixture sample"));
    assert.ok(
      run.recommendationAvailability === "has-material-recommendations",
    );
  });

  it("live mode never falls back to fixture data", async () => {
    const run = await runAgentOsBrief({ mode: "live" });
    assert.equal(run.mode, "live");
    assert.equal(
      run.sourceHealth.some((h) => h.retrievalState === "fixture"),
      false,
      "live mode must not emit fixture retrieval states",
    );
    assert.ok(run.brief.markdown.includes("Live read-only"));
    // Without configured sources in this environment, live should be blocked/degraded
    assert.ok(
      run.runStatus === "blocked" ||
        run.runStatus === "failed" ||
        run.runStatus === "completed-with-warnings",
    );
    if (run.recommendationAvailability === "none-blocked-by-sources") {
      assert.ok(
        run.runStatus === "blocked" || run.runStatus === "failed",
        "degraded zero-recs must not look like a healthy quiet run",
      );
    }
    // Must not invent fixture session counts in live degraded output
    assert.equal(run.brief.markdown.includes("Sessions 1,840"), false);
  });
});

describe("run-status contract", () => {
  it("exposes completed, completed-with-warnings, failed, blocked", () => {
    assert.deepEqual([...AGENT_RUN_STATUSES], [
      "completed",
      "completed-with-warnings",
      "failed",
      "blocked",
    ]);
  });

  it("separates healthy zero-recs from degraded zero-recs", () => {
    assert.equal(
      resolveRecommendationAvailability({
        materialCount: 0,
        criticalSourcesDown: false,
      }),
      "none-material",
    );
    assert.equal(
      resolveRunStatus({
        criticalSourcesDown: false,
        warningCount: 0,
        dataGapCount: 0,
        recommendationAvailability: "none-material",
      }),
      "completed",
    );

    assert.equal(
      resolveRecommendationAvailability({
        materialCount: 0,
        criticalSourcesDown: true,
      }),
      "none-blocked-by-sources",
    );
    assert.equal(
      resolveRunStatus({
        criticalSourcesDown: true,
        warningCount: 2,
        dataGapCount: 3,
        recommendationAvailability: "none-blocked-by-sources",
      }),
      "blocked",
    );
    assert.equal(
      resolveRunStatus({
        criticalSourcesDown: false,
        fatalError: "boom",
        warningCount: 1,
        dataGapCount: 0,
        recommendationAvailability: "none-blocked-by-sources",
      }),
      "failed",
    );
  });
});

describe("executives and brief", () => {
  it("Chief of Staff output contains required founder questions", async () => {
    const run = await runAgentOsBrief({ mode: "fixture" });
    for (const q of REQUIRED_BRIEF_QUESTIONS) {
      assert.ok(
        run.brief.markdown.includes(q),
        `brief missing question: ${q}`,
      );
    }
  });

  it("BI flags incomplete attribution", async () => {
    const bundle = await loadAllSources("fixture");
    const bi = runBusinessIntelligence(bundle, { ...FIXTURE_REPORTING_PERIOD });
    assert.equal(bi.incompleteAttribution, true);
    assert.ok(
      bi.dataGaps.some(
        (g) =>
          g.id === "gap-social-attribution" ||
          /attribution|Buffer|social/i.test(g.description),
      ),
    );
  });

  it("non-operational executives cannot generate recommendations", () => {
    assert.throws(() => assertScaffoldCannotRecommend("content"));
    assert.throws(() => assertOperationalForRecommendations("opportunity"));
  });

  it("Decision Journal schema validates", () => {
    const ok = validateDecisionJournalEntry({
      decisionId: "d1",
      recommendationId: "r1",
      originatingExecutive: "business-intelligence",
      dateProposed: "2026-07-21",
      evidenceSnapshot: [],
      confidenceAtDecision: 0.7,
      founderDecision: "approve",
      founderRationale: "Worth verifying CTA",
      actionOwner: "Founder",
      targetDate: "2026-07-28",
      outcomeStatus: "pending",
      measuredOutcome: null,
      reviewDate: null,
      lessonLearned: null,
    });
    assert.equal(ok.ok, true);
    const bad = validateDecisionJournalEntry({ decisionId: "" });
    assert.equal(bad.ok, false);
    const journal = new InMemoryDecisionJournal();
    if (ok.ok) journal.upsert(ok.entry);
    assert.equal(journal.list().length, 1);
  });

  it("fixture runner produces valid JSON shape and markdown", async () => {
    const run = await runAgentOsBrief({ mode: "fixture" });
    assert.equal(run.agentOsVersion, "1.0.0");
    assert.equal(run.mode, "fixture");
    assert.ok(run.executivesInvoked.includes("chief-of-staff"));
    assert.ok(run.executivesInvoked.includes("business-intelligence"));
    assert.ok(run.executivesInvoked.includes("search-strategy"));
    assert.deepEqual(run.executivesNotOperational.sort(), [
      "content",
      "opportunity",
    ]);
    const actionable = run.recommendations.filter(
      (r) =>
        r.status === "proposed" ||
        r.status === "downgraded" ||
        r.status === "monitor" ||
        r.agendaBucket === "do-now" ||
        r.agendaBucket === "schedule-next",
    );
    assert.ok(actionable.length >= 3, `expected ≥3 ranked recs, got ${actionable.length}`);
    for (const r of actionable.slice(0, 3)) {
      assert.ok(hasUsableEvidence(r.evidence) || r.status === "downgraded");
      assert.ok(typeof r.confidence === "number");
    }
    assert.ok(run.dataGaps.length >= 1);
    assert.ok(run.brief.markdown.includes("# Hourglass Founder Brief"));
    assert.ok(run.brief.markdown.includes("Mode: Fixture sample"));
    assert.equal(run.brief.markdown.toLowerCase().includes("revenue is up"), false);
    assert.equal(run.brief.markdown.includes("priorityScore"), false);
    assert.equal(run.brief.markdown.includes("retrievalState"), false);
    const json = JSON.stringify(run);
    assert.doesNotThrow(() => JSON.parse(json));
    assert.equal(json.includes("@example.com"), false);
    assert.equal(/Bearer\s+\w+/.test(json), false);
  });
});

describe("priority math sanity", () => {
  it("computes transparent priority scores", () => {
    const score = computePriorityScore(
      buildRankingFactors({
        expectedBusinessImpact: 10,
        confidence: 1,
        urgency: "critical",
        effortEstimate: "low",
        reversibility: "easily-reversed",
        strategicAlignment: 10,
        dependencyReadiness: 1,
        dataQuality: 1,
      }),
    );
    assert.ok(score > 0.5);
  });
});

describe("write-implied actions blocked", () => {
  it("blocks Buffer publish style proposals", () => {
    const rec = buildRecommendation({
      recommendationId: "write-bad",
      originatingExecutive: "business-intelligence",
      title: "Post to Buffer",
      plainLanguageExplanation: "no",
      whyItMattersNow: "n/a",
      proposedAction: "Post to Buffer about oval rings",
      expectedUpside: "reach",
      effortEstimate: "low",
      urgency: "medium",
      reversibility: "easily-reversed",
      baseConfidence: 0.9,
      evidence: [
        createEvidence({
          source: "ga4",
          sourceType: "analytics",
          collectedAt: new Date().toISOString(),
          reportingPeriod: FIXTURE_REPORTING_PERIOD,
          metricOrObservation: "social sessions",
        }),
      ],
      assumptions: [],
      risks: [],
      dependencies: [],
      approvalRequired: true,
      suggestedOwner: "Founder",
      rankingFactors: { expectedBusinessImpact: 5, strategicAlignment: 5 },
    });
    assert.equal(rec.status, "blocked");
  });
});

/** Compile-time / runtime fixture shape guard used by BI tests above */
void createFixtureGa4Bundle;
void createFixtureGscBundle;
void createFixtureWeeklyReport;
void (null as unknown as AgentOsDataBundle);
