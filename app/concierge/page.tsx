import type { Metadata } from "next";
import { Suspense } from "react";
import { pageMetadata } from "@/lib/seo/site-metadata";
import MarketingPageJsonLd from "@/app/shared-components/MarketingPageJsonLd";
import ConciergePageClient from "./concierge-page-client";

export const metadata: Metadata = pageMetadata({
  title: "Start Your Project",
  description:
    "Begin with a simple concierge conversation—share your direction, timeline, and budget. No pressure; a clear next step for rings and custom design.",
  path: "/concierge",
  openGraphTitle: "Start Your Project | Hourglass Diamonds Concierge",
});

export default function ConciergePage() {
  return (
    <>
      <MarketingPageJsonLd name="Concierge" path="/concierge" />
      <Suspense fallback={null}>
        <ConciergePageClient />
      </Suspense>
    </>
  );
}
