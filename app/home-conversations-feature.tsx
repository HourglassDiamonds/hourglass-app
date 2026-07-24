"use client";

import Link from "next/link";
import RevealOnScroll from "./shared-components/motion/RevealOnScroll";
import { useReducedMotion } from "./shared-components/motion/useReducedMotion";
import { trackConversationDiscoverabilityClicked } from "@/lib/conversations/analytics";
import type { ConversationEpisode } from "@/lib/conversations/episodes";
import {
  episodePath,
  formatEpisodeLabel,
  getLatestPublishedEpisode,
} from "@/lib/conversations/episodes";

const WATCH_CTA_CLASS =
  "inline-flex min-h-11 items-center justify-center rounded-full border border-[#d9cdbd] bg-white/80 px-7 py-3 text-[11px] uppercase tracking-[0.28em] text-[#6f665d] transition-all duration-500 ease-out hover:-translate-y-px hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-hg-focus";

const SERIES_LINK_CLASS =
  "hg-tap inline-flex min-h-11 items-center text-[10px] uppercase tracking-[0.32em] text-[#7a7167] transition-colors duration-300 hover:text-[#2b2723]";

function analyticsBase(episode: ConversationEpisode) {
  return {
    episode_slug: episode.slug,
    season: episode.season,
    episode_number: episode.episodeNumber,
    video_provider: episode.video?.provider ?? ("none" as const),
  };
}

function HomeConversationsFeatureCard({
  episode,
}: {
  episode: ConversationEpisode;
}) {
  const reducedMotion = useReducedMotion();
  const href = episodePath(episode.slug);
  const seriesLabel = formatEpisodeLabel(episode);
  const poster = (episode.poster || episode.thumbnail || "").trim();

  return (
    <RevealOnScroll
      as="section"
      className="border-b border-[#e4dbcf]/60 py-[64px] md:py-[88px] lg:py-[104px]"
      data-hourglass-home="conversations-feature"
    >
      <div className="grid items-center gap-10 md:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] md:gap-12 lg:gap-16">
        <Link
          href={href}
          aria-label={`Watch the Conversation: ${episode.title}`}
          data-conversations-home-episode={episode.slug}
          onClick={() =>
            trackConversationDiscoverabilityClicked({
              ...analyticsBase(episode),
              destination_path: href,
            })
          }
          className={[
            "group relative block aspect-[16/9] w-full overflow-hidden rounded-[22px] border border-[#e4dbcf] bg-[#1c1a18]",
            "shadow-[0_14px_40px_rgba(49,38,29,0.08)]",
            "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-hg-focus",
            reducedMotion ? "" : "transition-transform duration-700 hover:-translate-y-0.5",
          ].join(" ")}
        >
          {poster ? (
            // eslint-disable-next-line @next/next/no-img-element -- poster may be remote YouTube thumbnail
            <img
              src={poster}
              alt=""
              width={1280}
              height={720}
              className={[
                "absolute inset-0 h-full w-full object-cover",
                reducedMotion
                  ? ""
                  : "transition-transform duration-700 group-hover:scale-[1.015]",
              ].join(" ")}
              decoding="async"
              loading="lazy"
            />
          ) : null}
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

        <div className="max-w-[28rem] md:pt-1 lg:pt-2">
          <p className="text-[10px] uppercase tracking-[0.34em] text-[#8a8177]">
            Hourglass Conversations
          </p>
          {seriesLabel ? (
            <p className="mt-3 text-[0.78rem] tracking-[0.04em] text-[#8a8177]">
              {seriesLabel}
            </p>
          ) : null}

          <h2
            className="mt-4 text-[1.65rem] font-light leading-[1.14] tracking-[-0.022em] text-[#1f1d1a] md:mt-5 md:text-[1.95rem] lg:text-[2.15rem]"
            style={{ textWrap: "balance" }}
          >
            <Link
              href={href}
              className="no-underline transition-colors hover:text-[#3a332c] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-hg-focus"
              onClick={() =>
                trackConversationDiscoverabilityClicked({
                  ...analyticsBase(episode),
                  destination_path: href,
                })
              }
            >
              {episode.title}
            </Link>
          </h2>

          <p className="mt-5 text-[1.02rem] leading-[1.85] text-[#615a53]">
            {episode.summary}
          </p>

          <div className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-6">
            <Link
              href={href}
              className={WATCH_CTA_CLASS}
              onClick={() =>
                trackConversationDiscoverabilityClicked({
                  ...analyticsBase(episode),
                  destination_path: href,
                })
              }
            >
              Watch the Conversation
            </Link>
            <Link
              href="/conversations"
              className={SERIES_LINK_CLASS}
              data-conversations-home-series="true"
              onClick={() =>
                trackConversationDiscoverabilityClicked({
                  ...analyticsBase(episode),
                  destination_path: "/conversations",
                })
              }
            >
              Explore all Conversations →
            </Link>
          </div>
        </div>
      </div>
    </RevealOnScroll>
  );
}

/**
 * Restrained homepage editorial feature for the latest published Conversation.
 * Renders nothing when the registry has no publicly eligible episode.
 */
export default function HomeConversationsFeature() {
  const episode = getLatestPublishedEpisode();
  if (!episode) return null;
  return <HomeConversationsFeatureCard episode={episode} />;
}
