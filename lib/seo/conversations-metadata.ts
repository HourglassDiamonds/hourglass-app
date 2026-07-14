import type { Metadata } from "next";
import type { ConversationEpisode } from "@/lib/conversations/episodes";
import {
  episodeHasPlayableVideo,
  episodePath,
  isConversationsHubPublic,
} from "@/lib/conversations/episodes";
import {
  DEFAULT_OG_IMAGE,
  DEFAULT_OPEN_GRAPH,
  pageMetadata,
  SITE_URL,
} from "@/lib/seo/site-metadata";

const HUB_TITLE = "Conversations";
const HUB_DESCRIPTION =
  "Long-form conversations with Justin Smith on diamonds, design, judgment, and the decisions that matter.";

export function conversationsHubMetadata(): Metadata {
  const base = pageMetadata({
    title: HUB_TITLE,
    description: HUB_DESCRIPTION,
    path: "/conversations",
    openGraphTitle: "Conversations | Hourglass Diamonds",
  });

  // Do not index the hub until at least one episode is published.
  if (!isConversationsHubPublic()) {
    return {
      ...base,
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  return base;
}

export function conversationEpisodeMetadata(
  episode: ConversationEpisode,
): Metadata {
  const path = episodePath(episode.slug);
  const title = episode.seoTitle ?? episode.title;
  const description = episode.seoDescription ?? episode.summary;
  const openGraphTitle = `${title} | Hourglass Diamonds`;
  const imagePath =
    episode.openGraphImage ?? episode.thumbnail ?? episode.poster;
  const imageUrl = imagePath.startsWith("http")
    ? imagePath
    : imagePath.startsWith("/")
      ? imagePath
      : `/${imagePath}`;

  const ogImages = [
    {
      url: imageUrl,
      width: 1920,
      height: 1080,
      alt: `${episode.title} — Hourglass Conversations`,
    },
  ];

  const base = pageMetadata({
    title,
    description,
    path,
    openGraphTitle,
  });

  const metadata: Metadata = {
    ...base,
    openGraph: {
      ...DEFAULT_OPEN_GRAPH,
      type: episodeHasPlayableVideo(episode) ? "video.other" : "website",
      title: openGraphTitle,
      description,
      url: path,
      images: ogImages,
    },
    twitter: {
      card: "summary_large_image",
      title: openGraphTitle,
      description,
      images: [`${SITE_URL}${imageUrl.startsWith("/") ? imageUrl : `/${imageUrl}`}`],
    },
  };

  if (episode.status === "draft") {
    metadata.robots = {
      index: false,
      follow: false,
    };
  }

  return metadata;
}

export function conversationUnavailableMetadata(): Metadata {
  return {
    title: "Conversations",
    robots: {
      index: false,
      follow: false,
    },
    openGraph: {
      ...DEFAULT_OPEN_GRAPH,
      images: [DEFAULT_OG_IMAGE],
    },
  };
}
