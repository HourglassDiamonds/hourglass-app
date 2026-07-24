import type { ConversationEpisode } from "@/lib/conversations/episodes";
import {
  episodeHasPlayableVideo,
  episodePath,
} from "@/lib/conversations/episodes";
import {
  buildYouTubeEmbedUrl,
  buildYouTubeWatchUrl,
  normalizeYouTubeVideoId,
} from "@/lib/conversations/youtube";
import {
  absoluteUrl,
  ORGANIZATION_ID,
  PERSON_ID,
  PERSON_NAME,
  WEBSITE_ID,
} from "./constants";
import {
  buildBreadcrumbList,
  type BreadcrumbItem,
} from "./breadcrumbs";
import type { JsonLdValue } from "./json-ld";
import { jsonLdGraph } from "./json-ld";
import {
  organizationPublisherReference,
  personAuthorReference,
} from "./entities";

const HOME_CRUMB: BreadcrumbItem = { name: "Home", path: "/" };
const CONVERSATIONS_CRUMB: BreadcrumbItem = {
  name: "Conversations",
  path: "/conversations",
};

export function conversationsHubBreadcrumb(): JsonLdValue {
  return buildBreadcrumbList([HOME_CRUMB, CONVERSATIONS_CRUMB]);
}

export function conversationEpisodeBreadcrumb(input: {
  title: string;
  slug: string;
}): JsonLdValue {
  return buildBreadcrumbList([
    HOME_CRUMB,
    CONVERSATIONS_CRUMB,
    {
      name: input.title,
      path: episodePath(input.slug),
    },
  ]);
}

function muxContentUrl(playbackId: string): string {
  return `https://stream.mux.com/${playbackId}.m3u8`;
}

function muxEmbedUrl(playbackId: string): string {
  return `https://player.mux.com/${playbackId}`;
}

function resolveThumbnailUrl(episode: ConversationEpisode): string {
  const path = episode.thumbnail ?? episode.poster;
  return absoluteUrl(path);
}

/**
 * Build a VideoObject node from an episode. Omits embed/content URLs when
 * no playable video exists yet so schema stays valid.
 *
 * Does not emit incomplete playback URLs. Callers should only attach this
 * graph to publicly eligible episodes (see episode pages).
 */
export function buildConversationVideoObject(
  episode: ConversationEpisode,
): JsonLdValue {
  const pageUrl = absoluteUrl(episodePath(episode.slug));
  const node: Record<string, JsonLdValue> = {
    "@type": "VideoObject",
    "@id": `${pageUrl}#video`,
    name: episode.title,
    description: episode.seoDescription ?? episode.summary,
    thumbnailUrl: resolveThumbnailUrl(episode),
    url: pageUrl,
    mainEntityOfPage: pageUrl,
    publisher: organizationPublisherReference(),
    author: personAuthorReference(),
    creator: {
      "@type": "Person",
      "@id": PERSON_ID,
      name: PERSON_NAME,
    },
    isPartOf: {
      "@type": "WebPage",
      "@id": pageUrl,
      name: episode.title,
      url: pageUrl,
      isPartOf: { "@id": WEBSITE_ID },
    },
  };

  if (episode.publishedAt) {
    node.uploadDate = episode.publishedAt;
  }

  if (episode.durationIso) {
    node.duration = episode.durationIso;
  }

  if (episodeHasPlayableVideo(episode) && episode.video) {
    if (episode.video.provider === "mux" && episode.video.playbackId) {
      node.contentUrl = muxContentUrl(episode.video.playbackId);
      node.embedUrl = muxEmbedUrl(episode.video.playbackId);
    } else if (episode.video.provider === "file" && episode.video.src) {
      node.contentUrl = episode.video.src.startsWith("http")
        ? episode.video.src
        : absoluteUrl(episode.video.src);
    } else if (episode.video.provider === "youtube") {
      const youtubeId = normalizeYouTubeVideoId(episode.video.youtubeVideoId);
      if (youtubeId) {
        node.contentUrl = buildYouTubeWatchUrl(youtubeId);
        // Schema embed URL without autoplay — page player adds autoplay after click.
        node.embedUrl = buildYouTubeEmbedUrl(youtubeId, { autoplay: false });
      }
    }
  }

  return node;
}

export function buildConversationEpisodeJsonLd(
  episode: ConversationEpisode,
): JsonLdValue {
  return jsonLdGraph([
    buildConversationVideoObject(episode),
    conversationEpisodeBreadcrumb({
      title: episode.title,
      slug: episode.slug,
    }),
  ]);
}

export function buildConversationsHubJsonLd(): JsonLdValue {
  return jsonLdGraph([
    {
      "@type": "CollectionPage",
      name: "Conversations",
      description:
        "Long-form conversations with Justin Smith on diamonds, design, judgment, and the decisions that matter.",
      url: absoluteUrl("/conversations"),
      publisher: {
        "@type": "Organization",
        "@id": ORGANIZATION_ID,
      },
    },
    conversationsHubBreadcrumb(),
  ]);
}
