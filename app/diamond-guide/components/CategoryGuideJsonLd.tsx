import JsonLd from "@/app/shared-components/JsonLd";
import type { DiamondGuideCategorySegment } from "@/lib/seo/diamond-guide-metadata";
import {
  categoryHubBreadcrumb,
  categoryIndexBreadcrumb,
} from "@/lib/seo/schema/breadcrumbs";

type CategoryGuideJsonLdProps = {
  segment: DiamondGuideCategorySegment;
  variant: "hub" | "index";
};

export default function CategoryGuideJsonLd({
  segment,
  variant,
}: CategoryGuideJsonLdProps) {
  const data =
    variant === "hub"
      ? categoryHubBreadcrumb(segment)
      : categoryIndexBreadcrumb(segment);

  return <JsonLd data={data} />;
}
