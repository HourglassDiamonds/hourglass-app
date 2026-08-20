import JsonLd from "@/app/shared-components/JsonLd";
import type { DiamondGuideCategorySegment } from "@/lib/seo/diamond-guide-metadata";
import {
  categoryHubBreadcrumb,
  categoryIndexBreadcrumb,
} from "@/lib/seo/schema/breadcrumbs";
import { categoryCollectionPage } from "@/lib/seo/schema/category-map";
import { jsonLdGraph } from "@/lib/seo/schema/json-ld";

type CategoryGuideJsonLdProps = {
  segment: DiamondGuideCategorySegment;
  variant: "hub" | "index";
};

export default function CategoryGuideJsonLd({
  segment,
  variant,
}: CategoryGuideJsonLdProps) {
  const data = jsonLdGraph([
    categoryCollectionPage(segment, variant),
    variant === "hub"
      ? categoryHubBreadcrumb(segment)
      : categoryIndexBreadcrumb(segment),
  ]);

  return <JsonLd data={data} />;
}
