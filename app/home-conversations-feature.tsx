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
  "inline-flex min-h-11 items-center justify-center rounded-full border border-[#d9cdbd] bg-white/80 px-6 py-2.5 text-[11px] uppercase tracking-[0.28em] text-[#6f665d] transition-all duration-500 ease-out hover:-translate-y-px hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-hg-focus";

const SERIES_LINK_CLASS =
  "hg-tap inline-flex min-h-11 items-center text-[10px] uppercase tracking-[0.28em] text-[#8a8177] transition-colors duration-300 hover:text-[#5e5852]";

function analyticsBase(episode: ConversationEpisode) {
  return {
    episode_slug: episode.slug,
    season: episode.season,
    episode_number: episode.episodeNumber,
    video_provider: episode.video?.provider ?? ("none" as const),
  };
}

/** One concise sentence from existing episode copy — never invents new prose. */
function episodeInterludeBody(episode: ConversationEpisode): string {
  const summary = episode.summary.trim();
  const emDashParts = summary.split(/\s+[—–]\s+/);
  if (
    emDashParts.length > 1 &&
    emDashParts[0].length >= 40 &&
    emDashParts[0].length <= 140
  ) {
    const lead = emDashParts[0].trim();
    return /[.!?]$/.test(lead) ? lead : `${lead}.`;
  }
  const sentence = summary.match(/^(.+?[.!?])(?:\s|$)/);
  return sentence?.[1] ?? summary;
}

function HomeConversationsFeatureCard({
  episode,
}: {
  episode: ConversationEpisode;
}) {
  const reducedMotion = useReducedMotion();
  const href = episodePath(episode.slug);
  const seriesLabel = formatEpisodeLabel(episode) ?? "Hourglass Conversations";
  const poster = (episode.poster || episode.thumbnail || "").trim();
  const body = episodeInterludeBody(episode);

  return (
    <section
      className="border-b border-[#e4dbcf]/60 py-10 md:py-14 lg:py-16"
      data-hourglass-home="conversations-feature"
    >
      <RevealOnScroll className="mx-auto max-w-[920px]">
        <div className="grid items-center gap-6 md:grid-cols-[minmax(0,18.5rem)_minmax(0,1fr)] md:gap-8 lg:grid-cols-[minmax(0,21rem)_minmax(0,1fr)] lg:gap-10">
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
              "group relative mx-auto block aspect-[16/9] w-full max-w-[22rem] overflow-hidden rounded-[16px] border border-[#e4dbcf] bg-[#1c1a18] md:mx-0 md:max-w-none",
              "shadow-[0_8px_24px_rgba(49,38,29,0.06)]",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-hg-focus",
              reducedMotion
                ? ""
                : "transition-transform duration-700 hover:-translate-y-px",
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
                    : "transition-transform duration-700 group-hover:scale-[1.01]",
                ].join(" ")}
                decoding="async"
                loading="lazy"
              />
            ) : null}
            <div
              className="absolute inset-0 bg-gradient-to-t from-[#141210]/35 via-transparent to-transparent"
              aria-hidden
            />
            <span
              className={[
                "absolute bottom-3 left-3 inline-flex h-8 w-8 items-center justify-center",
                "rounded-full border border-white/20 bg-[#1c1a18]/65",
                "transition-[background-color,border-color] duration-500",
                "group-hover:border-white/35 group-hover:bg-[#1c1a18]/8",
              ].join(" ")}
              aria-hidden
            >
              <span className="ml-0.5 inline-block h-0 w-0 border-y-[5px] border-y-transparent border-l-[8px] border-l-[#f4eee6]" />
            </span>
          </Link>

          <div className="max-w-[26rem] md:pt-0.5">
            <p className="text-[10px] uppercase tracking-[0.34em] text-[#8a8177]">
              {seriesLabel}
            </p>

            <h2
              className="mt-3 text-[1.35rem] font-light leading-[1.18] tracking-[-0.02em] text-[#1f1d1a] md:text-[1.5rem] lg:text-[1.65rem]"
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

            <p className="mt-3 max-w-[34ch] text-[0.95rem] leading-[1.75] text-[#615a53]">
              {body}
            </p>

            <div className="mt-6 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-5">
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
                View all Conversations
              </Link>
            </div>
          </div>
        </div>
      </RevealOnScroll>
    </section>
  );
}

/**
 * Quiet homepage editorial interlude for the latest published Conversation.
 * Renders nothing when the registry has no publicly eligible episode.
 */
export default function HomeConversationsFeature() {
  const episode = getLatestPublishedEpisode();
  if (!episode) return null;
  return <HomeConversationsFeatureCard episode={episode} />;
}
