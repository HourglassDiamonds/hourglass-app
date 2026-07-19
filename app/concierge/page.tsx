import type { Metadata } from "next";
import { Suspense } from "react";
import { pageMetadata } from "@/lib/seo/site-metadata";
import MarketingPageJsonLd from "@/app/shared-components/MarketingPageJsonLd";
import Header from "../shared-components/Header";
import ConciergeIntro from "./concierge-intro";
import ConciergeFormClient from "./concierge-page-client";
import ConciergeSupportingLinks from "./concierge-supporting-links";
import ConciergeTrustStrip from "./concierge-trust-strip";

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
      <div className="min-h-screen bg-[#efe8de] text-[#1c1b1a]">
        <div className="mx-auto max-w-[1200px] px-6 md:px-10">
          <Header currentPage="concierge" />

          <div>
            <section className="border-b border-[#e4dbcf] pb-[72px] pt-[52px] md:pb-[88px] md:pt-[64px]">
              <ConciergeIntro />
              <ConciergeTrustStrip />
              <Suspense fallback={null}>
                <ConciergeFormClient />
              </Suspense>
              <ConciergeSupportingLinks />
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
