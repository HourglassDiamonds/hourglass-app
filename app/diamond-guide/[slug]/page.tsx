import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import Header from "../../shared-components/Header";
import { articles } from "../articles";

const INLINE_LINK_RE = /\[([^\]]+)\]\(([^)]+)\)/g;

function renderParagraphText(text: string): ReactNode {
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  INLINE_LINK_RE.lastIndex = 0;
  while ((match = INLINE_LINK_RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push(
      <Link
        key={key++}
        href={match[2]!}
        className="text-[#6a635c] underline underline-offset-4 transition hover:text-[#1f1d1a]"
      >
        {match[1]}
      </Link>,
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : text;
}

type ArticlePageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function ArticlePage({ params }: ArticlePageProps) {
  const { slug } = await params;

  const article = articles.find((item) => item.slug === slug);

  if (!article) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-[#efe8de] text-[#1c1b1a]">
      <div className="mx-auto max-w-[1200px] px-6 md:px-10">
        <Header currentPage="diamond-guide" />

        <article className="mx-auto max-w-[760px] pb-[112px] pt-[68px] md:pb-[132px] md:pt-[86px]">
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
              if (block.type === "heading") {
                return (
                  <h2
                    key={`${block.text}-${index}`}
                    className="mt-14 text-[1.45rem] font-light leading-[1.2] tracking-[-0.02em] text-[#1f1d1a] md:text-[1.7rem]"
                  >
                    {block.text}
                  </h2>
                );
              }

              return (
                <p key={`${block.text}-${index}`} className="mt-6 first:mt-0">
                  {renderParagraphText(block.text)}
                </p>
              );
            })}
          </div>

          <section className="mt-16 border-t border-[#e4dbcf] pt-10">
            <h3 className="text-[1.35rem] font-light tracking-[-0.02em] text-[#1f1d1a]">
              Continue Exploring
            </h3>

            <ul className="mt-5 space-y-3">
              {article.related.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-[0.98rem] leading-[1.8] text-[#6a635c] underline underline-offset-4 transition hover:text-[#1f1d1a]"
                  >
                    {item.title}
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-14 rounded-[28px] border border-[#e4dbcf] bg-white/42 px-7 py-8 text-center md:px-10 md:py-10">
            <p className="mx-auto max-w-[34rem] text-[1rem] leading-[1.8] text-[#5f5851]">
              If you’d like help applying this to your own diamond or ring, you
              can begin a private conversation here.
            </p>

            <Link
              href="/concierge"
              className="mt-7 inline-flex items-center justify-center rounded-full bg-[#2b2723] px-7 py-3 text-[11px] uppercase tracking-[0.28em] text-white transition-all duration-500 ease-out hover:-translate-y-[1px] hover:opacity-90"
            >
              Begin the Conversation
            </Link>
          </section>
        </article>
      </div>
    </div>
  );
}