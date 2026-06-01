import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo/site-metadata";
import MarketingPageJsonLd from "@/app/shared-components/MarketingPageJsonLd";
import TheHousePageClient from "./the-house-page-client";

export const metadata: Metadata = pageMetadata({
  title: "The House",
  description:
    "Meet the perspective behind Hourglass: Graduate Gemologist–led guidance, global sourcing experience, and a calmer alternative to traditional retail.",
  path: "/the-house",
});

export default function TheHousePage() {
  return (
    <>
      <MarketingPageJsonLd name="The House" path="/the-house" />
      <TheHousePageClient />
    </>
  );
}
