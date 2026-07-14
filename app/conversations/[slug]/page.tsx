import type { Metadata } from "next";
import { notFound } from "next/navigation";
import JsonLd from "@/app/shared-components/JsonLd";
import {
  episodeIsPubliclyEligible,
  getEpisodeBySlug,
  isProductionRuntime,
  resolveEpisodeForRequest,
} from "@/lib/conversations/episodes";
import {
  conversationEpisodeMetadata,
  conversationUnavailableMetadata,
} from "@/lib/seo/conversations-metadata";
import { buildConversationEpisodeJsonLd } from "@/lib/seo/schema/conversations";
import EpisodePageClient from "./episode-page-client";

type EpisodePageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export async function generateMetadata({
  params,
}: EpisodePageProps): Promise<Metadata> {
  const { slug } = await params;
  const episode = getEpisodeBySlug(slug);
  if (!episode) {
    return conversationUnavailableMetadata();
  }

  // Public episode metadata only for production-eligible records.
  // Incomplete published records and production draft hits stay unavailable
  // (no temporary poster / social cards on 404 surfaces).
  if (episodeIsPubliclyEligible(episode)) {
    return conversationEpisodeMetadata(episode);
  }

  // Local draft preview keeps noindex episode metadata for design review.
  if (episode.status === "draft" && !isProductionRuntime()) {
    return conversationEpisodeMetadata(episode);
  }

  return conversationUnavailableMetadata();
}

export default async function ConversationEpisodePage({
  params,
}: EpisodePageProps) {
  const { slug } = await params;
  const episode = resolveEpisodeForRequest(slug);

  if (!episode) {
    notFound();
  }

  return (
    <>
      {episodeIsPubliclyEligible(episode) ? (
        <JsonLd data={buildConversationEpisodeJsonLd(episode)} />
      ) : null}
      <EpisodePageClient episode={episode} />
    </>
  );
}
