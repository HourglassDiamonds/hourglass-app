import type { DiamondGuideCategorySegment } from "@/lib/seo/diamond-guide-metadata";
import { categoryVisualBreadcrumbs } from "@/lib/diamond-guide/guide-nav";
import GuideBreadcrumbs from "./GuideBreadcrumbs";

type CategoryPageBreadcrumbsProps = {
  segment: DiamondGuideCategorySegment;
  variant: "hub" | "index";
};

export default function CategoryPageBreadcrumbs({
  segment,
  variant,
}: CategoryPageBreadcrumbsProps) {
  return (
    <GuideBreadcrumbs items={categoryVisualBreadcrumbs(segment, variant)} />
  );
}
