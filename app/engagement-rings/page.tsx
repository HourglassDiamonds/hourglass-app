import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo/site-metadata";
import Header from "../shared-components/Header";
import EngagementRingsJsonLd from "./components/EngagementRingsJsonLd";
import EngagementRingsIntro from "./engagement-rings-intro";
import EngagementRingsRingStudioSection from "./engagement-rings-ring-studio-section";
import EngagementRingsEditorial from "./engagement-rings-editorial";
import EngagementRingsClosingCta from "./engagement-rings-closing-cta";

export const metadata: Metadata = pageMetadata({
  title: "Engagement Rings in Charlotte, NC",
  description:
    "Private engagement-ring guidance in the Charlotte area, led by a Graduate Gemologist. Explore designs in the Ring Studio, compare diamonds and settings, and begin when you are ready.",
  path: "/engagement-rings",
  openGraphTitle: "Engagement Rings in Charlotte, NC | Hourglass Diamonds",
});

export default function EngagementRingsPage() {
  return (
    <>
      <EngagementRingsJsonLd />
      <div className="min-h-screen bg-[#efe8de] text-[#1c1b1a]">
        <div className="mx-auto max-w-[1200px] px-6 md:px-10">
          <Header currentPage="engagement-rings" />

          <main>
            <section className="border-b border-[#e4dbcf] pb-[48px] pt-[52px] md:pb-[56px] md:pt-[64px]">
              <EngagementRingsIntro />
            </section>

            <EngagementRingsRingStudioSection />
            <EngagementRingsEditorial />
            <EngagementRingsClosingCta />
          </main>
        </div>
      </div>
    </>
  );
}
