import type { Metadata } from "next";
import type { Article } from "@/app/diamond-guide/articles";
import {
  ARTICLE_OG_IMAGE_SPECS,
  resolveArticleOgImagePath,
} from "@/lib/diamond-guide/article-imagery";
import { articleMetaDescription } from "./article-description";
import { DEFAULT_OPEN_GRAPH, pageMetadata } from "./site-metadata";

export type DiamondGuideCategorySegment =
  | "diamond-size"
  | "diamond-shapes"
  | "diamond-cut"
  | "light-performance"
  | "diamond-color"
  | "diamond-clarity"
  | "certification"
  | "buying-strategy"
  | "charlotte-guides"
  | "proposal-planning";

export type CategoryHubConfig = {
  /** Canonical category ID and public route slug. */
  segment: DiamondGuideCategorySegment;
  /** Exact `articles.ts` category label. */
  articleCategory: string;
  /** Public display name used in cards, nav, and breadcrumbs. */
  navTitle: string;
  /** Hub `<title>` / Open Graph title. */
  title: string;
  /** Hub meta description and CollectionPage description. */
  description: string;
  /** Short consumer copy for the Guide hub cards. */
  consumerDescription: string;
  /** `/all` page title and breadcrumb leaf. */
  indexTitle: string;
  /** Topic phrase used in `/all` meta description. */
  indexTopic: string;
  /** Visible `/all` heading. */
  indexHeading: string;
  /** Visible `/all` intro. */
  indexLead: string;
  /** Visible `/all` consultation note. */
  indexCtaNote: string;
};

export const DIAMOND_GUIDE_CATEGORIES: CategoryHubConfig[] = [
  {
    segment: "diamond-size",
    articleCategory: "Diamond Size",
    navTitle: "Diamond Size",
    title: "Diamond Size Guide",
    description:
      "How carat, proportions, and finger size change what you see—practical guides to diamond size, charts, and on-hand appearance.",
    consumerDescription: "How size actually shows up once it’s worn.",
    indexTitle: "All Diamond Size Guides",
    indexTopic: "diamond size",
    indexHeading: "All diamond size guides.",
    indexLead:
      "A complete set of guides covering how size is measured, how it appears once worn, and how to choose what feels right in practice.",
    indexCtaNote:
      "Understanding size is one part of the decision. Seeing how it all comes together is where things usually become clear.",
  },
  {
    segment: "diamond-shapes",
    articleCategory: "Diamond Shapes",
    navTitle: "Diamond Shapes",
    title: "Diamond Shapes Guide",
    description:
      "Compare diamond shapes for character, light, and wear—round, oval, emerald, cushion, and more—with guides that go beyond the label.",
    consumerDescription: "How shape influences character, light, and feel.",
    indexTitle: "All Diamond Shape Guides",
    indexTopic: "diamond shape",
    indexHeading: "All diamond shape guides.",
    indexLead:
      "A complete set of guides covering the major diamond shapes, how they compare, and how their character changes once worn.",
    indexCtaNote:
      "Shape often narrows the search faster than people expect. Seeing how it fits the hand and setting is where it usually becomes clear.",
  },
  {
    segment: "diamond-cut",
    articleCategory: "Diamond Cut",
    navTitle: "Diamond Cut",
    title: "Diamond Cut Guide",
    description:
      "Understand what cut really controls—light, sparkle, and presence—with guides on proportions, grades, and what to look for in person.",
    consumerDescription: "What gives a diamond its life.",
    indexTitle: "All Diamond Cut Guides",
    indexTopic: "diamond cut",
    indexHeading: "All diamond cut guides.",
    indexLead:
      "A complete set of guides covering how cut is graded, how it affects light, and how to judge it more clearly in practice.",
    indexCtaNote:
      "Cut is often the part that changes what you notice most. Seeing how it translates in person is where the picture usually sharpens.",
  },
  {
    segment: "light-performance",
    articleCategory: "Light Performance",
    navTitle: "Light Performance",
    title: "Diamond Light Performance Guide",
    description:
      "Learn how brilliance, fire, scintillation, and light return shape what you see—and how to judge a diamond beyond the certificate.",
    consumerDescription: "Understanding brilliance, fire, and movement.",
    indexTitle: "All Diamond Light Performance Guides",
    indexTopic: "diamond light performance",
    indexHeading: "All diamond light performance guides.",
    indexLead:
      "A complete set of guides covering brightness, fire, scintillation, light return, and the way performance changes what a diamond feels like in person.",
    indexCtaNote:
      "Light performance is often what people respond to first, even when they are not sure how to describe it. Seeing it in person is where it usually becomes unmistakable.",
  },
  {
    segment: "diamond-color",
    articleCategory: "Diamond Color",
    navTitle: "Color",
    title: "Diamond Color Guide",
    description:
      "When color matters, when it does not, and how to balance color with cut and setting—practical guides without unnecessary upsell.",
    consumerDescription: "When color matters and when it does not.",
    indexTitle: "All Diamond Color Guides",
    indexTopic: "diamond color",
    indexHeading: "All diamond color guides.",
    indexLead:
      "A complete set of guides covering how color is graded, where it becomes visible, and how to balance appearance with value more thoughtfully.",
    indexCtaNote:
      "Color often becomes simpler once you see where it actually changes the way a diamond feels, and where it simply becomes preference.",
  },
  {
    segment: "diamond-clarity",
    articleCategory: "Diamond Clarity",
    navTitle: "Clarity",
    title: "Diamond Clarity Guide",
    description:
      "What clarity actually affects in real life, what is often oversold, and how to choose with confidence and calm.",
    consumerDescription: "What matters, and what usually does not.",
    indexTitle: "All Diamond Clarity Guides",
    indexTopic: "diamond clarity",
    indexHeading: "All diamond clarity guides.",
    indexLead:
      "A complete set of guides covering clarity grades, inclusions, what is actually visible, and how to balance clarity without over-prioritizing it.",
    indexCtaNote:
      "Clarity tends to feel simpler once you separate what is visible in real life from what is mostly visible only on paper.",
  },
  {
    segment: "certification",
    articleCategory: "Certification",
    navTitle: "Certification",
    title: "Diamond Certification Guide",
    description:
      "GIA, IGI, AGS, and more—what certificates show, what they miss, and how to read a report with clearer judgment.",
    consumerDescription: "How to read grading reports with context.",
    indexTitle: "All Diamond Certification Guides",
    indexTopic: "diamond certification",
    indexHeading: "All diamond certification guides.",
    indexLead:
      "A complete set of guides covering grading reports, how to read them, how laboratories differ, and how to use certification clearly when comparing diamonds.",
    indexCtaNote:
      "A grading report is a useful tool, but understanding how to interpret it is what makes it valuable in practice.",
  },
  {
    segment: "buying-strategy",
    articleCategory: "Buying Guides",
    navTitle: "Buying Strategy",
    title: "Diamond Buying Strategy Guide",
    description:
      "Smarter tradeoffs when buying a diamond—what to prioritize, what to stop overpaying for, and how to decide with clarity.",
    consumerDescription: "How to balance quality, design, and budget.",
    indexTitle: "All Diamond Buying Strategy Guides",
    indexTopic: "diamond buying strategy",
    indexHeading: "All buying strategy guides.",
    indexLead:
      "A complete set of guides covering how to compare options, balance quality with value, and make decisions without overpaying for what adds very little in practice.",
    indexCtaNote:
      "A better decision usually comes from knowing what matters, what does not, and where the tradeoffs stop feeling worthwhile.",
  },
  {
    segment: "charlotte-guides",
    articleCategory: "Charlotte Guides",
    navTitle: "Charlotte Guides",
    title: "Charlotte Guides",
    description:
      "Local guidance for buying a diamond in Charlotte—independent advice, custom rings, size, and shape in this market.",
    consumerDescription: "Local guidance for buying a diamond in Charlotte.",
    indexTitle: "All Charlotte Guides",
    indexTopic: "buying a diamond in Charlotte",
    indexHeading: "All Charlotte guides.",
    indexLead:
      "A complete set of local guides covering how to buy a diamond in Charlotte, work with an independent advisor, and choose size and shape for this market.",
    indexCtaNote:
      "A local purchase is usually simpler once the market, the advisor, and the stone are considered together rather than as separate errands.",
  },
  {
    segment: "proposal-planning",
    articleCategory: "Proposal Planning",
    navTitle: "Proposal Planning",
    title: "Proposal Planning Guide",
    description:
      "How to prepare, propose, and celebrate with confidence: Charlotte locations, timing, photographers, and the first days after yes.",
    consumerDescription:
      "How to prepare, propose, and celebrate with confidence.",
    indexTitle: "All Proposal Planning Guides",
    indexTopic: "proposal planning",
    indexHeading: "All proposal planning guides.",
    indexLead:
      "A complete set of guides covering Charlotte proposal locations, planning the moment, photographers, celebration dinners, and the first days after you are engaged.",
    indexCtaNote:
      "A memorable proposal usually comes from thoughtful preparation, not last-minute improvisation.",
  },
];

const categoryBySegment = Object.fromEntries(
  DIAMOND_GUIDE_CATEGORIES.map((c) => [c.segment, c]),
) as Record<DiamondGuideCategorySegment, CategoryHubConfig>;

export function getCategoryConfig(
  segment: DiamondGuideCategorySegment,
): CategoryHubConfig {
  return categoryBySegment[segment];
}

export function categoryHubMetadata(
  segment: DiamondGuideCategorySegment,
): Metadata {
  const config = categoryBySegment[segment];
  return pageMetadata({
    title: config.title,
    description: config.description,
    path: `/diamond-guide/${segment}`,
  });
}

export function categoryIndexMetadata(
  segment: DiamondGuideCategorySegment,
): Metadata {
  const config = categoryBySegment[segment];
  return pageMetadata({
    title: config.indexTitle,
    description: `Browse every Hourglass guide related to ${config.indexTopic}.`,
    path: `/diamond-guide/${segment}/all`,
  });
}

export function articlePageMetadata(article: Article): Metadata {
  const description = articleMetaDescription(article.body);
  const path = `/diamond-guide/${article.slug}`;
  const openGraphTitle = `${article.title} | Hourglass Diamonds`;
  const ogImagePath = resolveArticleOgImagePath(article);

  return {
    title: article.title,
    description,
    alternates: {
      canonical: path,
    },
    openGraph: {
      ...DEFAULT_OPEN_GRAPH,
      type: "article",
      title: openGraphTitle,
      description,
      url: path,
      images: ogImagePath
        ? [
            {
              url: ogImagePath,
              width: ARTICLE_OG_IMAGE_SPECS.width,
              height: ARTICLE_OG_IMAGE_SPECS.height,
              alt: article.heroImageAlt ?? article.title,
            },
          ]
        : DEFAULT_OPEN_GRAPH.images,
    },
  };
}
