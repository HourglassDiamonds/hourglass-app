/**
 * Central episode content model for Hourglass Conversations.
 * Edit episode records here when publishing — no page redesign required.
 *
 * Operator guide: docs/conversations-publishing.md
 */

import {
  buildYouTubeThumbnailUrl,
  isValidYouTubeVideoId,
} from "./youtube";

export type ConversationPublishStatus = "draft" | "published";

export type ConversationVideoProvider = "mux" | "file" | "youtube";

export type ConversationCaptionTrack = {
  src: string;
  label: string;
  srclang: string;
  default?: boolean;
};

export type ConversationVideoSource = {
  provider: ConversationVideoProvider;
  /** Mux playback ID — public, not a secret. */
  playbackId?: string;
  /** Direct CDN or Cloudinary MP4/HLS URL for provider "file". */
  src?: string;
  /**
   * YouTube video ID (11 characters). Public, not a secret.
   * Prefer privacy-enhanced embeds via `buildYouTubeEmbedUrl`.
   */
  youtubeVideoId?: string;
  /** Optional poster override (falls back to episode.poster). */
  poster?: string;
  captions?: ConversationCaptionTrack[];
};

export type ConversationKeyIdea = {
  title: string;
  body: string;
};

export type ConversationTranscriptSection = {
  /** Optional chapter label shown as a heading. */
  heading?: string;
  paragraphs: string[];
};

export type ConversationRelatedLink = {
  title: string;
  href: string;
  /** Short label shown above the title (e.g. "Diamond Guide"). */
  eyebrow: string;
  description?: string;
  destinationType: "article" | "tool";
};

export type ConversationEpisode = {
  slug: string;
  status: ConversationPublishStatus;
  title: string;
  eyebrow: string;
  summary: string;
  centralIdea: string;
  season?: number;
  episodeNumber?: number;
  topicLabel?: string;
  publishedAt?: string;
  durationLabel: string;
  durationIso?: string;
  poster: string;
  thumbnail?: string;
  video?: ConversationVideoSource;
  captions?: ConversationCaptionTrack[];
  keyIdeas: ConversationKeyIdea[];
  transcript: ConversationTranscriptSection[];
  relatedArticle?: ConversationRelatedLink;
  relatedTool?: ConversationRelatedLink;
  seoTitle?: string;
  seoDescription?: string;
  openGraphImage?: string;
};

/**
 * All known episodes. Prefer `getPublishedEpisodes()` / `getEpisodeBySlug()`
 * for runtime listing and route resolution.
 */
/** Production YouTube video ID for Conversations 01 — verified live upload. */
export const WHY_WE_RE_HERE_YOUTUBE_VIDEO_ID = "8glfuhElhnA";

const WHY_WE_RE_HERE_YOUTUBE_THUMBNAIL = buildYouTubeThumbnailUrl(
  WHY_WE_RE_HERE_YOUTUBE_VIDEO_ID,
);

export const CONVERSATION_EPISODES: ConversationEpisode[] = [
  {
    slug: "why-we-re-here",
    status: "published",
    title: "Why Diamond Buying Should Still Feel Human",
    eyebrow: "Conversations",
    summary:
      "A long-form Hourglass conversation on why diamond buying should still feel human — slower guidance, clearer judgment, and technology that serves the decision rather than replacing it.",
    centralIdea:
      "An engagement decision still lives in the physical world — on the hand, in the light, and in the quiet confidence of knowing why a choice was made. Technology can sharpen that judgment. It should never replace it.",
    season: 1,
    episodeNumber: 1,
    topicLabel: "The House",
    // Verified from the live YouTube upload (2026-07-21T21:00:10-07:00).
    publishedAt: "2026-07-21",
    // Verified from YouTube lengthSeconds=702 (~11m 42s).
    durationLabel: "About 12 min",
    durationIso: "PT11M42S",
    poster: WHY_WE_RE_HERE_YOUTUBE_THUMBNAIL,
    thumbnail: WHY_WE_RE_HERE_YOUTUBE_THUMBNAIL,
    openGraphImage: WHY_WE_RE_HERE_YOUTUBE_THUMBNAIL,
    video: {
      provider: "youtube",
      youtubeVideoId: WHY_WE_RE_HERE_YOUTUBE_VIDEO_ID,
    },
    keyIdeas: [
      {
        title: "An engagement is still an analog moment",
        body: "Certificates, screens, and comparisons matter — but the decision settles in person, under real light, on a real hand.",
      },
      {
        title: "More access does not automatically create more clarity",
        body: "The internet expanded what anyone can find. It did not automatically teach what is worth keeping, refining, or politely leaving behind.",
      },
      {
        title: "Technology should support human judgment",
        body: "Studios and tools can reveal proportion, coverage, and light. The final read still belongs to a trained eye and a calm conversation.",
      },
    ],
    // Full on-page transcript deferred — YouTube captions cover playback for launch.
    transcript: [],
    relatedArticle: {
      title: "Why Work With a Graduate Gemologist?",
      href: "/diamond-guide/why-work-with-a-graduate-gemologist",
      eyebrow: "Diamond Guide",
      description: "What gemological training changes about guidance, not just vocabulary.",
      destinationType: "article",
    },
    relatedTool: {
      title: "Analyze Sparkle",
      href: "/diamond-intelligence",
      eyebrow: "Diamond Studio",
      description:
        "Upload a grading report and read light performance through Hourglass standards.",
      destinationType: "tool",
    },
    seoTitle: "Why Diamond Buying Should Still Feel Human",
    seoDescription:
      "Watch Hourglass Conversations 01 with Justin Smith — why diamond buying should still feel human, and how thoughtful guidance shapes clearer engagement decisions.",
  },
];

export function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === "production";
}

/** Episodes safe for public listings, sitemap, and indexation. */
export function getPublishedEpisodes(): ConversationEpisode[] {
  return CONVERSATION_EPISODES.filter(episodeIsPubliclyEligible).sort(
    compareEpisodesNewestFirst,
  );
}

/**
 * Episodes visible on the hub for the current runtime.
 * Production: published only. Local/dev: published + draft (for design review).
 */
export function getListableEpisodes(
  options: { includeDrafts?: boolean } = {},
): ConversationEpisode[] {
  const includeDrafts =
    options.includeDrafts ?? !isProductionRuntime();
  const episodes = CONVERSATION_EPISODES.filter((episode) => {
    if (episode.status === "draft") {
      return includeDrafts;
    }
    return episodeIsPubliclyEligible(episode);
  });
  return episodes.sort(compareEpisodesNewestFirst);
}

export function getEpisodeBySlug(
  slug: string,
): ConversationEpisode | undefined {
  return CONVERSATION_EPISODES.find((episode) => episode.slug === slug);
}

/**
 * Resolve an episode for route rendering.
 * Returns null when the episode is missing, or when a draft is requested in production.
 */
export function resolveEpisodeForRequest(
  slug: string,
  options: { allowDrafts?: boolean } = {},
): ConversationEpisode | null {
  const episode = getEpisodeBySlug(slug);
  if (!episode) return null;

  const allowDrafts = options.allowDrafts ?? !isProductionRuntime();
  if (episode.status === "draft" && !allowDrafts) {
    return null;
  }

  // Incomplete published records are not publicly renderable.
  if (
    episode.status === "published" &&
    !episodeIsPubliclyEligible(episode)
  ) {
    return null;
  }

  return episode;
}

export function hasPublishedConversations(): boolean {
  return getPublishedEpisodes().length > 0;
}

/** True when the hub should be publicly available (published inventory exists). */
export function isConversationsHubPublic(): boolean {
  return hasPublishedConversations();
}

export function episodePath(slug: string): string {
  return `/conversations/${slug}`;
}

export function episodeHasPlayableVideo(
  episode: ConversationEpisode,
): boolean {
  const video = episode.video;
  if (!video) return false;
  if (video.provider === "mux") {
    return Boolean(video.playbackId?.trim());
  }
  if (video.provider === "file") {
    return Boolean(video.src?.trim());
  }
  if (video.provider === "youtube") {
    return isValidYouTubeVideoId(video.youtubeVideoId);
  }
  return false;
}

/**
 * Temporary “master not ready” note — draft/preview without playable media only.
 * Published episodes never show it; playable drafts hide it automatically.
 */
export function shouldShowTemporaryPlaybackNote(
  episode: ConversationEpisode,
): boolean {
  return episode.status === "draft" && !episodeHasPlayableVideo(episode);
}

function hasValidIsoDuration(value: string | undefined): boolean {
  if (!value?.trim()) return false;
  return /^PT(?:\d+H)?(?:\d+M)?(?:\d+S)?$/i.test(value.trim());
}

/** Reject draft/placeholder transcript copy before publication. */
export function episodeHasPublishableTranscript(
  episode: ConversationEpisode,
): boolean {
  const paragraphs = episode.transcript.flatMap((section) => section.paragraphs);
  if (paragraphs.length === 0) return false;

  const joined = paragraphs.join("\n").trim();
  if (!joined) return false;

  const lower = joined.toLowerCase();
  if (lower.includes("draft transcript")) return false;
  if (lower.includes("for typography and rhythm review only")) return false;
  if (lower.includes("temporary transcript")) return false;
  if (lower.includes("placeholder body for layout qa")) return false;

  return true;
}

/**
 * True when the episode page should render the transcript block.
 * Empty or draft-marker transcripts stay hidden.
 */
export function shouldRenderEpisodeTranscript(
  episode: ConversationEpisode,
): boolean {
  return episodeHasPublishableTranscript(episode);
}

/**
 * Production eligibility: published records must carry complete episode fields
 * plus playable media. Incomplete published records stay out of hub/sitemap/routes.
 *
 * On-page transcript is optional for launch (YouTube captions may cover playback).
 * When a transcript is present, it must be publishable — draft markers block release.
 */
export function episodeIsPubliclyEligible(
  episode: ConversationEpisode,
): boolean {
  if (episode.status !== "published") return false;
  if (!episode.slug?.trim()) return false;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(episode.slug.trim())) return false;
  if (!episode.title?.trim()) return false;

  const description = (episode.seoDescription ?? episode.summary)?.trim();
  if (!description) return false;

  if (!episode.publishedAt?.trim()) return false;
  if (Number.isNaN(Date.parse(episode.publishedAt))) return false;

  if (!episode.durationLabel?.trim()) return false;
  if (!hasValidIsoDuration(episode.durationIso)) return false;

  const poster = (episode.poster ?? episode.thumbnail)?.trim();
  if (!poster) return false;

  if (!episodeHasPlayableVideo(episode)) return false;

  const hasTranscriptCopy = episode.transcript.some(
    (section) => section.paragraphs.some((paragraph) => paragraph.trim()),
  );
  if (hasTranscriptCopy && !episodeHasPublishableTranscript(episode)) {
    return false;
  }

  return true;
}

export function formatEpisodeLabel(episode: ConversationEpisode): string | null {
  if (episode.episodeNumber != null) {
    return `Hourglass Conversations ${String(episode.episodeNumber).padStart(2, "0")}`;
  }
  return null;
}

export function formatPublishedDate(publishedAt?: string): string | null {
  if (!publishedAt) return null;
  const date = new Date(`${publishedAt}T12:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function compareEpisodesNewestFirst(
  a: ConversationEpisode,
  b: ConversationEpisode,
): number {
  const aTime = a.publishedAt ? Date.parse(a.publishedAt) : 0;
  const bTime = b.publishedAt ? Date.parse(b.publishedAt) : 0;
  if (bTime !== aTime) return bTime - aTime;
  return (b.episodeNumber ?? 0) - (a.episodeNumber ?? 0);
}
