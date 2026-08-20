import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo/site-metadata";
import JsonLd from "@/app/shared-components/JsonLd";
import { diamondGuideHubBreadcrumb } from "@/lib/seo/schema/breadcrumbs";
import {
  buildGuideSearchIndex,
  hubCategoryPreviews,
} from "@/lib/diamond-guide/guide-architecture";
import DiamondGuidePageClient from "./diamond-guide-page-client";

export const metadata: Metadata = pageMetadata({
  title: "Diamond Guide",
  description:
    "Clear, practical diamond education—size, shape, cut, light, color, clarity, certification, and buying strategy—in one calm reference.",
  path: "/diamond-guide",
});

export default function DiamondGuidePage() {
  return (
    <>
      <JsonLd data={diamondGuideHubBreadcrumb()} />
      <DiamondGuidePageClient
        searchRecords={buildGuideSearchIndex()}
        categoryPreviews={hubCategoryPreviews()}
      />
    </>
  );
}
