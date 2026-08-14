/**
 * P1-QA-1 — Website / Engineering QA specialist under BI.
 * No live email, deploy, or external mutation.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isExecutiveOperational,
  listExecutives,
  operationalExecutives,
  PRODUCTION_CASE_STUDY_LEDGER,
  PRODUCTION_AUTHORITY_OUTREACH_WAVE,
  proposedActionImpliesWrite,
  runAgentOsBrief,
  runAuthoritySpecialist,
  runBusinessIntelligence,
  runChiefOfStaff,
  runContentExecutive,
  runWebsiteQaSpecialist,
  scaffoldExecutives,
  WEBSITE_QA_CRITICAL_ROUTES,
  WEBSITE_QA_ROOT_EXCEPTION_ID,
} from "./index";
import { emptyBusinessIntelligenceOutput } from "./bi/empty";
import { emptyContentExecutiveOutput } from "./executives/content";
import { emptyOpportunityExecutiveOutput } from "./executives/opportunity";
import { emptySearchStrategyOutput } from "./executives/search-strategy";
import { loadAllSources } from "./adapters/load";
import { FIXTURE_REPORTING_PERIOD } from "./fixtures/sample-data";
import { CURRENT_OPERATING_BACKLOG, recommendationsFromOperatingBacklog } from "./operating-backlog";
import { isCaseStudyProductionFounderNow } from "./content/authority";
import {
  classifyWebsiteQaPermissionTier,
  websiteQaMayExecute,
} from "./bi/website-qa/permissions";
import { skippedRouteProbe } from "./bi/website-qa/probe";
import type { WebsiteQaRouteProbe } from "./bi/website-qa/types";
import { dailyTodayCall } from "./brief-quality";
import { isWatchItem } from "./operating-backlog/surface-policy";
import { buildRecommendation } from "./recommendation";
import { createEvidence } from "./evidence";
import type { ConversionMeasurementAudit } from "./bi/types";

const PERIOD = { ...FIXTURE_REPORTING_PERIOD };

function healthyProbe(route: string): WebsiteQaRouteProbe {
  return {
    route,
    requestUrl: `https://www.hourglassdiamonds.com${route === "/" ? "/" : route}`,
    status: 200,
    reachable: true,
    probeOutcome: "ok",
    redirectLocation: null,
    epistemicClass: "observed",
    notes: ["HTTP 200"],
  };
}

function failedProbe(route: string, status = 503): WebsiteQaRouteProbe {
  return {
    route,
    requestUrl: `https://www.hourglassdiamonds.com${route}`,
    status,
    reachable: true,
    probeOutcome: "server-error",
    redirectLocation: null,
    epistemicClass: "observed",
    notes: [`HTTP ${status}`],
  };
}

function timeoutProbe(route: string): WebsiteQaRouteProbe {
  return {
    ...skippedRouteProbe(route),
    probeOutcome: "timeout",
    notes: ["QA probe timed out — UNKNOWN"],
  };
}

function clientErrorProbe(route: string, status = 404): WebsiteQaRouteProbe {
  return {
    route,
    requestUrl: `https://www.hourglassdiamonds.com${route}`,
    status,
    reachable: true,
    probeOutcome: "client-error",
    redirectLocation: null,
    epistemicClass: "observed",
    notes: [`HTTP ${status}`],
  };
}

function offHostRedirectProbe(route: string): WebsiteQaRouteProbe {
  return {
    route,
    requestUrl: `https://www.hourglassdiamonds.com${route}`,
    status: 302,
    reachable: true,
    probeOutcome: "redirect",
    redirectLocation: "https://example.net/elsewhere",
    epistemicClass: "observed",
    notes: ["Off-host redirect"],
  };
}

function stubAudit(
  over: Partial<ConversionMeasurementAudit> & {
    findings?: ConversionMeasurementAudit["findings"];
  },
): ConversionMeasurementAudit {
  return {
    expectedEvents: [],
    funnels: [],
    findings: [],
    opportunityHandoff: {
      conversionEventVerified: false,
      conversionEventStatus: "unknown",
      authoritativeConversionEvent: "generate_lead",
      destinationMeasurable: false,
      sourceAttributionUsable: false,
      geographicSegmentationAvailable: false,
      paidSearchMeasurementPrerequisiteMissing: true,
      remarketingAudienceEvidenceAvailable: false,
      remarketingConsentEvidenceAvailable: false,
      toolEngagementObserved: false,
      toolToConciergeMeasurable: false,
      measurementPrerequisites: [],
      decisionBlockingFindingIds: [],
      decisionDegradingFindingIds: [],
      notes: [],
    },
    volumeFunnel: {
      expectedEventsInventoried: 0,
      observedEvents: 0,
      notObservedEvents: 0,
      unknownEvents: 0,
      rawFindings: 0,
      qualifiedFindings: 0,
      monitorDeferredFindings: 0,
      rankedBiRecommendations: 0,
      surfacedEligibleBiRecommendations: 0,
    },
    facts: [],
    inferences: [],
    observationMode: "unavailable",
    ...over,
  };
}

describe("P1-QA-1 registry", () => {
  it("keeps exactly five executives and does not add QA as an executive", () => {
    assert.deepEqual(listExecutives().map((e) => e.id), [
      "chief-of-staff",
      "business-intelligence",
      "search-strategy",
      "content",
      "opportunity",
    ]);
    assert.equal(operationalExecutives().length, 5);
    assert.deepEqual(scaffoldExecutives(), []);
    assert.equal(isExecutiveOperational("business-intelligence"), true);
    const bi = listExecutives().find((e) => e.id === "business-intelligence");
    assert.ok(bi?.ownedDomains.includes("website / engineering QA"));
  });
});

describe("P1-QA-1 healthy production", () => {
  it("A — all 7 routes observed OK → HEALTHY and zero QA founder recs", async () => {
    assert.equal(WEBSITE_QA_CRITICAL_ROUTES.length, 7);
    const snap = await runWebsiteQaSpecialist({
      routeProbes: WEBSITE_QA_CRITICAL_ROUTES.map((r) => healthyProbe(r)),
    });
    assert.equal(snap.health, "healthy");
    assert.equal(snap.exception, null);
    const bundle = await loadAllSources("fixture");
    const bi = runBusinessIntelligence(bundle, PERIOD, { websiteQa: snap });
    assert.equal(
      bi.recommendations.some(
        (r) => r.recommendationId === WEBSITE_QA_ROOT_EXCEPTION_ID,
      ),
      false,
    );
    const blob = bi.recommendations.map((r) => r.title).join("\n");
    assert.doesNotMatch(blob, /run tests|review website|improvement checklist/i);
    assert.equal(
      bi.facts.some((f) => /Production health:/i.test(f)),
      false,
    );
  });

  it("B — 1 route OK + 6 UNKNOWN → UNKNOWN, silent, not HEALTHY", async () => {
    const routes = WEBSITE_QA_CRITICAL_ROUTES.map((r, i) =>
      i === 0 ? healthyProbe(r) : skippedRouteProbe(r),
    );
    const snap = await runWebsiteQaSpecialist({ routeProbes: routes });
    assert.equal(snap.health, "unknown");
    assert.notEqual(snap.health, "healthy");
    assert.equal(snap.exception, null);
  });

  it("skipped HTTP is UNKNOWN and silent — not an invented outage", async () => {
    const snap = await runWebsiteQaSpecialist({ liveHttp: false });
    assert.equal(snap.health, "unknown");
    assert.equal(snap.exception, null);
  });
});

describe("P1-QA-1 critical / degraded route failure", () => {
  it("D — observed 5xx emits one stable root exception identifying the affected route", async () => {
    const routes = WEBSITE_QA_CRITICAL_ROUTES.map((r) =>
      r === "/concierge" ? failedProbe(r) : healthyProbe(r),
    );
    const snap = await runWebsiteQaSpecialist({ routeProbes: routes });
    assert.equal(snap.health, "critical");
    assert.ok(snap.exception);
    assert.equal(snap.exception?.id, WEBSITE_QA_ROOT_EXCEPTION_ID);
    assert.deepEqual(snap.exception?.affectedRoutes, ["/concierge"]);
    const bundle = await loadAllSources("fixture");
    const bi = runBusinessIntelligence(bundle, PERIOD, { websiteQa: snap });
    const qaRecs = bi.recommendations.filter(
      (r) => r.recommendationId === WEBSITE_QA_ROOT_EXCEPTION_ID,
    );
    assert.equal(qaRecs.length, 1);
    assert.match(qaRecs[0]!.plainLanguageExplanation, /\/concierge/);
    assert.doesNotMatch(qaRecs[0]!.proposedAction, /\bdeploy\b/i);
  });

  it("D — observed 4xx is CRITICAL with one bounded root rec", async () => {
    const routes = WEBSITE_QA_CRITICAL_ROUTES.map((r) =>
      r === "/engagement-rings" ? clientErrorProbe(r, 404) : healthyProbe(r),
    );
    const snap = await runWebsiteQaSpecialist({ routeProbes: routes });
    assert.equal(snap.health, "critical");
    assert.equal(snap.exception?.id, WEBSITE_QA_ROOT_EXCEPTION_ID);
    assert.deepEqual(snap.exception?.affectedRoutes, ["/engagement-rings"]);
  });

  it("E — off-host redirect is DEGRADED with one bounded root rec", async () => {
    const routes = WEBSITE_QA_CRITICAL_ROUTES.map((r) =>
      r === "/custom-design" ? offHostRedirectProbe(r) : healthyProbe(r),
    );
    const snap = await runWebsiteQaSpecialist({ routeProbes: routes });
    assert.equal(snap.health, "degraded");
    assert.equal(snap.exception?.id, WEBSITE_QA_ROOT_EXCEPTION_ID);
    assert.deepEqual(snap.exception?.affectedRoutes, ["/custom-design"]);
    const bundle = await loadAllSources("fixture");
    const bi = runBusinessIntelligence(bundle, PERIOD, { websiteQa: snap });
    assert.equal(
      bi.recommendations.filter(
        (r) => r.recommendationId === WEBSITE_QA_ROOT_EXCEPTION_ID,
      ).length,
      1,
    );
  });
});

describe("P1-QA-1 multiple route failures", () => {
  it("stays one root exception covering all affected routes", async () => {
    const routes = WEBSITE_QA_CRITICAL_ROUTES.map((r) =>
      r === "/concierge" || r === "/diamond-studio"
        ? failedProbe(r)
        : healthyProbe(r),
    );
    const snap = await runWebsiteQaSpecialist({ routeProbes: routes });
    assert.equal(snap.exception?.affectedRoutes.length, 2);
    const bundle = await loadAllSources("fixture");
    const bi = runBusinessIntelligence(bundle, PERIOD, { websiteQa: snap });
    assert.equal(
      bi.recommendations.filter(
        (r) => r.recommendationId === WEBSITE_QA_ROOT_EXCEPTION_ID,
      ).length,
      1,
    );
  });
});

describe("P1-QA-1 timeout / unavailable", () => {
  it("treats all-timeouts as UNKNOWN rather than an invented outage", async () => {
    const snap = await runWebsiteQaSpecialist({
      routeProbes: WEBSITE_QA_CRITICAL_ROUTES.map((r) => timeoutProbe(r)),
    });
    assert.equal(snap.health, "unknown");
    assert.equal(snap.exception, null);
  });

  it("C — 6 OK + 1 timeout → UNKNOWN and zero QA founder rec", async () => {
    const routes = WEBSITE_QA_CRITICAL_ROUTES.map((r) =>
      r === "/diamond-intelligence" ? timeoutProbe(r) : healthyProbe(r),
    );
    const snap = await runWebsiteQaSpecialist({ routeProbes: routes });
    assert.equal(snap.health, "unknown");
    assert.notEqual(snap.health, "healthy");
    assert.equal(snap.exception, null);
  });
});

describe("P1-QA-1 analytics", () => {
  it("does not turn skipped/low-volume fixture measurement into a QA regression", async () => {
    const snap = await runWebsiteQaSpecialist({
      routeProbes: WEBSITE_QA_CRITICAL_ROUTES.map((r) => healthyProbe(r)),
    });
    const bundle = await loadAllSources("fixture");
    const withoutQa = runBusinessIntelligence(bundle, PERIOD);
    const bi = runBusinessIntelligence(bundle, PERIOD, { websiteQa: snap });
    assert.equal(bi.websiteQa.exception, null);
    assert.equal(
      bi.recommendations.some(
        (r) => r.recommendationId === WEBSITE_QA_ROOT_EXCEPTION_ID,
      ),
      false,
    );
    const withoutIds = withoutQa.recommendations
      .map((r) => r.recommendationId)
      .sort();
    const withIds = bi.recommendations
      .filter((r) => r.recommendationId !== WEBSITE_QA_ROOT_EXCEPTION_ID)
      .map((r) => r.recommendationId)
      .sort();
    assert.deepEqual(withIds, withoutIds);
  });

  it("does not duplicate a genuine BI measurement failure as a QA exception", async () => {
    const snap = await runWebsiteQaSpecialist({
      routeProbes: WEBSITE_QA_CRITICAL_ROUTES.map((r) => healthyProbe(r)),
      conversionAudit: stubAudit({
        observationMode: "live-derived",
        findings: [
          {
            id: "bi:measurement:generate_lead:decision-blocking",
            type: "measurement-regression",
            title: "Authoritative conversion event missing",
            expectedEvidence: "generate_lead observed",
            observedEvidence: "not observed",
            confidence: 0.9,
            sampleSize: 120,
            freshness: "current",
            severity: "critical",
            decisionEffect: "decision-blocking",
            likelyDecisionImpact: "Cannot evaluate conversion",
            affectedFunnel: "general-consultation",
            affectedRoute: "/concierge",
            affectedEvent: "generate_lead",
            recommendedNextAction: "Repair conversion measurement",
            whyItMatters: "Core conversion integrity",
            dependency: null,
            owner: "BI",
            founderApprovalRequired: false,
            codeOrConfigChangeEventuallyRequired: true,
            blocksOtherExecutive: true,
            isInference: false,
            suppressRecommendation: false,
          },
        ],
      }),
    });
    assert.equal(snap.health, "healthy");
    assert.equal(snap.exception, null);
    assert.equal(snap.conversionIntegrity.state, "degraded");
    assert.ok(snap.conversionIntegrity.decisionBlockingCount > 0);
  });
});

describe("P1-QA-1 completed systems", () => {
  it("does not reopen Size Studio / a11y / Concierge without a production regression", async () => {
    const snap = await runWebsiteQaSpecialist({
      routeProbes: WEBSITE_QA_CRITICAL_ROUTES.map((r) => healthyProbe(r)),
    });
    const blob = [...snap.facts, ...snap.inferences, snap.exception?.summary ?? ""].join(
      "\n",
    );
    assert.doesNotMatch(blob, /reopen Size Studio|accessibility sprint|schema enhancement/i);
    assert.equal(snap.exception, null);
  });
});

describe("P1-QA-1 permissions", () => {
  it("blocks deploy/write and executes GREEN only", () => {
    assert.equal(
      classifyWebsiteQaPermissionTier("report production health"),
      "green",
    );
    assert.equal(websiteQaMayExecute("deploy the fix to production"), false);
    assert.equal(proposedActionImpliesWrite("deploy the fix to production"), true);
    assert.equal(
      classifyWebsiteQaPermissionTier("prepare a repair plan"),
      "yellow",
    );
    assert.equal(websiteQaMayExecute("prepare a repair plan"), false);
  });
});

describe("P1-QA-1 CoS exception vs silence", () => {
  it("critical route failure becomes one founder-now exception, not a flood", async () => {
    const routes = WEBSITE_QA_CRITICAL_ROUTES.map((r) =>
      r === "/concierge" ? failedProbe(r) : healthyProbe(r),
    );
    const snap = await runWebsiteQaSpecialist({ routeProbes: routes });
    const bundle = await loadAllSources("fixture");
    const bi = runBusinessIntelligence(bundle, PERIOD, { websiteQa: snap });
    const cos = runChiefOfStaff({
      bi,
      search: emptySearchStrategyOutput(),
      content: emptyContentExecutiveOutput(),
      opportunity: emptyOpportunityExecutiveOutput(),
      reportingPeriod: PERIOD,
      warnings: [],
      mode: "fixture",
      briefCadenceIntent: "daily",
      briefLocalDate: "2026-08-14",
      operatingBacklog: CURRENT_OPERATING_BACKLOG,
    });
    assert.equal(
      cos.recommendations.filter(
        (r) => r.recommendationId === WEBSITE_QA_ROOT_EXCEPTION_ID,
      ).length,
      1,
    );
    assert.match(cos.brief.highestRoiAction, /production health|\/concierge/i);
    assert.doesNotMatch(cos.brief.highestRoiAction, /audit Concierge|test mobile/i);
    assert.equal(
      cos.brief.surfacedPriorityTitles.filter((t) =>
        /Production health regression/i.test(t),
      ).length,
      0,
    );
  });
});

describe("P1-QA-1 Authority pause", () => {
  it("keeps six Case Studies intact and Case Study production on watch", async () => {
    assert.equal(PRODUCTION_CASE_STUDY_LEDGER.length, 6);
    assert.equal(
      PRODUCTION_AUTHORITY_OUTREACH_WAVE.followUpEligibility,
      "not-due",
    );
    assert.equal(isCaseStudyProductionFounderNow(CURRENT_OPERATING_BACKLOG), false);
    const caseStudy = CURRENT_OPERATING_BACKLOG.masterSprint.items.find(
      (i) => i.id === "sprint-case-study-production",
    );
    assert.ok(caseStudy);
    assert.equal(caseStudy?.status, "active");
    assert.ok(isWatchItem(caseStudy!));
    const auth = runAuthoritySpecialist();
    assert.equal(auth.caseStudies.founderAffirmedCount, 6);
    assert.equal(auth.outreach.founderTask, "none");

    const bundle = await loadAllSources("fixture");
    const content = runContentExecutive(bundle, PERIOD);
    const recBlob = content.recommendations.map((r) => r.title).join("\n");
    const cos = runChiefOfStaff({
      bi: emptyBusinessIntelligenceOutput(),
      search: emptySearchStrategyOutput(),
      content,
      opportunity: emptyOpportunityExecutiveOutput(),
      reportingPeriod: PERIOD,
      warnings: [],
      mode: "fixture",
      briefCadenceIntent: "daily",
      briefLocalDate: "2026-08-14",
      operatingBacklog: CURRENT_OPERATING_BACKLOG,
    });
    const today = dailyTodayCall({
      whyItMatters: cos.brief.whyItMatters,
      highestRoiAction: cos.brief.highestRoiAction,
      sprintOrientation: cos.brief.sprintOrientation,
      dayOrientation: cos.brief.dayOrientation,
    });
    assert.doesNotMatch(today, /Editorial ROI/i);
    assert.doesNotMatch(cos.brief.highestRoiAction, /Start Aviary Bloom/i);
    assert.doesNotMatch(today, /Activate the Website \/ Engineering QA/i);
    assert.match(
      cos.brief.dayOrientation ?? "",
      /No additional founder-now work is queued today/i,
    );
    assert.ok(
      (cos.brief.watchNoActionItems ?? []).some((l) =>
        /Case Study production — paused by founder/i.test(l),
      ),
    );
    void recBlob;
  });
});

describe("P1-QA-1 activation lifecycle", () => {
  it("F — completed QA activation is not Today's Call", () => {
    const item = CURRENT_OPERATING_BACKLOG.masterSprint.items.find(
      (i) => i.id === "sprint-activate-website-qa",
    );
    assert.equal(item?.status, "completed");
    const recs = recommendationsFromOperatingBacklog(CURRENT_OPERATING_BACKLOG, {
      nowIso: "2026-08-14T11:05:00.000Z",
    });
    assert.equal(
      recs.some((r) => /Activate the Website \/ Engineering QA/i.test(r.title)),
      false,
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
      briefLocalDate: "2026-08-14",
      operatingBacklog: CURRENT_OPERATING_BACKLOG,
    });
    const today = dailyTodayCall({
      whyItMatters: cos.brief.whyItMatters,
      highestRoiAction: cos.brief.highestRoiAction,
      sprintOrientation: cos.brief.sprintOrientation,
      dayOrientation: cos.brief.dayOrientation,
    });
    assert.doesNotMatch(today, /Activate the Website \/ Engineering QA/i);
    assert.doesNotMatch(
      cos.brief.highestRoiAction,
      /Activate the Website \/ Engineering QA/i,
    );
  });

  it("G — empty founder-now is quiet day with no Search/Content/Opportunity backfill", () => {
    const busywork = buildRecommendation({
      recommendationId: "search-strategy:tool-handoff:busywork-qa",
      originatingExecutive: "search-strategy",
      title:
        '[Search Strategy] Add a tool handoff on “Do Fancy Shape Diamonds Have Cut Grades”',
      plainLanguageExplanation: "Repository tool-handoff gap",
      whyItMattersNow: "Size/shape education should connect to Studio tools.",
      proposedAction:
        "Add a contextual link from the article to See It On Your Hand.",
      expectedUpside: "Clearer tool path",
      effortEstimate: "low",
      urgency: "medium",
      reversibility: "easily-reversed",
      baseConfidence: 0.8,
      evidence: [
        createEvidence({
          source: "repository-content-inventory",
          sourceType: "internal-report",
          collectedAt: "2026-08-14T11:05:00.000Z",
          reportingPeriod: PERIOD,
          metricOrObservation: "test",
          reliability: "reliable",
          supportingReference: "repo://test",
        }),
      ],
      assumptions: [],
      risks: [],
      dependencies: [],
      approvalRequired: false,
      suggestedOwner: "Founder / Search Strategy",
      rankingFactors: { expectedBusinessImpact: 9, strategicAlignment: 8 },
    });
    const cos = runChiefOfStaff({
      bi: emptyBusinessIntelligenceOutput(),
      search: { ...emptySearchStrategyOutput(), recommendations: [busywork] },
      content: emptyContentExecutiveOutput(),
      opportunity: emptyOpportunityExecutiveOutput(),
      reportingPeriod: PERIOD,
      warnings: [],
      mode: "fixture",
      briefCadenceIntent: "daily",
      briefLocalDate: "2026-08-14",
      operatingBacklog: CURRENT_OPERATING_BACKLOG,
    });
    assert.match(
      cos.brief.dayOrientation ?? "",
      /No additional founder-now work is queued today/i,
    );
    assert.doesNotMatch(cos.brief.highestRoiAction, /Fancy Shape|tool handoff/i);
    assert.doesNotMatch(cos.brief.highestRoiAction, /Charlotte/i);
    assert.doesNotMatch(cos.brief.highestRoiAction, /Editorial ROI/i);
    assert.doesNotMatch(cos.brief.highestRoiAction, /paid-search/i);
    assert.equal(
      cos.brief.surfacedPriorityTitles.some((t) =>
        /Fancy Shape|Charlotte|Editorial ROI/i.test(t),
      ),
      false,
    );
  });
});

describe("P1-QA-1 no live mutation", () => {
  it("fixture Agent OS brief does not send email or mutate externals", async () => {
    const run = await runAgentOsBrief({
      mode: "fixture",
      briefCadenceIntent: "daily",
      briefLocalDate: "2026-08-14",
      operatingBacklog: CURRENT_OPERATING_BACKLOG,
    });
    assert.equal(run.mode, "fixture");
    assert.notEqual(run.deliveryGuidance, undefined);
    assert.equal(
      run.recommendations.some(
        (r) => r.recommendationId === WEBSITE_QA_ROOT_EXCEPTION_ID,
      ),
      false,
    );
    assert.doesNotMatch(
      run.brief.highestRoiAction,
      /Activate the Website \/ Engineering QA/i,
    );
    assert.doesNotMatch(run.brief.markdown, /## Production Health/i);
    assert.equal(run.deliveryGuidance, "send-nothing");
  });
});
