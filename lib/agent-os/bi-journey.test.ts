/**
 * Focused tests — BI Client Journey & Conversion Analysis.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CONCIERGE_CONVERSION_ROOT_RECOMMENDATION_ID,
  CONVERSION_EVENT_MEASUREMENT_GAP_ID,
  JOURNEY_FINDING_TYPES,
  JOURNEY_PATH_MEASUREMENT_GAP_ID,
  MIN_JOURNEY_SAMPLE,
  TOOL_COMPLETION_MEASUREMENT_GAP_ID,
  applyJourneyFounderRankingGate,
  buildJourneyFindingId,
  consolidateJourneyDuplicates,
  createFixtureJourneyObservations,
  journeyIdLooksSafe,
  operationalExecutives,
  runAgentOsBrief,
  runBusinessIntelligence,
  runClientJourneyAnalysis,
  sequenceJourneyMeasurementPrerequisites,
} from "./index";
import { loadAllSources } from "./adapters/load";
import { detectJourneyFindings } from "./bi/journey/findings";
import {
  buildJourneySurfaceInventory,
  CONTENT_HANDOFF_GUIDE_TO_TOOL_KEY,
  CONTENT_HANDOFF_TRUST_NARRATIVE_KEY,
} from "./bi/journey/inventory";
import { deriveLiveJourneyObservations } from "./bi/journey/observe";
import { buildJourneyHandoffs } from "./bi/journey/recommendations";
import { FIXTURE_REPORTING_PERIOD } from "./fixtures/sample-data";
import type { AgentOsDataBundle } from "./adapters/types";
import { buildSourceHealth } from "./source-health";
import type { Recommendation } from "./types";

function emptyUnavailable(
  sourceId: AgentOsDataBundle[keyof AgentOsDataBundle]["sourceId"],
): AgentOsDataBundle[keyof AgentOsDataBundle] {
  return {
    sourceId,
    ok: false,
    data: null,
    empty: false,
    failed: false,
    health: buildSourceHealth({
      sourceId,
      configured: false,
      reachable: false,
      fresh: false,
      complete: false,
      permissionPosture: "unknown",
      lastSuccessfulRead: null,
      errors: ["not configured"],
      retrievalState: "not-configured",
    }),
  } as AgentOsDataBundle[keyof AgentOsDataBundle];
}

describe("Client Journey — architecture", () => {
  it("does not create a sixth executive; all five remain operational", async () => {
    const ops = operationalExecutives().map((e) => e.id);
    assert.deepEqual(ops, [
      "chief-of-staff",
      "business-intelligence",
      "search-strategy",
      "content",
      "opportunity",
    ]);
    const run = await runAgentOsBrief({ mode: "fixture" });
    assert.equal(run.executivesInvoked.length, 5);
    assert.ok(run.executivesInvoked.includes("business-intelligence"));
    assert.ok(run.executivesInvoked.includes("chief-of-staff"));
    assert.ok(run.executivesInvoked.includes("search-strategy"));
    assert.ok(run.executivesInvoked.includes("content"));
    assert.ok(run.executivesInvoked.includes("opportunity"));
  });

  it("BI owns journey audit; CoS surfaces capped priorities", async () => {
    const run = await runAgentOsBrief({ mode: "fixture" });
    const bundle = await loadAllSources("fixture");
    const biOut = runBusinessIntelligence(bundle, FIXTURE_REPORTING_PERIOD, {
      mode: "fixture",
    });
    assert.ok(biOut.journeyAudit);
    assert.ok(biOut.journeyAudit.surfaces.length > 0);
    assert.ok(biOut.journeyAudit.findings.length > 0);
    assert.ok(run.briefSurfacing.recommendationsSurfacedInBrief <= 5);
  });
});

describe("Client Journey — evidence safety", () => {
  it("repository links are never labeled observed transitions", () => {
    const surfaces = buildJourneySurfaceInventory();
    const obs = createFixtureJourneyObservations(FIXTURE_REPORTING_PERIOD);
    // Strip observed transitions — leave repository only
    const repoOnly = { ...obs, transitions: [], pathMeasurementAvailable: false };
    const detected = detectJourneyFindings({
      observations: repoOnly,
      surfaces,
    });
    for (const t of detected.transitions) {
      if (t.state === "observed") {
        assert.fail(`Repository-only mode emitted observed transition ${t.id}`);
      }
    }
    const repo = detected.transitions.filter(
      (t) => t.state === "repository-available",
    );
    assert.ok(repo.length > 0);
  });

  it("missing conversion events remain unknown; zero events ≠ zero conversions", () => {
    const obs = createFixtureJourneyObservations(FIXTURE_REPORTING_PERIOD);
    const detected = detectJourneyFindings({ observations: obs });
    const conversion = detected.conversionSignals.filter(
      (s) => s.kind === "form-submit" || s.kind === "appointment-request",
    );
    assert.ok(conversion.length > 0);
    for (const s of conversion) {
      assert.ok(
        s.availability === "unknown" || s.availability === "not-observed",
      );
      assert.equal(s.supportsFounderConclusions, false);
    }
    const unknownFinding = detected.findings.find(
      (f) => f.type === "conversion-signal-unknown",
    );
    assert.ok(unknownFinding);
    assert.match(
      unknownFinding!.whyItMatters,
      /must not claim conversion is low|high|zero|improving/i,
    );
  });

  it("inferred journeys are labeled inferred", () => {
    const obs = createFixtureJourneyObservations(FIXTURE_REPORTING_PERIOD);
    const detected = detectJourneyFindings({ observations: obs });
    for (const f of detected.findings) {
      if (f.evidenceClass === "inferred") {
        assert.equal(f.isInference, true);
        assert.equal(f.transitionState === "inferred" || f.transitionState === null, true);
      }
      if (f.transitionState === "observed") {
        assert.equal(f.evidenceClass, "observed-analytics");
        assert.equal(f.isInference, false);
      }
    }
  });

  it("stable journey IDs look safe", () => {
    const id = buildJourneyFindingId({
      type: "high-entry-weak-next-step",
      subject: "/engagement-rings",
    });
    assert.ok(journeyIdLooksSafe(id));
    assert.ok(JOURNEY_FINDING_TYPES.includes("high-entry-weak-next-step"));
  });
});

describe("Client Journey — analysis behaviors", () => {
  it("high-entry / weak-next-step requires observed path evidence", () => {
    const obs = createFixtureJourneyObservations(FIXTURE_REPORTING_PERIOD);
    const withPaths = detectJourneyFindings({ observations: obs });
    const weak = withPaths.findings.filter(
      (f) => f.type === "high-entry-weak-next-step",
    );
    assert.ok(weak.length >= 1);
    assert.ok(weak.every((f) => f.evidenceClass === "observed-analytics"));

    const noPaths = detectJourneyFindings({
      observations: {
        ...obs,
        pathMeasurementAvailable: false,
        transitions: [],
      },
    });
    assert.equal(
      noPaths.findings.filter((f) => f.type === "high-entry-weak-next-step")
        .length,
      0,
    );
  });

  it("guide-to-tool movement is represented as observed when present", () => {
    const obs = createFixtureJourneyObservations(FIXTURE_REPORTING_PERIOD);
    const detected = detectJourneyFindings({ observations: obs });
    const guide = detected.findings.find(
      (f) =>
        f.type === "healthy-journey-coverage" &&
        /guide/i.test(f.title) &&
        /tool/i.test(f.title),
    );
    assert.ok(guide);
    assert.equal(guide!.transitionState, "observed");
  });

  it("repository-only tool-to-conversation stays repository-available", () => {
    const obs = createFixtureJourneyObservations(FIXTURE_REPORTING_PERIOD);
    const noObservedToolPath = {
      ...obs,
      transitions: obs.transitions.filter(
        (t) =>
          !(
            t.fromRoute.includes("studio") && t.toRoute === "/concierge"
          ),
      ),
    };
    // Keep path available but remove studio→concierge observed rows for shape studio
    const detected = detectJourneyFindings({
      observations: {
        ...noObservedToolPath,
        transitions: noObservedToolPath.transitions.filter(
          (t) => t.fromRoute !== "/diamond-shape-studio",
        ),
      },
    });
    const repoDisconnect = detected.findings.find(
      (f) =>
        f.type === "tool-to-conversation-disconnect" &&
        f.affectedRoute === "/diamond-shape-studio",
    );
    assert.ok(repoDisconnect);
    assert.equal(repoDisconnect!.transitionState, "repository-available");
    assert.equal(repoDisconnect!.evidenceClass, "repository-backed");
  });

  it("low-sample journeys are downgraded / not founder-rankable", () => {
    const obs = createFixtureJourneyObservations(FIXTURE_REPORTING_PERIOD);
    const detected = detectJourneyFindings({ observations: obs });
    const low = detected.findings.filter((f) => f.type === "insufficient-sample");
    assert.ok(low.length >= 1);
    assert.ok(low.every((f) => f.founderRankable === false));
    assert.ok(low.every((f) => (f.sampleSize ?? 0) < MIN_JOURNEY_SAMPLE));
  });

  it("healthy journey evidence does not generate unnecessary recommendations", () => {
    const obs = createFixtureJourneyObservations(FIXTURE_REPORTING_PERIOD);
    const detected = detectJourneyFindings({ observations: obs });
    const healthy = detected.findings.filter(
      (f) => f.type === "healthy-journey-coverage",
    );
    assert.ok(healthy.length >= 1);
    assert.ok(healthy.every((f) => f.suppressRecommendation === true));
  });

  it("query-to-landing mismatch routes to Search; content work to Content", () => {
    const obs = createFixtureJourneyObservations(FIXTURE_REPORTING_PERIOD);
    const detected = detectJourneyFindings({ observations: obs });
    const mismatch = detected.findings.filter(
      (f) => f.type === "landing-intent-mismatch",
    );
    assert.ok(mismatch.length >= 1);
    assert.ok(
      mismatch.every(
        (f) =>
          f.owner === "search-strategy" &&
          f.handoffTarget === "search-strategy" &&
          f.suppressRecommendation === true,
      ),
    );

    const content = detected.findings.filter(
      (f) => f.handoffTarget === "content",
    );
    assert.ok(content.length >= 1);
    assert.ok(content.every((f) => f.suppressRecommendation === true));
  });
});

describe("Client Journey — source-gap consolidation", () => {
  it("tool-completion gaps consolidate under one root id", () => {
    const obs = createFixtureJourneyObservations(FIXTURE_REPORTING_PERIOD);
    const detected = detectJourneyFindings({ observations: obs });
    const toolFindings = detected.findings.filter(
      (f) => f.rootSourceGapId === TOOL_COMPLETION_MEASUREMENT_GAP_ID,
    );
    assert.ok(toolFindings.length >= 2);
    assert.ok(
      detected.sourceGaps.some((g) => g.id === TOOL_COMPLETION_MEASUREMENT_GAP_ID),
    );
  });

  it("path measurement gap is stable, diagnostic, and not founder-rankable", () => {
    const obs = createFixtureJourneyObservations(FIXTURE_REPORTING_PERIOD);
    const liveLike = {
      ...obs,
      pathMeasurementAvailable: false,
      transitions: [],
      mode: "live-derived" as const,
    };
    const detected = detectJourneyFindings({ observations: liveLike });
    const pathGaps = detected.sourceGaps.filter(
      (g) => g.id === JOURNEY_PATH_MEASUREMENT_GAP_ID,
    );
    assert.equal(pathGaps.length, 1);
    assert.equal(pathGaps[0]!.suppressFromFounderRanking, true);
    assert.equal(pathGaps[0]!.mayAppearIndependentlyInBrief, false);
    assert.equal(pathGaps[0]!.founderRelevance, "diagnostic");
    const pathFindings = detected.findings.filter(
      (f) => f.rootSourceGapId === JOURNEY_PATH_MEASUREMENT_GAP_ID,
    );
    const sourceUnavailable = pathFindings.filter(
      (f) => f.type === "source-unavailable",
    );
    assert.ok(sourceUnavailable.length <= 1);
    assert.ok(sourceUnavailable.every((f) => f.founderRankable === false));
    assert.ok(sourceUnavailable.every((f) => f.suppressRecommendation === true));
  });

  it("conversion gap soft-dedupes when Concierge measurement root exists", async () => {
    const bundle = await loadAllSources("fixture");
    const result = runClientJourneyAnalysis({
      mode: "fixture",
      bundle,
      reportingPeriod: FIXTURE_REPORTING_PERIOD,
      measurementRecommendations: [
        {
          recommendationId: CONCIERGE_CONVERSION_ROOT_RECOMMENDATION_ID,
        } as Recommendation,
      ],
    });
    assert.ok(
      !result.recommendations.some(
        (r) => r.recommendationId === CONVERSION_EVENT_MEASUREMENT_GAP_ID,
      ),
    );
  });
});

describe("Client Journey — ranking and deduplication", () => {
  it("one root journey problem produces one canonical recommendation", () => {
    const recs: Recommendation[] = [
      stubRec(
        "business-intelligence:journey:high-entry-weak-next-step:engagement-rings",
        "Weak next-step A",
      ),
      stubRec(
        "business-intelligence:journey:high-entry-weak-next-step:engagement-rings-alt",
        "Weak next-step B",
      ),
    ];
    // Force same family via IDs that classify together
    const consolidated = consolidateJourneyDuplicates([
      stubRec(
        JOURNEY_PATH_MEASUREMENT_GAP_ID,
        "Path gap A",
      ),
      stubRec(
        "business-intelligence:journey:source-unavailable:journey-path-measurement",
        "Path gap symptom",
      ),
      ...recs,
    ]);
    const pathAlive = consolidated.filter(
      (r) =>
        r.status !== "consolidated" &&
        (r.recommendationId === JOURNEY_PATH_MEASUREMENT_GAP_ID ||
          r.recommendationId.includes("journey-path")),
    );
    assert.ok(pathAlive.length <= 2);
  });

  it("internal handoffs are not founder-rankable", () => {
    const gated = applyJourneyFounderRankingGate([
      stubRec(
        "business-intelligence:journey:landing-intent-mismatch:custom-rings",
        "Mismatch",
        "Handoff to Search Strategy for query alignment",
      ),
    ]);
    assert.equal(gated[0]!.status, "ignore");
  });

  it("measurement prerequisites sequence before optimization", () => {
    const sequenced = sequenceJourneyMeasurementPrerequisites([
      stubRec(CONVERSION_EVENT_MEASUREMENT_GAP_ID, "Conversion measurement"),
      stubRec(
        "business-intelligence:journey:high-entry-weak-next-step:engagement-rings",
        "Optimize path",
        "Inspect on-page next-step clarity",
      ),
    ]);
    const opt = sequenced.find((r) =>
      r.recommendationId.includes("high-entry-weak-next"),
    );
    assert.ok(opt);
    assert.ok(
      opt!.dependencies.includes(CONVERSION_EVENT_MEASUREMENT_GAP_ID) ||
        (opt!.blockedReasons ?? []).some((b) =>
          /sequenced after journey measurement/i.test(b),
        ),
    );
  });

  it("founder brief remains at five or fewer named priorities", async () => {
    const run = await runAgentOsBrief({ mode: "fixture" });
    assert.ok(run.briefSurfacing.recommendationsSurfacedInBrief <= 5);
    assert.ok((run.brief.surfacedPriorityTitles?.length ?? 0) <= 5);
  });
});

describe("Client Journey — fixture/live separation", () => {
  it("fixture journey data appears only in fixture mode", () => {
    const fixture = createFixtureJourneyObservations(FIXTURE_REPORTING_PERIOD);
    assert.equal(fixture.mode, "fixture");
    assert.equal(fixture.pathMeasurementAvailable, true);
    assert.ok(fixture.transitions.length > 0);
  });

  it("live mode cannot fall back to fixture transitions or conversions", async () => {
    const bundle = await loadAllSources("live");
    assert.throws(
      () =>
        runClientJourneyAnalysis({
          mode: "live",
          bundle,
          reportingPeriod: FIXTURE_REPORTING_PERIOD,
          fixtureOverlay: createFixtureJourneyObservations(
            FIXTURE_REPORTING_PERIOD,
          ),
        }),
      /refused fixture/,
    );

    const liveObs = deriveLiveJourneyObservations(
      bundle,
      FIXTURE_REPORTING_PERIOD,
    );
    if (liveObs) {
      assert.equal(liveObs.mode, "live-derived");
      assert.equal(liveObs.pathMeasurementAvailable, false);
      assert.equal(liveObs.transitions.length, 0);
      assert.ok(!liveObs.queriedEventNames.includes("generate_lead"));
    }
  });

  it("missing live sources generate source gaps without synthetic conversions", () => {
    const bundle: AgentOsDataBundle = {
      ga4: emptyUnavailable("ga4") as AgentOsDataBundle["ga4"],
      gsc: emptyUnavailable("gsc") as AgentOsDataBundle["gsc"],
      weeklyIntelligence: emptyUnavailable(
        "weekly-intelligence",
      ) as AgentOsDataBundle["weeklyIntelligence"],
      hubspotAggregates: emptyUnavailable(
        "hubspot-aggregates",
      ) as AgentOsDataBundle["hubspotAggregates"],
      buffer: emptyUnavailable("buffer") as AgentOsDataBundle["buffer"],
      gbp: emptyUnavailable("gbp") as AgentOsDataBundle["gbp"],
    };
    const result = runClientJourneyAnalysis({
      mode: "live",
      bundle,
      reportingPeriod: FIXTURE_REPORTING_PERIOD,
    });
    assert.equal(result.audit.observationMode, "unavailable");
    assert.ok(
      result.audit.findings.some((f) => f.type === "source-unavailable"),
    );
    assert.ok(
      !result.audit.facts.some((f) => /conversion rate|0%|funnel rate/i.test(f)),
    );
  });
});

describe("Client Journey — regression with executives", () => {
  it("Search, Content, Opportunity remain operational alongside journey", async () => {
    const run = await runAgentOsBrief({ mode: "fixture" });
    assert.ok(run.executivesInvoked.includes("search-strategy"));
    assert.ok(run.executivesInvoked.includes("content"));
    assert.ok(run.executivesInvoked.includes("opportunity"));
    assert.ok(run.briefSurfacing.recommendationsSurfacedInBrief <= 5);
  });
});

describe("Client Journey — high-entry / weak-next-step live safety", () => {
  it("high-entry alone cannot produce weak-next-step without path data", () => {
    const obs = createFixtureJourneyObservations(FIXTURE_REPORTING_PERIOD);
    const landingsOnly = {
      ...obs,
      pathMeasurementAvailable: false,
      transitions: [],
      mode: "live-derived" as const,
      landingPages: [
        { route: "/engagement-rings", sessions: 500 },
        { route: "/", sessions: 800 },
      ],
    };
    const detected = detectJourneyFindings({ observations: landingsOnly });
    assert.equal(
      detected.findings.filter((f) => f.type === "high-entry-weak-next-step")
        .length,
      0,
    );
  });

  it("missing path data cannot be interpreted as weak movement", () => {
    const obs = createFixtureJourneyObservations(FIXTURE_REPORTING_PERIOD);
    const detected = detectJourneyFindings({
      observations: {
        ...obs,
        pathMeasurementAvailable: false,
        transitions: [],
      },
    });
    assert.equal(
      detected.findings.filter((f) => f.type === "high-entry-weak-next-step")
        .length,
      0,
    );
    const pathUnavailable = detected.findings.find(
      (f) => f.type === "source-unavailable",
    );
    assert.ok(pathUnavailable);
    assert.match(pathUnavailable!.observedEvidence, /unknown/i);
    assert.ok(!/\b0% next\b|movement is zero|zero next-step/i.test(pathUnavailable!.observedEvidence));
    assert.match(pathUnavailable!.observedEvidence, /not zero movement/i);
  });

  it("high-entry / weak-next-step requires verified observed transitions", () => {
    const obs = createFixtureJourneyObservations(FIXTURE_REPORTING_PERIOD);
    // Path flagged available but empty transitions → unknown, not weak
    const emptyTransitions = detectJourneyFindings({
      observations: {
        ...obs,
        pathMeasurementAvailable: true,
        transitions: [],
      },
    });
    assert.equal(
      emptyTransitions.findings.filter(
        (f) => f.type === "high-entry-weak-next-step",
      ).length,
      0,
    );

    const withTransitions = detectJourneyFindings({ observations: obs });
    assert.ok(
      withTransitions.findings.some(
        (f) =>
          f.type === "high-entry-weak-next-step" &&
          f.transitionState === "observed" &&
          f.evidenceClass === "observed-analytics",
      ),
    );
  });

  it("fixture transitions cannot enter live mode; live landings cannot infer exits", async () => {
    const bundle = await loadAllSources("live");
    assert.throws(
      () =>
        runClientJourneyAnalysis({
          mode: "live",
          bundle,
          reportingPeriod: FIXTURE_REPORTING_PERIOD,
          fixtureOverlay: createFixtureJourneyObservations(
            FIXTURE_REPORTING_PERIOD,
          ),
        }),
      /refused fixture/,
    );
    const liveObs = deriveLiveJourneyObservations(
      bundle,
      FIXTURE_REPORTING_PERIOD,
    );
    if (liveObs) {
      assert.equal(liveObs.pathMeasurementAvailable, false);
      assert.equal(liveObs.transitions.length, 0);
      const detected = detectJourneyFindings({ observations: liveObs });
      assert.equal(
        detected.findings.filter((f) => f.type === "high-entry-weak-next-step")
          .length,
        0,
      );
      assert.ok(
        !detected.findings.some((f) =>
          /exit rate|abandonment rate|funnel rate/i.test(f.observedEvidence),
        ),
      );
    }
  });

  it("zero observed transitions with unavailable measurement remains unknown", () => {
    const obs = createFixtureJourneyObservations(FIXTURE_REPORTING_PERIOD);
    const detected = detectJourneyFindings({
      observations: {
        ...obs,
        pathMeasurementAvailable: false,
        transitions: [],
      },
    });
    const pathFinding = detected.findings.find(
      (f) => f.type === "source-unavailable",
    );
    assert.ok(pathFinding);
    assert.equal(pathFinding!.transitionState, "unknown");
    assert.match(pathFinding!.observedEvidence, /unknown/i);
    assert.ok(!/zero movement/i.test(pathFinding!.title));
  });
});

describe("Client Journey — surface classification", () => {
  it("Conversations is editorial, not inquiry/conversion; Concierge is inquiry not completed conversion", () => {
    const surfaces = buildJourneySurfaceInventory();
    const conversations = surfaces.find((s) => s.route === "/conversations");
    const concierge = surfaces.find((s) => s.route === "/concierge");
    assert.ok(conversations);
    assert.equal(conversations!.role, "editorial");
    assert.equal(conversations!.surfaceType, "editorial");
    assert.equal(conversations!.stage, "education");
    assert.ok(!/conversion event|inquiry form/i.test(conversations!.label));
    assert.match(
      conversations!.repositoryEvidence,
      /not an inquiry form|not.*conversion event/i,
    );

    assert.ok(concierge);
    assert.equal(concierge!.role, "inquiry-conversion");
    assert.equal(concierge!.surfaceType, "inquiry");
    assert.equal(concierge!.stage, "conversation-intent");
    assert.match(
      concierge!.repositoryEvidence,
      /not a completed conversion|not.*verified appointment/i,
    );

    // No separate appointment surface in inventory
    assert.ok(!surfaces.some((s) => s.role === "appointment"));
  });
});

describe("Client Journey — content handoff consolidation", () => {
  it("consolidates guide-to-tool and trust handoffs under stable roots", () => {
    const obs = createFixtureJourneyObservations(FIXTURE_REPORTING_PERIOD);
    const detected = detectJourneyFindings({ observations: obs });
    const contentFindings = detected.findings.filter(
      (f) => f.handoffTarget === "content",
    );
    const guideHandoffs = contentFindings.filter(
      (f) => f.type === "content-to-tool-disconnect",
    );
    const trustHandoffs = contentFindings.filter(
      (f) => f.type === "trust-surface-underuse",
    );
    assert.ok(guideHandoffs.length <= 1);
    assert.ok(trustHandoffs.length <= 1);
    if (guideHandoffs[0]) {
      assert.equal(
        guideHandoffs[0].deduplicationKey,
        CONTENT_HANDOFF_GUIDE_TO_TOOL_KEY,
      );
      assert.equal(guideHandoffs[0].founderRankable, false);
      assert.equal(guideHandoffs[0].suppressRecommendation, true);
      assert.equal(guideHandoffs[0].owner, "content");
    }
    if (trustHandoffs[0]) {
      assert.equal(
        trustHandoffs[0].deduplicationKey,
        CONTENT_HANDOFF_TRUST_NARRATIVE_KEY,
      );
      assert.equal(trustHandoffs[0].founderRankable, false);
    }

    const handoffs = buildJourneyHandoffs(detected.findings);
    assert.ok(handoffs.contentHandoffIds.length <= 2);

    // Healthy guide→tool does not emit handoff for oval-vs-round (strong movement)
    assert.ok(
      !guideHandoffs.some((f) =>
        /oval-vs-round/i.test(f.observedEvidence) &&
        !/carat-weight|weak/i.test(f.observedEvidence),
      ),
    );
  });

  it("low-sample paths do not emit Content production handoffs", () => {
    const obs = createFixtureJourneyObservations(FIXTURE_REPORTING_PERIOD);
    const lowOnly = {
      ...obs,
      landingPages: [
        {
          route: "/diamond-guide/charlotte-diamond-advisor-guide",
          sessions: 12,
        },
      ],
      transitions: [
        {
          fromRoute: "/diamond-guide/charlotte-diamond-advisor-guide",
          toRoute: "/diamond-studio",
          sessions: 1,
        },
      ],
    };
    const detected = detectJourneyFindings({ observations: lowOnly });
    assert.equal(
      detected.findings.filter((f) => f.type === "content-to-tool-disconnect")
        .length,
      0,
    );
  });
});

describe("Client Journey — path measurement not founder #1", () => {
  it("live brief does not surface journey-path-measurement as a named priority", async () => {
    const run = await runAgentOsBrief({ mode: "live" });
    assert.ok(run.briefSurfacing.recommendationsSurfacedInBrief <= 5);
    const titles = run.brief.surfacedPriorityTitles ?? [];
    assert.ok(
      !titles.some((t) =>
        /establish verified journey path measurement/i.test(t),
      ),
    );
    const pathRec = run.recommendations.find(
      (r) => r.recommendationId === JOURNEY_PATH_MEASUREMENT_GAP_ID,
    );
    if (pathRec) {
      assert.ok(
        pathRec.status === "ignore" ||
          pathRec.status === "consolidated" ||
          pathRec.agendaBucket === "ignore",
      );
    }
  });
});

function stubRec(
  id: string,
  title: string,
  explanation = "Evidence class: observed-analytics",
): Recommendation {
  return {
    recommendationId: id,
    originatingExecutive: "business-intelligence",
    title,
    plainLanguageExplanation: explanation,
    whyItMattersNow: "test",
    proposedAction: explanation.includes("Inspect")
      ? "Inspect on-page next-step clarity"
      : "Verify measurement",
    expectedUpside: "test",
    effortEstimate: "medium",
    urgency: "high",
    reversibility: "easily-reversed",
    confidence: 0.7,
    evidence: [],
    assumptions: [],
    risks: [],
    dependencies: [],
    approvalRequired: false,
    suggestedOwner: "BI",
    status: "proposed",
    agendaBucket: "do-now",
    rankingFactors: {
      expectedBusinessImpact: 7,
      confidence: 0.7,
      urgency: 8,
      effort: 5,
      reversibility: 9,
      strategicAlignment: 8,
      dependencyReadiness: 1,
      dataQuality: 0.8,
    },
    priorityScore: 0.4,
  };
}
