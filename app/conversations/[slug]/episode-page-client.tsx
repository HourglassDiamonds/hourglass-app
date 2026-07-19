"use client";

import Link from "next/link";
import ConsultationCtaLink from "@/app/shared-components/ConsultationCtaLink";
import Header from "@/app/shared-components/Header";
import RevealOnScroll from "@/app/shared-components/motion/RevealOnScroll";
import {
  buildConversationConciergeHref,
  trackConversationConciergeClicked,
  trackConversationRelatedResourceClicked,
} from "@/lib/conversations/analytics";
import type { ConversationEpisode } from "@/lib/conversations/episodes";
import {
  formatEpisodeLabel,
  formatPublishedDate,
} from "@/lib/conversations/episodes";
import HourglassVideoPlayer from "../components/HourglassVideoPlayer";

type EpisodePageClientProps = {
  episode: ConversationEpisode;
};

function RelatedResourceCard({
  episode,
  link,
}: {
  episode: ConversationEpisode;
  link: NonNullable<
    ConversationEpisode["relatedArticle"] | ConversationEpisode["relatedTool"]
  >;
}) {
  return (
    <Link
      href={link.href}
      aria-label={`${link.eyebrow}: ${link.title}`}
      className="group block min-h-11 border-t border-[#e4dbcf] py-7 no-underline transition-colors first:border-t-0 md:border-t-0 md:border-l md:border-[#e4dbcf] md:px-8 md:py-3 first:md:border-l-0 first:md:pl-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-hg-focus"
      onClick={() => {
        trackConversationRelatedResourceClicked({
          episode_slug: episode.slug,
          season: episode.season,
          episode_number: episode.episodeNumber,
          video_provider: episode.video?.provider ?? "none",
          destination_type: link.destinationType,
          destination_path: link.href,
        });
      }}
    >
      <p className="text-[10px] uppercase tracking-[0.3em] text-[#8a8177]">
        {link.eyebrow}
      </p>
      <h3 className="mt-3 font-serif text-[1.2rem] font-normal tracking-[-0.02em] text-[#1f1d1a] underline decoration-transparent underline-offset-[0.35em] transition-[color,text-decoration-color] duration-300 group-hover:decoration-[#cbbda9]/85">
        {link.title}
        <span
          aria-hidden
          className="ml-1.5 inline-block text-[0.85em] text-[#ad9164]/80 transition-transform duration-300 group-hover:translate-x-0.5"
        >
          →
        </span>
      </h3>
      {link.description ? (
        <p className="mt-3 max-w-[34ch] text-[0.95rem] leading-[1.75] text-[#6a635c]">
          {link.description}
        </p>
      ) : null}
    </Link>
  );
}

export default function EpisodePageClient({ episode }: EpisodePageClientProps) {
  const episodeLabel = formatEpisodeLabel(episode);
  const publishedLabel = formatPublishedDate(episode.publishedAt);
  const related = [episode.relatedArticle, episode.relatedTool].filter(
    Boolean,
  ) as NonNullable<
    ConversationEpisode["relatedArticle"] | ConversationEpisode["relatedTool"]
  >[];
  const conciergeHref = buildConversationConciergeHref(episode.slug);
  const ctaLocation = `conversations:${episode.slug}:footer`;

  return (
    <div className="relative z-0 -mb-20 min-h-screen bg-[#efe8de] pb-6 text-[#1c1b1a] [background:radial-gradient(circle_at_top,rgba(255,255,255,0.42),transparent_36rem),linear-gradient(180deg,#efe8de,#ebe3d8)] md:-mb-24 md:pb-8">
      <div className="mx-auto max-w-[1200px] px-6 md:px-10">
        <Header />

        <article>
          <header className="border-b border-[#e4dbcf] pb-[56px] pt-[56px] md:pb-[72px] md:pt-[72px]">
            <div className="mx-auto max-w-[760px] text-center">
              <p className="text-[10px] uppercase tracking-[0.34em] text-[#8a8177]">
                {episode.eyebrow}
              </p>
              {episodeLabel || episode.topicLabel ? (
                <p className="mt-4 text-[0.78rem] tracking-[0.04em] text-[#756b61]">
                  {[episodeLabel, episode.topicLabel].filter(Boolean).join(" · ")}
                </p>
              ) : null}
              {episode.status === "draft" ? (
                <p className="mt-4 text-[10px] uppercase tracking-[0.28em] text-[#8a8177]">
                  Draft preview — local review only
                </p>
              ) : null}
              <h1
                className="mt-5 text-[2.15rem] font-light leading-[1.08] tracking-[-0.03em] text-[#1f1d1a] md:text-[3.05rem]"
                style={{ textWrap: "balance" }}
              >
                {episode.title}
              </h1>
              <p className="mx-auto mt-6 max-w-[40rem] text-[1.05rem] leading-[1.85] text-[#615a53]">
                {episode.summary}
              </p>
              <div className="mt-7 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[0.8rem] tracking-[0.02em] text-[#8a8177]">
                {publishedLabel ? <span>{publishedLabel}</span> : null}
                {publishedLabel && episode.durationLabel ? (
                  <span aria-hidden>·</span>
                ) : null}
                {episode.durationLabel ? (
                  <span>{episode.durationLabel}</span>
                ) : null}
              </div>
            </div>
          </header>

          <section className="border-b border-[#e4dbcf] py-[48px] md:py-[64px]">
            <div className="mx-auto max-w-[1040px]">
              <HourglassVideoPlayer episode={episode} />
            </div>
          </section>

          <RevealOnScroll
            as="section"
            className="border-b border-[#e4dbcf] py-[72px] md:py-[96px]"
          >
            <div className="mx-auto max-w-[680px]">
              <p className="text-[10px] uppercase tracking-[0.34em] text-[#8a8177]">
                The Central Idea
              </p>
              <p
                className="mt-5 font-serif text-[1.35rem] font-normal leading-[1.55] tracking-[-0.015em] text-[#2f2b27] md:text-[1.55rem]"
                style={{ textWrap: "pretty" }}
              >
                {episode.centralIdea}
              </p>
            </div>
          </RevealOnScroll>

          <RevealOnScroll
            as="section"
            className="border-b border-[#e4dbcf] py-[72px] md:py-[96px]"
          >
            <div className="mx-auto max-w-[880px]">
              <p className="text-center text-[10px] uppercase tracking-[0.34em] text-[#8a8177]">
                Three Key Ideas
              </p>
              <ol className="mt-12 space-y-0">
                {episode.keyIdeas.map((idea, index) => (
                  <li
                    key={idea.title}
                    className="grid gap-4 border-t border-[#e4dbcf] py-9 md:grid-cols-[4.5rem_1fr] md:gap-10 md:py-10"
                  >
                    <span className="text-[11px] uppercase tracking-[0.28em] text-[#ad9164]">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <h2 className="font-serif text-[1.28rem] font-normal tracking-[-0.02em] text-[#1f1d1a] md:text-[1.4rem]">
                        {idea.title}
                      </h2>
                      <p className="mt-3 max-w-[46rem] text-[1rem] leading-[1.85] text-[#615a53]">
                        {idea.body}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </RevealOnScroll>

          <RevealOnScroll
            as="section"
            className="border-b border-[#e4dbcf] py-[72px] md:py-[96px]"
          >
            <div className="mx-auto max-w-[680px]">
              <p className="text-[10px] uppercase tracking-[0.34em] text-[#8a8177]">
                Transcript
              </p>
              <h2
                className="mt-4 text-[1.55rem] font-light tracking-[-0.02em] text-[#1f1d1a] md:text-[1.85rem]"
                style={{ textWrap: "balance" }}
              >
                The conversation, written.
              </h2>
              <div className="mt-10">
                {episode.transcript.map((section, index) => (
                  <section
                    key={section.heading ?? `section-${index}`}
                    className={index === 0 ? undefined : "mt-12 md:mt-14"}
                  >
                    {section.heading ? (
                      <h3 className="font-serif text-[1.15rem] font-medium tracking-[-0.015em] text-[#1f1d1a]">
                        {section.heading}
                      </h3>
                    ) : null}
                    <div
                      className={
                        section.heading ? "mt-3.5 space-y-5" : "space-y-5"
                      }
                    >
                      {section.paragraphs.map((paragraph) => (
                        <p
                          key={paragraph.slice(0, 48)}
                          className="text-[1.02rem] leading-[1.9] text-[#4f4942]"
                        >
                          {paragraph}
                        </p>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </div>
          </RevealOnScroll>

          {related.length > 0 ? (
            <RevealOnScroll
              as="section"
              className="border-b border-[#e4dbcf] py-[72px] md:py-[88px]"
            >
              <div className="mx-auto max-w-[880px]">
                <p className="text-center text-[10px] uppercase tracking-[0.34em] text-[#8a8177]">
                  Continue Exploring
                </p>
                <div className="mt-10 grid md:grid-cols-2">
                  {related.map((link) => (
                    <RelatedResourceCard
                      key={link.href}
                      episode={episode}
                      link={link}
                    />
                  ))}
                </div>
              </div>
            </RevealOnScroll>
          ) : null}

          <RevealOnScroll as="section" className="py-[56px] md:py-[72px]">
            <div className="mx-auto max-w-[720px] rounded-[24px] border border-[#e0d8cc]/75 bg-[#f9f6f1]/80 px-6 py-10 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] sm:px-8 md:px-10 md:py-12">
              <h2
                className="mx-auto max-w-[22ch] text-[1.55rem] font-light leading-[1.14] tracking-[-0.02em] text-[#1f1d1a] md:text-[1.9rem]"
                style={{ textWrap: "balance" }}
              >
                Carry the conversation forward.
              </h2>
              <p className="mx-auto mt-5 max-w-[34rem] text-[0.98rem] leading-[1.85] text-[#6a635c]">
                If something here clarified a decision you are already weighing,
                a private conversation is available — without hurry, and without
                catalogue noise.
              </p>
              <div className="mt-8 flex justify-center">
                <ConsultationCtaLink
                  glimmer
                  href={conciergeHref}
                  location={ctaLocation}
                  className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#4a4540]/55 bg-transparent px-7 py-3 text-[10px] uppercase tracking-[0.3em] text-[#3d3834] transition-all duration-500 ease-out hover:border-[#2b2723] hover:bg-[#2b2723] hover:text-[#faf7f3] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-hg-focus"
                  onClick={() => {
                    trackConversationConciergeClicked({
                      episode_slug: episode.slug,
                      season: episode.season,
                      episode_number: episode.episodeNumber,
                      video_provider: episode.video?.provider ?? "none",
                    });
                  }}
                >
                  Begin the Conversation
                </ConsultationCtaLink>
              </div>
            </div>
          </RevealOnScroll>
        </article>
      </div>
    </div>
  );
}
