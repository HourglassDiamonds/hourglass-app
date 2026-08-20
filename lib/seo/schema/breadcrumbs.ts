import {
  getCategoryConfig,
  type DiamondGuideCategorySegment,
} from "@/lib/seo/diamond-guide-metadata";
import { absoluteUrl } from "./constants";
import {
  categoryHubPath,
  categoryHubTitle,
  categoryIndexPath,
} from "./category-map";
import type { JsonLdValue } from "./json-ld";

export type BreadcrumbItem = {
  name: string;
  path: string;
};

export function buildBreadcrumbList(items: BreadcrumbItem[]): JsonLdValue {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

const HOME_CRUMB: BreadcrumbItem = { name: "Home", path: "/" };
const DIAMOND_GUIDE_CRUMB: BreadcrumbItem = {
  name: "Diamond Guide",
  path: "/diamond-guide",
};

export function homeBreadcrumb(): JsonLdValue {
  return buildBreadcrumbList([HOME_CRUMB]);
}

export function diamondGuideHubBreadcrumb(): JsonLdValue {
  return buildBreadcrumbList([HOME_CRUMB, DIAMOND_GUIDE_CRUMB]);
}

export function allGuidesIndexBreadcrumb(): JsonLdValue {
  return buildBreadcrumbList([
    HOME_CRUMB,
    DIAMOND_GUIDE_CRUMB,
    { name: "All Diamond Guides", path: "/diamond-guide/all" },
  ]);
}

export function categoryHubBreadcrumb(
  segment: DiamondGuideCategorySegment,
): JsonLdValue {
  return buildBreadcrumbList([
    HOME_CRUMB,
    DIAMOND_GUIDE_CRUMB,
    {
      name: categoryHubTitle(segment),
      path: categoryHubPath(segment),
    },
  ]);
}

export function categoryIndexBreadcrumb(
  segment: DiamondGuideCategorySegment,
): JsonLdValue {
  const config = getCategoryConfig(segment);
  return buildBreadcrumbList([
    HOME_CRUMB,
    DIAMOND_GUIDE_CRUMB,
    {
      name: config.navTitle,
      path: categoryHubPath(segment),
    },
    {
      name: config.indexTitle,
      path: categoryIndexPath(segment),
    },
  ]);
}

export function articleBreadcrumb(input: {
  title: string;
  slug: string;
  categorySegment: DiamondGuideCategorySegment | null;
}): JsonLdValue {
  const articleCrumb: BreadcrumbItem = {
    name: input.title,
    path: `/diamond-guide/${input.slug}`,
  };

  if (!input.categorySegment) {
    return buildBreadcrumbList([
      HOME_CRUMB,
      DIAMOND_GUIDE_CRUMB,
      articleCrumb,
    ]);
  }

  return buildBreadcrumbList([
    HOME_CRUMB,
    DIAMOND_GUIDE_CRUMB,
    {
      name: categoryHubTitle(input.categorySegment),
      path: categoryHubPath(input.categorySegment),
    },
    articleCrumb,
  ]);
}

export function diamondStudioBreadcrumb(): JsonLdValue {
  return buildBreadcrumbList([
    HOME_CRUMB,
    { name: "Diamond Size Studio", path: "/diamond-studio" },
  ]);
}

export function diamondIntelligenceBreadcrumb(): JsonLdValue {
  return buildBreadcrumbList([
    HOME_CRUMB,
    { name: "Diamond Intelligence", path: "/diamond-intelligence" },
  ]);
}

export function diamondShapeStudioBreadcrumb(): JsonLdValue {
  return buildBreadcrumbList([
    HOME_CRUMB,
    { name: "See It On Your Hand", path: "/diamond-shape-studio" },
  ]);
}

export function marketingPageBreadcrumb(
  name: string,
  path: string,
): JsonLdValue {
  return buildBreadcrumbList([HOME_CRUMB, { name, path }]);
}
