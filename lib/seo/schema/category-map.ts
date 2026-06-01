import type { DiamondGuideCategorySegment } from "@/lib/seo/diamond-guide-metadata";
import { DIAMOND_GUIDE_CATEGORIES } from "@/lib/seo/diamond-guide-metadata";

const categoryTitleBySegment = Object.fromEntries(
  DIAMOND_GUIDE_CATEGORIES.map((category) => [category.segment, category.title]),
) as Record<DiamondGuideCategorySegment, string>;

const categoryTitleByArticleCategory: Record<string, DiamondGuideCategorySegment> =
  {
    "Diamond Size": "diamond-size",
    "Diamond Shapes": "diamond-shapes",
    "Diamond Cut": "diamond-cut",
    "Light Performance": "light-performance",
    "Diamond Color": "diamond-color",
    "Diamond Clarity": "diamond-clarity",
    Certification: "certification",
    "Buying Guides": "buying-strategy",
  };

export function articleCategorySegment(
  articleCategory: string,
): DiamondGuideCategorySegment | null {
  return categoryTitleByArticleCategory[articleCategory] ?? null;
}

export function categoryHubTitle(segment: DiamondGuideCategorySegment): string {
  return categoryTitleBySegment[segment];
}

export function categoryHubPath(segment: DiamondGuideCategorySegment): string {
  return `/diamond-guide/${segment}`;
}

export function categoryIndexPath(segment: DiamondGuideCategorySegment): string {
  return `/diamond-guide/${segment}/all`;
}
