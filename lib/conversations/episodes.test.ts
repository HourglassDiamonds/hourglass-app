import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  CONVERSATION_EPISODES,
  WHY_WE_RE_HERE_YOUTUBE_VIDEO_ID,
  episodeHasPlayableVideo,
  episodeHasPublishableTranscript,
  episodeIsPubliclyEligible,
  episodePath,
  formatEpisodeLabel,
  getListableEpisodes,
  getPublishedEpisodes,
  isConversationsHubPublic,
  resolveEpisodeForRequest,
  shouldRenderEpisodeTranscript,
  shouldShowTemporaryPlaybackNote,
  type ConversationEpisode,
} from "./episodes";
import { buildConversationConciergeHref } from "./analytics";
import {
  buildYouTubeEmbedUrl,
  buildYouTubeIframeTitle,
  buildYouTubeThumbnailUrl,
} from "./youtube";

/** Synthetic fixture — tests only. Never ship in production episode data. */
const FIXTURE_YOUTUBE_ID = "AbCdefGh_12";
const FIXTURE_MUX_ID = "testMuxPlayback01";

function withStatus(
  episode: ConversationEpisode,
  status: ConversationEpisode["status"],
): ConversationEpisode {
  return { ...episode, status };
}

function withMuxPlayback(
  episode: ConversationEpisode,
  playbackId: string,
): ConversationEpisode {
  return {
    ...episode,
    video: {
      provider: "mux",
      playbackId,
    },
  };
}

function withYouTubePlayback(
  episode: ConversationEpisode,
  youtubeVideoId: string,
): ConversationEpisode {
  return {
    ...episode,
    video: {
      provider: "youtube",
      youtubeVideoId,
    },
  };
}

function withPublishableTranscript(
  episode: ConversationEpisode,
): ConversationEpisode {
  return {
    ...episode,
    transcript: [
      {
        heading: "Opening",
        paragraphs: [
          "An engagement decision still lives in the physical world.",
          "Technology can sharpen judgment without replacing it.",
        ],
      },
    ],
  };
}

function withDraftTranscript(
  episode: ConversationEpisode,
): ConversationEpisode {
  return {
    ...episode,
    transcript: [
      {
        heading: "Opening",
        paragraphs: [
          "Draft transcript — for typography and rhythm review only.",
        ],
      },
    ],
  };
}

describe("published Why We’re Here episode", () => {
  const episode = CONVERSATION_EPISODES.find(
    (item) => item.slug === "why-we-re-here",
  );

  it("uses the real production YouTube ID and published status", () => {
    assert.ok(episode);
    assert.equal(WHY_WE_RE_HERE_YOUTUBE_VIDEO_ID, "8glfuhElhnA");
    assert.equal(episode.status, "published");
    assert.equal(episode.video?.provider, "youtube");
    assert.equal(episode.video?.youtubeVideoId, "8glfuhElhnA");
    assert.equal(episode.title, "Why Diamond Buying Should Still Feel Human");
    assert.equal(episode.seoTitle, "Why Diamond Buying Should Still Feel Human");
    assert.equal(formatEpisodeLabel(episode), "Hourglass Conversations 01");
  });

  it("renders on the publicly listable hub inventory", () => {
    assert.ok(episode);
    const published = getPublishedEpisodes();
    assert.equal(published.length, 1);
    assert.equal(published[0]?.slug, "why-we-re-here");
    assert.equal(isConversationsHubPublic(), true);

    const listable = getListableEpisodes({ includeDrafts: false });
    assert.equal(listable.length, 1);
    assert.equal(listable[0]?.title, "Why Diamond Buying Should Still Feel Human");
    assert.equal(episodePath(listable[0]!.slug), "/conversations/why-we-re-here");
  });

  it("resolves the episode route in production-style requests", () => {
    assert.equal(
      resolveEpisodeForRequest("why-we-re-here", { allowDrafts: false })?.slug,
      "why-we-re-here",
    );
    assert.equal(
      resolveEpisodeForRequest("missing-episode", { allowDrafts: false }),
      null,
    );
  });

  it("is playable with no temporary missing-video note", () => {
    assert.ok(episode);
    assert.equal(episodeIsPubliclyEligible(episode), true);
    assert.equal(episodeHasPlayableVideo(episode), true);
    assert.equal(shouldShowTemporaryPlaybackNote(episode), false);
  });

  it("uses the verified YouTube thumbnail as poster", () => {
    assert.ok(episode);
    const expected = buildYouTubeThumbnailUrl("8glfuhElhnA");
    assert.equal(episode.poster, expected);
    assert.equal(episode.thumbnail, expected);
    assert.equal(episode.openGraphImage, expected);
  });

  it("omits on-page transcript so draft markers never render", () => {
    assert.ok(episode);
    assert.deepEqual(episode.transcript, []);
    assert.equal(episodeHasPublishableTranscript(episode), false);
    assert.equal(shouldRenderEpisodeTranscript(episode), false);
    const joined = episode.transcript
      .flatMap((section) => section.paragraphs)
      .join("\n")
      .toLowerCase();
    assert.equal(joined.includes("draft transcript"), false);
  });

  it("keeps Concierge attribution on the stable slug", () => {
    assert.equal(
      buildConversationConciergeHref("why-we-re-here"),
      "/concierge?tool=conversations&content=why-we-re-here",
    );
  });
});

describe("conversation publishing rules", () => {
  it("rejects incomplete published episodes from public surfaces", () => {
    const base = CONVERSATION_EPISODES.find(
      (episode) => episode.slug === "why-we-re-here",
    );
    assert.ok(base);
    const incompletePublished = {
      ...base,
      video: undefined,
    };

    assert.equal(episodeIsPubliclyEligible(incompletePublished), false);
  });

  it("accepts published Mux episodes when complete and playable", () => {
    const base = CONVERSATION_EPISODES.find(
      (episode) => episode.slug === "why-we-re-here",
    );
    assert.ok(base);
    const complete = withPublishableTranscript(
      withMuxPlayback(withStatus(base, "published"), FIXTURE_MUX_ID),
    );
    assert.equal(episodeIsPubliclyEligible(complete), true);
    assert.equal(episodeHasPlayableVideo(complete), true);
  });

  it("accepts published YouTube episodes with empty transcript for launch", () => {
    const base = CONVERSATION_EPISODES.find(
      (episode) => episode.slug === "why-we-re-here",
    );
    assert.ok(base);
    const complete = {
      ...withYouTubePlayback(withStatus(base, "published"), FIXTURE_YOUTUBE_ID),
      transcript: [],
    };
    assert.equal(episodeIsPubliclyEligible(complete), true);
    assert.equal(shouldRenderEpisodeTranscript(complete), false);
  });

  it("rejects invalid YouTube IDs as non-playable", () => {
    const base = CONVERSATION_EPISODES.find(
      (episode) => episode.slug === "why-we-re-here",
    );
    assert.ok(base);
    const invalid = withYouTubePlayback(base, "not-a-real-id");
    assert.equal(episodeHasPlayableVideo(invalid), false);
    assert.equal(episodeIsPubliclyEligible(invalid), false);
  });

  it("rejects published episodes that still use draft transcript copy", () => {
    const base = CONVERSATION_EPISODES.find(
      (episode) => episode.slug === "why-we-re-here",
    );
    assert.ok(base);
    const incomplete = withDraftTranscript(base);
    assert.equal(episodeIsPubliclyEligible(incomplete), false);
    assert.equal(shouldRenderEpisodeTranscript(incomplete), false);
  });

  it("allows future episodes to be added via the registry without new routes", () => {
    const base = CONVERSATION_EPISODES.find(
      (episode) => episode.slug === "why-we-re-here",
    );
    assert.ok(base);
    const second: ConversationEpisode = {
      ...withYouTubePlayback(withStatus(base, "published"), FIXTURE_YOUTUBE_ID),
      slug: "options-without-clarity",
      title: "Options Without Clarity",
      episodeNumber: 2,
      publishedAt: "2026-08-01",
      transcript: [],
    };

    assert.equal(episodePath(second.slug), "/conversations/options-without-clarity");
    assert.equal(episodeIsPubliclyEligible(second), true);
    assert.equal(formatEpisodeLabel(second), "Hourglass Conversations 02");
    assert.notEqual(second.slug, base.slug);
  });
});

describe("temporary playback note", () => {
  it("never shows the note for the published first episode", () => {
    const episode = CONVERSATION_EPISODES.find(
      (item) => item.slug === "why-we-re-here",
    );
    assert.ok(episode);
    assert.equal(shouldShowTemporaryPlaybackNote(episode), false);
  });

  it("shows the note only for drafts without media", () => {
    const episode = CONVERSATION_EPISODES.find(
      (item) => item.slug === "why-we-re-here",
    );
    assert.ok(episode);
    const draft = withStatus(
      {
        ...episode,
        video: undefined,
      },
      "draft",
    );
    assert.equal(shouldShowTemporaryPlaybackNote(draft), true);
  });
});

describe("YouTube embed contract for the live episode", () => {
  it("builds nocookie embeds without autoplay by default", () => {
    const url = buildYouTubeEmbedUrl("8glfuhElhnA");
    assert.equal(
      url.startsWith("https://www.youtube-nocookie.com/embed/8glfuhElhnA?"),
      true,
    );
    assert.equal(url.includes("autoplay="), false);
    assert.equal(
      buildYouTubeIframeTitle("Why Diamond Buying Should Still Feel Human"),
      "Why Diamond Buying Should Still Feel Human — Hourglass Conversations",
    );
  });
});

describe("Agent OS surfaces remain untouched by Conversations publishing gates", () => {
  it("keeps Agent OS cron paths absent from vercel.json", () => {
    const vercelPath = join(process.cwd(), "vercel.json");
    const raw = readFileSync(vercelPath, "utf8");
    const config = JSON.parse(raw) as {
      crons?: Array<{ path: string; schedule: string }>;
    };
    const paths = (config.crons ?? []).map((cron) => cron.path);
    assert.ok(paths.includes("/api/cron/weekly-intelligence"));
    assert.equal(
      paths.some((path) => path.includes("agent-os")),
      false,
    );
    assert.equal(
      paths.some((path) => path.includes("daily")),
      false,
    );
  });
});
