import Link from "next/link";
import Header from "../../shared-components/Header";
import CTAGlimmer from "../../shared-components/motion/CTAGlimmer";
import RevealOnScroll from "../../shared-components/motion/RevealOnScroll";
import ConsultationCtaLink from "@/app/shared-components/ConsultationCtaLink";
import {
  getCategoryConfig,
  type DiamondGuideCategorySegment,
} from "@/lib/seo/diamond-guide-metadata";
import {
  orderedArticlesForSegment,
  toSummary,
} from "@/lib/diamond-guide/guide-architecture";
import CategoryPageBreadcrumbs from "./CategoryPageBreadcrumbs";

type CategoryAllIndexProps = {
  segment: DiamondGuideCategorySegment;
};

export default function CategoryAllIndex({ segment }: CategoryAllIndexProps) {
  const config = getCategoryConfig(segment);
  const articles = orderedArticlesForSegment(segment).map(toSummary);
  const consultationLocation = `guide_hub:${segment.replace(/-/g, "_")}_all`;

  return (
    <div className="min-h-screen bg-[#efe8de] text-[#1c1b1a]">
      <div className="mx-auto max-w-[1100px] px-6 md:px-10">
        <Header currentPage="diamond-guide" />

        <section className="border-b border-[#e4dbcf] pb-[70px] pt-[80px] md:pb-[90px] md:pt-[95px]">
          <div className="mx-auto max-w-[720px] text-center">
            <CategoryPageBreadcrumbs segment={segment} variant="index" />

            <h1 className="mt-5 text-[2.2rem] tracking-[-0.045em] md:text-[3rem]">
              {config.indexHeading}
            </h1>

            <p className="mx-auto mt-6 max-w-[600px] text-[1rem] leading-[1.85] text-[#6f675f]">
              {config.indexLead}
            </p>

            <p className="mt-8">
              <Link
                href={`/diamond-guide/${segment}`}
                className="text-[11px] uppercase tracking-[0.32em] text-[#6d655e] transition-colors duration-300 hover:text-[#1d1b18]"
              >
                Back to {config.navTitle}
              </Link>
            </p>
          </div>
        </section>

        <RevealOnScroll as="section" className="py-[80px] md:py-[100px]">
          <ul className="divide-y divide-[#e7ddd2]">
            {articles.map((article) => (
              <li key={article.slug}>
                <Link
                  href={article.href}
                  className="flex items-center justify-between py-4 transition hover:opacity-80"
                >
                  <span className="text-[0.98rem]">{article.title}</span>
                  <span className="text-[#6f675f]">→</span>
                </Link>
              </li>
            ))}
          </ul>
        </RevealOnScroll>

        <RevealOnScroll as="section" className="pb-[110px] pt-[40px]">
          <div className="mx-auto max-w-[700px] text-center">
            <h2 className="text-[2rem] leading-[1.1] tracking-[-0.045em] md:text-[2.6rem]">
              If you want clarity, we can help.
            </h2>

            <p className="mt-5 leading-[1.8] text-[#6f675f]">
              {config.indexCtaNote}
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/diamond-guide/all"
                className="rounded-full border border-[#d9cec1] bg-white/58 px-6 py-3 text-[11px] uppercase tracking-[0.32em] text-[#6e665e] transition duration-300 hover:bg-white"
              >
                View All Diamond Guides
              </Link>
              <CTAGlimmer>
                <ConsultationCtaLink
                  location={consultationLocation}
                  tool="diamond-guide"
                  className="rounded-full bg-[#2b2621] px-6 py-3 text-[11px] uppercase tracking-[0.32em] text-white"
                >
                  Begin the Conversation
                </ConsultationCtaLink>
              </CTAGlimmer>
            </div>
          </div>
        </RevealOnScroll>
      </div>
    </div>
  );
}
