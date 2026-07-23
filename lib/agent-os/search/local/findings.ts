/**
 * Local Authority finding detectors.
 * Repository ≠ GBP. GSC ≠ map-pack. Testimonials ≠ GBP reviews.
 */

import type { GscWeeklyBundle } from "@/lib/integrations/gsc";
import { isBrandQuery } from "@/lib/intelligence/brand-queries";
import { articles, type Article } from "@/app/diamond-guide/articles";
import { articleCategorySegment } from "@/lib/seo/schema/category-map";
import {
  isSmallSample,
  sampleSizeConfidencePenalty,
} from "../classify";
import type { GuideAuthoritySnapshot } from "../guide-authority";
import {
  classifyLocalGeography,
  classifyLocalIntentKind,
  isLocalAuthorityQuery,
} from "./geography";
import { buildLocalAuthorityFindingId } from "./ids";
import type {
  GbpIntelligenceSnapshot,
  LocalAuthorityFinding,
  LocalEntityInventory,
  LocalGeography,
} from "./types";

const MIN_LOCAL_IMPRESSIONS_CTR = 250;
const LOW_CTR = 0.025;
const NEAR_PAGE_ONE_MIN = 4;
const NEAR_PAGE_ONE_MAX = 15;
const MIN_LOCAL_NEAR = 120;
const MIN_MISMATCH = 200;
const SMALL_LOCAL_IMPRESSIONS = 80;

const TOOL_PATHS = [
  "/diamond-studio",
  "/diamond-shape-studio",
  "/diamond-intelligence",
] as const;

export type DetectLocalFindingsInput = {
  gsc: GscWeeklyBundle | null;
  gscAvailable: boolean;
  entityInventory: LocalEntityInventory;
  gbp: GbpIntelligenceSnapshot;
  guideAuthority: GuideAuthoritySnapshot;
  articleList?: Article[];
};

export function detectLocalAuthorityFindings(
  input: DetectLocalFindingsInput,
): LocalAuthorityFinding[] {
  const articlesList = input.articleList ?? articles;
  const findings: LocalAuthorityFinding[] = [];

  findings.push(...detectGbpRootSourceGap(input.gbp));
  findings.push(...detectGbpUnknownDimensions(input.gbp));
  findings.push(
    ...detectGscLocalFindings(input.gsc, input.gscAvailable, articlesList),
  );
  findings.push(
    ...detectCharlotteHubGap(input.entityInventory, articlesList),
  );
  findings.push(...detectLocalGuideHandoffGaps(articlesList));
  findings.push(...detectServiceAreaConsistency(input.entityInventory));
  findings.push(...detectLocalSchemaReadiness(input.entityInventory));
  findings.push(...detectReviewReputationGaps(input.gbp, input.entityInventory));
  findings.push(...detectMapPackReadiness(input.gbp, input.entityInventory));
  findings.push(...detectHealthyLocalCoverage(input.gsc, input.gscAvailable));
  findings.push(...detectCrossExecutiveHandoffs(findings, input));

  return dedupeById(findings);
}

function detectGbpRootSourceGap(
  gbp: GbpIntelligenceSnapshot,
): LocalAuthorityFinding[] {
  if (gbp.hasVerifiedGbpData || !gbp.rootSourceGapId) return [];

  return [
    finding({
      type: "gbp-source-gap",
      source: "gbp",
      subject: "google-business-profile",
      geography: "charlotte-metro",
      title: "Google Business Profile source unavailable for local authority",
      whyItMatters:
        "Without a verified read-only GBP adapter, Agent OS cannot evaluate profile completeness, reviews, calls, directions, or map-pack performance.",
      recommendedAction:
        "Verify a trusted GBP read source before evaluating profile performance or local-pack actions. Do not treat this gap as proof the profile is incomplete.",
      queryOrPage: null,
      route: null,
      evidenceClass: "source-gap",
      confidence: 0.95,
      sampleSize: null,
      freshness: "unknown",
      localIntentKind: null,
      likelyImpact: 6,
      effort: "medium",
      urgency: "medium",
      dependency: "Verified GBP read adapter or trusted export",
      owner: "search-strategy",
      founderApprovalRequired: false,
      externalVerificationState: "unavailable",
      isInference: false,
      executionOwnedElsewhere: false,
      suppressRecommendation: false,
      evidenceNotes: [
        `GBP sourceState=${gbp.sourceState}`,
        "Unknown dimensions remain in JSON; do not list each as a named founder priority",
        "Repository entity evidence does not imply observed GBP state",
      ],
      supportingReference: gbp.rootSourceGapId,
    }),
  ];
}

function detectGbpUnknownDimensions(
  gbp: GbpIntelligenceSnapshot,
): LocalAuthorityFinding[] {
  if (gbp.hasVerifiedGbpData) return [];

  // Supporting unknown dimensions stay structured; recommendations suppressed
  // so the founder brief is not flooded. Root gbp-source-gap owns surfacing.
  return gbp.dimensions
    .filter((d) => d.observedValue == null)
    .slice(0, 8)
    .map((d) =>
      finding({
        type:
          d.key === "review-count" || d.key === "rating"
            ? "gbp-review-measurement-gap"
            : d.key === "calls" ||
                d.key === "directions" ||
                d.key === "messages" ||
                d.key === "website-clicks" ||
                d.key === "profile-views"
              ? "gbp-engagement-measurement-gap"
              : d.key === "primary-category" || d.key === "secondary-categories"
                ? "gbp-category-verification-required"
                : d.key === "service-areas"
                  ? "gbp-service-area-verification-required"
                  : d.key === "appointment-url"
                    ? "gbp-appointment-link-verification-required"
                    : "gbp-profile-readiness",
        source: "gbp",
        subject: d.key,
        geography: "charlotte-metro",
        title: `GBP dimension unknown: ${d.key}`,
        whyItMatters:
          "Dimension cannot be assessed without a verified GBP source.",
        recommendedAction:
          "Deferred — covered by the root GBP source-gap recommendation.",
        queryOrPage: null,
        route: null,
        evidenceClass: "unknown",
        confidence: 0,
        sampleSize: null,
        freshness: "unknown",
        localIntentKind: null,
        likelyImpact: 2,
        effort: "low",
        urgency: "low",
        dependency: gbp.rootSourceGapId,
        owner: "search-strategy",
        founderApprovalRequired: false,
        externalVerificationState: "unavailable",
        isInference: false,
        executionOwnedElsewhere: false,
        suppressRecommendation: true,
        evidenceNotes: [
          "Supporting unknown dimension — not a separate founder priority",
          "Do not claim incomplete profile from absence of adapter data",
        ],
        supportingReference: `gbp.dimension.${d.key}`,
      }),
    );
}

function detectGscLocalFindings(
  gsc: GscWeeklyBundle | null,
  available: boolean,
  articleList: Article[],
): LocalAuthorityFinding[] {
  if (!available || !gsc?.current) return [];

  const out: LocalAuthorityFinding[] = [];
  const queries = gsc.current.topQueries ?? [];
  const pages = gsc.current.topPages ?? [];
  const charlotteRoutes = articleList
    .filter((a) => a.category === "Charlotte Guides")
    .map((a) => `/diamond-guide/${a.slug}`);

  for (const row of queries) {
    if (!isLocalAuthorityQuery(row.query)) continue;

    const geography = classifyLocalGeography(row.query);
    const intent = classifyLocalIntentKind(row.query);
    const penalty = sampleSizeConfidencePenalty(row.impressions, row.clicks);
    const small = isSmallSample(row.impressions, row.clicks);

    // Small-sample local queries: lower confidence / suppress
    if (row.impressions < SMALL_LOCAL_IMPRESSIONS) {
      out.push(
        finding({
          type: "local-intent-query",
          source: "gsc",
          subject: row.query,
          geography,
          title: `Small-sample local query suppressed: “${row.query}”`,
          whyItMatters:
            "Local demand signal is too thin to justify a named recommendation.",
          recommendedAction: "Monitor only — do not act on this sample alone.",
          queryOrPage: row.query,
          route: null,
          evidenceClass: "observed",
          confidence: round(0.35 * penalty),
          sampleSize: row.impressions,
          freshness: "fresh",
          localIntentKind: intent,
          likelyImpact: 2,
          effort: "low",
          urgency: "low",
          dependency: null,
          owner: "search-strategy",
          founderApprovalRequired: false,
          externalVerificationState: "not-required",
          isInference: false,
          executionOwnedElsewhere: false,
          suppressRecommendation: true,
          evidenceNotes: [
            `Impressions ${row.impressions} below local action threshold`,
            "Query text does not prove physical user location",
          ],
          supportingReference: "gsc.topQueries.local",
        }),
      );
      continue;
    }

    // Healthy branded location query
    if (
      isBrandQuery(row.query) &&
      intent === "branded-location-query" &&
      row.position <= 5 &&
      row.ctr >= 0.08
    ) {
      out.push(
        finding({
          type: "local-coverage-healthy",
          source: "gsc",
          subject: row.query,
          geography,
          title: `Healthy branded local query: “${row.query}”`,
          whyItMatters:
            "Branded location demand already resolves with strong CTR/position — no problem finding.",
          recommendedAction: "No action — preserve current landing clarity.",
          queryOrPage: row.query,
          route: null,
          evidenceClass: "healthy",
          confidence: round(0.85 * penalty),
          sampleSize: row.impressions,
          freshness: "fresh",
          localIntentKind: intent,
          likelyImpact: 1,
          effort: "low",
          urgency: "low",
          dependency: null,
          owner: "search-strategy",
          founderApprovalRequired: false,
          externalVerificationState: "not-required",
          isInference: false,
          executionOwnedElsewhere: false,
          suppressRecommendation: true,
          evidenceNotes: [
            `pos ${row.position.toFixed(1)}; CTR ${(row.ctr * 100).toFixed(2)}%`,
            "Healthy coverage — recommendation suppressed",
          ],
          supportingReference: "gsc.topQueries.local",
        }),
      );
      continue;
    }

    if (
      !isBrandQuery(row.query) &&
      row.position >= NEAR_PAGE_ONE_MIN &&
      row.position <= NEAR_PAGE_ONE_MAX &&
      row.impressions >= MIN_LOCAL_NEAR
    ) {
      out.push(
        finding({
          type: "local-near-page-one",
          source: "gsc",
          subject: row.query,
          geography,
          title: `Local near-page-one opportunity: “${row.query}”`,
          whyItMatters:
            "Verified local discovery demand sits in positions 4–15 where contained authority work can compound.",
          recommendedAction:
            "Strengthen the best-matching Charlotte guide or commercial landing opening answer and Concierge path — Search diagnoses; Content owns communication assets.",
          queryOrPage: row.query,
          route: bestMatchingLocalRoute(row.query, charlotteRoutes, pages),
          evidenceClass: "observed",
          confidence: round(0.76 * penalty),
          sampleSize: row.impressions,
          freshness: "fresh",
          localIntentKind: intent,
          likelyImpact: 8,
          effort: "medium",
          urgency: "high",
          dependency: null,
          owner: "search-strategy",
          founderApprovalRequired: false,
          externalVerificationState: "not-required",
          isInference: false,
          executionOwnedElsewhere: false,
          suppressRecommendation: small,
          evidenceNotes: [
            `pos ${row.position.toFixed(1)}; ${row.impressions} impressions`,
            small ? "Sample modest — treat as directional" : "Sample adequate",
            "Does not claim map-pack ranking",
          ],
          supportingReference: "gsc.topQueries.local",
        }),
      );
    }

    if (
      !isBrandQuery(row.query) &&
      row.impressions >= MIN_LOCAL_IMPRESSIONS_CTR &&
      row.ctr < LOW_CTR
    ) {
      out.push(
        finding({
          type: "local-high-impression-low-ctr",
          source: "gsc",
          subject: row.query,
          geography,
          title: `Local high-impression / weak CTR: “${row.query}”`,
          whyItMatters:
            "Regional discovery volume with weak click-through wastes existing Search Console demand.",
          recommendedAction:
            "Review title/meta and opening promise for the best-matching local landing — do not invent a new city page automatically.",
          queryOrPage: row.query,
          route: bestMatchingLocalRoute(row.query, charlotteRoutes, pages),
          evidenceClass: "observed",
          confidence: round(0.78 * penalty),
          sampleSize: row.impressions,
          freshness: "fresh",
          localIntentKind: intent,
          likelyImpact: 8,
          effort: "low",
          urgency: "high",
          dependency: null,
          owner: "search-strategy",
          founderApprovalRequired: false,
          externalVerificationState: "not-required",
          isInference: false,
          executionOwnedElsewhere: false,
          suppressRecommendation: false,
          evidenceNotes: [
            `CTR ${(row.ctr * 100).toFixed(2)}% on ${row.impressions} impressions`,
          ],
          supportingReference: "gsc.topQueries.local",
        }),
      );
    }

    // Query–page mismatch for local queries
    if (!isBrandQuery(row.query) && row.impressions >= MIN_MISMATCH) {
      const matched = localQueryHasMatchingPage(row.query, pages, charlotteRoutes);
      if (!matched) {
        const routeHint =
          bestMatchingLocalRoute(row.query, charlotteRoutes, pages) ??
          "/diamond-guide/charlotte-diamond-advisor-guide";
        out.push(
          finding({
            type: "local-query-page-mismatch",
            source: "local",
            subject: `${geography}:${routeHint}`,
            geography,
            title: `Local query–page mismatch risk: “${row.query}”`,
            whyItMatters:
              "Local Search Console demand lacks a clearly matching top landing page in the same week.",
            recommendedAction:
              "Map the query to an existing Charlotte guide or commercial URL; prefer internal linking over a new location page unless no match exists.",
            queryOrPage: row.query,
            route: routeHint,
            evidenceClass: "observed",
            confidence: round(0.58 * penalty),
            sampleSize: row.impressions,
            freshness: "fresh",
            localIntentKind: intent,
            likelyImpact: 7,
            effort: "medium",
            urgency: "medium",
            dependency: "Guide-authority mapping confirmation",
            owner: "search-strategy",
            founderApprovalRequired: false,
            externalVerificationState: "not-required",
            isInference: true,
            executionOwnedElsewhere: false,
            suppressRecommendation: false,
            evidenceNotes: [
              "Inference from top-query vs top-page lists (not query×page matrix)",
              "Do not auto-create a page for every city",
            ],
            supportingReference: "gsc.query-vs-page.local",
          }),
        );
      }
    }
  }

  return out;
}

function detectCharlotteHubGap(
  inventory: LocalEntityInventory,
  articleList: Article[],
): LocalAuthorityFinding[] {
  const charlotteArticles = articleList.filter(
    (a) => a.category === "Charlotte Guides",
  );
  const hubMapped = articleCategorySegment("Charlotte Guides") !== null;
  if (charlotteArticles.length === 0 || hubMapped) return [];

  return [
    finding({
      type: "local-hub-gap",
      source: "repository",
      subject: "charlotte-guides",
      geography: "charlotte",
      title: "Charlotte Guides lack a discoverable category hub",
      whyItMatters:
        "Local authority articles exist, but Charlotte Guides is not mapped in DIAMOND_GUIDE_CATEGORIES — weakening hub discovery.",
      recommendedAction:
        "Plan Charlotte Guides hub segment alignment (metadata + category-map) in a later editorial/SEO pass — Agent OS will not create the page.",
      queryOrPage: "Charlotte Guides",
      route: inventory.charlotteGuideRoutes[0] ?? null,
      evidenceClass: "repository-backed",
      confidence: 0.9,
      sampleSize: charlotteArticles.length,
      freshness: "fresh",
      localIntentKind: "local-informational-query",
      likelyImpact: 7,
      effort: "medium",
      urgency: "medium",
      dependency: null,
      owner: "search-strategy",
      founderApprovalRequired: false,
      externalVerificationState: "not-required",
      isInference: false,
      executionOwnedElsewhere: false,
      // Static repository gap — keep in JSON; soft-suppress from flooding brief
      suppressRecommendation: false,
      evidenceNotes: [
        "Repository fact: articleCategorySegment('Charlotte Guides') is null",
        "Articles remain sitemap-included via slug loop",
        "Static repository finding — should not flood daily founder priorities alone",
      ],
      supportingReference: "lib/seo/schema/category-map.ts",
    }),
  ];
}

function detectLocalGuideHandoffGaps(
  articleList: Article[],
): LocalAuthorityFinding[] {
  const out: LocalAuthorityFinding[] = [];
  const charlotte = articleList.filter((a) => a.category === "Charlotte Guides");
  let toolGaps = 0;
  let conciergeGaps = 0;

  for (const article of charlotte) {
    const hrefs = collectHrefs(article);
    const route = `/diamond-guide/${article.slug}`;
    const hasTool = TOOL_PATHS.some((p) => hrefs.some((h) => h.includes(p)));
    const hasConcierge = hrefs.some((h) => h.includes("/concierge"));

    if (!hasTool) {
      toolGaps += 1;
      out.push(
        finding({
          type: "local-tool-handoff-gap",
          source: "repository",
          subject: route,
          geography: "charlotte",
          title: `Local guide–tool link gap: ${article.slug}`,
          whyItMatters:
            "Charlotte Guides should connect buyers to Size Studio / See It On Your Hand / Analyze Sparkle when ready.",
          recommendedAction: `Propose an editorial link from ${route} to a relevant Studio tool (Agent OS does not edit content).`,
          queryOrPage: route,
          route,
          evidenceClass: "repository-backed",
          confidence: 0.82,
          sampleSize: hrefs.length,
          freshness: "fresh",
          localIntentKind: "local-informational-query",
          likelyImpact: 6,
          effort: "low",
          urgency: "medium",
          dependency: null,
          owner: "search-strategy",
          founderApprovalRequired: false,
          externalVerificationState: "not-required",
          isInference: false,
          executionOwnedElsewhere: false,
          suppressRecommendation: toolGaps > 1,
          evidenceNotes: [
            `Source route: ${route}`,
            "Destination candidates: /diamond-studio, /diamond-shape-studio, /diamond-intelligence",
          ],
          supportingReference: `app/diamond-guide/articles.ts#${article.slug}`,
        }),
      );
    }

    if (!hasConcierge) {
      conciergeGaps += 1;
      out.push(
        finding({
          type: "local-concierge-handoff-gap",
          source: "repository",
          subject: route,
          geography: "charlotte",
          title: `Local guide–Concierge link gap: ${article.slug}`,
          whyItMatters:
            "Local educational content should offer a calm path into Concierge when the buyer is ready.",
          recommendedAction: `Propose an editorial Concierge handoff from ${route} to /concierge.`,
          queryOrPage: route,
          route,
          evidenceClass: "repository-backed",
          confidence: 0.84,
          sampleSize: hrefs.length,
          freshness: "fresh",
          localIntentKind: "local-commercial-query",
          likelyImpact: 7,
          effort: "low",
          urgency: "medium",
          dependency: null,
          owner: "search-strategy",
          founderApprovalRequired: false,
          externalVerificationState: "not-required",
          isInference: false,
          executionOwnedElsewhere: false,
          suppressRecommendation: conciergeGaps > 1,
          evidenceNotes: [
            `Source route: ${route}`,
            "Destination: /concierge",
          ],
          supportingReference: `app/diamond-guide/articles.ts#${article.slug}`,
        }),
      );
    }
  }

  return out;
}

function detectServiceAreaConsistency(
  inventory: LocalEntityInventory,
): LocalAuthorityFinding[] {
  const out: LocalAuthorityFinding[] = [];
  const serviceField = inventory.fields.find((f) => f.key === "service-areas");
  const primary = inventory.fields.find((f) => f.key === "primary-location");
  const description = inventory.fields.find(
    (f) => f.key === "primary-service-description",
  );

  // Complementary Charlotte + nationwide language is healthy, not a contradiction
  if (
    serviceField?.present &&
    description?.normalizedValue?.toLowerCase().includes("nationwide") &&
    description.normalizedValue.toLowerCase().includes("charlotte")
  ) {
    out.push(
      finding({
        type: "local-coverage-healthy",
        source: "repository",
        subject: "charlotte-nationwide-complementary",
        geography: "charlotte-metro",
        title: "Service-area language is complementary (Charlotte + nationwide)",
        whyItMatters:
          "Charlotte primary positioning alongside nationwide capability is consistent repository intent — not a contradiction.",
        recommendedAction: "No corrective action for complementary geography framing.",
        queryOrPage: null,
        route: null,
        evidenceClass: "healthy",
        confidence: 0.88,
        sampleSize: inventory.serviceAreaSignals.length,
        freshness: "fresh",
        localIntentKind: null,
        likelyImpact: 1,
        effort: "low",
        urgency: "low",
        dependency: null,
        owner: "search-strategy",
        founderApprovalRequired: false,
        externalVerificationState: "not-required",
        isInference: false,
        executionOwnedElsewhere: false,
        suppressRecommendation: true,
        evidenceNotes: [
          "Charlotte-based + nationwide + metro areaServed treated as complementary",
          "External NAP verification still required outside the website",
        ],
        supportingReference: "lib/seo/schema/constants.ts",
      }),
    );
  }

  // Real contradiction would require conflicting locality claims — none detected in constants
  if (
    primary?.normalizedValue &&
    /waxhaw/i.test(primary.normalizedValue) &&
    inventory.fields.some(
      (f) =>
        f.key === "locality" &&
        f.normalizedValue != null &&
        !/charlotte/i.test(f.normalizedValue) &&
        !/waxhaw/i.test(f.normalizedValue),
    )
  ) {
    out.push(
      finding({
        type: "service-area-inconsistency",
        source: "repository",
        subject: "primary-locality",
        geography: "charlotte-metro",
        title: "Repository service-area contradiction detected",
        whyItMatters:
          "Conflicting primary locality signals weaken entity clarity for local search readiness.",
        recommendedAction:
          "Confirm one authoritative local entity representation across metadata, schema, and contact surfaces.",
        queryOrPage: null,
        route: null,
        evidenceClass: "repository-backed",
        confidence: 0.7,
        sampleSize: null,
        freshness: "fresh",
        localIntentKind: null,
        likelyImpact: 7,
        effort: "medium",
        urgency: "medium",
        dependency: null,
        owner: "search-strategy",
        founderApprovalRequired: true,
        externalVerificationState: "required",
        isInference: true,
        executionOwnedElsewhere: false,
        suppressRecommendation: false,
        evidenceNotes: [
          "Internal repository consistency only — not external citation proof",
        ],
        supportingReference: "lib/seo/schema/entities.ts",
      }),
    );
  }

  // Missing street/postal are readiness gaps, not GBP incompleteness claims
  if (!inventory.hasStreetAddress || !inventory.hasPostalCode) {
    out.push(
      finding({
        type: "local-entity-inconsistency",
        source: "repository",
        subject: "postal-address-completeness",
        geography: "charlotte",
        title: "Repository LocalBusiness address is locality-level only",
        whyItMatters:
          "Schema exposes Charlotte, NC without street or postal code — internal readiness signal only.",
        recommendedAction:
          "Confirm whether a public street address should appear in schema/contact; external verification required before claiming NAP consistency.",
        queryOrPage: null,
        route: null,
        evidenceClass: "readiness",
        confidence: 0.8,
        sampleSize: null,
        freshness: "fresh",
        localIntentKind: null,
        likelyImpact: 4,
        effort: "medium",
        urgency: "low",
        dependency: "Founder decision on public address disclosure",
        owner: "search-strategy",
        founderApprovalRequired: true,
        externalVerificationState: "required",
        isInference: false,
        executionOwnedElsewhere: false,
        suppressRecommendation: true,
        evidenceNotes: [
          "Internal-only entity observation",
          "Does not prove GBP address mismatch",
        ],
        supportingReference: "lib/seo/schema/entities.ts#PostalAddress",
      }),
    );
  }

  return out;
}

function detectLocalSchemaReadiness(
  inventory: LocalEntityInventory,
): LocalAuthorityFinding[] {
  const out: LocalAuthorityFinding[] = [];

  if (
    inventory.schemaTypesPresent.includes("LocalBusiness") &&
    inventory.schemaTypesPresent.includes("Organization")
  ) {
    out.push(
      finding({
        type: "local-coverage-healthy",
        source: "repository",
        subject: "localbusiness-organization-schema",
        geography: "charlotte",
        title: "LocalBusiness + Organization schema present (readiness)",
        whyItMatters:
          "Repository ships LocalBusiness/JewelryStore with areaServed — schema readiness only, not Google eligibility.",
        recommendedAction: "No schema change in this pass.",
        queryOrPage: null,
        route: null,
        evidenceClass: "readiness",
        confidence: 0.9,
        sampleSize: null,
        freshness: "fresh",
        localIntentKind: null,
        likelyImpact: 1,
        effort: "low",
        urgency: "low",
        dependency: null,
        owner: "search-strategy",
        founderApprovalRequired: false,
        externalVerificationState: "not-required",
        isInference: false,
        executionOwnedElsewhere: false,
        suppressRecommendation: true,
        evidenceNotes: [
          "Schema readiness language only — no Google eligibility claim",
        ],
        supportingReference: "lib/seo/schema/entities.ts",
      }),
    );
  }

  if (!inventory.hasAggregateRatingSchema && !inventory.hasReviewSchema) {
    out.push(
      finding({
        type: "local-schema-gap",
        source: "repository",
        subject: "aggregate-rating-absent",
        geography: "charlotte",
        title: "Review/AggregateRating schema absent (readiness)",
        whyItMatters:
          "No review schema in repository — correct unless visible page content and policy support it.",
        recommendedAction:
          "Do not add AggregateRating schema unless visible testimonials and policy requirements clearly support it. Search reports readiness only.",
        queryOrPage: "/whispered-praise",
        route: "/whispered-praise",
        evidenceClass: "readiness",
        confidence: 0.85,
        sampleSize: null,
        freshness: "fresh",
        localIntentKind: null,
        likelyImpact: 3,
        effort: "low",
        urgency: "low",
        dependency: null,
        owner: "search-strategy",
        founderApprovalRequired: true,
        externalVerificationState: "required",
        isInference: false,
        executionOwnedElsewhere: false,
        suppressRecommendation: true,
        evidenceNotes: [
          "Whispered Praise testimonials ≠ GBP reviews",
          "Schema readiness only — not eligibility",
        ],
        supportingReference: "lib/seo/schema/entities.ts",
      }),
    );
  }

  return out;
}

function detectReviewReputationGaps(
  gbp: GbpIntelligenceSnapshot,
  inventory: LocalEntityInventory,
): LocalAuthorityFinding[] {
  const out: LocalAuthorityFinding[] = [];

  const reviewCount = gbp.dimensions.find((d) => d.key === "review-count");
  const rating = gbp.dimensions.find((d) => d.key === "rating");

  if (
    (reviewCount?.observedValue == null || reviewCount.evidenceClass === "unknown") &&
    (rating?.observedValue == null || rating.evidenceClass === "unknown")
  ) {
    out.push(
      finding({
        type: "local-review-readiness-gap",
        source: "gbp",
        subject: "review-metrics-unknown",
        geography: "charlotte-metro",
        title: "GBP review count/rating unknown without verified source",
        whyItMatters:
          "Reputation opportunity requires verified review data — repository testimonials are not GBP reviews.",
        recommendedAction:
          "Covered by root GBP source gap — do not recommend generic “get more reviews” or client-specific outreach.",
        queryOrPage: inventory.fields.find((f) => f.key === "review-testimonial-route")
          ?.normalizedValue ?? "/whispered-praise",
        route: "/whispered-praise",
        evidenceClass: "unknown",
        confidence: 0.9,
        sampleSize: null,
        freshness: "unknown",
        localIntentKind: null,
        likelyImpact: 4,
        effort: "low",
        urgency: "low",
        dependency: gbp.rootSourceGapId,
        owner: "search-strategy",
        founderApprovalRequired: false,
        externalVerificationState: "unavailable",
        isInference: false,
        executionOwnedElsewhere: false,
        suppressRecommendation: true,
        evidenceNotes: [
          "Review count unknown",
          "Rating unknown",
          "Repository testimonials do not equal GBP reviews",
        ],
        supportingReference: "gbp.review-metrics",
      }),
    );
  }

  return out;
}

function detectMapPackReadiness(
  gbp: GbpIntelligenceSnapshot,
  inventory: LocalEntityInventory,
): LocalAuthorityFinding[] {
  const out: LocalAuthorityFinding[] = [];

  const readinessSignals: string[] = [];
  if (inventory.schemaTypesPresent.includes("LocalBusiness")) {
    readinessSignals.push("LocalBusiness schema present");
  }
  if (inventory.fields.find((f) => f.key === "contact-concierge-route")?.present) {
    readinessSignals.push("Concierge contact path present");
  }
  if (inventory.charlotteGuideRoutes.length > 0) {
    readinessSignals.push("Charlotte Guides content present");
  }
  if (inventory.fields.find((f) => f.key === "locality")?.present) {
    readinessSignals.push("Locality signal present");
  }

  out.push(
    finding({
      type: "map-pack-readiness-signal",
      source: "repository",
      subject: "map-pack-readiness",
      geography: "charlotte-metro",
      title: "Map-pack readiness signals (repository only)",
      whyItMatters:
        "Entity clarity, local content, and Concierge path support local search readiness — not observed map-pack ranking.",
      recommendedAction:
        "Treat as readiness inventory only. Verify GBP before any map-pack performance claims.",
      queryOrPage: null,
      route: null,
      evidenceClass: "readiness",
      confidence: 0.7,
      sampleSize: readinessSignals.length,
      freshness: "fresh",
      localIntentKind: null,
      likelyImpact: 3,
      effort: "low",
      urgency: "low",
      dependency: gbp.rootSourceGapId,
      owner: "search-strategy",
      founderApprovalRequired: false,
      externalVerificationState: gbp.hasVerifiedGbpData ? "verified" : "required",
      isInference: true,
      executionOwnedElsewhere: false,
      suppressRecommendation: true,
      evidenceNotes: [
        ...readinessSignals,
        "No map ranking claim without observed map/GBP data",
      ],
      supportingReference: "repository.map-pack-readiness",
    }),
  );

  if (!gbp.hasVerifiedGbpData) {
    out.push(
      finding({
        type: "map-pack-data-unavailable",
        source: "gbp",
        subject: "map-pack-data",
        geography: "charlotte-metro",
        title: "Map-pack performance data unavailable",
        whyItMatters:
          "Cannot claim map-pack inclusion, visibility movement, or local pack ranking without observed data.",
        recommendedAction:
          "Defer map-pack performance evaluation until a verified GBP/map source exists.",
        queryOrPage: null,
        route: null,
        evidenceClass: "source-gap",
        confidence: 0.95,
        sampleSize: null,
        freshness: "unknown",
        localIntentKind: null,
        likelyImpact: 3,
        effort: "low",
        urgency: "low",
        dependency: gbp.rootSourceGapId,
        owner: "search-strategy",
        founderApprovalRequired: false,
        externalVerificationState: "unavailable",
        isInference: false,
        executionOwnedElsewhere: false,
        suppressRecommendation: true,
        evidenceNotes: [
          "verification-required for any map visibility claim",
        ],
        supportingReference: "gbp.map-pack",
      }),
    );
  }

  return out;
}

function detectHealthyLocalCoverage(
  gsc: GscWeeklyBundle | null,
  available: boolean,
): LocalAuthorityFinding[] {
  if (!available || !gsc?.current) return [];
  // Additional healthy signal already handled in branded query loop
  return [];
}

function detectCrossExecutiveHandoffs(
  existing: LocalAuthorityFinding[],
  input: DetectLocalFindingsInput,
): LocalAuthorityFinding[] {
  const out: LocalAuthorityFinding[] = [];

  const demand = existing.find(
    (f) =>
      !f.suppressRecommendation &&
      (f.type === "local-near-page-one" ||
        f.type === "local-high-impression-low-ctr" ||
        f.type === "local-query-page-mismatch") &&
      f.evidenceClass === "observed",
  );

  if (demand) {
    out.push(
      finding({
        type: "local-authority-opportunity",
        source: "local",
        subject: `content-handoff:${demand.geography}`,
        geography: demand.geography,
        title: "Local search demand supports a Content founder conversation",
        whyItMatters:
          "Verified local discovery demand can feed a calm Charlotte-area founder conversation without inventing GBP metrics.",
        recommendedAction:
          "Hand off to Content for a Charlotte discernment conversation map; Search retains technical diagnosis.",
        queryOrPage: demand.queryOrPage,
        route: demand.route,
        evidenceClass: "observed",
        confidence: Math.min(0.72, demand.confidence),
        sampleSize: demand.sampleSize,
        freshness: demand.freshness,
        localIntentKind: demand.localIntentKind,
        likelyImpact: 6,
        effort: "medium",
        urgency: "medium",
        dependency: demand.id,
        owner: "content",
        founderApprovalRequired: true,
        externalVerificationState: "not-required",
        isInference: true,
        executionOwnedElsewhere: true,
        // Internal Content handoff only — Content executive owns founder-facing production priorities
        suppressRecommendation: true,
        evidenceNotes: [
          `Search diagnosis ID: ${demand.id}`,
          "Content owns production; Search owns diagnosis",
          "Search-emitted handoff is not founder-rankable",
        ],
        supportingReference: demand.supportingReference,
      }),
    );

    out.push(
      finding({
        type: "local-authority-opportunity",
        source: "local",
        subject: `opportunity-handoff:${demand.geography}`,
        geography: demand.geography,
        title: "Local intent may support Opportunity partnership research",
        whyItMatters:
          "Verified regional demand can inform category-level bridal/partner research — not named outreach targets.",
        recommendedAction:
          "Hand off to Opportunity for partner-category research; do not name specific businesses as available.",
        queryOrPage: demand.queryOrPage,
        route: demand.route,
        evidenceClass: "observed",
        confidence: Math.min(0.65, demand.confidence),
        sampleSize: demand.sampleSize,
        freshness: demand.freshness,
        localIntentKind: demand.localIntentKind,
        likelyImpact: 5,
        effort: "medium",
        urgency: "low",
        dependency: demand.id,
        owner: "opportunity",
        founderApprovalRequired: true,
        externalVerificationState: "required",
        isInference: true,
        executionOwnedElsewhere: true,
        suppressRecommendation: true,
        evidenceNotes: [
          "Opportunity owns partnerships/distribution; Search retains diagnosis",
          "Research-required — not a named brief priority by default",
        ],
        supportingReference: demand.supportingReference,
      }),
    );
  }

  // BI local measurement prerequisite — internal routing under the GBP root source gap
  if (!input.gbp.hasVerifiedGbpData) {
    out.push(
      finding({
        type: "local-measurement-gap",
        source: "local",
        subject: "calls-directions-gbp-clicks",
        geography: "charlotte-metro",
        title: "Local conversion measurement blocked without GBP/call sources",
        whyItMatters:
          "Calls, directions, and GBP website clicks remain unknown/unobservable in Agent OS without a verified local engagement source — not evidence that volumes are poor.",
        recommendedAction:
          "Internal BI handoff only: after the GBP root source is verified, BI owns calls/directions/attribution measurement design. Do not treat unknown metrics as poor performance.",
        queryOrPage: null,
        route: "/concierge",
        evidenceClass: "source-gap",
        confidence: 0.88,
        sampleSize: null,
        freshness: "unknown",
        localIntentKind: null,
        likelyImpact: 6,
        effort: "medium",
        urgency: "medium",
        dependency:
          input.gbp.rootSourceGapId ??
          "search-strategy:gbp:measurement-gap:google-business-profile",
        owner: "business-intelligence",
        founderApprovalRequired: false,
        externalVerificationState: "unavailable",
        isInference: false,
        executionOwnedElsewhere: true,
        // Internal routing metadata — must not duplicate the GBP root as a founder priority
        suppressRecommendation: true,
        evidenceNotes: [
          "BI owns measurement design after GBP source verification",
          "Depends on search-strategy:gbp:measurement-gap:google-business-profile",
          "Metrics remain unknown/unobservable — not poor",
          "Concierge form measurement is separate from GBP calls/directions",
        ],
        supportingReference: "bi.local-measurement-prerequisite",
      }),
    );
  }

  return out;
}

function localQueryHasMatchingPage(
  query: string,
  pages: Array<{ page: string }>,
  charlotteRoutes: string[],
): boolean {
  const q = query.toLowerCase();
  const tokens = q
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 3);

  const pagePaths = pages.map((p) => pathKey(p.page).toLowerCase());

  if (
    tokens.some((t) =>
      ["charlotte", "waxhaw", "fort", "mill"].includes(t),
    ) &&
    pagePaths.some(
      (p) =>
        p.includes("charlotte") ||
        charlotteRoutes.some((r) => p.includes(r.toLowerCase())),
    )
  ) {
    return true;
  }

  if (
    tokens.some((t) => pagePaths.some((p) => p.includes(t))) &&
    (q.includes("charlotte") || q.includes("waxhaw") || q.includes("fort mill"))
  ) {
    // Generic page match without local path token → mismatch for local commercial
    const hasLocalPath = pagePaths.some(
      (p) =>
        p.includes("charlotte") ||
        p.includes("engagement-rings") ||
        p.includes("custom-design"),
    );
    return hasLocalPath;
  }

  return pagePaths.some((p) =>
    tokens.some((t) => t.length > 4 && p.includes(t)),
  );
}

function bestMatchingLocalRoute(
  query: string,
  charlotteRoutes: string[],
  pages: Array<{ page: string }>,
): string | null {
  const q = query.toLowerCase();
  if (q.includes("engagement")) {
    const hit = pages.find((p) =>
      pathKey(p.page).includes("/engagement-rings"),
    );
    if (hit) return pathKey(hit.page);
    return "/engagement-rings";
  }
  if (q.includes("custom")) {
    return (
      charlotteRoutes.find((r) => r.includes("custom-engagement")) ??
      "/custom-design"
    );
  }
  return (
    charlotteRoutes.find((r) => r.includes("charlotte-diamond-advisor")) ??
    charlotteRoutes[0] ??
    null
  );
}

function collectHrefs(article: Article): string[] {
  const hrefs: string[] = [];
  for (const r of article.related ?? []) {
    if (r.href) hrefs.push(r.href);
  }
  for (const block of article.body) {
    if (
      block.type === "paragraph" ||
      block.type === "heading" ||
      block.type === "studio-callout"
    ) {
      const matches = block.text.matchAll(/\((\/[a-z0-9\-/_]+)\)/gi);
      for (const m of matches) {
        if (m[1]) hrefs.push(m[1]);
      }
    }
  }
  return hrefs;
}

function pathKey(page: string): string {
  try {
    return new URL(page).pathname;
  } catch {
    return page;
  }
}

function round(n: number): number {
  return Math.round(Math.max(0, Math.min(1, n)) * 100) / 100;
}

function finding(input: {
  type: LocalAuthorityFinding["type"];
  source: LocalAuthorityFinding["source"];
  subject: string;
  geography: LocalGeography;
  title: string;
  whyItMatters: string;
  recommendedAction: string;
  queryOrPage: string | null;
  route: string | null;
  evidenceClass: LocalAuthorityFinding["evidenceClass"];
  confidence: number;
  sampleSize: number | null;
  freshness: LocalAuthorityFinding["freshness"];
  localIntentKind: LocalAuthorityFinding["localIntentKind"];
  likelyImpact: number;
  effort: LocalAuthorityFinding["effort"];
  urgency: LocalAuthorityFinding["urgency"];
  dependency: string | null;
  owner: LocalAuthorityFinding["owner"];
  founderApprovalRequired: boolean;
  externalVerificationState: LocalAuthorityFinding["externalVerificationState"];
  isInference: boolean;
  executionOwnedElsewhere: boolean;
  suppressRecommendation: boolean;
  evidenceNotes: string[];
  supportingReference: string;
}): LocalAuthorityFinding {
  return {
    id: buildLocalAuthorityFindingId({
      source: input.source,
      type: input.type,
      subject: input.subject,
      geography:
        input.source === "local" || input.type === "local-query-page-mismatch"
          ? input.geography
          : input.source === "repository" &&
              (input.type === "local-hub-gap" ||
                input.type === "local-tool-handoff-gap" ||
                input.type === "local-concierge-handoff-gap")
            ? input.geography
            : input.type.startsWith("gbp") || input.type === "map-pack-data-unavailable"
              ? null
              : input.geography,
    }),
    ...input,
  };
}

function dedupeById(
  items: LocalAuthorityFinding[],
): LocalAuthorityFinding[] {
  const seen = new Set<string>();
  const out: LocalAuthorityFinding[] = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
}
