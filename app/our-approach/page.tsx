import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo/site-metadata";
import MarketingPageJsonLd from "@/app/shared-components/MarketingPageJsonLd";
import JsonLd from "@/app/shared-components/JsonLd";
import { absoluteUrl, WEBSITE_ID } from "@/lib/seo/schema/constants";
import { organizationPublisherReference } from "@/lib/seo/schema/entities";
import OurApproachPageClient from "./our-approach-page-client";

const PAGE_DESCRIPTION =
  "A thoughtful look at how Hourglass Diamonds evaluates diamonds, makes recommendations, and guides clients through a more curated engagement ring experience.";

export const metadata: Metadata = pageMetadata({
  title: "Our Approach",
  description: PAGE_DESCRIPTION,
  path: "/our-approach",
  openGraphTitle: "Our Approach | Hourglass Diamonds",
});

const OUR_APPROACH_JSON_LD = {
  "@type": "AboutPage",
  name: "Our Approach",
  description: PAGE_DESCRIPTION,
  url: absoluteUrl("/our-approach"),
  isPartOf: { "@id": WEBSITE_ID },
  about: organizationPublisherReference(),
  publisher: organizationPublisherReference(),
};

export default function OurApproachPage() {
  return (
    <>
      <MarketingPageJsonLd name="Our Approach" path="/our-approach" />
      <JsonLd data={OUR_APPROACH_JSON_LD} />
      <OurApproachPageClient />
    </>
  );
}
