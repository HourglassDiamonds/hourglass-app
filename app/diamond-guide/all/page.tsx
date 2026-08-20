import type { Metadata } from "next";
import Link from "next/link";
import JsonLd from "@/app/shared-components/JsonLd";
import Header from "@/app/shared-components/Header";
import { pageMetadata } from "@/lib/seo/site-metadata";
import { allGuidesIndexBreadcrumb } from "@/lib/seo/schema/breadcrumbs";
import { jsonLdGraph, type JsonLdValue } from "@/lib/seo/schema/json-ld";
import { absoluteUrl, WEBSITE_ID } from "@/lib/seo/schema/constants";
import {
  buildGuideSearchIndex,
  groupedGuideLibrary,
} from "@/lib/diamond-guide/guide-architecture";
import type { GuideNavGroupId } from "@/lib/diamond-guide/guide-nav";
import GuideBreadcrumbs from "../components/GuideBreadcrumbs";
import GuideSearch from "../components/GuideSearch";

export const metadata: Metadata = pageMetadata({
  title: "All Diamond Guides",
  description:
    "The complete Hourglass Diamond Guide library, grouped by subject: size, shape, cut, light, color, clarity, certification, buying strategy, Charlotte, and proposal planning.",
  path: "/diamond-guide/all",
});

const INDEX_JUMP: { id: GuideNavGroupId; label: string }[] = [
  { id: "diamond-size", label: "Size" },
  { id: "diamond-shapes", label: "Shapes" },
  { id: "diamond-cut", label: "Cut" },
  { id: "light-performance", label: "Light" },
  { id: "diamond-color", label: "Color" },
  { id: "diamond-clarity", label: "Clarity" },
  { id: "certification", label: "Certification" },
  { id: "buying-strategy", label: "Buying" },
  { id: "charlotte-guides", label: "Charlotte" },
  { id: "proposal-planning", label: "Proposals" },
];

function allGuidesCollectionPage(): JsonLdValue {
  return {
    "@type": "CollectionPage",
    "@id": `${absoluteUrl("/diamond-guide/all")}#page`,
    name: "All Diamond Guides",
    description:
      "Complete index of Hourglass Diamond Guide articles, grouped by subject.",
    url: absoluteUrl("/diamond-guide/all"),
    isPartOf: {
      "@type": "WebSite",
      "@id": WEBSITE_ID,
    },
  };
}

export default function AllDiamondGuidesPage() {
  const library = groupedGuideLibrary();
  const searchRecords = buildGuideSearchIndex();

  return (
    <div className="min-h-screen overflow-x-clip bg-[#efe8de] text-[#1c1b1a]">
      <JsonLd
        data={jsonLdGraph([allGuidesCollectionPage(), allGuidesIndexBreadcrumb()])}
      />
      <div className="mx-auto max-w-[1100px] px-6 md:px-10">
        <Header currentPage="diamond-guide" />

        <article className="pb-[112px] pt-[68px] md:pb-[132px] md:pt-[86px]">
          <header className="border-b border-[#e4dbcf] pb-[56px] md:pb-[72px]">
            <GuideBreadcrumbs
              align="start"
              items={[
                { name: "Diamond Guide", href: "/diamond-guide" },
                { name: "All Diamond Guides" },
              ]}
            />
            <div className="text-[11px] uppercase tracking-[0.34em] text-[#6d655e]">
              Diamond Guide
            </div>
            <h1 className="mt-5 font-serif text-[2.2rem] font-normal leading-[1.08] tracking-[-0.045em] text-[#1d1b18] md:text-[3rem]">
              All Diamond Guides
            </h1>
            <p className="mt-6 max-w-[600px] text-[1rem] leading-[1.85] text-[#6f675f]">
              The full library, arranged by subject. Search, or jump to a
              category. Return to the Diamond Guide when you want a quieter
              place to begin.
            </p>
            <div className="mt-10 max-w-[620px]">
              <GuideSearch
                records={searchRecords}
                inputId="diamond-guide-index-search"
              />
            </div>
            <nav
              aria-label="Jump to a category"
              className="mt-8 flex flex-wrap items-baseline gap-x-3 gap-y-2 text-[0.92rem] leading-[1.6] text-[#6d655e]"
            >
              {INDEX_JUMP.map((item, index) => (
                <span key={item.id} className="inline-flex items-baseline">
                  {index > 0 ? (
                    <span aria-hidden="true" className="mr-3 text-[#d4cbc0]">
                      ·
                    </span>
                  ) : null}
                  <a
                    href={`#${item.id}`}
                    className="underline decoration-[#d4cbc0] underline-offset-[0.22em] transition-colors duration-300 hover:text-[#1d1b18] hover:decoration-[#1d1b18]"
                  >
                    {item.label}
                  </a>
                </span>
              ))}
            </nav>
          </header>

          <div className="mt-16 grid gap-x-16 gap-y-16 md:mt-20 md:grid-cols-2 md:gap-y-20">
            {library.map(({ group, articles: groupArticles }) => (
              <section
                key={group.id}
                id={group.id}
                aria-labelledby={`${group.id}-heading`}
                className="scroll-mt-28"
              >
                <h2
                  id={`${group.id}-heading`}
                  className="font-serif text-[1.55rem] font-normal tracking-[-0.03em] text-[#1d1b18] md:text-[1.7rem]"
                >
                  <Link
                    href={group.href}
                    className="transition-colors duration-300 hover:text-[#0f0e0d]"
                  >
                    {group.title}
                  </Link>
                </h2>
                <p className="mt-3 max-w-[36rem] text-[0.94rem] leading-[1.7] text-[#6f675f]">
                  {group.description}
                </p>

                <ul className="mt-6">
                  {groupArticles.map((article) => (
                    <li key={article.slug}>
                      <Link
                        href={article.href}
                        className="group flex min-h-11 items-center justify-between gap-4 border-t border-[#e7ddd2]/90 py-2.5 text-[0.98rem] leading-[1.4] text-[#2f2b27] transition-colors duration-300 hover:text-[#0f0e0d]"
                      >
                        <span>{article.title}</span>
                        <span
                          aria-hidden
                          className="shrink-0 text-[#c4bbb0] transition-colors duration-300 group-hover:text-[#1d1b18]"
                        >
                          →
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </article>
      </div>
    </div>
  );
}
