/**
 * P1-AUTH-1 — Content Authority specialist (Case-Study-first).
 * No live email, publish, outreach, or CRM mutation.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  authorityIdLooksSafe,
  authorityMayExecute,
  classifyAuthorityPermissionTier,
  isExecutiveOperational,
  listExecutives,
  operationalExecutives,
  PRODUCTION_AUTHORITY_OUTREACH_WAVE,
  PRODUCTION_CASE_STUDY_LEDGER,
  proposedActionImpliesWrite,
  runAgentOsBrief,
  runAuthoritySpecialist,
  runBusinessIntelligence,
  runChiefOfStaff,
  runContentExecutive,
  runOpportunityExecutive,
  runSearchStrategy,
  scaffoldExecutives,
  selectNextCaseStudy,
} from "./index";
import { emptyBusinessIntelligenceOutput } from "./bi/empty";
import { emptyContentExecutiveOutput } from "./executives/content";
import { emptyOpportunityExecutiveOutput } from "./executives/opportunity";
import { emptySearchStrategyOutput } from "./executives/search-strategy";
import { loadAllSources } from "./adapters/load";
import { FIXTURE_REPORTING_PERIOD } from "./fixtures/sample-data";
import { CURRENT_OPERATING_BACKLOG } from "./operating-backlog";
import {
  FIXTURE_CASE_STUDY_BLOCKED,
  FIXTURE_CASE_STUDY_READY,
  FIXTURE_OUTREACH_WAVE_DUE,
} from "./content/authority/fixtures";
import { assertProductionLedgerSafe } from "./content/authority/ledger";
import {
  AUTHORITY_CASE_STUDY_INVENTORY_ID,
  authoritySnapshotToOpportunities,
  emptyAuthoritySnapshot,
} from "./content/authority";
import { inspectContentInventory } from "./content/inventory";
import { emptyContentRoiSnapshot } from "./content/roi";
import { dailyTodayCall } from "./brief-quality";
import { buildRecommendation } from "./recommendation";
import { createEvidence } from "./evidence";
import type { ContentExecutiveOutput } from "./content";
import type { Recommendation } from "./types";

const PERIOD = { ...FIXTURE_REPORTING_PERIOD };
const COLLECTED = "2026-08-14T12:00:00.000Z";

function recFromOpp(
  opp: ReturnType<typeof authoritySnapshotToOpportunities>[number],
): Recommendation {
  return buildRecommendation({
    recommendationId: opp.id,
    originatingExecutive: "content",
    title: `[Content] ${opp.title}`,
    plainLanguageExplanation: opp.whyItMatters,
    whyItMattersNow: opp.whyItMatters,
    proposedAction: opp.recommendedAction,
    expectedUpside: "Founder-affirmed Case Study progress",
    effortEstimate: opp.effort,
    urgency: opp.urgency,
    reversibility: "easily-reversed",
    baseConfidence: opp.confidence,
    evidence: [
      createEvidence({
        source: "repository-content-inventory",
        sourceType: "internal-report",
        collectedAt: COLLECTED,
        reportingPeriod: PERIOD,
        metricOrObservation: opp.type,
        reliability: "reliable",
        supportingReference: opp.supportingReference,
      }),
    ],
    assumptions: [],
    risks: ["Agent OS does not publish or send"],
    dependencies: [],
    approvalRequired: opp.approvalRequired,
    suggestedOwner: "Founder / Content",
    rankingFactors: {
      expectedBusinessImpact: opp.likelyImpact,
      strategicAlignment: 9,
    },
  });
}

function contentWithAuthority(
  authority = emptyAuthoritySnapshot(true),
  extraRecs: Recommendation[] = [],
): ContentExecutiveOutput {
  const opps = authoritySnapshotToOpportunities(authority);
  return {
    ...emptyContentExecutiveOutput(),
    authority,
    opportunities: opps,
    facts: authority.facts,
    inferences: authority.inferences,
    recommendations: [...opps.map(recFromOpp), ...extraRecs],
    inventory: inspectContentInventory([]),
    contentRoi: emptyContentRoiSnapshot("unavailable"),
  };
}

describe("P1-AUTH-1 registry", () => {
  it("keeps exactly five executives and does not add Authority as an executive", () => {
    assert.deepEqual(listExecutives().map((e) => e.id), [
      "chief-of-staff",
      "business-intelligence",
      "search-strategy",
      "content",
      "opportunity",
    ]);
    assert.equal(operationalExecutives().length, 5);
    assert.deepEqual(scaffoldExecutives(), []);
    assert.equal(isExecutiveOperational("content"), true);
    const content = listExecutives().find((e) => e.id === "content");
    assert.ok(content?.ownedDomains.includes("case study pipeline"));
    assert.ok(content?.ownedDomains.includes("authority outreach lifecycle"));
  });
});

describe("P1-AUTH-1 Case Study ledger", () => {
  it("production ledger is empty and has no invented clients or geography", () => {
    assert.equal(PRODUCTION_CASE_STUDY_LEDGER.length, 0);
    assert.equal(PRODUCTION_AUTHORITY_OUTREACH_WAVE.originalSendDate, null);
    assert.equal(
      PRODUCTION_AUTHORITY_OUTREACH_WAVE.sendDateEpistemicClass,
      "unknown",
    );
    assert.equal(
      PRODUCTION_AUTHORITY_OUTREACH_WAVE.followUpEligibility,
      "not-due",
    );
  });

  it("refuses fixture-only rows in production ledger assertion", () => {
    assert.throws(() => assertProductionLedgerSafe([FIXTURE_CASE_STUDY_READY]));
  });

  it("does not infer publication state from titles", () => {
    const snap = runAuthoritySpecialist({
      ledger: [FIXTURE_CASE_STUDY_READY],
      allowFixtureLedger: true,
      caseStudyFounderNow: true,
    });
    assert.equal(snap.caseStudies.nextCaseStudy?.publicationState, "unknown");
    assert.ok(snap.caseStudies.epistemicNotes.some((n) => /OBSERVED/i.test(n)));
  });
});

describe("P1-AUTH-1 empty production inventory", () => {
  it("reports UNKNOWN / founder input and does not fake a Case Study or Conversation", async () => {
    const bundle = await loadAllSources("fixture");
    const content = runContentExecutive(bundle, PERIOD);
    assert.equal(content.authority.status, "empty-inventory");
    assert.equal(content.authority.caseStudies.founderAffirmedCount, 0);
    assert.equal(content.authority.caseStudies.nextCaseStudy, null);
    assert.equal(content.authority.caseStudies.needsFounderInput, true);
    assert.ok(
      content.opportunities.some((o) => o.type === "case-study-founder-input"),
    );
    assert.equal(
      content.opportunities.some((o) => o.type === "case-study-production"),
      false,
    );
    const recBlob = content.recommendations.map((r) => r.title).join("\n");
    assert.doesNotMatch(recBlob, /Fixture Case Study/i);
    assert.ok(
      content.recommendations.some((r) =>
        r.recommendationId.includes("case-study-founder-input"),
      ),
    );
  });

  it("daily CoS does not substitute a Conversation when inventory is empty", () => {
    const run = runChiefOfStaff({
      bi: emptyBusinessIntelligenceOutput(),
      search: emptySearchStrategyOutput(),
      content: contentWithAuthority(emptyAuthoritySnapshot(true)),
      opportunity: emptyOpportunityExecutiveOutput(),
      reportingPeriod: PERIOD,
      warnings: [],
      mode: "fixture",
      briefCadenceIntent: "daily",
      briefLocalDate: "2026-08-14",
      operatingBacklog: CURRENT_OPERATING_BACKLOG,
    });
    const today = dailyTodayCall({
      whyItMatters: run.brief.whyItMatters,
      highestRoiAction: run.brief.highestRoiAction,
      sprintOrientation: run.brief.sprintOrientation,
      dayOrientation: run.brief.dayOrientation,
    });
    assert.match(today, /Case Study/i);
    assert.match(today, /founder input/i);
    assert.doesNotMatch(today, /Editorial ROI/i);
    assert.doesNotMatch(run.brief.highestRoiAction, /Editorial ROI/i);
    assert.doesNotMatch(run.brief.highestRoiAction, /Charlotte/i);
    assert.match(run.brief.highestRoiAction, /Case Study/i);
    assert.match(
      run.brief.highestRoiAction,
      /founder-affirmed|Affirm the next Case Study/i,
    );
  });
});

describe("P1-AUTH-1 next Case Study selector", () => {
  it("selects one deterministic actionable Case Study", () => {
    const next = selectNextCaseStudy([
      FIXTURE_CASE_STUDY_BLOCKED,
      FIXTURE_CASE_STUDY_READY,
    ]);
    assert.equal(next?.caseStudyId, "fixture-case-study-alpha");
    assert.equal(
      next?.nextAction,
      "Draft the opening narrative from affirmed material",
    );
  });

  it("returns null when nothing is actionable", () => {
    assert.equal(selectNextCaseStudy([FIXTURE_CASE_STUDY_BLOCKED]), null);
    assert.equal(selectNextCaseStudy([]), null);
  });
});

describe("P1-AUTH-1 founder-now vs Conversations", () => {
  it("demotes ordinary editorial opportunities while Case Study is founder-now", async () => {
    const bundle = await loadAllSources("fixture");
    const search = runSearchStrategy(bundle, PERIOD);
    const content = runContentExecutive(bundle, PERIOD, {
      search,
      authorityOptions: {
        ledger: [FIXTURE_CASE_STUDY_READY],
        allowFixtureLedger: true,
        caseStudyFounderNow: true,
      },
    });
    const next = content.opportunities.find(
      (o) => o.type === "case-study-production",
    );
    assert.ok(next);
    assert.equal(next?.urgency, "high");
    const editorial = content.opportunities.filter(
      (o) =>
        o.type === "editorial-roi-package" ||
        o.type === "founder-conversation-topic",
    );
    for (const o of editorial) {
      assert.equal(o.urgency, "low");
      assert.ok(o.likelyImpact <= 4);
    }
  });

  it("weekly Highest-ROI does not elevate a Conversation over an actionable Case Study", () => {
    const editorial = buildRecommendation({
      recommendationId: "content:roi:editorial-roi-package:weekly-noise",
      originatingExecutive: "content",
      title:
        "[Content] Editorial ROI: Most People Start Diamond Shopping in the Wrong Place",
      plainLanguageExplanation: "Conversation package",
      whyItMattersNow: "Editorial ROI package",
      proposedAction: "Plan a founder conversation after reserved cycles",
      expectedUpside: "Editorial coverage",
      effortEstimate: "medium",
      urgency: "high",
      reversibility: "easily-reversed",
      baseConfidence: 0.9,
      evidence: [
        createEvidence({
          source: "repository-content-inventory",
          sourceType: "internal-report",
          collectedAt: COLLECTED,
          reportingPeriod: PERIOD,
          metricOrObservation: "editorial-roi",
          reliability: "unverified",
          supportingReference: "content/roi",
        }),
      ],
      assumptions: [],
      risks: [],
      dependencies: [],
      approvalRequired: true,
      suggestedOwner: "Founder / Content",
      rankingFactors: { expectedBusinessImpact: 10, strategicAlignment: 9 },
    });
    const authority = runAuthoritySpecialist({
      ledger: [FIXTURE_CASE_STUDY_READY],
      allowFixtureLedger: true,
      caseStudyFounderNow: true,
      operatingBacklog: CURRENT_OPERATING_BACKLOG,
    });
    const cos = runChiefOfStaff({
      bi: emptyBusinessIntelligenceOutput(),
      search: emptySearchStrategyOutput(),
      content: contentWithAuthority(authority, [editorial]),
      opportunity: emptyOpportunityExecutiveOutput(),
      reportingPeriod: PERIOD,
      warnings: [],
      mode: "fixture",
      briefCadenceIntent: "weekly",
      operatingBacklog: CURRENT_OPERATING_BACKLOG,
    });
    assert.match(
      cos.brief.highestRoiAction,
      /Draft the opening narrative|Case Study/i,
    );
    assert.doesNotMatch(cos.brief.highestRoiAction, /Editorial ROI/i);
    assert.doesNotMatch(
      cos.brief.highestRoiAction,
      /Most People Start Diamond Shopping/i,
    );
  });
});

describe("P1-AUTH-1 outreach wave", () => {
  it("not due = watch / no founder send task", async () => {
    const bundle = await loadAllSources("fixture");
    const content = runContentExecutive(bundle, PERIOD);
    assert.equal(content.authority.outreach.founderTask, "none");
    assert.equal(content.authority.outreach.followUpEligibility, "not-due");
    assert.equal(
      content.opportunities.some((o) => o.type === "authority-outreach-follow-up"),
      false,
    );
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
    const watch = cos.brief.watchNoActionItems ?? [];
    assert.ok(watch.some((l) => /authority outreach/i.test(l)));
    assert.equal(watch.some((l) => /follow-up window due/i.test(l)), false);
    assert.doesNotMatch(cos.brief.highestRoiAction, /outreach/i);
  });

  it("due = at most one readiness signal, no send, no contacts", async () => {
    const bundle = await loadAllSources("fixture");
    const content = runContentExecutive(bundle, PERIOD, {
      authorityOptions: {
        outreachWave: FIXTURE_OUTREACH_WAVE_DUE,
        allowFixtureLedger: true,
      },
    });
    const follow = content.opportunities.filter(
      (o) => o.type === "authority-outreach-follow-up",
    );
    assert.equal(follow.length, 1);
    assert.equal(follow[0]?.approvalRequired, true);
    assert.equal(
      proposedActionImpliesWrite(follow[0]!.recommendedAction),
      false,
    );
    assert.ok(authorityIdLooksSafe(follow[0]!.id));
    assert.doesNotMatch(follow[0]!.id, /contact|email|phone|@/i);
    assert.doesNotMatch(follow[0]!.recommendedAction, /\bsend\b/i);
  });
});

describe("P1-AUTH-1 Opportunity duplication", () => {
  it("marks the current authority outreach wave already-covered", async () => {
    const bundle = await loadAllSources("fixture");
    const bi = runBusinessIntelligence(bundle, PERIOD);
    const search = runSearchStrategy(bundle, PERIOD);
    const content = runContentExecutive(bundle, PERIOD, { bi, search });
    const opportunity = runOpportunityExecutive(bundle, PERIOD, {
      bi,
      search,
      content,
    });
    assert.ok(
      opportunity.opportunities.some(
        (o) =>
          o.type === "opportunity-already-covered" &&
          /current-outreach-wave|authority outreach wave/i.test(
            `${o.id} ${o.title} ${o.relatedContent ?? ""}`,
          ),
      ),
    );
    assert.equal(
      opportunity.recommendations.some((r) =>
        /current authority outreach wave/i.test(r.title + r.proposedAction),
      ),
      false,
    );
  });
});

describe("P1-AUTH-1 permissions", () => {
  it("classifies publish/send as red and executes GREEN only", () => {
    assert.equal(
      classifyAuthorityPermissionTier("inspect Case Study ledger"),
      "green",
    );
    assert.equal(
      classifyAuthorityPermissionTier(
        "Prepare follow-up copy for founder approval",
      ),
      "yellow",
    );
    assert.equal(
      classifyAuthorityPermissionTier("publish the Case Study"),
      "red",
    );
    assert.equal(
      classifyAuthorityPermissionTier("send outreach to editors"),
      "red",
    );
    assert.equal(authorityMayExecute("publish the Case Study"), false);
    assert.equal(authorityMayExecute("send outreach to editors"), false);
    assert.equal(proposedActionImpliesWrite("publish the Case Study"), true);
  });

  it("stable IDs are persistence-safe and PII-free", () => {
    assert.ok(authorityIdLooksSafe(AUTHORITY_CASE_STUDY_INVENTORY_ID));
    assert.equal(
      authorityIdLooksSafe("content:authority:case-study:jane@x.com"),
      false,
    );
    assert.equal(
      authorityIdLooksSafe(
        "content:authority:outreach:linkedin.com/in/someone",
      ),
      false,
    );
  });
});

describe("P1-AUTH-1 production-shaped brief", () => {
  it("fixture brief with empty ledger asks for founder input", async () => {
    const run = await runAgentOsBrief({
      mode: "fixture",
      briefCadenceIntent: "daily",
      briefLocalDate: "2026-08-14",
      operatingBacklog: CURRENT_OPERATING_BACKLOG,
    });
    assert.match(run.brief.dayOrientation ?? "", /founder input/i);
    assert.match(run.brief.highestRoiAction, /Case Study/i);
    assert.doesNotMatch(run.brief.highestRoiAction, /Fixture Case Study/i);
    assert.doesNotMatch(run.brief.highestRoiAction, /Editorial ROI/i);
  });
});
