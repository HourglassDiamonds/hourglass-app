import type { Metadata } from "next";
import { notFound } from "next/navigation";
import JsonLd from "@/app/shared-components/JsonLd";
import { articlePageMetadata } from "@/lib/seo/diamond-guide-metadata";
import { buildArticlePageJsonLd } from "@/lib/seo/schema/articles";
import {
  certificateReaderFaqNode,
  charlotteAdvisorFaqNode,
  clarityFaqNode,
  colorFaqNode,
  cutFaqNode,
  fluorescenceFaqNode,
  labNaturalFaqNode,
} from "@/lib/seo/schema/entities";
import { jsonLdGraph, type JsonLdValue } from "@/lib/seo/schema/json-ld";
import ConsultationCtaLink from "../../shared-components/ConsultationCtaLink";
import Header from "../../shared-components/Header";
import ArticleAuthorByline from "../components/ArticleAuthorByline";
import ArticleHeroImage from "../components/ArticleHeroImage";
import {
  ArticleEditorialImage,
  CaratMmReference,
  FingerCoverageScale,
  PerceivedSizeRanking,
  ReferenceFactorList,
  ShapeSpreadTable,
  StudioCallout,
} from "../article-blocks";
import { articles, type ArticleBlock } from "../articles";
import { renderInlineContent } from "../inline-content";
import GuideBreadcrumbs from "../components/GuideBreadcrumbs";
import RelatedReadingSection from "../components/RelatedReading";
import {
  articleVisualBreadcrumbs,
  resolveRelatedReading,
} from "@/lib/diamond-guide/guide-architecture";

type ArticlePageProps = {
  params: Promise<{
    slug: string;
  }>;
};

const VISUAL_BLOCK_TYPES = new Set<ArticleBlock["type"]>([
  "carat-mm-reference",
  "shape-spread-table",
  "perceived-size-ranking",
  "reference-factor-list",
  "finger-coverage-scale",
  "studio-callout",
  "editorial-image",
]);

const COHESION_SLUG = "what-diamond-shape-looks-the-largest";
const CHARLOTTE_ADVISOR_SLUG = "charlotte-diamond-advisor-guide";
const CERTIFICATE_READER_SLUG = "how-to-read-a-diamond-certificate";
const LAB_NATURAL_SLUG = "natural-vs-lab-diamonds";
const FLUORESCENCE_SLUG = "what-is-diamond-fluorescence";
const CLARITY_SLUG = "what-is-diamond-clarity";
const COLOR_SLUG = "what-is-diamond-color";
const CUT_SLUG = "what-is-diamond-cut";

function buildPageJsonLd(article: (typeof articles)[number], slug: string) {
  const base = buildArticlePageJsonLd(article);
  const faqNode =
    slug === CHARLOTTE_ADVISOR_SLUG
      ? charlotteAdvisorFaqNode()
      : slug === CERTIFICATE_READER_SLUG
        ? certificateReaderFaqNode()
        : slug === LAB_NATURAL_SLUG
          ? labNaturalFaqNode()
          : slug === FLUORESCENCE_SLUG
            ? fluorescenceFaqNode()
            : slug === CLARITY_SLUG
              ? clarityFaqNode()
              : slug === COLOR_SLUG
                ? colorFaqNode()
                : slug === CUT_SLUG
                  ? cutFaqNode()
                  : null;
  if (!faqNode) {
    return base;
  }

  const graph = (base as { "@graph": JsonLdValue[] })["@graph"];
  return jsonLdGraph([...graph, faqNode]);
}

function isVisualBlock(block: ArticleBlock): boolean {
  return VISUAL_BLOCK_TYPES.has(block.type);
}

export async function generateMetadata({
  params,
}: ArticlePageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = articles.find((item) => item.slug === slug);
  if (!article) {
    return {};
  }
  return articlePageMetadata(article);
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const { slug } = await params;

  const article = articles.find((item) => item.slug === slug);

  if (!article) {
    notFound();
  }

  const isReferenceArticle = article.body.some((block) =>
    VISUAL_BLOCK_TYPES.has(block.type),
  );
  const isCohesionArticle = slug === COHESION_SLUG;

  const proseWrapClass = isCohesionArticle
    ? "mx-auto max-w-[40rem]"
    : isReferenceArticle
      ? "mx-auto max-w-[42rem]"
      : "";

  const paragraphClass = isCohesionArticle
    ? "mt-[1.4rem] leading-[1.88] first:mt-0"
    : "mt-6 first:mt-0";

  function renderBlock(block: ArticleBlock, index: number) {
    const key = `${block.type}-${index}`;

    if (block.type === "heading") {
      return (
        <h2
          key={key}
          className="mt-14 text-[1.45rem] font-light leading-[1.2] tracking-[-0.02em] text-[#1f1d1a] md:text-[1.7rem]"
        >
          {block.text}
        </h2>
      );
    }

    if (block.type === "carat-mm-reference") {
      return <CaratMmReference key={key} {...block} />;
    }

    if (block.type === "shape-spread-table") {
      return <ShapeSpreadTable key={key} {...block} />;
    }

    if (block.type === "perceived-size-ranking") {
      return <PerceivedSizeRanking key={key} {...block} />;
    }

    if (block.type === "reference-factor-list") {
      return <ReferenceFactorList key={key} {...block} />;
    }

    if (block.type === "finger-coverage-scale") {
      return <FingerCoverageScale key={key} {...block} />;
    }

    if (block.type === "studio-callout") {
      return <StudioCallout key={key} {...block} articleSlug={slug} />;
    }

    if (block.type === "editorial-image") {
      return <ArticleEditorialImage key={key} {...block} />;
    }

    return (
      <p key={key} className={paragraphClass}>
        {renderInlineContent(block.text, { articleSlug: slug })}
      </p>
    );
  }

  return (
    <div className="min-h-screen bg-[#efe8de] text-[#1c1b1a]">
      <JsonLd data={buildPageJsonLd(article, slug)} />
      <div className="mx-auto max-w-[1200px] px-6 md:px-10">
        <Header currentPage="diamond-guide" />

        <article
          className={`mx-auto max-w-[760px] pb-[112px] pt-[68px] md:pb-[132px] md:pt-[86px] ${
            isCohesionArticle ? "md:pb-[140px]" : ""
          }`}
        >
          <GuideBreadcrumbs items={articleVisualBreadcrumbs(article)} />
          <div className="text-center">
            <div className="text-[10px] uppercase tracking-[0.34em] text-[#6d655e]">
              {article.category}
            </div>

            <h1
              className="mx-auto mt-4 max-w-[18ch] text-[2.25rem] font-light leading-[1.08] tracking-[-0.035em] text-[#1f1d1a] md:text-[3rem]"
              style={{ textWrap: "balance" }}
            >
              {article.title}
            </h1>

            <ArticleAuthorByline />
          </div>

          <ArticleHeroImage article={article} />

          <div className="mt-14 text-[1rem] leading-[1.9] text-[#4f4942] md:text-[1.04rem]">
            {article.body.map((block, index) => {
              const node = renderBlock(block, index);

              if (!isCohesionArticle) {
                return proseWrapClass ? (
                  <div key={`wrap-${index}`} className={proseWrapClass}>
                    {node}
                  </div>
                ) : (
                  node
                );
              }

              if (isVisualBlock(block)) {
                return (
                  <div key={`wrap-${index}`} className="w-full">
                    {node}
                  </div>
                );
              }

              return (
                <div key={`wrap-${index}`} className={proseWrapClass}>
                  {node}
                </div>
              );
            })}
          </div>

          <RelatedReadingSection
            reading={resolveRelatedReading(article)}
            compact={!isReferenceArticle}
          />

          <section
            className={`rounded-[24px] border border-[#e0d8cc]/75 bg-[#f9f6f1]/80 px-6 py-8 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] sm:px-8 sm:py-9 md:px-10 ${
              isReferenceArticle ? "mt-16 md:mt-20" : "mt-14"
            } ${isCohesionArticle || isReferenceArticle ? `mx-auto ${isCohesionArticle ? "max-w-[40rem]" : "max-w-[42rem]"}` : ""}`}
          >
            <p className="mx-auto max-w-[28rem] text-[0.95rem] leading-[1.8] text-[#6a635c]">
              {isCohesionArticle
                ? "When the question turns from charts to your hand, a private conversation can help settle shape, spread, and finger size together."
                : "If you would like this applied to your own diamond or ring, a private conversation is available."}
            </p>

            <div className="mt-6 flex justify-center md:mt-7">
              <ConsultationCtaLink
                glimmer
                location="guide_article:footer"
                tool="diamond-guide"
                content={slug}
                className="inline-flex items-center justify-center rounded-full border border-[#4a4540]/55 bg-transparent px-6 py-2.5 text-[10px] uppercase tracking-[0.3em] text-[#3d3834] transition-all duration-500 ease-out hover:border-[#2b2723] hover:bg-[#2b2723] hover:text-[#faf7f3]"
              >
                Begin the Conversation
              </ConsultationCtaLink>
            </div>
          </section>

          {isCohesionArticle ? (
            <div
              className="pointer-events-none mt-20 h-px bg-gradient-to-r from-transparent via-[#e0d8cc]/45 to-transparent md:mt-24"
              aria-hidden
            />
          ) : null}
        </article>
      </div>
    </div>
  );
}
