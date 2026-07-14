import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CONVERSATION_EPISODES,
  episodeHasPlayableVideo,
  episodeIsPubliclyEligible,
  getListableEpisodes,
  getPublishedEpisodes,
  isConversationsHubPublic,
  resolveEpisodeForRequest,
  shouldShowTemporaryPlaybackNote,
  type ConversationEpisode,
} from "./episodes";

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

  it("excludes drafts from production-style listings", () => {
    const listable = getListableEpisodes({ includeDrafts: false });
    assert.equal(listable.length, 0);
  });

  it("resolves drafts only when drafts are allowed", () => {
    assert.equal(
      resolveEpisodeForRequest("why-we-re-here", { allowDrafts: true })?.slug,
      "why-we-re-here",
    );
    assert.equal(
      resolveEpisodeForRequest("why-we-re-here", { allowDrafts: false }),
      null,
    );
    assert.equal(
      resolveEpisodeForRequest("missing-episode", { allowDrafts: true }),
      null,
    );
  });

  it("marks the draft preview as not yet playable", () => {
    const draft = CONVERSATION_EPISODES.find(
      (episode) => episode.slug === "why-we-re-here",
    );
    assert.ok(draft);
    assert.equal(episodeHasPlayableVideo(draft), false);
    assert.equal(episodeHasPlayableVideo(withStatus(draft, "published")), false);
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

  it("accepts published episodes only when complete and playable", () => {
    const draft = CONVERSATION_EPISODES.find(
      (episode) => episode.slug === "why-we-re-here",
    );
    assert.ok(draft);
    const complete: ConversationEpisode = {
      ...withMuxPlayback(withStatus(draft, "published"), "abc123"),
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
    assert.equal(episodeIsPubliclyEligible(complete), true);
    assert.equal(episodeHasPlayableVideo(complete), true);
  });

  it("rejects published episodes that still use draft transcript copy", () => {
    const draft = CONVERSATION_EPISODES.find(
      (episode) => episode.slug === "why-we-re-here",
    );
    assert.ok(draft);
    const incomplete = withMuxPlayback(withStatus(draft, "published"), "abc123");
    assert.equal(episodeIsPubliclyEligible(incomplete), false);
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
    const withMedia = withMuxPlayback(draft, "localPreviewPlayback");
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
      "pubPlayback",
    );

    assert.equal(shouldShowTemporaryPlaybackNote(publishedIncomplete), false);
    assert.equal(shouldShowTemporaryPlaybackNote(publishedComplete), false);
  });
});
