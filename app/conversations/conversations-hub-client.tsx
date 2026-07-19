"use client";

import Link from "next/link";
import { useEffect } from "react";
import Header from "@/app/shared-components/Header";
import { useReducedMotion } from "@/app/shared-components/motion/useReducedMotion";
import type { ConversationEpisode } from "@/lib/conversations/episodes";
import {
  episodePath,
  formatEpisodeLabel,
  formatPublishedDate,
} from "@/lib/conversations/episodes";

type ConversationsHubClientProps = {
  episodes: ConversationEpisode[];
};

const WATCH_CTA_CLASS =
  "inline-flex min-h-11 items-center justify-center rounded-full border border-[#d9cdbd] bg-white/80 px-7 py-3 text-[11px] uppercase tracking-[0.28em] text-[#6f665d] transition-all duration-500 ease-out hover:-translate-y-px hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-hg-focus";

function FeaturedMeta({ episode }: { episode: ConversationEpisode }) {
  const seasonLabel = formatEpisodeLabel(episode);
  const published = formatPublishedDate(episode.publishedAt);
  const detailParts = [
    published,
    episode.durationLabel,
    episode.status === "draft" ? "Draft" : null,
  ].filter(Boolean);

  return (
    <div className="mt-4 space-y-2 text-[0.78rem] tracking-[0.04em] text-[#8a8177]">
      {seasonLabel ? <p>{seasonLabel}</p> : null}
      {detailParts.length > 0 ? <p>{detailParts.join(" · ")}</p> : null}
    </div>
  );
}

function FeaturedEpisode({
  episode,
  isSoleFeature,
}: {
  episode: ConversationEpisode;
  isSoleFeature: boolean;
}) {
  const reducedMotion = useReducedMotion();
  const href = episodePath(episode.slug);

  return (
    <section
      className={
        isSoleFeature
          ? "pb-16 pt-8 md:pb-20 md:pt-10"
          : "border-b border-[#e4dbcf] pb-16 pt-8 md:pb-20 md:pt-10"
      }
    >
      <div className="grid items-start gap-8 md:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] md:gap-10 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] lg:gap-12 xl:gap-14">
        <Link
          href={href}
          aria-label={`Watch the Conversation: ${episode.title}`}
          className={[
            "group relative block aspect-[16/9] w-full overflow-hidden rounded-[22px] border border-[#e4dbcf] bg-[#1c1a18]",
            "shadow-[0_14px_40px_rgba(49,38,29,0.08)]",
            "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-hg-focus",
            reducedMotion ? "" : "transition-transform duration-700 hover:-translate-y-0.5",
          ].join(" ")}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- poster may be SVG or photo */}
          <img
            src={episode.poster}
            alt=""
            width={1920}
            height={1080}
            className={[
              "absolute inset-0 h-full w-full object-cover",
              reducedMotion
                ? ""
                : "transition-transform duration-700 group-hover:scale-[1.015]",
            ].join(" ")}
            decoding="async"
            fetchPriority="high"
          />
          <div
            className="absolute inset-0 bg-gradient-to-t from-[#141210]/45 via-transparent to-transparent"
            aria-hidden
          />
          <span
            className={[
              "absolute bottom-5 left-5 inline-flex h-11 w-11 items-center justify-center",
              "rounded-full border border-white/25 bg-[#1c1a18]/72",
              "transition-[background-color,border-color,transform] duration-500",
              "group-hover:border-white/40 group-hover:bg-[#1c1a18]/88",
              reducedMotion ? "" : "group-hover:-translate-y-px",
            ].join(" ")}
            aria-hidden
          >
            <span className="ml-0.5 inline-block h-0 w-0 border-y-[6px] border-y-transparent border-l-[10px] border-l-[#f4eee6]" />
          </span>
        </Link>

        <div className="md:pt-1 md:max-w-[20rem] lg:pt-2 lg:max-w-[22rem] xl:max-w-[24rem]">
          <p className="text-[10px] uppercase tracking-[0.34em] text-[#8a8177]">
            Latest Conversation
          </p>
          <FeaturedMeta episode={episode} />
          <h2
            className="mt-4 text-[1.65rem] font-light leading-[1.14] tracking-[-0.022em] text-[#1f1d1a] md:mt-5 md:text-[1.95rem] lg:text-[2.2rem]"
            style={{ textWrap: "balance" }}
          >
            <Link
              href={href}
              className="no-underline transition-colors hover:text-[#3a332c] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-hg-focus"
            >
              {episode.title}
            </Link>
          </h2>
          <p className="mt-5 text-[1.02rem] leading-[1.85] text-[#615a53]">
            {episode.summary}
          </p>
          <div className="mt-8">
            <Link href={href} className={WATCH_CTA_CLASS}>
              Watch the Conversation
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function EpisodeListItem({ episode }: { episode: ConversationEpisode }) {
  const reducedMotion = useReducedMotion();
  const label = formatEpisodeLabel(episode);
  const published = formatPublishedDate(episode.publishedAt);
  const meta = [
    label,
    published,
    episode.durationLabel,
    episode.status === "draft" ? "Draft" : null,
  ].filter(Boolean);

  return (
    <li className="border-t border-[#e4dbcf] py-8 first:border-t-0 md:py-9">
      <Link
        href={episodePath(episode.slug)}
        className="group grid items-center gap-6 no-underline md:grid-cols-[11rem_1fr] md:gap-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-hg-focus"
      >
        <div
          className={[
            "relative aspect-[16/9] overflow-hidden rounded-[14px] border border-[#ebe3d8] bg-[#1c1a18]",
            reducedMotion ? "" : "transition-transform duration-500 group-hover:-translate-y-0.5",
          ].join(" ")}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- poster may be SVG or photo */}
          <img
            src={episode.poster}
            alt=""
            width={640}
            height={360}
            className="absolute inset-0 h-full w-full object-cover"
            decoding="async"
            loading="lazy"
          />
        </div>
        <div>
          <h3 className="font-serif text-[1.25rem] font-normal tracking-[-0.02em] text-[#2f2b27] transition-colors duration-300 group-hover:text-[#1f1d1a] md:text-[1.35rem]">
            {episode.title}
          </h3>
          {meta.length > 0 ? (
            <p className="mt-3 text-[0.78rem] tracking-[0.04em] text-[#8a8177]">
              {meta.join(" · ")}
            </p>
          ) : null}
          <p className="mt-3 max-w-[42rem] text-[0.98rem] leading-[1.8] text-[#615a53]">
            {episode.summary}
          </p>
        </div>
      </Link>
    </li>
  );
}

export default function ConversationsHubClient({
  episodes,
}: ConversationsHubClientProps) {
  const [featured, ...previous] = episodes;
  const hasPrevious = previous.length > 0;

  useEffect(() => {
    const main = document.querySelector("main");
    const footer = document.querySelector("footer");
    if (!(main instanceof HTMLElement)) return;

    const previousMainBackground = main.style.background;
    const previousFooterBackground =
      footer instanceof HTMLElement ? footer.style.background : "";
    const previousFooterBorder =
      footer instanceof HTMLElement ? footer.style.borderTopColor : "";

    main.style.background =
      "linear-gradient(180deg, #efe8de 0%, #efe8de 70%, #ebe3d8 100%)";

    if (footer instanceof HTMLElement) {
      footer.style.background =
        "linear-gradient(180deg, #ebe3d8 0%, #f3eee6 5rem, #ffffff 11rem)";
      footer.style.borderTopColor = "rgba(228, 219, 207, 0.9)";
    }

    return () => {
      main.style.background = previousMainBackground;
      if (footer instanceof HTMLElement) {
        footer.style.background = previousFooterBackground;
        footer.style.borderTopColor = previousFooterBorder;
      }
    };
  }, []);

  return (
    <div
      className="relative z-0 -mb-32 pb-20 text-[#1c1b1a] md:pb-24"
      style={{
        background:
          "radial-gradient(circle at top, rgba(255,255,255,0.42), transparent 36rem), linear-gradient(180deg, #efe8de 0%, #efe8de 68%, #ebe3d8 100%)",
      }}
    >
      <div className="mx-auto max-w-[1200px] px-6 md:px-10">
        <Header />

        <section className="border-b border-[#e4dbcf] pb-12 pt-14 md:pb-14 md:pt-16">
          <div className="mx-auto max-w-[820px] text-center">
            <p className="text-[10px] uppercase tracking-[0.34em] text-[#8a8177]">
              Conversations
            </p>
            <h1
              className="mt-5 text-[2.25rem] font-light leading-[1.08] tracking-[-0.03em] text-[#1f1d1a] md:text-[3.2rem]"
              style={{ textWrap: "balance" }}
            >
              Ideas worth slowing down for.
            </h1>
            <p className="mx-auto mt-6 max-w-[38rem] text-[1.05rem] leading-[1.85] text-[#615a53]">
              Long-form conversations with Justin Smith on diamonds, design,
              judgment, and the decisions that matter.
            </p>
          </div>
        </section>

        {featured ? (
          <FeaturedEpisode
            episode={featured}
            isSoleFeature={!hasPrevious}
          />
        ) : null}

        {hasPrevious ? (
          <section className="pb-4 pt-14 md:pb-6 md:pt-16">
            <div className="mx-auto max-w-[880px]">
              <p className="text-[10px] uppercase tracking-[0.34em] text-[#8a8177]">
                Previous Conversations
              </p>
              <ul className="mt-8">
                {previous.map((episode) => (
                  <EpisodeListItem key={episode.slug} episode={episode} />
                ))}
              </ul>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
