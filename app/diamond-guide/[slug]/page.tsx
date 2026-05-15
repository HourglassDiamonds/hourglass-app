import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "../../shared-components/Header";
import {
  CaratMmReference,
  FingerCoverageScale,
  PerceivedSizeRanking,
  ReferenceFactorList,
  ShapeSpreadTable,
  StudioCallout,
} from "../article-blocks";
import { articles, type ArticleBlock } from "../articles";
import { renderInlineContent } from "../inline-content";

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
]);

const COHESION_SLUG = "what-diamond-shape-looks-the-largest";

function isVisualBlock(block: ArticleBlock): boolean {
  return VISUAL_BLOCK_TYPES.has(block.type);
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
      return <StudioCallout key={key} {...block} />;
    }

    return (
      <p key={key} className={paragraphClass}>
        {renderInlineContent(block.text)}
      </p>
    );
  }

  return (
    <div className="min-h-screen bg-[#efe8de] text-[#1c1b1a]">
      <div className="mx-auto max-w-[1200px] px-6 md:px-10">
        <Header currentPage="diamond-guide" />

        <article
          className={`mx-auto max-w-[760px] pb-[112px] pt-[68px] md:pb-[132px] md:pt-[86px] ${
            isCohesionArticle ? "md:pb-[140px]" : ""
          }`}
        >
          <div className="text-center">
            <div className="text-[10px] uppercase tracking-[0.34em] text-[#9a9084]">
              {article.category}
            </div>

            <h1
              className="mx-auto mt-4 max-w-[18ch] text-[2.25rem] font-light leading-[1.08] tracking-[-0.035em] text-[#1f1d1a] md:text-[3rem]"
              style={{ textWrap: "balance" }}
            >
              {article.title}
            </h1>
          </div>

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

          <section
            className={`border-t border-[#e4dbcf]/55 ${
              isReferenceArticle
                ? "mt-20 pt-12 md:mt-24 md:pt-14"
                : "mt-16 pt-10"
            } ${isCohesionArticle ? proseWrapClass : isReferenceArticle ? `mx-auto ${proseWrapClass}` : ""}`}
          >
            <p className="text-[9px] font-normal uppercase tracking-[0.38em] text-[#9a9084]">
              Further reading
            </p>
            <h3 className="mt-2 font-serif text-[1.2rem] font-normal tracking-[-0.02em] text-[#1f1d1a] md:text-[1.28rem]">
              Continue Exploring
            </h3>

            <ul className="mt-7 flex flex-col divide-y divide-[#ebe4da]/35 md:mt-9 md:grid md:grid-cols-2 md:gap-x-12 md:divide-y-0">
              {article.related.map((item, index) => (
                <li
                  key={item.href}
                  className={`border-[#ebe4da]/35 py-[1.15rem] first:border-t-0 md:border-t md:py-5 ${
                    index < 2 ? "md:border-t-0" : ""
                  }`}
                >
                  <Link
                    href={item.href}
                    className="group block no-underline transition-colors duration-300"
                  >
                    <span className="font-serif text-[1.02rem] tracking-[-0.01em] text-[#3a3632] transition-colors duration-300 group-hover:text-[#1f1d1a]">
                      {item.title}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section
            className={`rounded-[24px] border border-[#e0d8cc]/75 bg-[#f9f6f1]/80 px-6 py-8 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] sm:px-8 sm:py-9 md:px-10 ${
              isReferenceArticle ? "mt-16 md:mt-20" : "mt-14"
            } ${isCohesionArticle || isReferenceArticle ? `mx-auto ${isCohesionArticle ? "max-w-[40rem]" : "max-w-[42rem]"}` : ""}`}
          >
            <p className="mx-auto max-w-[28rem] text-[0.95rem] leading-[1.8] text-[#6a635c]">
              {isCohesionArticle
                ? "When shape, spread, and finger size need to be weighed together, a private conversation can help clarify what will read best on the hand."
                : "If this would help with your own diamond or ring, a private conversation is available."}
            </p>

            <Link
              href="/concierge"
              className="mt-6 inline-flex items-center justify-center rounded-full border border-[#4a4540]/55 bg-transparent px-6 py-2.5 text-[10px] uppercase tracking-[0.3em] text-[#3d3834] transition-all duration-500 ease-out hover:border-[#2b2723] hover:bg-[#2b2723] hover:text-[#faf7f3] md:mt-7"
            >
              Begin the Conversation
            </Link>
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
