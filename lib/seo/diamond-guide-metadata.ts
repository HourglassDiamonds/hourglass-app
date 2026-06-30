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
  | "proposal-planning";

type CategoryHubConfig = {
  segment: DiamondGuideCategorySegment;
  title: string;
  description: string;
  indexTitle: string;
  indexTopic: string;
};

export const DIAMOND_GUIDE_CATEGORIES: CategoryHubConfig[] = [
  {
    segment: "diamond-size",
    title: "Diamond Size Guide",
    description:
      "How carat, proportions, and finger size change what you see—practical guides to diamond size, charts, and on-hand appearance.",
    indexTitle: "All Diamond Size Guides",
    indexTopic: "diamond size",
  },
  {
    segment: "diamond-shapes",
    title: "Diamond Shapes Guide",
    description:
      "Compare diamond shapes for character, light, and wear—round, oval, emerald, cushion, and more—with guides that go beyond the label.",
    indexTitle: "All Diamond Shape Guides",
    indexTopic: "diamond shape",
  },
  {
    segment: "diamond-cut",
    title: "Diamond Cut Guide",
    description:
      "Understand what cut really controls—light, sparkle, and presence—with guides on proportions, grades, and what to look for in person.",
    indexTitle: "All Diamond Cut Guides",
    indexTopic: "diamond cut",
  },
  {
    segment: "light-performance",
    title: "Diamond Light Performance Guide",
    description:
      "Learn how brilliance, fire, scintillation, and light return shape what you see—and how to judge a diamond beyond the certificate.",
    indexTitle: "All Diamond Light Performance Guides",
    indexTopic: "diamond light performance",
  },
  {
    segment: "diamond-color",
    title: "Diamond Color Guide",
    description:
      "When color matters, when it does not, and how to balance color with cut and setting—practical guides without unnecessary upsell.",
    indexTitle: "All Diamond Color Guides",
    indexTopic: "diamond color",
  },
  {
    segment: "diamond-clarity",
    title: "Diamond Clarity Guide",
    description:
      "What clarity actually affects in real life, what is often oversold, and how to choose with confidence and calm.",
    indexTitle: "All Diamond Clarity Guides",
    indexTopic: "diamond clarity",
  },
  {
    segment: "certification",
    title: "Diamond Certification Guide",
    description:
      "GIA, IGI, AGS, and more—what certificates show, what they miss, and how to read a report with clearer judgment.",
    indexTitle: "All Diamond Certification Guides",
    indexTopic: "diamond certification",
  },
  {
    segment: "buying-strategy",
    title: "Diamond Buying Strategy Guide",
    description:
      "Smarter tradeoffs when buying a diamond—what to prioritize, what to stop overpaying for, and how to decide with clarity.",
    indexTitle: "All Diamond Buying Strategy Guides",
    indexTopic: "diamond buying strategy",
  },
  {
    segment: "proposal-planning",
    title: "Proposal Planning Guide",
    description:
      "How to prepare, propose, and celebrate with confidence: Charlotte locations, timing, photographers, and the first days after yes.",
    indexTitle: "All Proposal Planning Guides",
    indexTopic: "proposal planning",
  },
];

const categoryBySegment = Object.fromEntries(
  DIAMOND_GUIDE_CATEGORIES.map((c) => [c.segment, c]),
) as Record<DiamondGuideCategorySegment, CategoryHubConfig>;

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
