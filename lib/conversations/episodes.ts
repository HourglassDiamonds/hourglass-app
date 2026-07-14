/**
 * Central episode content model for Hourglass Conversations.
 * Edit episode records here when publishing — no page redesign required.
 */

export type ConversationPublishStatus = "draft" | "published";

export type ConversationVideoProvider = "mux" | "file";

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
export const CONVERSATION_EPISODES: ConversationEpisode[] = [
  {
    slug: "why-we-re-here",
    status: "draft",
    title: "Why We’re Here",
    eyebrow: "Conversations",
    summary:
      "A slower conversation about diamonds, design, and what thoughtful guidance should feel like.",
    centralIdea:
      "An engagement decision still lives in the physical world — on the hand, in the light, and in the quiet confidence of knowing why a choice was made. Technology can sharpen that judgment. It should never replace it.",
    season: 1,
    episodeNumber: 1,
    topicLabel: "The House",
    publishedAt: "2026-07-13",
    durationLabel: "About 8 min",
    durationIso: "PT8M",
    poster: "/media/conversations/why-we-re-here-poster.svg",
    thumbnail: "/media/conversations/why-we-re-here-poster.svg",
    openGraphImage: "/media/conversations/why-we-re-here-poster.svg",
    // No playback source yet — player renders a polished poster preview.
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
    transcript: [
      {
        heading: "Opening",
        paragraphs: [
          "Draft transcript — for typography and rhythm review only. Replace with the final spoken words after filming and edit.",
          "I’m Justin Smith. This conversation is about why Hourglass exists, and why a slower way of looking at diamonds and design still matters when almost everything else in the market is trying to move faster.",
        ],
      },
      {
        heading: "What the decision actually is",
        paragraphs: [
          "An engagement ring is purchased in a digital age, but it is worn in an analog one. The certificate is useful. The photograph is useful. Neither one is the ring on the hand, catching light across a dinner table, or becoming familiar through ordinary days.",
          "That is why we treat guidance as a conversation rather than a checkout flow. The goal is not to overwhelm you with every available option. The goal is to arrive at the few that will still feel clear when the noise is gone.",
        ],
      },
      {
        heading: "Clarity in a louder market",
        paragraphs: [
          "There has never been more access to diamonds, grading reports, and price comparisons. That abundance can feel like progress. It can also flatten judgment into a spreadsheet when the real question is quieter: will this stone and this design still feel right once you stop comparing?",
          "Hourglass was built for that quieter question. We use technology carefully — to show scale, to interpret light performance, to make proportions easier to understand — and then we return to human judgment.",
        ],
      },
      {
        heading: "What this series is for",
        paragraphs: [
          "These conversations are long enough to think in. They are not pitch decks. They are a record of how we see diamonds, design, craft, and the decisions that matter before metal is set and a stone becomes part of someone’s life.",
          "If you are beginning that process, you do not need more urgency. You need better information, a calmer pace, and someone willing to say when a beautiful option is still the wrong option.",
        ],
      },
    ],
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
    seoTitle: "Why We’re Here",
    seoDescription:
      "A long-form Hourglass conversation with Justin Smith on diamonds, design, judgment, and what thoughtful guidance should feel like.",
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
 * Production eligibility: published records must carry complete episode fields
 * plus playable media. Incomplete published records stay out of hub/sitemap/routes.
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
  if (!episodeHasPublishableTranscript(episode)) return false;

  return true;
}

export function formatEpisodeLabel(episode: ConversationEpisode): string | null {
  if (episode.season != null && episode.episodeNumber != null) {
    return `Season ${episode.season} · Episode ${episode.episodeNumber}`;
  }
  if (episode.episodeNumber != null) {
    return `Episode ${episode.episodeNumber}`;
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
