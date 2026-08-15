/**
 * P1-BI-2 — Accepted Concierge inquiry attribution evidence under BI.
 * No live email, CRM mutation, analytics write, or deploy.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ATTRIBUTION_COVERAGE_INTEGRITY_ID,
  ATTRIBUTION_FUNNEL_STAGES,
  ATTRIBUTION_JOIN_STATUS,
  attributionMayExecute,
  classifyAttributionPermissionTier,
  classifyInquiryOrigin,
  founderFacingAttributionTextContainsPii,
  isExecutiveOperational,
  listExecutives,
  operationalExecutives,
  PRODUCTION_AUTHORITY_OUTREACH_WAVE,
  PRODUCTION_CASE_STUDY_LEDGER,
  proposedActionImpliesWrite,
  runAcceptedInquiryAttributionSpecialist,
  runAgentOsBrief,
  runAuthoritySpecialist,
  runBusinessIntelligence,
  runChiefOfStaff,
  runContentExecutive,
  scaffoldExecutives,
  WEBSITE_QA_CRITICAL_ROUTES,
  WEBSITE_QA_ROOT_EXCEPTION_ID,
} from "./index";
import { reconstructConciergeFromHubSpot } from "./bi/client-attention";
import { emptyBusinessIntelligenceOutput } from "./bi/empty";
import { emptyContentExecutiveOutput } from "./executives/content";
import { emptyOpportunityExecutiveOutput } from "./executives/opportunity";
import { emptySearchStrategyOutput } from "./executives/search-strategy";
import { loadAllSources } from "./adapters/load";
import { FIXTURE_REPORTING_PERIOD } from "./fixtures/sample-data";
import { CURRENT_OPERATING_BACKLOG } from "./operating-backlog";
import { isCaseStudyProductionFounderNow } from "./content/authority";
import { isWatchItem } from "./operating-backlog/surface-policy";
import { CLIENT_ATTENTION_FIXTURE_NOW } from "./bi/client-attention";
import type { NormalizedConciergeSubmission } from "./bi/client-attention/adapters/types";
import { parseConciergeDealDescription } from "./bi/client-attention/adapters/concierge-from-hubspot";
import { runWebsiteQaSpecialist } from "./bi/website-qa";
import { containsLikelyPiiOrSecret } from "./redaction";

const PERIOD = { ...FIXTURE_REPORTING_PERIOD };
const NOW = CLIENT_ATTENTION_FIXTURE_NOW;

function hoursAgo(hours: number): string {
  return new Date(Date.parse(NOW) - hours * 3600_000).toISOString();
}

function submission(
  over: Partial<NormalizedConciergeSubmission> &
    Pick<NormalizedConciergeSubmission, "submissionId">,
): NormalizedConciergeSubmission {
  return {
    accepted: true,
    submittedAt: hoursAgo(24),
    ...over,
  };
}

function concierge(submissions: NormalizedConciergeSubmission[]) {
  return {
    sourceType: "concierge" as const,
    status: "ok" as const,
    collectedAt: NOW,
    recordCount: submissions.length,
    submissions,
  };
}

function runAttribution(
  submissions: NormalizedConciergeSubmission[],
  ga4?: {
    generateLeadCount?: number;
    conciergeFormStarted?: number;
    conciergeFormSubmitted?: number;
    consultationCtaClicks?: number;
  },
  coverage?: {
    crmReadLookbackDays?: number;
    crmRecordCap?: number | null;
    crmRecordsReturned?: number | null;
    mode?: "fixture" | "live";
    conciergeStatus?: "ok" | "empty" | "not-configured" | "failed";
  },
) {
  return runAcceptedInquiryAttributionSpecialist({
    mode: coverage?.mode ?? "fixture",
    nowIso: NOW,
    reportingPeriod: PERIOD,
    concierge:
      coverage?.conciergeStatus && coverage.conciergeStatus !== "ok"
        ? {
            sourceType: "concierge",
            status: coverage.conciergeStatus,
            collectedAt: NOW,
            recordCount: 0,
            submissions: [],
          }
        : concierge(submissions),
    crmReadLookbackDays: coverage?.crmReadLookbackDays ?? 90,
    crmRecordCap: coverage?.crmRecordCap,
    crmRecordsReturned: coverage?.crmRecordsReturned,
    ga4Available: Boolean(ga4),
    ga4Current: ga4 ?? null,
  });
}

function snapshotBlob(value: unknown): string {
  return JSON.stringify(value);
}

describe("P1-BI-2 registry", () => {
  it("K — keeps exactly five executives and does not add an attribution executive", () => {
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
    assert.ok(bi?.ownedDomains.includes("accepted-inquiry attribution evidence"));
  });
});

describe("P1-BI-2 reconstruction and aggregation", () => {
  it("A — accepted Concierge deals aggregate without PII", () => {
    const submissions = [
      submission({
        submissionId: "a1",
        normalizedEmail: "ada.fixture@clients.example.test",
        firstName: "Ada",
        lastName: "Example",
        fullName: "Ada Example",
        originatingTool: "diamond-studio",
        hubspotDealId: "deal-secret-1",
      }),
      submission({
        submissionId: "a2",
        normalizedEmail: "bob.fixture@clients.example.test",
        originatingTool: "diamond-studio",
      }),
    ];
    const { snapshot, recommendations } = runAttribution(submissions, {
      generateLeadCount: 2,
    });
    const blob = snapshotBlob(snapshot);
    assert.equal(snapshot.acceptedInquiryCount, 2);
    assert.equal(snapshot.explicitOriginCount, 2);
    assert.equal(containsLikelyPiiOrSecret(blob), false);
    assert.doesNotMatch(blob, /Ada Example|ada\.fixture|bob\.fixture|deal-secret-1/i);
    assert.equal(founderFacingAttributionTextContainsPii(blob), false);
    assert.equal(recommendations.length, 0);
  });

  it("B — originating tool is counted only when explicitly parsed", () => {
    const inferredWouldBeWrong = submission({
      submissionId: "b1",
      landingPath: "/diamond-studio",
    });
    const explicit = submission({
      submissionId: "b2",
      originatingTool: "diamond-studio",
    });
    const { snapshot } = runAttribution([inferredWouldBeWrong, explicit]);
    assert.deepEqual(snapshot.byOriginatingTool, [
      { key: "diamond-studio", count: 1 },
    ]);
    assert.equal(snapshot.byOriginClass["explicit-tool-origin"], 1);
    assert.equal(snapshot.byOriginClass["landing-campaign-context"], 1);
    const origin = classifyInquiryOrigin(inferredWouldBeWrong);
    assert.equal(origin.originatingTool, undefined);
    assert.equal(origin.originClass, "landing-campaign-context");
  });

  it("C — CTA / landing / UTM remain explicit evidence, not inferred", () => {
    const parsed = parseConciergeDealDescription(
      [
        "Submission ID: sub-explicit",
        "Project Type: Engagement Ring",
        "",
        "Attribution:",
        "UTM Source: newsletter",
        "UTM Medium: email",
        "UTM Campaign: july-guide",
        "Landing path: /custom-design",
        "Last CTA: custom_design:footer",
      ].join("\n"),
    );
    assert.equal(parsed.utmSource, "newsletter");
    assert.equal(parsed.utmMedium, "email");
    assert.equal(parsed.utmCampaign, "july-guide");
    assert.equal(parsed.landingPath, "/custom-design");
    assert.equal(parsed.lastCtaLocation, "custom_design:footer");
    assert.equal(parsed.originatingTool, undefined);

    const { snapshot } = runAttribution([
      submission({
        submissionId: "c1",
        lastCtaLocation: "home:hero",
        landingPath: "/engagement-rings",
        utmSource: "google",
        utmMedium: "organic",
      }),
    ]);
    assert.deepEqual(snapshot.byCtaSurface, [{ key: "home", count: 1 }]);
    assert.deepEqual(snapshot.byLandingPath, [
      { key: "/engagement-rings", count: 1 },
    ]);
    assert.deepEqual(snapshot.byUtmSource, [{ key: "google", count: 1 }]);
    assert.equal(snapshot.byOriginatingTool.length, 0);
    assert.equal(snapshot.byOriginClass["explicit-cta-surface"], 1);
  });

  it("D — missing origin becomes UNKNOWN", () => {
    const { snapshot } = runAttribution([
      submission({ submissionId: "d1" }),
      submission({ submissionId: "d2" }),
    ]);
    assert.equal(snapshot.unknownOriginCount, 2);
    assert.equal(snapshot.explicitOriginCount, 0);
    assert.equal(snapshot.byOriginClass.unknown, 2);
    assert.equal(snapshot.originCoverageRate, 0);
  });
});

describe("P1-BI-2 GA4 unjoined sanity", () => {
  it("E/F — GA4 and CRM counts are labeled unjoined; mismatch is not a missing-lead claim", () => {
    const { snapshot, recommendations } = runAttribution(
      [
        submission({ submissionId: "e1", originatingTool: "conversations" }),
        submission({ submissionId: "e2", originatingTool: "conversations" }),
        submission({ submissionId: "e3" }),
        submission({ submissionId: "e4" }),
      ],
      {
        generateLeadCount: 5,
        conciergeFormSubmitted: 5,
        conciergeFormStarted: 8,
        consultationCtaClicks: 20,
      },
    );
    assert.equal(snapshot.acceptedInquiryCount, 4);
    assert.equal(snapshot.ga4Sanity.joinStatus, ATTRIBUTION_JOIN_STATUS);
    assert.equal(snapshot.ga4Sanity.identityJoinPerformed, false);
    assert.equal(snapshot.ga4Sanity.reconciliationClaim, false);
    assert.equal(snapshot.ga4Sanity.generateLeadCount, 5);
    assert.match(snapshot.ga4Sanity.note, /UNJOINED/i);
    assert.doesNotMatch(
      snapshotBlob(snapshot),
      /missing from HubSpot|one lead is missing|reconcile identities/i,
    );
    assert.equal(recommendations.length, 0);
  });
});

describe("P1-BI-2 small-sample discipline", () => {
  it("G — tiny samples stay descriptive and do not create founder recommendations", async () => {
    const { snapshot, recommendations } = runAttribution(
      [
        submission({ submissionId: "g1", originatingTool: "diamond-studio" }),
        submission({ submissionId: "g2", originatingTool: "diamond-studio" }),
        submission({ submissionId: "g3" }),
        submission({ submissionId: "g4" }),
      ],
      { generateLeadCount: 4 },
    );
    assert.equal(snapshot.sampleStrength, "DESCRIPTIVE_ONLY");
    assert.equal(snapshot.founderRecommendationEmitted, false);
    assert.equal(recommendations.length, 0);
    assert.match(
      snapshot.facts.join("\n"),
      /2 of 4 accepted inquiries explicitly named diamond-studio/i,
    );
    assert.match(
      snapshot.facts.join("\n"),
      /Sample too small to change product or acquisition strategy/i,
    );
    assert.doesNotMatch(
      snapshot.facts.join("\n"),
      /best-performing acquisition source/i,
    );

    const bundle = await loadAllSources("fixture");
    const bi = runBusinessIntelligence(bundle, PERIOD, {
      attributionConcierge: concierge([
        submission({ submissionId: "g1", originatingTool: "diamond-studio" }),
        submission({ submissionId: "g2", originatingTool: "diamond-studio" }),
        submission({ submissionId: "g3" }),
        submission({ submissionId: "g4" }),
      ]),
      attributionCrmReadLookbackDays: 90,
    });
    assert.equal(
      bi.recommendations.some(
        (r) => r.recommendationId === ATTRIBUTION_COVERAGE_INTEGRITY_ID,
      ),
      false,
    );
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
    assert.doesNotMatch(
      cos.brief.highestRoiAction,
      /origin capture|Diamond Studio is the best/i,
    );
  });

  it("H — attribution coverage collapse can create one bounded BI integrity finding", () => {
    const collapsed = Array.from({ length: 8 }, (_, i) =>
      submission({ submissionId: `h${i}` }),
    );
    const { snapshot, recommendations } = runAttribution(collapsed, {
      generateLeadCount: 8,
    });
    assert.equal(snapshot.sampleStrength, "MATERIAL_SIGNAL");
    assert.equal(snapshot.coverageIntegrityFinding, true);
    assert.equal(recommendations.length, 1);
    assert.equal(
      recommendations[0]?.recommendationId,
      ATTRIBUTION_COVERAGE_INTEGRITY_ID,
    );
    assert.match(recommendations[0]?.title ?? "", /coverage collapsed/i);

    const tinyUnknown = Array.from({ length: 3 }, (_, i) =>
      submission({ submissionId: `tiny${i}` }),
    );
    const tiny = runAttribution(tinyUnknown);
    assert.equal(tiny.snapshot.coverageIntegrityFinding, false);
    assert.equal(tiny.recommendations.length, 0);
  });
});

describe("P1-BI-2 qualification and revenue bans", () => {
  it("I — NEW_INQUIRY is not labeled qualified", () => {
    const { snapshot } = runAttribution([
      submission({
        submissionId: "i1",
        originatingTool: "diamond-intelligence",
      }),
    ]);
    assert.equal(
      snapshot.funnel.qualifiedOpportunity,
      ATTRIBUTION_FUNNEL_STAGES.qualifiedOpportunity,
    );
    assert.equal(
      snapshot.funnel.qualifiedOpportunity,
      "unknown-not-yet-defined",
    );
    const blob = snapshotBlob(snapshot);
    assert.doesNotMatch(
      blob,
      /qualified lead|qualified conversation|qualified opportunity = /i,
    );
    assert.match(
      snapshot.facts.join("\n"),
      /accepted Concierge inquiry ≠ qualified opportunity/i,
    );
  });

  it("J — revenue / amount is not surfaced or ranked", () => {
    const reconstructed = reconstructConciergeFromHubSpot({
      nowIso: NOW,
      maxSubmissions: 10,
      dealDescriptions: {
        paid: [
          "Submission ID: sub-paid",
          "Project Type: Engagement Ring",
          "",
          "Attribution:",
          "Originating Tool: diamond-shape-studio",
        ].join("\n"),
      },
      deals: [
        {
          dealId: "paid",
          contactIds: ["c1"],
          dealName: "Ada Example — Engagement Ring",
          stage: "appointmentscheduled",
          amount: 18400,
          createdAt: hoursAgo(10),
        },
      ],
      contacts: [
        {
          contactId: "c1",
          normalizedEmail: "ada.amount@clients.example.test",
          firstName: "Ada",
          lastName: "Example",
        },
      ],
    });
    const { snapshot } = runAttribution(reconstructed.submissions);
    const blob = snapshotBlob(snapshot);
    assert.doesNotMatch(blob, /18400/);
    assert.doesNotMatch(blob, /"amount"/);
    assert.equal(snapshot.funnel.revenue, "not-attributed");
    assert.doesNotMatch(blob, /Ada Example|ada\.amount/i);
    assert.equal(snapshot.byOriginatingTool[0]?.key, "diamond-shape-studio");
  });
});

describe("P1-BI-2 privacy", () => {
  it("N — no PII enters founder-facing attribution output", () => {
    const { snapshot, recommendations } = runAttribution([
      submission({
        submissionId: "n1",
        normalizedEmail: "secret.person@hourglass.test",
        normalizedPhone: "7045550199",
        firstName: "Secret",
        lastName: "Person",
        fullName: "Secret Person",
        originatingTool: "conversations",
      }),
    ]);
    const blob = [snapshotBlob(snapshot), snapshotBlob(recommendations)].join(
      "\n",
    );
    assert.equal(containsLikelyPiiOrSecret(blob), false);
    assert.doesNotMatch(blob, /secret\.person|Secret Person|7045550199/i);
  });
});

describe("P1-BI-2 permissions", () => {
  it("GREEN only — no CRM mutation, analytics write, or deploy", () => {
    assert.equal(
      classifyAttributionPermissionTier("report sanitized origin aggregates"),
      "green",
    );
    assert.equal(
      attributionMayExecute("deploy attribution to production"),
      false,
    );
    assert.equal(proposedActionImpliesWrite("update HubSpot"), true);
    assert.equal(
      classifyAttributionPermissionTier("create HubSpot properties"),
      "red",
    );
  });
});

describe("P1-BI-2 management state preserved", () => {
  it("L — QA remains silent/operational on healthy production", async () => {
    const snap = await runWebsiteQaSpecialist({
      routeProbes: WEBSITE_QA_CRITICAL_ROUTES.map((route) => ({
        route,
        requestUrl: `https://www.hourglassdiamonds.com${route === "/" ? "/" : route}`,
        status: 200,
        reachable: true,
        probeOutcome: "ok" as const,
        redirectLocation: null,
        epistemicClass: "observed" as const,
        notes: ["HTTP 200"],
      })),
    });
    const bundle = await loadAllSources("fixture");
    const bi = runBusinessIntelligence(bundle, PERIOD, { websiteQa: snap });
    assert.equal(snap.health, "healthy");
    assert.equal(bi.websiteQa.exception, null);
    assert.equal(
      bi.recommendations.some(
        (r) => r.recommendationId === WEBSITE_QA_ROOT_EXCEPTION_ID,
      ),
      false,
    );
    assert.equal(
      bi.acceptedInquiryAttribution.founderRecommendationEmitted,
      false,
    );
  });

  it("M — Case Studies remain Watch", async () => {
    assert.equal(PRODUCTION_CASE_STUDY_LEDGER.length, 6);
    assert.equal(
      PRODUCTION_AUTHORITY_OUTREACH_WAVE.followUpEligibility,
      "not-due",
    );
    assert.equal(
      isCaseStudyProductionFounderNow(CURRENT_OPERATING_BACKLOG),
      false,
    );
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
    assert.match(
      cos.brief.dayOrientation ?? "",
      /No additional founder-now work is queued today/i,
    );
    assert.ok(
      (cos.brief.watchNoActionItems ?? []).some((l) =>
        /Case Study production — paused by founder/i.test(l),
      ),
    );
  });
});

describe("P1-BI-2 CoS behavior", () => {
  it("ordinary tiny-sample evidence stays silent; coverage collapse can surface once", async () => {
    const bundle = await loadAllSources("fixture");
    const quietBi = runBusinessIntelligence(bundle, PERIOD);
    assert.equal(
      quietBi.acceptedInquiryAttribution.sampleStrength,
      "INSUFFICIENT_SAMPLE",
    );
    const quietCos = runChiefOfStaff({
      bi: quietBi,
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
    assert.doesNotMatch(
      quietCos.brief.highestRoiAction,
      /origin capture coverage collapsed/i,
    );

    const collapsed = Array.from({ length: 8 }, (_, i) =>
      submission({ submissionId: `cos${i}` }),
    );
    const loudBi = runBusinessIntelligence(bundle, PERIOD, {
      attributionConcierge: concierge(collapsed),
      attributionCrmReadLookbackDays: 90,
    });
    assert.equal(
      loudBi.recommendations.filter(
        (r) => r.recommendationId === ATTRIBUTION_COVERAGE_INTEGRITY_ID,
      ).length,
      1,
    );
    const loudCos = runChiefOfStaff({
      bi: loudBi,
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
    assert.match(
      loudCos.brief.highestRoiAction,
      /attribution capture|coverage collapsed/i,
    );
  });

  it("fixture Agent OS brief does not send email or mutate externals", async () => {
    const run = await runAgentOsBrief({
      mode: "fixture",
      briefCadenceIntent: "daily",
      briefLocalDate: "2026-08-14",
      operatingBacklog: CURRENT_OPERATING_BACKLOG,
    });
    assert.equal(run.mode, "fixture");
    assert.equal(run.deliveryGuidance, "send-nothing");
    assert.equal(
      run.recommendations.some(
        (r) => r.recommendationId === ATTRIBUTION_COVERAGE_INTEGRITY_ID,
      ),
      false,
    );
    assert.doesNotMatch(run.brief.highestRoiAction, /Activate BI attribution/i);
  });
});

describe("P1-BI-2 lookback truth", () => {
  it("A — 30-day CRM source cannot be labeled complete 90-day evidence", () => {
    const { snapshot } = runAttribution(
      [
        submission({ submissionId: "lb30-1", originatingTool: "diamond-studio" }),
        submission({
          submissionId: "lb30-old",
          originatingTool: "conversations",
          submittedAt: hoursAgo(60 * 24),
        }),
      ],
      undefined,
      { crmReadLookbackDays: 30, crmRecordCap: 40, crmRecordsReturned: 8 },
    );
    assert.equal(snapshot.lookback.requestedDays, 90);
    assert.equal(snapshot.lookback.actualCrmCoverageDays, 30);
    assert.equal(snapshot.lookback.completeness, "partial");
    assert.equal(snapshot.acceptedInquiryCount, 1);
    assert.equal(snapshot.optionalComparison, null);
    assert.match(snapshot.lookback.note, /not a complete 90-day snapshot/i);
    assert.doesNotMatch(snapshot.lookback.note, /Period complete/i);
    assert.doesNotMatch(
      snapshot.facts.join("\n"),
      /90-day complete CRM window/i,
    );
  });

  it("B — 28d vs prior28d is unavailable when source coverage is insufficient", () => {
    const { snapshot } = runAttribution(
      [submission({ submissionId: "lb56", originatingTool: "diamond-studio" })],
      undefined,
      { crmReadLookbackDays: 30 },
    );
    assert.equal(snapshot.optionalComparison, null);
    assert.ok(snapshot.lookback.actualCrmCoverageDays < 56);
  });

  it("C — full 90-day source may truthfully report 90-day evidence", () => {
    const { snapshot } = runAttribution(
      [
        submission({ submissionId: "lb90-1", originatingTool: "diamond-studio" }),
        submission({
          submissionId: "lb90-2",
          originatingTool: "conversations",
          submittedAt: hoursAgo(60 * 24),
        }),
      ],
      undefined,
      { crmReadLookbackDays: 90, crmRecordCap: 40, crmRecordsReturned: 4 },
    );
    assert.equal(snapshot.lookback.requestedDays, 90);
    assert.equal(snapshot.lookback.actualCrmCoverageDays, 90);
    assert.equal(snapshot.lookback.completeness, "complete");
    assert.equal(snapshot.lookback.truncatedByRecordCap, false);
    assert.equal(snapshot.acceptedInquiryCount, 2);
    assert.ok(snapshot.optionalComparison);
    assert.equal(snapshot.optionalComparison?.current28.lookbackDays, 28);
    assert.equal(snapshot.optionalComparison?.prior28.lookbackDays, 28);
    assert.match(snapshot.lookback.note, /Period complete/i);
  });

  it("D — record-cap truncation is labeled PARTIAL and does not create a founder rec", () => {
    const { snapshot, recommendations } = runAttribution(
      [
        submission({ submissionId: "cap1", originatingTool: "diamond-studio" }),
        submission({ submissionId: "cap2" }),
      ],
      undefined,
      { crmReadLookbackDays: 90, crmRecordCap: 40, crmRecordsReturned: 40 },
    );
    assert.equal(snapshot.lookback.truncatedByRecordCap, true);
    assert.equal(snapshot.lookback.completeness, "partial");
    assert.equal(snapshot.lookback.recordCap, 40);
    assert.equal(snapshot.optionalComparison, null);
    assert.match(snapshot.lookback.note, /PARTIAL|Record cap was reached/i);
    assert.equal(recommendations.length, 0);
    assert.equal(snapshot.founderRecommendationEmitted, false);
  });

  it("E — HubSpot unavailable is UNKNOWN, not zero inquiries", () => {
    const { snapshot, recommendations } = runAttribution([], undefined, {
      mode: "live",
      conciergeStatus: "not-configured",
      crmReadLookbackDays: 90,
    });
    assert.equal(snapshot.sourceStatus, "unavailable");
    assert.equal(snapshot.epistemicClass, "unknown");
    assert.equal(snapshot.originCoverageRate, null);
    assert.equal(snapshot.sampleStrength, null);
    assert.equal(snapshot.lookback.completeness, "unavailable");
    assert.equal(snapshot.optionalComparison, null);
    assert.equal(snapshot.founderRecommendationEmitted, false);
    assert.equal(recommendations.length, 0);
    const facts = snapshot.facts.join("\n");
    assert.doesNotMatch(facts, /Accepted Concierge inquiries.*:\s*0/);
    assert.doesNotMatch(facts, /Sample too small to change product/i);
    assert.match(facts, /unknown/i);
    assert.match(
      snapshot.inferences.join("\n"),
      /not evidence that there were zero inquiries/i,
    );
  });
});

describe("P1-BI-2 backlog unchanged", () => {
  it("does not add a founder-now activate-attribution item", () => {
    const ids = CURRENT_OPERATING_BACKLOG.masterSprint.items.map((i) => i.id);
    assert.equal(ids.includes("sprint-activate-website-qa"), true);
    assert.equal(
      ids.some((id) => /attribution/i.test(id)),
      false,
    );
    const blob = JSON.stringify(CURRENT_OPERATING_BACKLOG);
    assert.doesNotMatch(blob, /activate BI attribution/i);
  });
});
