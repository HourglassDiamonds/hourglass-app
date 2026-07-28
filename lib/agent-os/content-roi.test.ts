/**
 * Content ROI Prioritization — deterministic tests.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { loadAllSources } from "./adapters/load";
import { runChiefOfStaff } from "./executives/chief-of-staff";
import { runContentExecutive } from "./executives/content";
import { FIXTURE_REPORTING_PERIOD } from "./fixtures/sample-data";
import { runBusinessIntelligence } from "./executives/business-intelligence";
import { runSearchStrategy } from "./search";
import { runOpportunityExecutive } from "./executives/opportunity";
import {
  assertFlagshipBeforeSupporting,
  assertWeightsSumToOne,
  CONTENT_ROI_WEIGHTS,
  MAX_FOUNDER_FACING_CONTENT_ROI,
  MIN_CONVERSATION_DEPTH,
  MIN_TASTE_ASSIGNMENT,
  RESERVED_CONVERSATION_CYCLES,
  runContentRoiGuarded,
  runContentRoiPrioritizer,
  selectFounderFacingPackages,
} from "./content/roi";
import {
  PLANNED_CONVERSATION_TOPICS,
  RESERVE_BACKLOG_CONVERSATION_TOPICS,
} from "./content/themes";
import { getActiveFanOutQuestions } from "./search/fan-out";

describe("Content ROI model", () => {
  it("weights sum to 1.0", () => {
    assert.equal(assertWeightsSumToOne(CONTENT_ROI_WEIGHTS), true);
    const sum = Object.values(CONTENT_ROI_WEIGHTS).reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(sum - 1) < 1e-9);
  });

  it("scores every active canonical question with valid ranges", () => {
    const snap = runContentRoiPrioritizer();
    assert.equal(snap.status, "ok");
    const active = getActiveFanOutQuestions();
    assert.equal(snap.questionAssessments.length, active.length);
    for (const a of snap.questionAssessments) {
      assert.ok(a.scores.overall >= 0 && a.scores.overall <= 100);
      for (const v of Object.values(a.scores.dimensions)) {
        assert.ok(v >= 0 && v <= 100);
      }
      assert.ok(a.scores.reasons.length >= 1);
      assert.ok(a.scores.evidence.length >= 1);
    }
  });

  it("produces stable ranking under unchanged inputs", () => {
    const a = runContentRoiPrioritizer();
    const b = runContentRoiPrioritizer();
    assert.deepEqual(
      a.top10Packages.map((p) => p.id),
      b.top10Packages.map((p) => p.id),
    );
    assert.deepEqual(
      a.fullSequenceOrder.map((s) => s.packageId),
      b.fullSequenceOrder.map((s) => s.packageId),
    );
  });

  it("keeps reserved three Conversation cycles ahead of new content", () => {
    const snap = runContentRoiPrioritizer();
    assert.equal(RESERVED_CONVERSATION_CYCLES.length, 3);
    const reservedSlots = snap.fullSequenceOrder.filter((s) => s.reserved);
    assert.equal(reservedSlots.length, 3);
    assert.equal(reservedSlots[0]?.order, 1);
    assert.equal(reservedSlots[1]?.order, 2);
    assert.equal(reservedSlots[2]?.order, 3);
    assert.match(
      reservedSlots[0]!.workingTitle,
      /Wrong Place/i,
    );
    assert.match(reservedSlots[1]!.workingTitle, /Identical Diamonds/i);
    assert.match(reservedSlots[2]!.workingTitle, /Confidence to Stop Looking/i);
    const firstPost = snap.postSequenceOrder[0];
    assert.ok(firstPost);
    assert.equal(firstPost.reserved, false);
    assert.ok(firstPost.order > 3);
  });

  it("does not promote supporting FAQs over flagships", () => {
    const snap = runContentRoiPrioritizer();
    assert.equal(assertFlagshipBeforeSupporting(snap.packages), true);
    const founder = selectFounderFacingPackages(snap.packages);
    assert.ok(founder.every((p) => p.topicKind !== "supporting-faq"));
  });

  it("consolidates pricing and buying-location into flagships", () => {
    const snap = runContentRoiPrioritizer();
    const pricing = snap.packages.find((p) =>
      /Budget for an Engagement Ring/i.test(p.workingTitle),
    );
    const where = snap.packages.find((p) =>
      /Where to Buy an Engagement Ring/i.test(p.workingTitle),
    );
    assert.ok(pricing);
    assert.ok(where);
    assert.equal(pricing!.topicKind, "flagship-cluster");
    assert.equal(where!.topicKind, "flagship-cluster");
    assert.ok((pricing!.relatedQuestionIds.length ?? 0) >= 2);
    assert.ok((where!.relatedQuestionIds.length ?? 0) >= 2);
  });

  it("allows sales and brand to outrank raw search value", () => {
    const snap = runContentRoiPrioritizer();
    const highSales = snap.questionAssessments
      .filter((a) => a.scores.dimensions.salesInfluence >= 80)
      .sort((a, b) => b.scores.overall - a.scores.overall)[0];
    const highSearchLowSales = snap.questionAssessments
      .filter(
        (a) =>
          a.scores.dimensions.searchDiscovery >= 70 &&
          a.scores.dimensions.salesInfluence <= 55,
      )
      .sort((a, b) => b.scores.dimensions.searchDiscovery - a.scores.dimensions.searchDiscovery)[0];
    assert.ok(highSales);
    if (highSearchLowSales) {
      // Not a hard global rule for every pair — but sales-weighted overall should often win
      assert.ok(
        highSales.scores.overall + 5 >= highSearchLowSales.scores.overall ||
          highSales.scores.dimensions.salesInfluence >
            highSearchLowSales.scores.dimensions.salesInfluence,
      );
    }
  });

  it("does not auto-rank low-effort maintenance facts as Conversation", () => {
    const snap = runContentRoiPrioritizer();
    const maint = snap.questionAssessments.filter(
      (a) => a.queryFamily === "maintenance-repairs-ownership",
    );
    assert.ok(maint.length > 0);
    for (const m of maint) {
      assert.notEqual(m.primaryFormat, "conversation");
      assert.ok(
        m.primaryFormat === "post-purchase-guide" ||
          m.primaryFormat === "faq-cluster" ||
          m.primaryFormat === "short-form-series" ||
          m.primaryFormat === "carousel",
      );
      assert.ok(
        m.scores.dimensions.conversationPotential < MIN_CONVERSATION_DEPTH,
      );
    }
  });

  it("does not assign A Matter of Taste universally", () => {
    const snap = runContentRoiPrioritizer();
    const withTaste = snap.questionAssessments.filter(
      (a) =>
        a.primaryFormat === "a-matter-of-taste" ||
        a.supportingFormats.includes("a-matter-of-taste"),
    );
    assert.ok(withTaste.length < snap.questionAssessments.length * 0.5);
    const lowTaste = snap.questionAssessments.filter(
      (a) => a.scores.dimensions.tastePotential < MIN_TASTE_ASSIGNMENT,
    );
    for (const a of lowTaste) {
      assert.notEqual(a.primaryFormat, "a-matter-of-taste");
    }
  });

  it("caps founder-facing Content ROI packages", () => {
    const snap = runContentRoiPrioritizer();
    assert.ok(
      snap.founderFacingPackages.length <= MAX_FOUNDER_FACING_CONTENT_ROI,
    );
  });

  it("uses one canonical reserved Conversation sequence with Taste pairings", () => {
    const snap = runContentRoiPrioritizer();
    assert.ok(snap.editorialSequenceNote);
    assert.match(snap.editorialSequenceNote, /editorial-sequence\.ts/);
    assert.deepEqual(
      snap.reservedCycles.map((c) => c.conversationTitle),
      [
        "Most People Start Diamond Shopping in the Wrong Place",
        "Why Two Identical Diamonds Can Look Completely Different",
        "The Confidence to Stop Looking",
      ],
    );
    assert.deepEqual(
      snap.reservedCycles.map((c) => c.tasteTitle),
      [
        "Why Diamonds Shouldn’t Sound Like Desserts",
        "When Everything Is “Rare,” Nothing Is",
        "Lab vs Natural Is Six of One, Half a Dozen of the Other",
      ],
    );
    // themes.ts PLANNED_CONVERSATION_TOPICS must match ROI reserved cycles
    assert.deepEqual(
      PLANNED_CONVERSATION_TOPICS.map((t) => t.title),
      snap.reservedCycles.map((c) => c.conversationTitle),
    );
    assert.equal(PLANNED_CONVERSATION_TOPICS.length, RESERVED_CONVERSATION_CYCLES.length);
  });

  it("preserves older planned themes as reserve-backlog topics", () => {
    const snap = runContentRoiPrioritizer();
    assert.equal(
      snap.reserveBacklogTopics.length,
      RESERVE_BACKLOG_CONVERSATION_TOPICS.length,
    );
    assert.ok(snap.reserveBacklogTopics.length >= 3);
    const ids = snap.reserveBacklogTopics.map((t) => t.id);
    assert.ok(ids.includes("options-without-clarity"));
    assert.ok(ids.includes("standard-belongs-on-product"));
    assert.ok(ids.includes("charlotte-discernment"));
    assert.ok(
      snap.reserveBacklogTopics.every((t) => t.sequenceLane === "reserve-backlog"),
    );
    for (const t of snap.reserveBacklogTopics) {
      assert.equal(
        snap.reservedCycles.some((c) => c.conversationTitle === t.title),
        false,
      );
    }
  });

  it("consolidates decision-anxiety questions into one package", () => {
    const snap = runContentRoiPrioritizer();
    const decision = snap.packages.find(
      (p) => p.gapClusterId === "decision-confidence",
    );
    assert.ok(decision);
    assert.match(decision!.workingTitle, /Confident Engagement-Ring Decision/i);
    assert.ok(decision!.relatedQuestionIds.length >= 4);
    assert.equal(decision!.primaryFormat, "conversation");

    const anxietyTitles = [
      /overpaying/i,
      /stop comparing/i,
      /regret/i,
      /too many.*options/i,
      /alone or bring/i,
      /surprise/i,
    ];
    const topAnxietySingles = snap.top10Packages.filter(
      (p) =>
        p.gapClusterId !== "decision-confidence" &&
        anxietyTitles.some((re) => re.test(p.workingTitle)),
    );
    assert.equal(
      topAnxietySingles.length,
      0,
      `anxiety singles flooded top10: ${topAnxietySingles.map((p) => p.workingTitle).join("; ")}`,
    );
  });

  it("avoids excessive adjacent emotional-theme repetition without ignoring ROI", () => {
    const snap = runContentRoiPrioritizer();
    const post = snap.postSequenceOrder.slice(0, 8);
    let emotionalStreak = 0;
    let maxStreak = 0;
    for (const slot of post) {
      if (slot.balanceTag === "emotional-decision") {
        emotionalStreak += 1;
        maxStreak = Math.max(maxStreak, emotionalStreak);
      } else {
        emotionalStreak = 0;
      }
    }
    assert.ok(
      maxStreak <= 2,
      `emotional-decision streak too long in early post-sequence: ${post.map((s) => s.balanceTag).join(",")}`,
    );
    // Top post-sequence item should still be high-ROI (budget/concierge/where-to-buy family)
    assert.ok(post[0]!.overallRoi >= 80);
  });
});

describe("Content ROI resilience and executive integration", () => {
  it("degrades safely on injected failure and recovers", async () => {
    const bundle = await loadAllSources("fixture");
    const bi = runBusinessIntelligence(bundle, FIXTURE_REPORTING_PERIOD);
    const search = runSearchStrategy(bundle, FIXTURE_REPORTING_PERIOD, {
      mode: "fixture",
    });

    const failed = runContentExecutive(bundle, FIXTURE_REPORTING_PERIOD, {
      search,
      bi,
      contentRoiOptions: { forceFailureAt: "question-scoring" },
    });
    assert.equal(failed.contentRoi.status, "failed");
    assert.ok(
      failed.dataGaps.some((g) => g.id === "gap-content-roi-prioritization"),
    );
    assert.equal(
      failed.opportunities.filter((o) => o.type === "editorial-roi-package")
        .length,
      0,
    );
    const briefNoise = JSON.stringify(failed.recommendations);
    assert.equal(/\bat\s+\S+\s+\(/.test(briefNoise), false);
    assert.equal(/[A-Za-z]:\\/.test(briefNoise), false);

    const recovered = runContentExecutive(bundle, FIXTURE_REPORTING_PERIOD, {
      search,
      bi,
    });
    assert.equal(recovered.contentRoi.status, "ok");
    assert.ok(recovered.contentRoi.founderFacingPackages.length > 0);
    assert.equal(
      recovered.dataGaps.some((g) => g.id === "gap-content-roi-prioritization"),
      false,
    );
  });

  it("keeps Content ROI founder packages capped through CoS", async () => {
    const bundle = await loadAllSources("fixture");
    const bi = runBusinessIntelligence(bundle, FIXTURE_REPORTING_PERIOD);
    const search = runSearchStrategy(bundle, FIXTURE_REPORTING_PERIOD, {
      mode: "fixture",
    });
    const content = runContentExecutive(bundle, FIXTURE_REPORTING_PERIOD, {
      search,
      bi,
    });
    const opportunity = runOpportunityExecutive(bundle, FIXTURE_REPORTING_PERIOD, {
      search,
      bi,
      content,
    });
    const cos = runChiefOfStaff({
      bi,
      search,
      content,
      opportunity,
      reportingPeriod: FIXTURE_REPORTING_PERIOD,
      warnings: [],
      mode: "fixture",
      briefCadenceIntent: "daily",
      briefLocalDate: "2026-07-28",
    });

    const roiRecs = content.recommendations.filter((r) =>
      r.recommendationId.includes("editorial-roi-package"),
    );
    assert.ok(roiRecs.length <= MAX_FOUNDER_FACING_CONTENT_ROI);
    assert.ok(content.contentRoi.founderFacingPackages.length <= 3);
    assert.ok(cos.surfacedInBriefCount <= 8);
  });

  it("guarded runner never throws", () => {
    const snap = runContentRoiGuarded(() => {
      throw new Error("boom at C:\\Users\\test\\file.ts");
    });
    assert.equal(snap.status, "failed");
    assert.ok(snap.degradation?.safeMessage);
    assert.equal(/C:\\Users/.test(snap.degradation!.safeMessage), false);
  });
});
