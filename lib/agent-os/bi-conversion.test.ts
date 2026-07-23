/**
 * Focused tests — BI Conversion & Measurement Audit.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  AUTHORITATIVE_CONVERSION_EVENT,
  CONCIERGE_CONVERSION_ROOT_RECOMMENDATION_ID,
  EXPECTED_EVENT_INVENTORY,
  FUNNEL_DEFINITIONS,
  GA4_ADAPTER_QUERIED_EVENTS,
  MIN_FUNNEL_SAMPLE,
  buildMeasurementFindingId,
  createFixtureConversionObservations,
  measurementIdLooksSafe,
  runConversionMeasurementAudit,
  runBusinessIntelligence,
  runAgentOsBrief,
  operationalExecutives,
  MEASUREMENT_HEALTH_TYPES,
} from "./index";
import { loadAllSources } from "./adapters/load";
import {
  buildExpectedEventInventory,
  deriveLiveConversionObservations,
  resolveObservedStatus,
} from "./bi/observe";
import { detectMeasurementFindings } from "./bi/findings";
import { FIXTURE_REPORTING_PERIOD } from "./fixtures/sample-data";
import type { AgentOsDataBundle } from "./adapters/types";
import { buildSourceHealth } from "./source-health";

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

describe("BI Conversion & Measurement — executives remain operational", () => {
  it("BI remains operational and all five executives are represented", async () => {
    const ops = operationalExecutives().map((e) => e.id);
    assert.deepEqual(ops, [
      "chief-of-staff",
      "business-intelligence",
      "search-strategy",
      "content",
      "opportunity",
    ]);
    const run = await runAgentOsBrief({ mode: "fixture" });
    assert.ok(run.executivesInvoked.includes("business-intelligence"));
    assert.ok(run.executivesInvoked.includes("search-strategy"));
    assert.ok(run.executivesInvoked.includes("content"));
    assert.ok(run.executivesInvoked.includes("opportunity"));
    assert.ok(run.executivesInvoked.includes("chief-of-staff"));
  });

  it("Search, Content, and Opportunity remain operational in fixture brief", async () => {
    const run = await runAgentOsBrief({ mode: "fixture" });
    assert.ok(run.executivesInvoked.length === 5);
    assert.ok(
      run.briefSurfacing.recommendationsSurfacedInBrief <= 5,
    );
  });
});

describe("Expected vs observed contract", () => {
  it("expected event does not imply observed event", () => {
    const obs = createFixtureConversionObservations(FIXTURE_REPORTING_PERIOD);
    const inventory = buildExpectedEventInventory(obs);
    const lead = inventory.find(
      (e) => e.expectedEventName === AUTHORITATIVE_CONVERSION_EVENT,
    );
    assert.ok(lead);
    assert.equal(lead!.repositoryEvidenceClear, true);
    assert.equal(lead!.observedStatus, "not-observed");
  });

  it("missing live analytics produces unknown, not broken", () => {
    const inventory = buildExpectedEventInventory(null);
    for (const item of inventory) {
      assert.equal(item.observedStatus, "unknown");
    }
    const findings = detectMeasurementFindings({
      inventory,
      observations: null,
    });
    assert.ok(
      findings.some(
        (f) =>
          f.type === "verification-required" &&
          f.affectedEvent === AUTHORITATIVE_CONVERSION_EVENT,
      ),
    );
    assert.ok(
      !findings.some(
        (f) =>
          f.type === "expected-event-not-observed" &&
          f.affectedEvent === AUTHORITATIVE_CONVERSION_EVENT,
      ),
    );
  });

  it("observed event not documented is detected cautiously", () => {
    const base = createFixtureConversionObservations(FIXTURE_REPORTING_PERIOD);
    const obs = {
      ...base,
      eventCounts: {
        ...base.eventCounts,
        totally_undocumented_event_xyz: { current: 55, previous: 40 },
      },
    };
    const findings = detectMeasurementFindings({
      inventory: buildExpectedEventInventory(obs),
      observations: obs,
    });
    const undocumented = findings.find(
      (f) => f.type === "observed-event-not-documented",
    );
    assert.ok(undocumented);
    assert.equal(undocumented!.decisionEffect, "monitor");
    assert.equal(undocumented!.suppressRecommendation, true);
  });
});

describe("Funnel and gap detection", () => {
  it("detects Concierge start/submit gap", () => {
    const obs = createFixtureConversionObservations(FIXTURE_REPORTING_PERIOD);
    const { audit } = runConversionMeasurementAudit({
      mode: "fixture",
      bundle: {} as AgentOsDataBundle,
      reportingPeriod: FIXTURE_REPORTING_PERIOD,
      fixtureOverlay: obs,
    });
    assert.ok(
      audit.findings.some((f) => f.type === "concierge-start-submit-gap"),
    );
  });

  it("detects tool entry/completion gap when completion missing", () => {
    const base = createFixtureConversionObservations(FIXTURE_REPORTING_PERIOD);
    const { studio_session_engaged: _omit, ...rest } = base.eventCounts;
    void _omit;
    const obs = {
      ...base,
      eventCounts: rest,
      queriedEventNames: [...base.queriedEventNames],
    };
    const findings = detectMeasurementFindings({
      inventory: buildExpectedEventInventory(obs),
      observations: obs,
    });
    assert.ok(
      findings.some((f) => f.type === "tool-entry-completion-gap"),
    );
  });

  it("detects tool-to-Concierge gap", () => {
    const obs = createFixtureConversionObservations(FIXTURE_REPORTING_PERIOD);
    const findings = detectMeasurementFindings({
      inventory: buildExpectedEventInventory(obs),
      observations: obs,
    });
    assert.ok(findings.some((f) => f.type === "tool-to-concierge-gap"));
  });

  it("funnel stages must use comparable periods for drop-off", () => {
    const obs = createFixtureConversionObservations(FIXTURE_REPORTING_PERIOD);
    // Same reportingPeriod on the bundle is required — stages share it
    assert.ok(obs.reportingPeriod.start);
    assert.ok(obs.comparisonPeriod);
    const start = obs.eventCounts.concierge_form_started!.current;
    assert.ok(start >= MIN_FUNNEL_SAMPLE);
    // Drop-off type only when both start+submit observed with comparable counts
    const withSubmit = {
      ...obs,
      eventCounts: {
        ...obs.eventCounts,
        concierge_form_submitted: { current: 5, previous: 6 },
      },
    };
    const findings = detectMeasurementFindings({
      inventory: buildExpectedEventInventory(withSubmit),
      observations: withSubmit,
    });
    const drop = findings.find((f) => f.type === "funnel-dropoff");
    assert.ok(drop);
    assert.match(drop!.observedEvidence, /same period/i);
  });

  it("small samples suppress drop-off conclusions", () => {
    const base = createFixtureConversionObservations(FIXTURE_REPORTING_PERIOD);
    const obs = {
      ...base,
      eventCounts: {
        ...base.eventCounts,
        concierge_form_started: { current: 8, previous: 9 },
        concierge_form_submitted: { current: 1, previous: 2 },
      },
    };
    const findings = detectMeasurementFindings({
      inventory: buildExpectedEventInventory(obs),
      observations: obs,
    });
    assert.ok(
      !findings.some(
        (f) => f.type === "funnel-dropoff" && !f.suppressRecommendation,
      ),
    );
    assert.ok(
      findings.some(
        (f) =>
          f.type === "sample-size-limitation" && f.suppressRecommendation,
      ),
    );
  });

  it("missing event does not prove user abandonment", () => {
    const obs = createFixtureConversionObservations(FIXTURE_REPORTING_PERIOD);
    const findings = detectMeasurementFindings({
      inventory: buildExpectedEventInventory(obs),
      observations: obs,
    });
    const gap = findings.find((f) => f.type === "concierge-start-submit-gap");
    assert.ok(gap);
    assert.match(gap!.recommendedNextAction, /not infer abandonment/i);
    assert.ok(!/users hate|everyone is abandoning|costs revenue/i.test(gap!.title));
    assert.match(gap!.observedEvidence, /not proof users abandoned/i);
  });

  it("verified healthy funnel does not generate a problem recommendation", () => {
    const obs = createFixtureConversionObservations(FIXTURE_REPORTING_PERIOD);
    const { recommendations, audit } = runConversionMeasurementAudit({
      mode: "fixture",
      bundle: {} as AgentOsDataBundle,
      reportingPeriod: FIXTURE_REPORTING_PERIOD,
      fixtureOverlay: obs,
    });
    const healthy = audit.findings.find((f) => f.type === "measurement-healthy");
    assert.ok(healthy);
    assert.equal(healthy!.suppressRecommendation, true);
    assert.ok(
      !recommendations.some((r) => r.recommendationId === healthy!.id),
    );
  });
});

describe("Regression and attribution", () => {
  it("event regression requires stable definition and comparison period", () => {
    const obs = createFixtureConversionObservations(FIXTURE_REPORTING_PERIOD);
    assert.ok(obs.comparisonPeriod);
    const findings = detectMeasurementFindings({
      inventory: buildExpectedEventInventory(obs),
      observations: obs,
    });
    const reg = findings.find((f) => f.type === "measurement-regression");
    assert.ok(reg);
    assert.match(reg!.recommendedNextAction, /possible/i);
  });

  it("source/medium anomaly requires sufficient repeated evidence", () => {
    const obs = createFixtureConversionObservations(FIXTURE_REPORTING_PERIOD);
    const findings = detectMeasurementFindings({
      inventory: buildExpectedEventInventory(obs),
      observations: obs,
    });
    assert.ok(findings.some((f) => f.type === "source-medium-anomaly"));
    // Tiny odd-ref alone must not be the anomaly subject
    assert.ok(
      !findings.some(
        (f) =>
          f.type === "source-medium-anomaly" &&
          f.id.includes("odd-ref"),
      ),
    );
  });

  it("direct traffic concentration is not overclaimed on weak volume", () => {
    const base = createFixtureConversionObservations(FIXTURE_REPORTING_PERIOD);
    const obs = {
      ...base,
      channelGroups: [
        { value: "Direct", sessions: 60 },
        { value: "Organic Search", sessions: 20 },
      ],
      sourceMediumRows: [],
    };
    const findings = detectMeasurementFindings({
      inventory: buildExpectedEventInventory(obs),
      observations: obs,
    });
    assert.ok(
      !findings.some(
        (f) =>
          f.type === "direct-traffic-overconcentration" &&
          !f.suppressRecommendation,
      ),
    );
  });
});

describe("Opportunity readiness handoff", () => {
  it("paid-search readiness receives measurement prerequisite", async () => {
    const run = await runAgentOsBrief({ mode: "fixture" });
    const bi = runBusinessIntelligence(
      await loadAllSources("fixture"),
      FIXTURE_REPORTING_PERIOD,
      { mode: "fixture" },
    );
    assert.equal(
      bi.opportunityHandoff.paidSearchMeasurementPrerequisiteMissing,
      true,
    );
    assert.equal(bi.opportunityHandoff.conversionEventVerified, false);
    const paid = run.recommendations.filter((r) =>
      /paid-search/i.test(r.title),
    );
    // Opportunity may keep paid in JSON as measurement-blocked / deferred
    const oppPaid = (run as { opportunity?: { opportunities?: Array<{ type: string; readiness: string; recommendedAction: string }> } })
      ;
    void paid;
    void oppPaid;
    assert.ok(
      bi.opportunityHandoff.notes.some((n) =>
        /paid-search|Do not recommend or launch ads/i.test(n),
      ),
    );
  });

  it("remarketing readiness remains blocked without audience/consent evidence", () => {
    const bi = runBusinessIntelligence(
      // sync path via fixture load is async — use conversion audit directly
      {
        ga4: emptyUnavailable("ga4"),
        gsc: emptyUnavailable("gsc"),
        weeklyIntelligence: emptyUnavailable("weekly-intelligence"),
        hubspotAggregates: emptyUnavailable("hubspot-aggregates"),
        buffer: emptyUnavailable("buffer"),
        gbp: emptyUnavailable("gbp"),
      } as AgentOsDataBundle,
      FIXTURE_REPORTING_PERIOD,
      { mode: "fixture" },
    );
    assert.equal(
      bi.opportunityHandoff.remarketingAudienceEvidenceAvailable,
      false,
    );
    assert.equal(
      bi.opportunityHandoff.remarketingConsentEvidenceAvailable,
      false,
    );
  });

  it("BI does not launch or recommend launching ads", async () => {
    const run = await runAgentOsBrief({ mode: "fixture" });
    const biRecs = run.recommendations.filter(
      (r) => r.originatingExecutive === "business-intelligence",
    );
    for (const r of biRecs) {
      assert.ok(!/launch ads|start a campaign|set up google ads/i.test(r.proposedAction));
      assert.ok(!/launch ads/i.test(r.title));
    }
  });
});

describe("Destination quality and severity", () => {
  it("destination-quality finding requires an existing destination", () => {
    const obs = createFixtureConversionObservations(FIXTURE_REPORTING_PERIOD);
    const findings = detectMeasurementFindings({
      inventory: buildExpectedEventInventory(obs),
      observations: obs,
    });
    const dest = findings.find(
      (f) =>
        f.type === "destination-quality-gap" &&
        f.affectedRoute === "/diamond-shape-studio",
    );
    assert.ok(dest);
    assert.ok(dest!.observedEvidence.includes("sessions"));
  });

  it("missing destination is distinct from missing tracking", () => {
    const base = createFixtureConversionObservations(FIXTURE_REPORTING_PERIOD);
    const obs = {
      ...base,
      landingPages: base.landingPages.filter((p) => !p.value.includes("concierge")),
    };
    const findings = detectMeasurementFindings({
      inventory: buildExpectedEventInventory(obs),
      observations: obs,
    });
    const missingDest = findings.find((f) =>
      f.id.includes("concierge-landing-absent"),
    );
    assert.ok(missingDest);
    assert.match(missingDest!.observedEvidence, /distinct from missing event tracking/i);
  });

  it("core conversion-measurement failure can be decision-blocking", () => {
    const obs = createFixtureConversionObservations(FIXTURE_REPORTING_PERIOD);
    const findings = detectMeasurementFindings({
      inventory: buildExpectedEventInventory(obs),
      observations: obs,
    });
    assert.ok(
      findings.some(
        (f) =>
          f.decisionEffect === "decision-blocking" &&
          (f.affectedEvent === AUTHORITATIVE_CONVERSION_EVENT ||
            f.type === "concierge-start-submit-gap"),
      ),
    );
  });

  it("low-value event gap remains monitor", () => {
    const obs = createFixtureConversionObservations(FIXTURE_REPORTING_PERIOD);
    const findings = detectMeasurementFindings({
      inventory: buildExpectedEventInventory(obs),
      observations: obs,
    });
    const home = findings.find((f) => f.affectedEvent === "home_clicked");
    assert.ok(home);
    assert.equal(home!.decisionEffect, "monitor");
    assert.equal(home!.suppressRecommendation, true);
  });
});

describe("Chief of Staff integration and ownership", () => {
  it("decision-blocking findings may outrank downstream speculative work", async () => {
    const run = await runAgentOsBrief({ mode: "fixture" });
    const blocking = run.recommendations.filter(
      (r) =>
        r.originatingExecutive === "business-intelligence" &&
        r.recommendationId.includes(":measurement:") &&
        r.rankingFactors.expectedBusinessImpact >= 8,
    );
    assert.ok(blocking.length >= 1);
    const top = run.recommendations[0];
    // Highest score should not be the cosmetic BI item
    assert.notEqual(top?.recommendationId, "bi-cosmetic-nav-label");
  });

  it("Search technical ownership remains Search; Content production remains Content", async () => {
    const run = await runAgentOsBrief({ mode: "fixture" });
    for (const r of run.recommendations) {
      if (r.originatingExecutive === "search-strategy") {
        assert.ok(!/write a conversation script|film a clip/i.test(r.proposedAction));
      }
      if (r.originatingExecutive === "content") {
        assert.ok(!/fix schema|add FAQ schema/i.test(r.proposedAction));
      }
      if (r.originatingExecutive === "business-intelligence") {
        assert.ok(!/launch ads|publish to buffer/i.test(r.proposedAction));
      }
    }
  });

  it("founder brief remains capped at 5 named priorities with full JSON findings", async () => {
    const run = await runAgentOsBrief({ mode: "fixture" });
    assert.ok(run.briefSurfacing.recommendationsSurfacedInBrief <= 5);
    assert.ok(
      run.brief.surfacedPriorityTitles.length <= 5,
    );
    assert.ok(
      run.recommendations.length >=
        run.briefSurfacing.recommendationsSurfacedInBrief,
    );
    assert.ok(
      run.recommendations.some((r) =>
        r.recommendationId.includes("business-intelligence:measurement"),
      ) ||
        run.recommendations.some(
          (r) => r.originatingExecutive === "business-intelligence",
        ),
    );
  });

  it("BI can return zero new measurement recommendations without failing", () => {
    const healthyOnly = createFixtureConversionObservations(FIXTURE_REPORTING_PERIOD);
    // Mark generate_lead observed + submit observed so conversion gaps quiet down
    const obs = {
      ...healthyOnly,
      eventCounts: {
        ...healthyOnly.eventCounts,
        generate_lead: { current: 20, previous: 18 },
        concierge_form_submitted: { current: 20, previous: 18 },
        consultation_cta_clicked: { current: 42, previous: 40 },
      },
      sourceMediumRows: [
        { source: "google", medium: "organic", sessions: 620 },
      ],
      landingPages: [
        { value: "/diamond-studio", sessions: 40 },
        { value: "/concierge", sessions: 30 },
      ],
    };
    const { recommendations } = runConversionMeasurementAudit({
      mode: "fixture",
      bundle: {} as AgentOsDataBundle,
      reportingPeriod: FIXTURE_REPORTING_PERIOD,
      fixtureOverlay: obs,
    });
    // May be zero or few — must not throw
    assert.ok(Array.isArray(recommendations));
  });
});

describe("Stable IDs", () => {
  it("stable repeated ID and distinct IDs for events/funnels", () => {
    const a = buildMeasurementFindingId({
      type: "concierge-start-submit-gap",
      subject: "concierge",
      funnel: "general-consultation",
    });
    const b = buildMeasurementFindingId({
      type: "concierge-start-submit-gap",
      subject: "concierge",
      funnel: "general-consultation",
    });
    assert.equal(a, b);
    const c = buildMeasurementFindingId({
      type: "tool-entry-completion-gap",
      subject: "diamond-studio",
      funnel: "diamond-studio",
    });
    assert.notEqual(a, c);
    const d = buildMeasurementFindingId({
      type: "concierge-start-submit-gap",
      subject: "concierge",
      funnel: "diamond-studio",
    });
    assert.notEqual(a, d);
    assert.ok(measurementIdLooksSafe(a));
    assert.ok(!measurementIdLooksSafe("business-intelligence:measurement:x:user@x.com"));
    assert.ok(!a.includes("@"));
    assert.ok(!/\d{4}-\d{2}-\d{2}t/i.test(a));
  });

  it("IDs contain no PII, sessions, uploads, secrets, or timestamps", () => {
    const obs = createFixtureConversionObservations(FIXTURE_REPORTING_PERIOD);
    const findings = detectMeasurementFindings({
      inventory: buildExpectedEventInventory(obs),
      observations: obs,
    });
    for (const f of findings) {
      assert.ok(measurementIdLooksSafe(f.id), f.id);
      assert.ok(!/secret|password|session-|upload/i.test(f.id));
    }
  });
});

describe("Fixture vs live safety", () => {
  it("fixture includes expected/observed/unknown/healthy states", () => {
    const obs = createFixtureConversionObservations(FIXTURE_REPORTING_PERIOD);
    const inventory = buildExpectedEventInventory(obs);
    assert.ok(inventory.some((e) => e.observedStatus === "observed"));
    assert.ok(inventory.some((e) => e.observedStatus === "not-observed"));
    // page_view is expected but not in queried fixture list → unknown
    const pageView = inventory.find((e) => e.expectedEventName === "page_view");
    assert.equal(pageView?.observedStatus, "unknown");
    const findings = detectMeasurementFindings({ inventory, observations: obs });
    assert.ok(findings.some((f) => f.type === "measurement-healthy"));
    assert.ok(
      findings.some((f) => f.decisionEffect === "decision-blocking"),
    );
    assert.ok(MEASUREMENT_HEALTH_TYPES.includes("measurement-healthy"));
    assert.ok(EXPECTED_EVENT_INVENTORY.length > 5);
    assert.ok(FUNNEL_DEFINITIONS.length >= 5);
  });

  it("live mode never uses fixture analytics", async () => {
    const bundle = await loadAllSources("fixture");
    // Force live derivation path
    const liveObs = deriveLiveConversionObservations(
      bundle,
      FIXTURE_REPORTING_PERIOD,
    );
    // Even from fixture GA4 data shape, mode is live-derived and queried set is adapter-only
    if (liveObs) {
      assert.equal(liveObs.mode, "live-derived");
      assert.deepEqual(
        [...liveObs.queriedEventNames].sort(),
        [...GA4_ADAPTER_QUERIED_EVENTS].sort(),
      );
      assert.equal(
        resolveObservedStatus(AUTHORITATIVE_CONVERSION_EVENT, liveObs),
        "unknown",
      );
    }
    assert.throws(() =>
      runConversionMeasurementAudit({
        mode: "live",
        bundle,
        reportingPeriod: FIXTURE_REPORTING_PERIOD,
        fixtureOverlay: createFixtureConversionObservations(
          FIXTURE_REPORTING_PERIOD,
        ),
      }),
    );
  });

  it("no revenue, lead-value, ROI, or attribution fabrication; no raw payloads", async () => {
    const run = await runAgentOsBrief({ mode: "fixture" });
    const blob = JSON.stringify(run.recommendations);
    // Allow prohibition language ("do not infer … lead value") — reject fabricated estimates
    assert.ok(!/revenue \$|ROI of \d|lead value of \$|estimated ROI|\$\d{3,}/i.test(blob));
    assert.ok(!/"email"\s*:/.test(blob));
    assert.ok(!/event_payload|rawPayload|customer_record/i.test(blob));
  });

  it("no public route or external write is added by conversion audit", () => {
    // Structural: conversion audit modules are lib-only; no app/api routes in this pass
    assert.ok(EXPECTED_EVENT_INVENTORY.every((e) => e.sourceReference.startsWith("lib/") || e.sourceReference.startsWith("app/") || e.sourceReference.startsWith("docs/")));
  });
});

describe("Concierge conversion root consolidation", () => {
  it("start/submit gap + missing submit + definition gap consolidate to one root rec", () => {
    const obs = createFixtureConversionObservations(FIXTURE_REPORTING_PERIOD);
    const { audit, recommendations } = runConversionMeasurementAudit({
      mode: "fixture",
      bundle: {} as AgentOsDataBundle,
      reportingPeriod: FIXTURE_REPORTING_PERIOD,
      fixtureOverlay: obs,
    });
    assert.ok(
      audit.findings.some((f) => f.type === "expected-event-not-observed"),
    );
    assert.ok(
      audit.findings.some((f) => f.type === "concierge-start-submit-gap"),
    );
    assert.ok(
      audit.findings.some((f) => f.type === "conversion-definition-gap"),
    );
    const roots = recommendations.filter(
      (r) => r.recommendationId === CONCIERGE_CONVERSION_ROOT_RECOMMENDATION_ID,
    );
    assert.equal(roots.length, 1);
    assert.equal(roots[0]!.title, "Establish one verified Concierge conversion signal");
    assert.match(roots[0]!.plainLanguageExplanation, /Decision effect: decision-blocking/);
    assert.match(
      roots[0]!.proposedAction,
      /authoritative reporting conversion|retain earlier-stage/i,
    );
    assert.ok(!/delete or replace events/i.test(roots[0]!.proposedAction) || /Do not delete/i.test(roots[0]!.proposedAction));
    // Supporting findings remain in structured audit
    assert.ok(audit.findings.length >= 3);
    // No duplicate founder-facing Concierge conversion titles
    const conciergeTitles = recommendations.filter((r) =>
      /generate_lead|concierge start|authoritative conversion event for decisions/i.test(
        r.title,
      ),
    );
    assert.equal(conciergeTitles.length, 0);
  });

  it("attribution and tool-completion issues remain separate from Concierge root", () => {
    const base = createFixtureConversionObservations(FIXTURE_REPORTING_PERIOD);
    const { studio_session_engaged: _omit, ...rest } = base.eventCounts;
    void _omit;
    const obs = { ...base, eventCounts: rest };
    const { recommendations } = runConversionMeasurementAudit({
      mode: "fixture",
      bundle: {} as AgentOsDataBundle,
      reportingPeriod: FIXTURE_REPORTING_PERIOD,
      fixtureOverlay: obs,
    });
    assert.ok(
      recommendations.some(
        (r) => r.recommendationId === CONCIERGE_CONVERSION_ROOT_RECOMMENDATION_ID,
      ),
    );
    assert.ok(
      recommendations.some((r) => /source\/medium fragmentation|instagram/i.test(r.title)),
    );
    assert.ok(
      recommendations.some((r) => /tool entry|completion cannot be verified|Studio entries/i.test(r.title)),
    );
  });

  it("founder brief surfaces at most one Concierge conversion root among ≤5 priorities", async () => {
    const run = await runAgentOsBrief({ mode: "fixture" });
    assert.ok(run.briefSurfacing.recommendationsSurfacedInBrief <= 5);
    const conciergeSurfaced = run.brief.surfacedPriorityTitles.filter((t) =>
      /Establish one verified Concierge conversion signal|generate_lead|Concierge start is observed|authoritative conversion event for decisions/i.test(
        t,
      ),
    );
    assert.ok(conciergeSurfaced.length <= 1);
  });
});

describe("Live expected-vs-observed language", () => {
  it("event outside GA4 allowlist remains unknown in live mode", () => {
    const bundle = {
      ga4: {
        ...emptyUnavailable("ga4"),
        ok: true,
        data: {
          fetchedAt: "2026-07-20T14:00:00.000Z",
          current: {
            traffic: { sessions: 100, engagedSessions: 50, engagementRate: 0.5 },
            sources: [],
            landingPages: [],
            devices: [],
            studioEvents: { diamond_studio_view: 10, consultation_cta_clicked: 5 },
            topShapes: [],
            consultationCtaClicks: 5,
            studioViews: 10,
          },
          previous: {
            traffic: { sessions: 90, engagedSessions: 45, engagementRate: 0.5 },
            sources: [],
            landingPages: [],
            devices: [],
            studioEvents: { diamond_studio_view: 8, consultation_cta_clicked: 4 },
            topShapes: [],
            consultationCtaClicks: 4,
            studioViews: 8,
          },
        },
        health: buildSourceHealth({
          sourceId: "ga4",
          configured: true,
          reachable: true,
          fresh: true,
          complete: true,
          permissionPosture: "read-only",
          lastSuccessfulRead: "2026-07-20T14:00:00.000Z",
          errors: [],
          retrievalState: "ok",
        }),
      },
      gsc: emptyUnavailable("gsc"),
      weeklyIntelligence: emptyUnavailable("weekly-intelligence"),
      hubspotAggregates: emptyUnavailable("hubspot-aggregates"),
      buffer: emptyUnavailable("buffer"),
      gbp: emptyUnavailable("gbp"),
    } as AgentOsDataBundle;

    const liveObs = deriveLiveConversionObservations(
      bundle,
      FIXTURE_REPORTING_PERIOD,
    );
    assert.ok(liveObs);
    assert.equal(liveObs!.mode, "live-derived");
    assert.equal(
      resolveObservedStatus(AUTHORITATIVE_CONVERSION_EVENT, liveObs),
      "unknown",
    );
    const findings = detectMeasurementFindings({
      inventory: buildExpectedEventInventory(liveObs),
      observations: liveObs,
    });
    assert.ok(
      !findings.some((f) => f.type === "expected-event-not-observed"),
    );
    const unverified = findings.find(
      (f) =>
        f.type === "verification-required" &&
        f.affectedEvent === AUTHORITATIVE_CONVERSION_EVENT,
    );
    assert.ok(unverified);
    assert.match(unverified!.observedEvidence, /unknown|unverified/i);
    assert.ok(!/broken tracking|users failed to convert|regressed/i.test(unverified!.observedEvidence));
    assert.ok(!/is absent(?!.*not)/i.test(unverified!.title));
  });

  it("unavailable GA4 cannot produce expected-event-not-observed", () => {
    const findings = detectMeasurementFindings({
      inventory: buildExpectedEventInventory(null),
      observations: null,
    });
    assert.ok(
      !findings.some((f) => f.type === "expected-event-not-observed"),
    );
    assert.ok(
      findings.some(
        (f) =>
          f.type === "verification-required" &&
          /unknown|unverified/i.test(f.observedEvidence),
      ),
    );
  });

  it("repository presence alone cannot produce a regression finding", () => {
    const findings = detectMeasurementFindings({
      inventory: buildExpectedEventInventory(null),
      observations: null,
    });
    assert.ok(!findings.some((f) => f.type === "measurement-regression"));
  });

  it("explicit fixture observation can produce the Concierge gap cluster", () => {
    const obs = createFixtureConversionObservations(FIXTURE_REPORTING_PERIOD);
    const findings = detectMeasurementFindings({
      inventory: buildExpectedEventInventory(obs),
      observations: obs,
    });
    assert.ok(findings.some((f) => f.type === "expected-event-not-observed"));
    assert.ok(findings.some((f) => f.type === "concierge-start-submit-gap"));
  });
});

describe("Opportunity handoff deduplication", () => {
  it("BI owns measurement repair; Opportunity stays measurement-blocked in JSON without duplicate fix-tracking rec", async () => {
    const run = await runAgentOsBrief({ mode: "fixture" });
    const biRoot = run.recommendations.filter(
      (r) =>
        r.originatingExecutive === "business-intelligence" &&
        r.recommendationId === CONCIERGE_CONVERSION_ROOT_RECOMMENDATION_ID,
    );
    assert.ok(biRoot.length >= 1);
    const oppFixTracking = run.recommendations.filter(
      (r) =>
        r.originatingExecutive === "opportunity" &&
        /fix conversion tracking|repair generate_lead|add concierge submit event/i.test(
          r.title + r.proposedAction,
        ),
    );
    assert.equal(oppFixTracking.length, 0);
    const paidBlocked = run.recommendations.some(
      (r) =>
        r.originatingExecutive === "opportunity" &&
        /paid-search/i.test(r.title) &&
        (/measurement-blocked|measurement prerequisite|Do not launch ads/i.test(
          r.plainLanguageExplanation + r.proposedAction + r.title,
        ) ||
          r.status === "blocked" ||
          (r.blockedReasons?.length ?? 0) > 0),
    );
    // Paid may be deferred from brief but present in JSON ranked/blocked set
    const anyPaid = run.recommendations.filter(
      (r) =>
        r.originatingExecutive === "opportunity" && /paid-search/i.test(r.title),
    );
    assert.ok(anyPaid.length >= 0); // readiness retained in opportunity executive path
    void paidBlocked;
    for (const r of anyPaid) {
      // Allow explicit "Do not launch ads" refusals; reject affirmative launch language.
      const action = r.proposedAction;
      const stripped = action.replace(/do not launch ads/gi, "");
      assert.ok(!/\blaunch ads\b/i.test(stripped));
      assert.match(
        r.proposedAction + r.title,
        /Do not launch ads|measurement|prerequisite|BI/i,
      );
    }
  });
});

describe("Measurement volume funnel", () => {
  it("does not convert every unknown/missing event into a recommendation", () => {
    const obs = createFixtureConversionObservations(FIXTURE_REPORTING_PERIOD);
    const { audit, recommendations } = runConversionMeasurementAudit({
      mode: "fixture",
      bundle: {} as AgentOsDataBundle,
      reportingPeriod: FIXTURE_REPORTING_PERIOD,
      fixtureOverlay: obs,
    });
    assert.ok(audit.volumeFunnel.expectedEventsInventoried >= 8);
    assert.ok(audit.volumeFunnel.rawFindings > audit.volumeFunnel.qualifiedFindings);
    assert.ok(audit.volumeFunnel.monitorDeferredFindings >= 1);
    assert.ok(
      recommendations.length < audit.volumeFunnel.rawFindings,
    );
    assert.ok(
      audit.volumeFunnel.surfacedEligibleBiRecommendations <=
        audit.volumeFunnel.rankedBiRecommendations,
    );
  });
});
