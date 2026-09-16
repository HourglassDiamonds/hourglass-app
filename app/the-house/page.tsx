import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo/site-metadata";
import MarketingPageJsonLd from "@/app/shared-components/MarketingPageJsonLd";
import JsonLd from "@/app/shared-components/JsonLd";
import {
  buildHousePageJsonLd,
  HOUSE_PAGE_DESCRIPTION,
} from "@/lib/seo/schema/house";
import TheHousePageClient from "./the-house-page-client";

export const metadata: Metadata = pageMetadata({
  title: "The House",
  description: HOUSE_PAGE_DESCRIPTION,
  path: "/the-house",
});

export default function TheHousePage() {
  return (
    <>
      <MarketingPageJsonLd name="The House" path="/the-house" />
      <JsonLd data={buildHousePageJsonLd()} />
      <TheHousePageClient />
    </>
  );
}
