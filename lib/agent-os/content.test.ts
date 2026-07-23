/**
 * Focused Content Executive tests.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assessBrandFit,
  buildContentOpportunityId,
  contentIdLooksSafe,
  consolidateDuplicates,
  detectContentOpportunities,
  emptyContentExecutiveOutput,
  inspectContentInventory,
  isExecutiveOperational,
  operationalExecutives,
  proposedActionImpliesWrite,
  redactSecretsAndPii,
  runAgentOsBrief,
  runBusinessIntelligence,
  runChiefOfStaff,
  runContentExecutive,
  runSearchStrategy,
  scaffoldExecutives,
} from "./index";
import { loadAllSources } from "./adapters/load";
import { FIXTURE_REPORTING_PERIOD } from "./fixtures/sample-data";
import { MAX_ADDITIONAL_SURFACED_PRIORITIES } from "./executives/chief-of-staff";

describe("Content Executive operational status", () => {
  it("marks Content operational alongside Opportunity", () => {
    assert.equal(isExecutiveOperational("content"), true);
    assert.equal(isExecutiveOperational("opportunity"), true);
    assert.equal(isExecutiveOperational("search-strategy"), true);
    const ops = operationalExecutives().map((e) => e.id);
    assert.ok(ops.includes("content"));
    assert.ok(ops.includes("opportunity"));
    assert.deepEqual(scaffoldExecutives().map((e) => e.id), []);
  });
});

describe("Content inventory", () => {
  it("works without social adapters", () => {
    const snap = inspectContentInventory();
    assert.ok(snap.episodeCount >= 1);
    assert.ok(snap.plannedTopicCount >= 1);
    assert.ok(snap.items.every((i) => !/draft transcript — for typography/i.test(i.title)));
  });
});

describe("Content opportunity detection", () => {
  it("does not fabricate Buffer/social metrics when unavailable", async () => {
    const bundle = await loadAllSources("fixture");
    const bi = runBusinessIntelligence(bundle, FIXTURE_REPORTING_PERIOD);
    const search = runSearchStrategy(bundle, FIXTURE_REPORTING_PERIOD);
    const content = runContentExecutive(bundle, FIXTURE_REPORTING_PERIOD, {
      bi,
      search,
    });
    assert.ok(content.dataGaps.some((g) => g.sourceId === "buffer"));
    assert.equal(
      content.recommendations.some((r) =>
        /reach|watch time|followers|saves|shares/i.test(r.expectedUpside),
      ),
      false,
    );
    assert.ok(
      content.opportunities.some((o) => o.type === "content-measurement-gap"),
    );
  });

  it("emits search-supported founder conversation opportunity", async () => {
    const bundle = await loadAllSources("fixture");
    const search = runSearchStrategy(bundle, FIXTURE_REPORTING_PERIOD);
    const content = runContentExecutive(bundle, FIXTURE_REPORTING_PERIOD, {
      search,
    });
    const found = content.opportunities.find(
      (o) =>
        o.type === "founder-conversation-topic" ||
        o.type === "search-demand-content" ||
        o.type === "local-authority-content",
    );
    assert.ok(found);
    assert.ok(found!.evidenceNotes.length > 0);
  });

  it("emits BI-supported trust content when BI CTA signal exists", async () => {
    const bundle = await loadAllSources("fixture");
    const bi = runBusinessIntelligence(bundle, FIXTURE_REPORTING_PERIOD);
    const content = runContentExecutive(bundle, FIXTURE_REPORTING_PERIOD, { bi });
    const trust = content.opportunities.find(
      (o) => o.type === "trust-building-content",
    );
    assert.ok(trust);
    assert.equal(trust!.targetAudience.length > 0, true);
    assert.ok(trust!.funnelStage);
  });

  it("founder-conversation recommendation includes evidence", async () => {
    const bundle = await loadAllSources("fixture");
    const search = runSearchStrategy(bundle, FIXTURE_REPORTING_PERIOD);
    const content = runContentExecutive(bundle, FIXTURE_REPORTING_PERIOD, {
      search,
    });
    const conv = content.recommendations.find((r) =>
      /founder conversation|search demand|local-authority|Next founder/i.test(
        r.title,
      ),
    );
    if (conv) {
      assert.ok(conv.evidence.length > 0);
      assert.ok(conv.confidence > 0);
    } else {
      // Inventory still produces other evidence-backed content recs
      assert.ok(content.recommendations.every((r) => r.evidence.length > 0));
    }
  });

  it("detects repurposing, narrative sequence, and handoff gaps", () => {
    const inventory = inspectContentInventory();
    const opps = detectContentOpportunities({
      inventory,
      searchOpportunities: [
        {
          id: "s1",
          type: "local-intent-gap",
          title: "Local",
          whyItMatters: "x",
          recommendedAction: "y",
          queryOrPage: "custom engagement rings charlotte",
          metric: "impressions",
          currentValue: "100",
          sampleSize: 100,
          classifications: ["local"],
          isInference: false,
          confidence: 0.7,
          likelyImpact: 7,
          effort: "medium",
          urgency: "medium",
          approvalRequired: false,
          supportingReference: "gsc.local",
          evidenceNotes: ["n"],
        },
      ],
      biRecommendations: [],
      bufferAvailable: false,
      socialPerformanceAvailable: false,
    });
    assert.ok(opps.some((o) => o.type === "repurposing-gap"));
    assert.ok(
      opps.some(
        (o) =>
          o.type === "follow-up-conversation" &&
          o.sequenceKind === "recommendedNarrativeSequence",
      ),
    );
    assert.equal(
      opps.some((o) => /waits on|still draft|sequence blocked/i.test(o.title)),
      false,
    );
    assert.ok(
      opps.some(
        (o) =>
          o.type === "video-to-guide-handoff" ||
          o.type === "video-to-tool-handoff" ||
          o.type === "video-to-concierge-handoff",
      ),
    );
    const carousel = opps.find((o) => o.type === "carousel-opportunity");
    if (carousel) {
      assert.match(carousel.formatRationale, /sequenc|visual/i);
    }
    const clip = opps.find((o) => o.type === "short-form-clip" || o.type === "repurposing-gap");
    assert.ok(clip);
    assert.ok(clip!.sourceMaterial.length > 0);
  });

  it("does not auto-recommend every format for every topic", () => {
    const inventory = inspectContentInventory();
    const opps = detectContentOpportunities({
      inventory,
      searchOpportunities: [],
      biRecommendations: [],
      bufferAvailable: false,
      socialPerformanceAvailable: false,
    });
    const byTopic = new Map<string, Set<string>>();
    for (const o of opps) {
      const set = byTopic.get(o.topicOrItem) ?? new Set();
      set.add(o.recommendedFormat);
      byTopic.set(o.topicOrItem, set);
    }
    // At least one topic should not have all formats
    assert.ok(
      [...byTopic.values()].some((formats) => formats.size < 5),
    );
  });

  it("includes audience and funnel stage on opportunities", () => {
    const inventory = inspectContentInventory();
    const opps = detectContentOpportunities({
      inventory,
      searchOpportunities: [],
      biRecommendations: [],
      bufferAvailable: false,
      socialPerformanceAvailable: false,
    });
    assert.ok(opps.length > 0);
    assert.ok(opps.every((o) => o.targetAudience && o.funnelStage));
  });

  it("brand-fit rejects clickbait framing", () => {
    const bad = assessBrandFit("You won't believe this shocking diamond hack — buy now");
    assert.equal(bad.ok, false);
    const good = assessBrandFit(
      "A calmer way to choose a diamond when options create more noise than clarity",
    );
    assert.equal(good.ok, true);
  });

  it("repository findings do not claim traffic impact", async () => {
    const bundle = await loadAllSources("live");
    const content = runContentExecutive(bundle, FIXTURE_REPORTING_PERIOD);
    for (const r of content.recommendations) {
      if (r.evidence.every((e) => e.source === "repository-content-inventory")) {
        assert.equal(/\btraffic is up\b|\bwill increase traffic\b/i.test(r.expectedUpside), false);
        assert.match(
          r.expectedUpside,
          /no traffic impact claimed|communication impact/i,
        );
      }
    }
  });

  it("recommendations remain read-only", async () => {
    const bundle = await loadAllSources("fixture");
    const content = runContentExecutive(bundle, FIXTURE_REPORTING_PERIOD);
    for (const r of content.recommendations) {
      assert.equal(proposedActionImpliesWrite(r.proposedAction), false);
      assert.equal(/publish via buffer|upload to youtube|post now/i.test(r.proposedAction), false);
    }
  });
});

describe("Content stable IDs", () => {
  it("stable repeated ID", () => {
    const a = buildContentOpportunityId({
      source: "repository",
      type: "repurposing-gap",
      subject: "why-we-re-here",
      format: "short-form-clip",
    });
    const b = buildContentOpportunityId({
      source: "repository",
      type: "repurposing-gap",
      subject: "why-we-re-here",
      format: "short-form-clip",
    });
    assert.equal(a, b);
    assert.ok(contentIdLooksSafe(a));
  });

  it("distinct IDs for topics and formats", () => {
    const a = buildContentOpportunityId({
      source: "repository",
      type: "short-form-clip",
      subject: "topic-a",
      format: "short-form-clip",
    });
    const b = buildContentOpportunityId({
      source: "repository",
      type: "short-form-clip",
      subject: "topic-b",
      format: "short-form-clip",
    });
    const c = buildContentOpportunityId({
      source: "repository",
      type: "carousel-opportunity",
      subject: "topic-a",
      format: "carousel",
    });
    assert.notEqual(a, b);
    assert.notEqual(a, c);
  });

  it("IDs contain no PII, secrets, or transcript text", () => {
    const inventory = inspectContentInventory();
    const opps = detectContentOpportunities({
      inventory,
      searchOpportunities: [],
      biRecommendations: [],
      bufferAvailable: false,
      socialPerformanceAvailable: false,
    });
    for (const o of opps) {
      assert.ok(contentIdLooksSafe(o.id), o.id);
      assert.equal(/@|api_key|sk-|password|draft transcript/i.test(o.id), false);
    }
  });
});

describe("Content Chief of Staff integration", () => {
  it("deduplicates and preserves Search technical ownership vs Content production", async () => {
    const bundle = await loadAllSources("fixture");
    const bi = runBusinessIntelligence(bundle, FIXTURE_REPORTING_PERIOD);
    const search = runSearchStrategy(bundle, FIXTURE_REPORTING_PERIOD);
    const content = runContentExecutive(bundle, FIXTURE_REPORTING_PERIOD, {
      bi,
      search,
    });
    const cos = runChiefOfStaff({
      bi,
      search,
      content,
      reportingPeriod: FIXTURE_REPORTING_PERIOD,
      warnings: [],
      mode: "fixture",
    });
    const searchTech = cos.recommendations.filter(
      (r) =>
        r.originatingExecutive === "search-strategy" &&
        /CTR|schema|position|cannibal/i.test(r.title),
    );
    const contentProd = cos.recommendations.filter(
      (r) => r.originatingExecutive === "content",
    );
    assert.ok(searchTech.length + contentProd.length >= 1);
    const merged = consolidateDuplicates([
      ...search.recommendations,
      ...content.recommendations,
    ]);
    assert.ok(merged.length <= search.recommendations.length + content.recommendations.length);
  });

  it("founder brief remains capped at 5 named priorities with full JSON set", async () => {
    const run = await runAgentOsBrief({ mode: "fixture" });
    assert.ok(
      run.briefSurfacing.recommendationsSurfacedInBrief <=
        1 + MAX_ADDITIONAL_SURFACED_PRIORITIES,
    );
    assert.ok(
      run.recommendations.length >=
        run.briefSurfacing.recommendationsSurfacedInBrief,
    );
    assert.ok(run.executivesInvoked.includes("content"));
    assert.ok(run.executivesInvoked.includes("opportunity"));
    assert.deepEqual(run.executivesNotOperational, []);
    assert.ok(
      run.recommendations.some((r) => r.originatingExecutive === "content") ||
        run.briefSurfacing.opportunitiesDetected >= 1,
    );
  });

  it("zero-recommendation Content path remains healthy", async () => {
    const bundle = await loadAllSources("fixture");
    const bi = runBusinessIntelligence(bundle, FIXTURE_REPORTING_PERIOD);
    const search = runSearchStrategy(bundle, FIXTURE_REPORTING_PERIOD);
    const empty = emptyContentExecutiveOutput();
    const cos = runChiefOfStaff({
      bi,
      search,
      content: empty,
      reportingPeriod: FIXTURE_REPORTING_PERIOD,
      warnings: [],
      mode: "fixture",
    });
    assert.ok(cos.brief.markdown.includes("What changed?"));
  });

  it("fixture mode includes Content findings; live never uses fixture retrieval", async () => {
    const fixture = await runAgentOsBrief({ mode: "fixture" });
    assert.ok(fixture.executivesInvoked.includes("content"));
    assert.ok(
      fixture.recommendations.some((r) => r.originatingExecutive === "content") ||
        fixture.dataGaps.some((g) => g.id.includes("content")),
    );
    assert.equal(redactSecretsAndPii("api_key=abc123").includes("abc123"), false);

    const live = await runAgentOsBrief({ mode: "live" });
    assert.equal(live.mode, "live");
    assert.equal(
      live.sourceHealth.some((h) => h.retrievalState === "fixture"),
      false,
    );
  });
});

describe("Content publication-state hardening", () => {
  it("repository draft status does not equal verified unpublished", () => {
    const snap = inspectContentInventory();
    const ep = snap.items.find((i) => i.kind === "conversation-episode");
    assert.ok(ep);
    assert.equal(ep!.registryMaterialLabel, "draft");
    assert.equal(ep!.publicationState, "unknown");
    assert.notEqual(ep!.publicationState, "verified-unpublished");
  });

  it("missing Buffer/social ledger produces unknown publication state and partial inventory", () => {
    const snap = inspectContentInventory(undefined, {
      socialAdapterAvailable: false,
      publicationLedgerAvailable: false,
    });
    assert.equal(snap.inventoryCompleteness, "partial");
    assert.equal(snap.hasVerifiedPublicationLedger, false);
    assert.ok(snap.items.every((i) => i.publicationState === "unknown"));
  });

  it("unknown publication status cannot generate a confirmed sequence wait", () => {
    const inventory = inspectContentInventory();
    const opps = detectContentOpportunities({
      inventory,
      searchOpportunities: [],
      biRecommendations: [],
      bufferAvailable: false,
      socialPerformanceAvailable: false,
    });
    assert.equal(
      opps.some((o) => /waits on|must wait|sequence blocked|still draft/i.test(o.title)),
      false,
    );
    assert.equal(
      opps.some((o) => o.sequenceKind === "verifiedPublishingSequence"),
      false,
    );
    const narrative = opps.find(
      (o) =>
        o.type === "follow-up-conversation" &&
        o.sequenceKind === "recommendedNarrativeSequence",
    );
    assert.ok(narrative);
    assert.ok(narrative!.confidence < 0.7);
  });

  it("conceptual sequence recommendations remain allowed", () => {
    const inventory = inspectContentInventory();
    const opps = detectContentOpportunities({
      inventory,
      searchOpportunities: [],
      biRecommendations: [],
      bufferAvailable: false,
      socialPerformanceAvailable: false,
    });
    assert.ok(
      opps.some(
        (o) =>
          o.sequenceKind === "recommendedNarrativeSequence" &&
          /narrative|verify current publishing/i.test(
            `${o.title} ${o.recommendedAction}`,
          ),
      ),
    );
  });

  it("one content item does not prove high-confidence saturation", () => {
    const inventory = inspectContentInventory();
    assert.equal(inventory.episodeCount, 1);
    const opps = detectContentOpportunities({
      inventory,
      searchOpportunities: [],
      biRecommendations: [],
      bufferAvailable: false,
      socialPerformanceAvailable: false,
    });
    const sat = opps.filter((o) => o.type === "message-saturation-risk");
    for (const s of sat) {
      assert.ok(s.confidence < 0.55, s.title);
      assert.match(
        `${s.title} ${s.whyItMatters}`,
        /concentration|monitor|planned-topic overlap/i,
      );
      assert.equal(/brand message is saturated/i.test(s.whyItMatters), false);
    }
  });

  it("multiple overlapping content items may produce stronger saturation", () => {
    const base = inspectContentInventory().episodes[0]!;
    const inventory = inspectContentInventory([
      base,
      {
        ...base,
        slug: "second-philosophy-pass",
        title: "Why judgment still matters",
      },
    ]);
    const opps = detectContentOpportunities({
      inventory,
      searchOpportunities: [],
      biRecommendations: [],
      bufferAvailable: false,
      socialPerformanceAvailable: false,
    });
    const multi = opps.find((o) =>
      /multiple items|planned-topic overlap/i.test(o.title),
    );
    assert.ok(multi);
  });

  it("partial inventory lowers duplicate confidence", () => {
    const inventory = inspectContentInventory();
    assert.equal(inventory.inventoryCompleteness, "partial");
    const opps = detectContentOpportunities({
      inventory,
      searchOpportunities: [],
      biRecommendations: [],
      bufferAvailable: false,
      socialPerformanceAvailable: false,
    });
    const dups = opps.filter((o) => o.type === "duplicate-topic-risk");
    for (const d of dups) {
      assert.ok(d.confidence <= 0.5);
    }
  });

  it("repurposing findings still work with unknown publication status", () => {
    const inventory = inspectContentInventory();
    assert.ok(
      inventory.items.every((i) => i.publicationState === "unknown"),
    );
    const opps = detectContentOpportunities({
      inventory,
      searchOpportunities: [],
      biRecommendations: [],
      bufferAvailable: false,
      socialPerformanceAvailable: false,
    });
    assert.ok(opps.some((o) => o.type === "repurposing-gap"));
  });

  it("stable publication-inventory gap ID", async () => {
    const { CONTENT_PUBLICATION_INVENTORY_GAP_ID } = await import(
      "./content/inventory"
    );
    const bundle = await loadAllSources("fixture");
    const a = runContentExecutive(bundle, FIXTURE_REPORTING_PERIOD);
    const b = runContentExecutive(bundle, FIXTURE_REPORTING_PERIOD);
    const gapA = a.opportunities.find(
      (o) => o.type === "content-measurement-gap",
    );
    const gapB = b.opportunities.find(
      (o) => o.type === "content-measurement-gap",
    );
    assert.ok(gapA);
    assert.equal(gapA!.id, CONTENT_PUBLICATION_INVENTORY_GAP_ID);
    assert.equal(gapA!.id, gapB!.id);
    assert.ok(contentIdLooksSafe(gapA!.id));
  });

  it("live mode never inserts fixture publication status", async () => {
    const live = await runAgentOsBrief({ mode: "live" });
    assert.equal(
      live.sourceHealth.some((h) => h.retrievalState === "fixture"),
      false,
    );
    const content = runContentExecutive(
      await loadAllSources("live"),
      FIXTURE_REPORTING_PERIOD,
    );
    assert.ok(
      content.inventory.items.every((i) => i.publicationState === "unknown"),
    );
    assert.equal(
      /nothing has been published|zero conversations are published|no published founder conversation yet/i.test(
        [...content.facts, ...content.inferences, content.recommendations.map((r) => r.title).join(" ")].join(" "),
      ),
      false,
    );
  });

  it("verified unpublished parent may emit verifiedPublishingSequence", () => {
    const inventory = inspectContentInventory(undefined, {
      publicationLedgerAvailable: true,
      verifiedPublicationBySlug: {
        "why-we-re-here": "verified-unpublished",
      },
    });
    const parent = inventory.items.find((i) => i.id === "episode:why-we-re-here");
    assert.equal(parent?.publicationState, "verified-unpublished");
    const opps = detectContentOpportunities({
      inventory,
      searchOpportunities: [],
      biRecommendations: [],
      bufferAvailable: false,
      socialPerformanceAvailable: false,
    });
    assert.ok(
      opps.some((o) => o.sequenceKind === "verifiedPublishingSequence"),
    );
  });
});
