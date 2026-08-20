import type { DiamondGuideCategorySegment } from "@/lib/seo/diamond-guide-metadata";
import {
  DIAMOND_GUIDE_CATEGORIES,
  getCategoryConfig,
} from "@/lib/seo/diamond-guide-metadata";
import { absoluteUrl, WEBSITE_ID } from "./constants";
import type { JsonLdValue } from "./json-ld";

const categoryTitleByArticleCategory = Object.fromEntries(
  DIAMOND_GUIDE_CATEGORIES.map((category) => [
    category.articleCategory,
    category.segment,
  ]),
) as Record<string, DiamondGuideCategorySegment>;

export function articleCategorySegment(
  articleCategory: string,
): DiamondGuideCategorySegment | null {
  return categoryTitleByArticleCategory[articleCategory] ?? null;
}

export function categoryHubTitle(segment: DiamondGuideCategorySegment): string {
  return getCategoryConfig(segment).navTitle;
}

export function categoryHubPath(segment: DiamondGuideCategorySegment): string {
  return `/diamond-guide/${segment}`;
}

export function categoryIndexPath(segment: DiamondGuideCategorySegment): string {
  return `/diamond-guide/${segment}/all`;
}

export function categoryCollectionPage(
  segment: DiamondGuideCategorySegment,
  variant: "hub" | "index",
): JsonLdValue {
  const config = getCategoryConfig(segment);
  const path =
    variant === "hub" ? categoryHubPath(segment) : categoryIndexPath(segment);
  const name = variant === "hub" ? config.navTitle : config.indexTitle;
  const description =
    variant === "hub"
      ? config.description
      : `Browse every Hourglass guide related to ${config.indexTopic}.`;

  return {
    "@type": "CollectionPage",
    "@id": `${absoluteUrl(path)}#page`,
    name,
    description,
    url: absoluteUrl(path),
    isPartOf: {
      "@type": "WebSite",
      "@id": WEBSITE_ID,
    },
  };
}
