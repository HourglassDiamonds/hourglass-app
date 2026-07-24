import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  CONVERSATION_EPISODES,
  episodeHasPlayableVideo,
  episodeHasPublishableTranscript,
  episodeIsPubliclyEligible,
  episodePath,
  getListableEpisodes,
  getPublishedEpisodes,
  isConversationsHubPublic,
  resolveEpisodeForRequest,
  shouldShowTemporaryPlaybackNote,
  type ConversationEpisode,
} from "./episodes";
import { buildConversationConciergeHref } from "./analytics";

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

describe("conversation publishing rules", () => {
  it("keeps the draft preview episode out of published inventory", () => {
    const published = getPublishedEpisodes();
    assert.equal(published.length, 0);
    assert.equal(isConversationsHubPublic(), false);
    assert.ok(
      CONVERSATION_EPISODES.some(
        (episode) =>
          episode.slug === "why-we-re-here" && episode.status === "draft",
      ),
    );
  });

  it("includes drafts in local listable inventory by default", () => {
    const listable = getListableEpisodes({ includeDrafts: true });
    assert.ok(listable.some((episode) => episode.slug === "why-we-re-here"));
  });

  it("renders hub inventory with exactly one listable episode in draft preview", () => {
    const listable = getListableEpisodes({ includeDrafts: true });
    assert.equal(listable.length, 1);
    assert.equal(listable[0]?.slug, "why-we-re-here");
    assert.equal(listable[0]?.title, "Why We’re Here");
    assert.ok(listable[0]?.summary.trim().length > 0);
    assert.equal(episodePath(listable[0]!.slug), "/conversations/why-we-re-here");
  });

  it("excludes drafts from production-style listings", () => {
    const listable = getListableEpisodes({ includeDrafts: false });
    assert.equal(listable.length, 0);
  });

  it("resolves the Why We’re Here episode route when drafts are allowed", () => {
    assert.equal(
      resolveEpisodeForRequest("why-we-re-here", { allowDrafts: true })?.slug,
      "why-we-re-here",
    );
  });

  it("returns not-found behavior for missing and production-hidden drafts", () => {
    assert.equal(
      resolveEpisodeForRequest("why-we-re-here", { allowDrafts: false }),
      null,
    );
    assert.equal(
      resolveEpisodeForRequest("missing-episode", { allowDrafts: true }),
      null,
    );
  });

  it("marks the draft preview as not yet playable and shows the temporary note", () => {
    const draft = CONVERSATION_EPISODES.find(
      (episode) => episode.slug === "why-we-re-here",
    );
    assert.ok(draft);
    assert.equal(episodeHasPlayableVideo(draft), false);
    assert.equal(draft.video, undefined);
    assert.equal(shouldShowTemporaryPlaybackNote(draft), true);
    assert.equal(episodeHasPublishableTranscript(draft), false);
  });

  it("rejects incomplete published episodes from public surfaces", () => {
    const draft = CONVERSATION_EPISODES.find(
      (episode) => episode.slug === "why-we-re-here",
    );
    assert.ok(draft);
    const incompletePublished = withStatus(draft, "published");

    assert.equal(episodeIsPubliclyEligible(incompletePublished), false);
    assert.equal(
      resolveEpisodeForRequest(incompletePublished.slug, {
        allowDrafts: false,
      }),
      null,
    );
  });

  it("accepts published Mux episodes only when complete and playable", () => {
    const draft = CONVERSATION_EPISODES.find(
      (episode) => episode.slug === "why-we-re-here",
    );
    assert.ok(draft);
    const complete = withPublishableTranscript(
      withMuxPlayback(withStatus(draft, "published"), FIXTURE_MUX_ID),
    );
    assert.equal(episodeIsPubliclyEligible(complete), true);
    assert.equal(episodeHasPlayableVideo(complete), true);
  });

  it("accepts published YouTube episodes with a valid video ID and final transcript", () => {
    const draft = CONVERSATION_EPISODES.find(
      (episode) => episode.slug === "why-we-re-here",
    );
    assert.ok(draft);
    const complete = withPublishableTranscript(
      withYouTubePlayback(withStatus(draft, "published"), FIXTURE_YOUTUBE_ID),
    );
    assert.equal(episodeIsPubliclyEligible(complete), true);
    assert.equal(episodeHasPlayableVideo(complete), true);
  });

  it("rejects invalid YouTube IDs as non-playable", () => {
    const draft = CONVERSATION_EPISODES.find(
      (episode) => episode.slug === "why-we-re-here",
    );
    assert.ok(draft);
    const invalid = withYouTubePlayback(draft, "not-a-real-id");
    assert.equal(episodeHasPlayableVideo(invalid), false);
    assert.equal(
      episodeIsPubliclyEligible(
        withPublishableTranscript(withStatus(invalid, "published")),
      ),
      false,
    );
  });

  it("rejects published episodes that still use draft transcript copy", () => {
    const draft = CONVERSATION_EPISODES.find(
      (episode) => episode.slug === "why-we-re-here",
    );
    assert.ok(draft);
    const incomplete = withMuxPlayback(withStatus(draft, "published"), FIXTURE_MUX_ID);
    assert.equal(episodeIsPubliclyEligible(incomplete), false);
  });

  it("allows future episodes to be added via the registry without new routes", () => {
    const draft = CONVERSATION_EPISODES.find(
      (episode) => episode.slug === "why-we-re-here",
    );
    assert.ok(draft);
    const second: ConversationEpisode = {
      ...withPublishableTranscript(
        withYouTubePlayback(withStatus(draft, "published"), FIXTURE_YOUTUBE_ID),
      ),
      slug: "options-without-clarity",
      title: "Options Without Clarity",
      episodeNumber: 2,
      publishedAt: "2026-08-01",
    };

    assert.equal(episodePath(second.slug), "/conversations/options-without-clarity");
    assert.equal(episodeIsPubliclyEligible(second), true);
    assert.notEqual(second.slug, draft.slug);
  });
});

describe("temporary playback note", () => {
  it("shows the note for draft episodes without media", () => {
    const draft = CONVERSATION_EPISODES.find(
      (episode) => episode.slug === "why-we-re-here",
    );
    assert.ok(draft);
    assert.equal(shouldShowTemporaryPlaybackNote(draft), true);
  });

  it("hides the note when a draft gains valid media", () => {
    const draft = CONVERSATION_EPISODES.find(
      (episode) => episode.slug === "why-we-re-here",
    );
    assert.ok(draft);
    const withMedia = withYouTubePlayback(draft, FIXTURE_YOUTUBE_ID);
    assert.equal(shouldShowTemporaryPlaybackNote(withMedia), false);
    assert.equal(episodeHasPlayableVideo(withMedia), true);
  });

  it("never shows the note for published episodes", () => {
    const draft = CONVERSATION_EPISODES.find(
      (episode) => episode.slug === "why-we-re-here",
    );
    assert.ok(draft);
    const publishedIncomplete = withStatus(draft, "published");
    const publishedComplete = withMuxPlayback(
      withStatus(draft, "published"),
      FIXTURE_MUX_ID,
    );

    assert.equal(shouldShowTemporaryPlaybackNote(publishedIncomplete), false);
    assert.equal(shouldShowTemporaryPlaybackNote(publishedComplete), false);
  });
});

describe("production placeholder isolation", () => {
  it("does not treat draft transcript markers as publishable content", () => {
    const draft = CONVERSATION_EPISODES.find(
      (episode) => episode.slug === "why-we-re-here",
    );
    assert.ok(draft);
    const joined = draft.transcript
      .flatMap((section) => section.paragraphs)
      .join("\n")
      .toLowerCase();
    assert.ok(joined.includes("draft transcript"));
    assert.equal(episodeHasPublishableTranscript(draft), false);
    assert.equal(episodeIsPubliclyEligible(withStatus(draft, "published")), false);
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

describe("Concierge attribution", () => {
  it("builds Conversations-specific Concierge attribution for Why We’re Here", () => {
    const href = buildConversationConciergeHref("why-we-re-here");
    assert.equal(href, "/concierge?tool=conversations&content=why-we-re-here");
    assert.equal(href.includes("email="), false);
    assert.equal(href.includes("phone="), false);
  });
});
