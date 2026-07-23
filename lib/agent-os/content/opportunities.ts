/**
 * Content opportunity detectors.
 * Translates inventory + Search/BI evidence into communication recommendations.
 * Does not emit technical SEO actions (Search Strategy ownership).
 * Does not fabricate social/Buffer metrics.
 */

import type { SearchOpportunity } from "../search/types";
import type { Recommendation } from "../types";
import { assessBrandFit } from "./brand-fit";
import { buildContentOpportunityId } from "./ids";
import {
  CONTENT_PUBLICATION_INVENTORY_GAP_ID,
  type ContentInventorySnapshot,
} from "./inventory";
import type { ContentOpportunity } from "./types";

export type ContentOpportunityContext = {
  inventory: ContentInventorySnapshot;
  searchOpportunities: SearchOpportunity[];
  biRecommendations: Recommendation[];
  bufferAvailable: boolean;
  socialPerformanceAvailable: boolean;
};

export function detectContentOpportunities(
  ctx: ContentOpportunityContext,
): ContentOpportunity[] {
  const out: ContentOpportunity[] = [];

  out.push(...detectMeasurementGap(ctx));
  out.push(...detectFounderConversationFromSearch(ctx));
  out.push(...detectSequenceAndCoverage(ctx));
  out.push(...detectRepurposingAndHandoffs(ctx));
  out.push(...detectSaturationAndDuplicates(ctx));
  out.push(...detectBiSupportedTrustContent(ctx));
  out.push(...detectLocalAuthorityContent(ctx));

  return dedupeById(out.filter((o) => o.brandFitOk)).slice(0, 14);
}

function detectMeasurementGap(ctx: ContentOpportunityContext): ContentOpportunity[] {
  const ledgerOk = ctx.inventory.hasVerifiedPublicationLedger;
  const socialOk =
    ctx.bufferAvailable &&
    ctx.socialPerformanceAvailable &&
    ctx.inventory.hasVerifiedSocialAdapter;
  if (ledgerOk && socialOk) return [];

  // Stable deterministic ID — Decision Journal can recognize unchanged gap
  return [
    withBrandFit({
      id: CONTENT_PUBLICATION_INVENTORY_GAP_ID,
      type: "content-measurement-gap",
      title: "Publication and social inventory cannot be verified",
      whyItMatters:
        "Without a verified publication ledger or social adapter, Agent OS cannot reconcile what is live, scheduled, or unpublished — timing confidence must stay low.",
      recommendedAction:
        "Connect a read-only publication/social inventory before treating sequence or channel timing as operational fact. Continue theme, handoff, and brand-fit analysis from repository material.",
      recommendedFormat: "caption",
      formatRationale:
        "Measurement gap only — not a request to publish across channels.",
      topicOrItem: "publication-inventory-ledger",
      targetAudience: "founders-peers",
      funnelStage: "awareness",
      sourceMaterial: "Agent OS content inventory completeness contract",
      confidence: 0.92,
      likelyImpact: 3,
      effort: "medium",
      urgency: "low",
      approvalRequired: false,
      supportingReference: "lib/agent-os/content/inventory.ts",
      evidenceNotes: [
        `inventoryCompleteness=${ctx.inventory.inventoryCompleteness}`,
        ctx.inventory.publicationCoverageNote,
        "No reach, watch time, saves, shares, or follower metrics fabricated",
        "Publication state remains unknown until a verified ledger is connected",
      ],
      performanceInferred: true,
      isInference: false,
    }),
  ];
}

function detectFounderConversationFromSearch(
  ctx: ContentOpportunityContext,
): ContentOpportunity[] {
  const out: ContentOpportunity[] = [];
  const searchDemand = ctx.searchOpportunities.filter(
    (o) =>
      o.type === "near-page-one" ||
      o.type === "rising-query" ||
      o.type === "high-impression-low-ctr" ||
      o.type === "content-gap",
  );

  // Prefer planned topics that align with search demand tokens
  for (const topic of ctx.inventory.plannedTopics) {
    const match = searchDemand.find((s) =>
      tokensOverlap(s.queryOrPage, `${topic.title} ${topic.id} ${topic.relatedGuideSlug ?? ""}`),
    );
    if (!match) continue;

    out.push(
      withBrandFit({
        id: buildContentOpportunityId({
          source: "search",
          type: "founder-conversation-topic",
          subject: topic.id,
          format: "founder-conversation",
        }),
        type: "founder-conversation-topic",
        title: `Next founder conversation: ${topic.title}`,
        whyItMatters:
          "Search demand shows buyers already researching this territory — a calm founder conversation can clarify the decision without chasing trends.",
        recommendedAction:
          `Plan a 5–9 minute conversation map for “${topic.title}” (strategic outline only — Agent OS will not publish). Link to related guide/tool after filming.`,
        recommendedFormat: "founder-conversation",
        formatRationale:
          "Buyer question + founder expertise fits long-form conversation better than a one-off tip post.",
        topicOrItem: topic.id,
        targetAudience: "engagement-buyers",
        funnelStage: topic.funnelStage,
        sourceMaterial: `themes.ts#${topic.id}`,
        relatedGuide: topic.relatedGuideSlug
          ? `/diamond-guide/${topic.relatedGuideSlug}`
          : null,
        relatedTool: topic.relatedToolPath ?? null,
        relatedConcierge:
          topic.relatedToolPath === "/concierge" ? "/concierge" : "/concierge",
        supportingIdeaAreas: topic.supportingIdeaAreas,
        ownableLines: topic.ownableLines,
        hookDirection:
          "Open on the buyer’s stuck feeling — never a shocking claim or inventory pitch.",
        audienceQuestion: topic.audienceQuestion,
        clipTerritories: topic.clipFriendly
          ? topic.supportingIdeaAreas.slice(0, 3)
          : [],
        confidence: Math.min(0.82, match.confidence + 0.05),
        likelyImpact: 8,
        effort: "medium",
        urgency: "high",
        dependency: match.type === "content-gap" ? "Search Strategy content-gap evidence" : undefined,
        approvalRequired: true,
        supportingReference: match.supportingReference,
        evidenceNotes: [
          `Search opportunity: ${match.type} — ${match.queryOrPage}`,
          "Communication recommendation — technical SEO remains Search Strategy owned",
          "No traffic prediction claimed from impressions alone",
        ],
        performanceInferred: true,
        isInference: true,
      }),
    );
  }

  // If no planned topic matched but rising/near-page-one exists, emit search-demand-content
  if (out.length === 0) {
    const top = searchDemand.find(
      (s) => s.type === "rising-query" || s.type === "near-page-one",
    );
    if (top && !isBrandQueryLoose(top.queryOrPage)) {
      out.push(
        withBrandFit({
          id: buildContentOpportunityId({
            source: "search",
            type: "search-demand-content",
            subject: top.queryOrPage,
            format: "founder-conversation",
          }),
          type: "search-demand-content",
          title: `Translate search demand into a conversation: “${top.queryOrPage}”`,
          whyItMatters:
            "Verified Search Console demand exists; Content should clarify the human question, not rewrite titles for CTR.",
          recommendedAction:
            "Draft a conversation-map outline answering the buyer question; leave title/meta CTR work to Search Strategy.",
          recommendedFormat: "founder-conversation",
          formatRationale:
            "High-intent questions repay calm long-form explanation more than isolated tips.",
          topicOrItem: top.queryOrPage,
          targetAudience: "engagement-buyers",
          funnelStage: "consideration",
          sourceMaterial: top.supportingReference,
          confidence: Math.min(0.7, top.confidence),
          likelyImpact: 7,
          effort: "medium",
          urgency: "medium",
          approvalRequired: true,
          supportingReference: top.supportingReference,
          evidenceNotes: [
            `Search type ${top.type}; Content owns communication framing only`,
          ],
          performanceInferred: true,
          isInference: true,
        }),
      );
    }
  }

  return out.slice(0, 3);
}

function detectSequenceAndCoverage(
  ctx: ContentOpportunityContext,
): ContentOpportunity[] {
  const out: ContentOpportunity[] = [];
  const partial = ctx.inventory.inventoryCompleteness !== "complete";
  const pubUnknown = !ctx.inventory.hasVerifiedPublicationLedger;

  // Material incompleteness (e.g. missing video source) — not a publication claim
  for (const item of ctx.inventory.items.filter(
    (i) => i.kind === "conversation-episode" && i.materialState === "incomplete",
  ).slice(0, 2)) {
    out.push(
      withBrandFit({
        id: buildContentOpportunityId({
          source: "repository",
          type: "sequence-gap",
          subject: `${item.topic}-material-incomplete`,
        }),
        type: "sequence-gap",
        title: `Source material incomplete for “${item.title}”`,
        whyItMatters:
          "Repository source material exists but is incomplete (e.g. missing playable video). This is material readiness — not verified publish status.",
        recommendedAction:
          "Complete filming/editing assets in the repository record when ready. Do not treat registry draft labels as proof the piece is unpublished operationally.",
        recommendedFormat: "founder-conversation",
        formatRationale: "Material readiness for long-form source assets.",
        topicOrItem: item.topic,
        targetAudience: "founders-peers",
        funnelStage: "trust",
        sourceMaterial: item.sourceReference,
        sequenceKind: "recommendedNarrativeSequence",
        confidence: partial ? 0.62 : 0.75,
        likelyImpact: 5,
        effort: "medium",
        urgency: "low",
        approvalRequired: false,
        supportingReference: item.sourceReference,
        evidenceNotes: [
          `materialState=${item.materialState}`,
          `publicationState=${item.publicationState}`,
          `registryMaterialLabel=${item.registryMaterialLabel ?? "n/a"}`,
          "Registry draft ≠ verified unpublished",
        ],
        performanceInferred: false,
        isInference: false,
      }),
    );
  }

  for (const topic of ctx.inventory.plannedTopics) {
    if (!topic.sequenceAfter) continue;
    const parentItem = ctx.inventory.items.find(
      (i) =>
        i.kind === "conversation-episode" &&
        (i.id === `episode:${topic.sequenceAfter}` ||
          i.topic === topic.sequenceAfter ||
          i.sourceReference.endsWith(`#${topic.sequenceAfter}`)),
    );
    const parentExists = ctx.inventory.episodes.some(
      (e) => e.slug === topic.sequenceAfter,
    );
    if (!parentExists && !parentItem) continue;

    const parentPub = parentItem?.publicationState ?? "unknown";

    if (parentPub === "verified-unpublished") {
      out.push(
        withBrandFit({
          id: buildContentOpportunityId({
            source: "repository",
            type: "follow-up-conversation",
            subject: topic.id,
            format: "founder-conversation",
          }),
          type: "follow-up-conversation",
          title: `Verified publishing sequence: “${topic.title}” after “${topic.sequenceAfter}”`,
          whyItMatters:
            "A verified publication ledger shows the parent is unpublished — operational sequencing can wait on that parent.",
          recommendedAction:
            `Hold operational publish of “${topic.id}” until “${topic.sequenceAfter}” is verified-published.`,
          recommendedFormat: "founder-conversation",
          formatRationale: "Verified publishing order from connected ledger.",
          topicOrItem: topic.id,
          targetAudience: "engagement-buyers",
          funnelStage: topic.funnelStage,
          sourceMaterial: `themes.ts#${topic.id}`,
          relatedGuide: topic.relatedGuideSlug
            ? `/diamond-guide/${topic.relatedGuideSlug}`
            : null,
          relatedTool: topic.relatedToolPath ?? null,
          supportingIdeaAreas: topic.supportingIdeaAreas,
          audienceQuestion: topic.audienceQuestion,
          sequenceKind: "verifiedPublishingSequence",
          confidence: 0.85,
          likelyImpact: 6,
          effort: "low",
          urgency: "medium",
          approvalRequired: false,
          supportingReference: `lib/agent-os/content/themes.ts#${topic.id}`,
          evidenceNotes: [
            `parent publicationState=verified-unpublished`,
            "Verified publishing sequence — not theme-only inference",
          ],
          performanceInferred: false,
          isInference: false,
        }),
      );
      continue;
    }

    // Unknown publication: narrative relationship only — never a confirmed wait
    out.push(
      withBrandFit({
        id: buildContentOpportunityId({
          source: "repository",
          type: "follow-up-conversation",
          subject: topic.id,
          format: "founder-conversation",
        }),
        type: "follow-up-conversation",
        title: `Recommended narrative follow-up: “${topic.title}” after “${topic.sequenceAfter}”`,
        whyItMatters:
          "Thematic repository planning suggests a natural follow-up relationship — not verified operational publish order.",
        recommendedAction:
          `Verify current publishing/scheduling order for “${topic.sequenceAfter}” before treating “${topic.id}” as next operational. Refine the conversation map as a possible next-step relationship.`,
        recommendedFormat: "founder-conversation",
        formatRationale: "Conceptual narrative sequence from planned themes.",
        topicOrItem: topic.id,
        targetAudience: "engagement-buyers",
        funnelStage: topic.funnelStage,
        sourceMaterial: `themes.ts#${topic.id}`,
        relatedGuide: topic.relatedGuideSlug
          ? `/diamond-guide/${topic.relatedGuideSlug}`
          : null,
        relatedTool: topic.relatedToolPath ?? null,
        supportingIdeaAreas: topic.supportingIdeaAreas,
        audienceQuestion: topic.audienceQuestion,
        sequenceKind: "recommendedNarrativeSequence",
        confidence: pubUnknown || partial ? 0.55 : 0.7,
        likelyImpact: 5,
        effort: "low",
        urgency: "low",
        approvalRequired: false,
        supportingReference: `lib/agent-os/content/themes.ts#${topic.id}`,
        evidenceNotes: [
          `recommendedNarrativeSequence after ${topic.sequenceAfter}`,
          `parent publicationState=${parentPub}`,
          "Not a confirmed wait — publication inventory incomplete",
        ],
        performanceInferred: false,
        isInference: true,
      }),
    );
  }

  const uncovered = ctx.inventory.territories.filter(
    (t) => t.coveredByEpisodeSlugs.length === 0,
  );
  if (uncovered.length >= 3) {
    const first = uncovered[0]!;
    out.push(
      withBrandFit({
        id: buildContentOpportunityId({
          source: "repository",
          type: "message-coverage-gap",
          subject: first.id,
        }),
        type: "message-coverage-gap",
        title: `Message coverage gap: “${first.label}”`,
        whyItMatters:
          "Core Hourglass territories exist in strategy but lack a mapped founder conversation covering them yet.",
        recommendedAction:
          `Prioritize a conversation map for “${first.label}” when sequencing allows — preserve quiet-luxury tone. Verify live publish order separately.`,
        recommendedFormat: "founder-conversation",
        formatRationale: "Brand-philosophy territories belong in founder long-form first.",
        topicOrItem: first.id,
        targetAudience: "engagement-buyers",
        funnelStage: "trust",
        sourceMaterial: `themes.ts#${first.id}`,
        sequenceKind: "recommendedNarrativeSequence",
        confidence: partial ? 0.62 : 0.75,
        likelyImpact: 6,
        effort: "medium",
        urgency: "medium",
        approvalRequired: true,
        supportingReference: "lib/agent-os/content/themes.ts",
        evidenceNotes: [
          `${uncovered.length} uncovered message territories in repository strategy inventory`,
          "Coverage gap is thematic — not a claim about live publish counts",
        ],
        performanceInferred: false,
        isInference: false,
      }),
    );
  }

  return out;
}

function detectRepurposingAndHandoffs(
  ctx: ContentOpportunityContext,
): ContentOpportunity[] {
  const out: ContentOpportunity[] = [];

  for (const ep of ctx.inventory.episodes) {
    // Repurposing gap: episode has key ideas but no published derivatives tracked
    if (ep.keyIdeas.length >= 2) {
      out.push(
        withBrandFit({
          id: buildContentOpportunityId({
            source: "repository",
            type: "repurposing-gap",
            subject: ep.slug,
            format: "short-form-clip",
          }),
          type: "repurposing-gap",
          title: `Repurposing gap for “${ep.title}”`,
          whyItMatters:
            "Long-form key ideas are defined without tracked short-form derivatives — the flywheel cannot compound from one conversation.",
          recommendedAction:
            `When “${ep.slug}” is filmed, cut 2–3 calm clips from key ideas (not every format). Agent OS will not upload or schedule posts.`,
          recommendedFormat: "short-form-clip",
          formatRationale:
            "Key ideas are conversational beats that translate cleanly to short clips; carousel only if sequencing helps.",
          topicOrItem: ep.slug,
          targetAudience: "engagement-buyers",
          funnelStage: "awareness",
          sourceMaterial: `episodes.ts#${ep.slug}.keyIdeas`,
          clipTerritories: ep.keyIdeas.map((k) => k.title).slice(0, 3),
          confidence: 0.78,
          likelyImpact: 6,
          effort: "low",
          urgency: "medium",
          approvalRequired: false,
          supportingReference: `lib/conversations/episodes.ts#${ep.slug}`,
          evidenceNotes: [
            `${ep.keyIdeas.length} key ideas present; no derivative inventory in repository`,
            "Does not claim social performance",
          ],
          performanceInferred: false,
          isInference: false,
        }),
      );

      // Carousel only when ideas benefit from visual sequencing
      if (ep.keyIdeas.length >= 3) {
        out.push(
          withBrandFit({
            id: buildContentOpportunityId({
              source: "repository",
              type: "carousel-opportunity",
              subject: ep.slug,
              format: "carousel",
            }),
            type: "carousel-opportunity",
            title: `Carousel opportunity from “${ep.title}” key ideas`,
            whyItMatters:
              "Three or more related ideas benefit from ordered visual sequencing rather than a single caption dump.",
            recommendedAction:
              "Design a quiet carousel that walks the viewer through the key ideas in order — no clickbait covers.",
            recommendedFormat: "carousel",
            formatRationale:
              "Visual sequencing matches multi-beat philosophy better than one static post.",
            topicOrItem: ep.slug,
            targetAudience: "engagement-buyers",
            funnelStage: "consideration",
            sourceMaterial: `episodes.ts#${ep.slug}.keyIdeas`,
            confidence: 0.7,
            likelyImpact: 5,
            effort: "medium",
            urgency: "low",
            approvalRequired: false,
            supportingReference: `lib/conversations/episodes.ts#${ep.slug}`,
            evidenceNotes: ["Carousel recommended because ≥3 sequenced key ideas exist"],
            performanceInferred: false,
            isInference: false,
          }),
        );
      }
    }

    if (!ep.relatedArticle) {
      out.push(
        withBrandFit({
          id: buildContentOpportunityId({
            source: "repository",
            type: "video-to-guide-handoff",
            subject: ep.slug,
          }),
          type: "video-to-guide-handoff",
          title: `Video→guide handoff missing on “${ep.title}”`,
          whyItMatters:
            "Conversations should deepen into Diamond Guide authority when a related article exists.",
          recommendedAction:
            "When publishing, set relatedArticle to the best matching /diamond-guide slug (Content owns the handoff recommendation; Search owns technical linking audits).",
          recommendedFormat: "guide-enhancement",
          formatRationale: "Handoff is editorial linking, not a new channel post.",
          topicOrItem: ep.slug,
          targetAudience: "returning-researchers",
          funnelStage: "consideration",
          sourceMaterial: `episodes.ts#${ep.slug}`,
          relatedGuide: "/diamond-guide",
          confidence: 0.84,
          likelyImpact: 6,
          effort: "low",
          urgency: "medium",
          approvalRequired: false,
          supportingReference: `lib/conversations/episodes.ts#${ep.slug}`,
          evidenceNotes: ["relatedArticle absent on episode record"],
          performanceInferred: false,
          isInference: false,
        }),
      );
    }

    if (!ep.relatedTool) {
      out.push(
        withBrandFit({
          id: buildContentOpportunityId({
            source: "repository",
            type: "video-to-tool-handoff",
            subject: ep.slug,
          }),
          type: "video-to-tool-handoff",
          title: `Video→Studio tool handoff missing on “${ep.title}”`,
          whyItMatters:
            "Founder conversations about judgment should invite a calm Studio try-on or certificate read when relevant.",
          recommendedAction:
            "Propose relatedTool to /diamond-studio, /diamond-shape-studio, or /diamond-intelligence based on the episode’s idea (read-only recommendation).",
          recommendedFormat: "founder-conversation",
          formatRationale: "Tool handoff is part of the conversation page model, not a social post.",
          topicOrItem: ep.slug,
          targetAudience: "engagement-buyers",
          funnelStage: "decision",
          sourceMaterial: `episodes.ts#${ep.slug}`,
          relatedTool: "/diamond-studio",
          confidence: 0.84,
          likelyImpact: 7,
          effort: "low",
          urgency: "medium",
          approvalRequired: false,
          supportingReference: `lib/conversations/episodes.ts#${ep.slug}`,
          evidenceNotes: [
            "relatedTool absent",
            "Destination candidates: /diamond-studio, /diamond-shape-studio, /diamond-intelligence",
          ],
          performanceInferred: false,
          isInference: false,
        }),
      );
    }

    // Concierge handoff opportunity for trust-stage episodes
    out.push(
      withBrandFit({
        id: buildContentOpportunityId({
          source: "repository",
          type: "video-to-concierge-handoff",
          subject: ep.slug,
        }),
        type: "video-to-concierge-handoff",
        title: `Confirm Concierge path from “${ep.title}”`,
        whyItMatters:
          "Qualified viewers should reach a calm Concierge conversation without hard sell language.",
        recommendedAction:
          "Ensure the episode page Concierge CTA uses conversations attribution params — do not invent CRM metrics.",
        recommendedFormat: "founder-conversation",
        formatRationale: "Concierge is the decision-stage handoff for founder content.",
        topicOrItem: ep.slug,
        targetAudience: "engagement-buyers",
        funnelStage: "decision",
        sourceMaterial: `episodes.ts#${ep.slug}`,
        relatedConcierge: "/concierge",
        confidence: 0.72,
        likelyImpact: 6,
        effort: "low",
        urgency: "low",
        approvalRequired: false,
        supportingReference: "lib/conversations/episodes.ts",
        evidenceNotes: ["Concierge path is product-standard; no HubSpot aggregates available"],
        performanceInferred: false,
        isInference: false,
      }),
    );
  }

  // Planned topics with carousel/clip flags — only recommend fitting formats
  for (const topic of ctx.inventory.plannedTopics.slice(0, 2)) {
    if (topic.clipFriendly && topic.carouselFriendly) {
      // Prefer clips; carousel only with rationale already on topic
      out.push(
        withBrandFit({
          id: buildContentOpportunityId({
            source: "repository",
            type: "short-form-clip",
            subject: topic.id,
            format: "short-form-clip",
          }),
          type: "short-form-clip",
          title: `Short-form clip territories for planned “${topic.title}”`,
          whyItMatters:
            "Planned long-form already lists supporting beats that can become calm clips after filming.",
          recommendedAction:
            "Reserve clip territories from supporting idea areas — film long-form first; do not post quota-driven shorts.",
          recommendedFormat: "short-form-clip",
          formatRationale: "Supporting idea areas are discrete spoken beats suitable for shorts.",
          topicOrItem: topic.id,
          targetAudience: "engagement-buyers",
          funnelStage: topic.funnelStage,
          sourceMaterial: `themes.ts#${topic.id}`,
          clipTerritories: topic.supportingIdeaAreas.slice(0, 3),
          relatedGuide: topic.relatedGuideSlug
            ? `/diamond-guide/${topic.relatedGuideSlug}`
            : null,
          confidence: 0.68,
          likelyImpact: 5,
          effort: "low",
          urgency: "low",
          approvalRequired: false,
          supportingReference: `lib/agent-os/content/themes.ts#${topic.id}`,
          evidenceNotes: ["Derived from planned conversation map — not measured watch time"],
          performanceInferred: true,
          isInference: true,
        }),
      );
    }
  }

  return out;
}

function detectSaturationAndDuplicates(
  ctx: ContentOpportunityContext,
): ContentOpportunity[] {
  const out: ContentOpportunity[] = [];
  const partial = ctx.inventory.inventoryCompleteness !== "complete";
  const pubUnknown = !ctx.inventory.hasVerifiedPublicationLedger;
  const episodeItems = ctx.inventory.items.filter(
    (i) => i.kind === "conversation-episode",
  );
  const titles = ctx.inventory.episodes.map((e) => e.title.toLowerCase());
  const planned = ctx.inventory.plannedTopics.map((t) => t.title.toLowerCase());

  // Theme concentration on a single long-form item — soft language, not high-confidence saturation
  const singleSlugCoverage = new Map<string, number>();
  for (const t of ctx.inventory.territories) {
    for (const slug of t.coveredByEpisodeSlugs) {
      singleSlugCoverage.set(slug, (singleSlugCoverage.get(slug) ?? 0) + 1);
    }
  }
  for (const [slug, count] of singleSlugCoverage) {
    if (count < 3) continue;
    const distinctItemsCovering = episodeItems.filter((i) =>
      i.messageTags.includes(slug),
    ).length;
    // One content item alone must not create high-confidence saturation
    if (distinctItemsCovering <= 1 && episodeItems.length <= 1) {
      out.push(
        withBrandFit({
          id: buildContentOpportunityId({
            source: "repository",
            type: "message-saturation-risk",
            subject: `${slug}-theme-concentration`,
          }),
          type: "message-saturation-risk",
          title: `Broad theme concentration in “${slug}” source material`,
          whyItMatters:
            "A single founder conversation may intentionally hold several related themes. That is broad theme concentration to monitor — not high-confidence saturation.",
          recommendedAction:
            "Monitor overlap as the catalog grows; prefer uncovered territories for net-new maps rather than treating one long-form item as proof of saturation.",
          recommendedFormat: "founder-conversation",
          formatRationale: "Soft monitoring guidance for thematic density.",
          topicOrItem: `${slug}-theme-concentration`,
          targetAudience: "founders-peers",
          funnelStage: "trust",
          sourceMaterial: "themes.ts + episodes.ts",
          sequenceKind: "recommendedNarrativeSequence",
          confidence: pubUnknown || partial ? 0.4 : 0.48,
          likelyImpact: 3,
          effort: "low",
          urgency: "low",
          approvalRequired: false,
          supportingReference: "lib/agent-os/content/themes.ts",
          evidenceNotes: [
            `${count} territories mapped to one source item`,
            "Single-item concentration — not high-confidence saturation",
            `publicationState unknown lowers confidence`,
          ],
          performanceInferred: false,
          isInference: true,
        }),
      );
      continue;
    }

    // Multiple distinct items with overlap → stronger saturation signal
    if (distinctItemsCovering >= 2 || episodeItems.length >= 2) {
      out.push(
        withBrandFit({
          id: buildContentOpportunityId({
            source: "repository",
            type: "message-saturation-risk",
            subject: `${slug}-multi-item-overlap`,
          }),
          type: "message-saturation-risk",
          title: `Message saturation risk across multiple items near “${slug}”`,
          whyItMatters:
            "Repeated territory across multiple distinct content items raises duplication risk for the series.",
          recommendedAction:
            "Differentiate net-new conversations toward uncovered territories before repeating the same philosophy block.",
          recommendedFormat: "founder-conversation",
          formatRationale: "Saturation control from multi-item overlap.",
          topicOrItem: `${slug}-multi-item-overlap`,
          targetAudience: "founders-peers",
          funnelStage: "trust",
          sourceMaterial: "themes.ts + episodes.ts",
          confidence: partial || pubUnknown ? 0.58 : 0.78,
          likelyImpact: 6,
          effort: "low",
          urgency: "medium",
          approvalRequired: false,
          supportingReference: "lib/agent-os/content/themes.ts",
          evidenceNotes: [
            `distinctItems=${distinctItemsCovering}`,
            partial
              ? "Partial inventory — saturation confidence reduced"
              : "Inventory completeness adequate for stronger saturation claim",
          ],
          performanceInferred: false,
          isInference: true,
        }),
      );
    }
  }

  // Planned-topic mutual overlap (multiple planned with substantial overlap)
  const plannedPairs = ctx.inventory.plannedTopics;
  for (let i = 0; i < plannedPairs.length; i++) {
    for (let j = i + 1; j < plannedPairs.length; j++) {
      const a = plannedPairs[i]!;
      const b = plannedPairs[j]!;
      if (!tokensOverlap(a.title, b.title)) continue;
      out.push(
        withBrandFit({
          id: buildContentOpportunityId({
            source: "repository",
            type: "message-saturation-risk",
            subject: `planned-overlap-${a.id}-${b.id}`,
          }),
          type: "message-saturation-risk",
          title: `Planned-topic overlap: “${a.id}” vs “${b.id}”`,
          whyItMatters:
            "Multiple planned conversation maps share substantial theme overlap — future repetition risk if both ship unchanged.",
          recommendedAction:
            "Differentiate the maps or merge intent before production.",
          recommendedFormat: "founder-conversation",
          formatRationale: "Planning overlap across multiple planned items.",
          topicOrItem: `${a.id}-vs-${b.id}`,
          targetAudience: "founders-peers",
          funnelStage: "awareness",
          sourceMaterial: "themes.ts planned pipeline",
          confidence: partial ? 0.5 : 0.68,
          likelyImpact: 5,
          effort: "low",
          urgency: "low",
          approvalRequired: false,
          supportingReference: "lib/agent-os/content/themes.ts",
          evidenceNotes: ["Multiple planned items with token overlap"],
          performanceInferred: false,
          isInference: true,
        }),
      );
    }
  }

  for (const topic of ctx.inventory.plannedTopics) {
    const dup = titles.some((t) => tokensOverlap(t, topic.title));
    const selfDup =
      planned.filter((t) => tokensOverlap(t, topic.title)).length > 1;
    if (dup || selfDup) {
      out.push(
        withBrandFit({
          id: buildContentOpportunityId({
            source: "repository",
            type: "duplicate-topic-risk",
            subject: topic.id,
          }),
          type: "duplicate-topic-risk",
          title: `Duplicate-topic risk: “${topic.title}”`,
          whyItMatters:
            "Overlapping titles/themes can confuse the series — treat cautiously while publication inventory is partial.",
          recommendedAction:
            "Differentiate the conversation map or defer until publish order is verified — do not assume operational duplicates from registry alone.",
          recommendedFormat: "founder-conversation",
          formatRationale: "Cautious risk flag for long-form planning.",
          topicOrItem: topic.id,
          targetAudience: "founders-peers",
          funnelStage: "awareness",
          sourceMaterial: `themes.ts#${topic.id}`,
          confidence: partial || pubUnknown ? 0.42 : 0.65,
          likelyImpact: 4,
          effort: "low",
          urgency: "low",
          approvalRequired: false,
          supportingReference: "lib/agent-os/content/themes.ts",
          evidenceNotes: [
            "Title/token overlap with existing episode or planned topics",
            partial
              ? "Partial inventory — duplicate confidence lowered"
              : "Duplicate signal from repository titles",
          ],
          performanceInferred: false,
          isInference: true,
        }),
      );
    }
  }

  return out;
}

function detectBiSupportedTrustContent(
  ctx: ContentOpportunityContext,
): ContentOpportunity[] {
  const out: ContentOpportunity[] = [];
  const cta = ctx.biRecommendations.find(
    (r) =>
      /cta|consultation|studio/i.test(r.title) ||
      /cta|consultation|studio/i.test(r.proposedAction),
  );
  if (!cta) return out;

  out.push(
    withBrandFit({
      id: buildContentOpportunityId({
        source: "bi",
        type: "trust-building-content",
        subject: "studio-to-conversation",
      }),
      type: "trust-building-content",
      title: "Trust-building content: Studio engagement vs consultation clarity",
      whyItMatters:
        "BI shows Studio interest with weaker consultation CTA — Content can clarify what a Concierge conversation feels like without inventing conversion rates.",
      recommendedAction:
        "Plan a short conversation or clip that explains calm next steps after Studio exploration — not a hard sell. Leave funnel measurement fixes to BI.",
      recommendedFormat: "short-form-clip",
      formatRationale:
        "A contained clip can reduce anxiety about ‘what happens next’ without a full philosophy episode.",
      topicOrItem: "studio-consultation-clarity",
      targetAudience: "engagement-buyers",
      funnelStage: "decision",
      sourceMaterial: cta.recommendationId,
      relatedTool: "/diamond-studio",
      relatedConcierge: "/concierge",
      confidence: Math.min(0.7, cta.confidence),
      likelyImpact: 7,
      effort: "low",
      urgency: "medium",
      approvalRequired: false,
      supportingReference: cta.recommendationId,
      evidenceNotes: [
        `BI signal: ${cta.title}`,
        "Content owns communication; BI owns measurement diagnosis",
        "No revenue inferred from CTA clicks",
      ],
      performanceInferred: true,
      isInference: true,
    }),
  );
  return out;
}

function detectLocalAuthorityContent(
  ctx: ContentOpportunityContext,
): ContentOpportunity[] {
  const local = ctx.searchOpportunities.find(
    (o) => o.type === "local-intent-gap",
  );
  if (!local) return [];
  return [
    withBrandFit({
      id: buildContentOpportunityId({
        source: "search",
        type: "local-authority-content",
        subject: "charlotte-conversation",
        format: "founder-conversation",
      }),
      type: "local-authority-content",
      title: "Local-authority conversation for Charlotte-area seekers",
      whyItMatters:
        "Search shows regional discovery demand; Content can speak calmly to local intent without fabricating GBP pack metrics.",
      recommendedAction:
        "Use the planned Charlotte discernment conversation map; do not invent review/pack claims. Search owns hub/schema technical fixes.",
      recommendedFormat: "founder-conversation",
      formatRationale: "Local trust is narrative + Concierge path, not a GBP edit.",
      topicOrItem: "charlotte-discernment",
      targetAudience: "local-charlotte",
      funnelStage: "decision",
      sourceMaterial: local.supportingReference,
      relatedGuide: "/diamond-guide/charlotte-diamond-advisor-guide",
      relatedConcierge: "/concierge",
      confidence: Math.min(0.72, local.confidence),
      likelyImpact: 7,
      effort: "medium",
      urgency: "medium",
      approvalRequired: true,
      supportingReference: local.supportingReference,
      evidenceNotes: [
        `Search local-intent evidence: ${local.queryOrPage}`,
        "GBP metrics unavailable — readiness/recommendation only",
      ],
      performanceInferred: true,
      isInference: true,
    }),
  ];
}

function withBrandFit(
  partial: Omit<ContentOpportunity, "brandFitOk" | "brandFitNotes">,
): ContentOpportunity {
  const fit = assessBrandFit(
    `${partial.title} ${partial.recommendedAction} ${partial.hookDirection ?? ""}`,
  );
  return {
    ...partial,
    brandFitOk: fit.ok,
    brandFitNotes: fit.notes,
  };
}

function tokensOverlap(a: string, b: string): boolean {
  const ta = new Set(
    a
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 3),
  );
  const tb = b
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 3);
  let hits = 0;
  for (const t of tb) {
    if (ta.has(t)) hits += 1;
  }
  return hits >= 2;
}

function isBrandQueryLoose(q: string): boolean {
  return /hourglass/i.test(q);
}

function dedupeById(items: ContentOpportunity[]): ContentOpportunity[] {
  const seen = new Set<string>();
  const out: ContentOpportunity[] = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
}
