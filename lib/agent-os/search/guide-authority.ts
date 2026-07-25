/**
 * Read-only Diamond Guide authority inspection from repository sources.
 *
 * Deployment-safe for Vercel Node later:
 * - Uses static imports of authoritative registries (`articles`, category map,
 *   diamond-guide metadata) — no filesystem walks, no absolute/worktree paths,
 *   no scanning of node_modules/.git/tmp, no dynamic eval of article source.
 * - Pure in-memory inspection with bounded opportunity output (≤12).
 * - Performs no writes.
 *
 * Does not crawl production. Does not parse customer data.
 */

import { articles, type Article } from "@/app/diamond-guide/articles";
import { DIAMOND_GUIDE_CATEGORIES } from "@/lib/seo/diamond-guide-metadata";
import { articleCategorySegment } from "@/lib/seo/schema/category-map";
import { buildSearchOpportunityId } from "./ids";
import type { SearchOpportunity } from "./types";

const TOOL_PATHS = [
  "/diamond-studio",
  "/diamond-shape-studio",
  "/diamond-intelligence",
  "/concierge",
] as const;

/** Articles known to ship FAQPage JSON-LD via schema builders. */
export const FAQ_SCHEMA_ARTICLE_SLUGS = new Set([
  "charlotte-diamond-advisor-guide",
  "how-to-read-a-diamond-certificate",
  "natural-vs-lab-diamonds",
  "what-is-diamond-fluorescence",
  "what-is-diamond-clarity",
  "what-is-diamond-color",
  "what-is-diamond-cut",
]);

export type GuideAuthoritySnapshot = {
  articleCount: number;
  hubSegments: string[];
  charlotteGuideCount: number;
  charlotteHubMapped: boolean;
  articlesWithToolHandoff: number;
  articlesWithConciergeHandoff: number;
  articlesWithFaqSchema: number;
  weaklyLinkedCount: number;
  opportunities: SearchOpportunity[];
};

export function inspectGuideAuthority(
  articleList: Article[] = articles,
): GuideAuthoritySnapshot {
  const hubSegments = DIAMOND_GUIDE_CATEGORIES.map((c) => c.segment);
  const charlotteArticles = articleList.filter(
    (a) => a.category === "Charlotte Guides",
  );
  const charlotteHubMapped =
    articleCategorySegment("Charlotte Guides") !== null;

  let articlesWithToolHandoff = 0;
  let articlesWithConciergeHandoff = 0;
  let weaklyLinkedCount = 0;
  const opportunities: SearchOpportunity[] = [];

  for (const article of articleList) {
    const hrefs = collectHrefs(article);
    const hasTool = TOOL_PATHS.some(
      (p) => p !== "/concierge" && hrefs.some((h) => h.includes(p)),
    );
    const hasConcierge = hrefs.some((h) => h.includes("/concierge"));
    if (hasTool) articlesWithToolHandoff += 1;
    if (hasConcierge) articlesWithConciergeHandoff += 1;

    const relatedCount = article.related?.length ?? 0;
    if (relatedCount < 2) {
      weaklyLinkedCount += 1;
    }

    // GEO readiness: answer-first structure (heading early) + expertise links
    const geo = scoreGeoReadiness(article, hrefs);
    if (
      geo.score < 0.55 &&
      (article.category === "Buying Guides" ||
        article.category === "Certification" ||
        article.slug.includes("charlotte"))
    ) {
      opportunities.push({
        id: buildSearchOpportunityId({
          source: "repository",
          type: "geo-readiness-gap",
          subject: `/diamond-guide/${article.slug}`,
        }),
        type: "geo-readiness-gap",
        title: `GEO readiness gap on ${article.slug}`,
        whyItMatters:
          "High-value buyer guides benefit from answer-first openings and clear entity/tool links for AI-assisted discovery readiness.",
        recommendedAction:
          "Plan a clearer opening answer and explicit expertise/tool handoff in a future editorial pass — labeled readiness, not confirmed AI citations.",
        queryOrPage: `/diamond-guide/${article.slug}`,
        metric: "geo-readiness-score",
        currentValue: geo.score.toFixed(2),
        comparisonValue: null,
        sampleSize: article.body.length,
        classifications: ["informational", "non-branded"],
        isInference: true,
        confidence: 0.55,
        likelyImpact: 5,
        effort: "medium",
        urgency: "low",
        approvalRequired: false,
        supportingReference: `app/diamond-guide/articles.ts#${article.slug}`,
        evidenceNotes: [
          ...geo.notes,
          "GEO readiness signal only — not verified AI-engine ranking or citations",
        ],
      });
    }

    // Schema gap: only when title + visible Q&A-shaped content already support FAQ
    if (
      !FAQ_SCHEMA_ARTICLE_SLUGS.has(article.slug) &&
      article.title.toLowerCase().startsWith("what is") &&
      articleHasVisibleQaSupport(article)
    ) {
      opportunities.push({
        id: buildSearchOpportunityId({
          source: "repository",
          type: "schema-gap",
          subject: `/diamond-guide/${article.slug}`,
        }),
        type: "schema-gap",
        title: `FAQ/schema opportunity on ${article.slug}`,
        whyItMatters:
          "The article already teaches a definition with question-shaped structure; FAQ schema may help extractability where content already supports it.",
        recommendedAction:
          "Recommend adding FAQ JSON-LD in a future content pass only for Q&A already visible in the body — Agent OS will not edit schema.",
        queryOrPage: `/diamond-guide/${article.slug}`,
        metric: "faq-schema-present",
        currentValue: "false",
        comparisonValue: null,
        sampleSize: article.body.length,
        classifications: ["informational"],
        isInference: true,
        confidence: 0.58,
        likelyImpact: 5,
        effort: "low",
        urgency: "low",
        approvalRequired: false,
        supportingReference: `app/diamond-guide/articles.ts#${article.slug}`,
        evidenceNotes: [
          "Requires visible question heading or Q&A-shaped blocks already in the article body",
        ],
      });
    }
  }

  // Charlotte Guides category not in hub map
  if (charlotteArticles.length > 0 && !charlotteHubMapped) {
    opportunities.push({
      id: buildSearchOpportunityId({
        source: "repository",
        type: "local-intent-gap",
        subject: "charlotte-guides-hub",
      }),
      type: "local-intent-gap",
      title: "Charlotte Guides lack a mapped category hub",
      whyItMatters:
        "Local authority articles exist, but Charlotte Guides is not in DIAMOND_GUIDE_CATEGORIES — weakening hub discovery and entity consistency.",
      recommendedAction:
        "Plan a Charlotte Guides hub segment alignment (metadata + category-map) in a later editorial/SEO pass — read-only finding only.",
      queryOrPage: "Charlotte Guides",
      metric: "hub-mapping",
      currentValue: `${charlotteArticles.length} articles; hubMapped=false`,
      comparisonValue: null,
      sampleSize: charlotteArticles.length,
      classifications: ["local", "informational"],
      isInference: false,
      confidence: 0.88,
      likelyImpact: 7,
      effort: "medium",
      urgency: "medium",
      approvalRequired: false,
      supportingReference: "lib/seo/schema/category-map.ts",
      evidenceNotes: [
        "Repository fact: articleCategorySegment('Charlotte Guides') is null",
        "No GBP metrics used",
      ],
    });
  }

  // Tool handoff: shape/size education without Studio tools
  const handoffCandidates = articleList.filter(
    (a) =>
      a.category === "Diamond Shapes" ||
      a.category === "Diamond Size" ||
      a.slug.includes("shape") ||
      a.slug.includes("carat"),
  );
  for (const article of handoffCandidates.slice(0, 12)) {
    const hrefs = collectHrefs(article);
    const hasShapeStudio = hrefs.some((h) =>
      h.includes("/diamond-shape-studio"),
    );
    const hasSizeStudio = hrefs.some((h) => h.includes("/diamond-studio"));
    if (!hasShapeStudio && !hasSizeStudio) {
      opportunities.push({
        id: buildSearchOpportunityId({
          source: "repository",
          type: "tool-handoff-gap",
          subject: `/diamond-guide/${article.slug}`,
        }),
        type: "tool-handoff-gap",
        title: `Add a tool handoff on “${article.title}”`,
        whyItMatters:
          "Size/shape education should connect to Diamond Studio or See It On Your Hand when readers are ready to try options on-hand.",
        recommendedAction:
          `Add a contextual link from the “${article.title}” Diamond Guide article to See It On Your Hand. Readers comparing shape characteristics are closest to a visualization step before a consultation.`,
        queryOrPage: `/diamond-guide/${article.slug}`,
        metric: "tool-handoff",
        currentValue: "missing studio handoff in related/body links",
        comparisonValue: null,
        sampleSize: hrefs.length,
        classifications: ["informational", "commercial"],
        isInference: false,
        confidence: 0.8,
        likelyImpact: 7,
        effort: "low",
        urgency: "medium",
        approvalRequired: false,
        supportingReference: `app/diamond-guide/articles.ts#${article.slug}`,
        evidenceNotes: [
          `Source article: ${article.title}`,
          "Primary destination: See It On Your Hand; Diamond Studio remains available when size/coverage is the reader intent.",
        ],
      });
    }
  }

  // Internal link gap: certification flagship with few related links
  const certHubTargets = articleList.filter(
    (a) => a.category === "Certification" && (a.related?.length ?? 0) < 2,
  );
  for (const article of certHubTargets.slice(0, 3)) {
    opportunities.push({
      id: buildSearchOpportunityId({
        source: "repository",
        type: "internal-link-gap",
        subject: `/diamond-guide/${article.slug}`,
      }),
      type: "internal-link-gap",
      title: `Internal-link gap on ${article.slug}`,
      whyItMatters:
        "Weak related-link sets reduce guide-to-guide authority flow into certification and Analyze Sparkle paths.",
      recommendedAction:
        "Propose related links from this article to /diamond-guide/how-to-read-a-diamond-certificate and /diamond-intelligence where relevant.",
      queryOrPage: `/diamond-guide/${article.slug}`,
      metric: "related-link-count",
      currentValue: String(article.related?.length ?? 0),
      comparisonValue: null,
      sampleSize: article.related?.length ?? 0,
      classifications: ["informational"],
      isInference: false,
      confidence: 0.82,
      likelyImpact: 6,
      effort: "low",
      urgency: "medium",
      approvalRequired: false,
      supportingReference: `app/diamond-guide/articles.ts#${article.slug}`,
      evidenceNotes: [
        "Source: article related[] array",
        "Destination examples: how-to-read-a-diamond-certificate, /diamond-intelligence",
      ],
    });
  }

  // Content gap requires evidence: only when a cluster has hub but thin related density
  const buying = articleList.filter((a) => a.category === "Buying Guides");
  if (buying.length > 0) {
    const withDi = buying.filter((a) =>
      collectHrefs(a).some((h) => h.includes("/diamond-intelligence")),
    );
    if (withDi.length / buying.length < 0.25) {
      opportunities.push({
        id: buildSearchOpportunityId({
          source: "repository",
          type: "content-gap",
          subject: "buying-guides-diamond-intelligence",
        }),
        type: "content-gap",
        title: "Buying Guides under-link Analyze Sparkle",
        whyItMatters:
          "Buying-strategy education should more often hand off to certificate interpretation when reports are in play.",
        recommendedAction:
          "Prioritize internal links from buying guides to /diamond-intelligence where certificate decisions appear — evidence-backed cluster gap, not ‘publish more’.",
        queryOrPage: "/diamond-guide/buying-strategy",
        metric: "cluster-tool-handoff-rate",
        currentValue: `${withDi.length}/${buying.length} buying guides link Analyze Sparkle`,
        comparisonValue: null,
        sampleSize: buying.length,
        classifications: ["commercial", "informational"],
        isInference: false,
        confidence: 0.75,
        likelyImpact: 6,
        effort: "low",
        urgency: "medium",
        approvalRequired: false,
        supportingReference: "app/diamond-guide/articles.ts#Buying Guides",
        evidenceNotes: [
          "Derived from repository link inventory — not a generic content-calendar idea",
          "Does not claim traffic or ranking impact without GSC evidence",
        ],
      });
    }
  }

  return {
    articleCount: articleList.length,
    hubSegments,
    charlotteGuideCount: charlotteArticles.length,
    charlotteHubMapped,
    articlesWithToolHandoff,
    articlesWithConciergeHandoff,
    articlesWithFaqSchema: articleList.filter((a) =>
      FAQ_SCHEMA_ARTICLE_SLUGS.has(a.slug),
    ).length,
    weaklyLinkedCount,
    opportunities: dedupeById(opportunities).slice(0, 12),
  };
}

function collectHrefs(article: Article): string[] {
  const hrefs: string[] = [];
  for (const r of article.related ?? []) {
    if (r.href) hrefs.push(r.href);
  }
  for (const block of article.body) {
    if (block.type === "paragraph" || block.type === "heading") {
      const matches = block.text.matchAll(/\((\/[a-z0-9\-/_]+)\)/gi);
      for (const m of matches) {
        if (m[1]) hrefs.push(m[1]);
      }
    }
    if (block.type === "studio-callout") {
      const matches = block.text.matchAll(/\((\/[a-z0-9\-/_]+)\)/gi);
      for (const m of matches) {
        if (m[1]) hrefs.push(m[1]);
      }
    }
  }
  return hrefs;
}

/** Visible Q&A support required before recommending FAQ schema. */
function articleHasVisibleQaSupport(article: Article): boolean {
  if (article.body.length < 3) return false;
  let questionHeadings = 0;
  for (const block of article.body) {
    if (block.type === "heading") {
      const t = block.text.trim();
      if (t.endsWith("?") || /^(what|how|why|when|which)\b/i.test(t)) {
        questionHeadings += 1;
      }
    }
  }
  return questionHeadings >= 1;
}

function scoreGeoReadiness(
  article: Article,
  hrefs: string[],
): { score: number; notes: string[] } {
  const notes: string[] = [];
  let score = 0.35;
  const first = article.body[0];
  if (first?.type === "heading") {
    score += 0.2;
    notes.push("Opens with a heading (answer-frame signal)");
  } else if (first?.type === "paragraph" && first.text.length < 280) {
    score += 0.1;
    notes.push("Short opening paragraph present");
  } else {
    notes.push("Opening is not clearly answer-first");
  }
  if (FAQ_SCHEMA_ARTICLE_SLUGS.has(article.slug)) {
    score += 0.2;
    notes.push("FAQ schema already wired for this slug");
  }
  if (hrefs.some((h) => TOOL_PATHS.some((t) => h.includes(t)))) {
    score += 0.15;
    notes.push("Links to Studio tools or Concierge");
  } else {
    notes.push("Missing tool/Concierge interconnection");
  }
  if ((article.related?.length ?? 0) >= 2) {
    score += 0.1;
    notes.push("Related-link set supports entity relationships");
  }
  return { score: Math.min(1, score), notes };
}

function dedupeById(items: SearchOpportunity[]): SearchOpportunity[] {
  const seen = new Set<string>();
  const out: SearchOpportunity[] = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
}
