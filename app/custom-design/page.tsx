import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo/site-metadata";
import MarketingPageJsonLd from "@/app/shared-components/MarketingPageJsonLd";
import Header from "../shared-components/Header";
import CustomDesignIntro from "./custom-design-intro";
import CustomDesignProgression from "./custom-design-progression";
import CustomDesignProcess from "./custom-design-process";
import CustomDesignClosingCta from "./custom-design-closing-cta";

export const metadata: Metadata = pageMetadata({
  title: "Custom Engagement Rings in Charlotte, NC",
  description:
    "Custom engagement rings and fine jewelry in the Charlotte area, led by a Graduate Gemologist. Personal guidance from first reference through proportion, sourcing, and the finished piece.",
  path: "/custom-design",
  openGraphTitle:
    "Custom Engagement Rings in Charlotte, NC | Hourglass Diamonds",
});

export default function CustomDesignPage() {
  return (
    <>
      <MarketingPageJsonLd name="Custom Design" path="/custom-design" />
      <div className="min-h-screen bg-[#efe8de] text-[#1c1b1a]">
        <div className="mx-auto max-w-[1200px] px-6 md:px-10">
          <Header currentPage="custom-design" />

          <main>
            <section className="border-b border-[#e4dbcf] pb-[48px] pt-[52px] md:pb-[56px] md:pt-[64px]">
              <CustomDesignIntro />
            </section>

            <CustomDesignProgression />
            <CustomDesignProcess />
            <CustomDesignClosingCta />
          </main>
        </div>
      </div>
    </>
  );
}
