import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CONVERSATION_EPISODES } from "@/lib/conversations/episodes";
import { conversationEpisodeMetadata } from "@/lib/seo/conversations-metadata";
import {
  buildConversationEpisodeJsonLd,
  buildConversationVideoObject,
} from "@/lib/seo/schema/conversations";
import { serializeJsonLd } from "@/lib/seo/schema/json-ld";
import { getPublishedEpisodes } from "@/lib/conversations/episodes";
import { buildYouTubeEmbedUrl } from "@/lib/conversations/youtube";
import sitemap from "@/app/sitemap";
import { SITE_URL } from "@/lib/seo/site-metadata";

/** Synthetic fixture — tests only. Never ship in production episode data. */
const FIXTURE_YOUTUBE_ID = "AbCdefGh_12";

function graphTypes(data: unknown): string[] {
  if (
    typeof data !== "object" ||
    data === null ||
    !("@graph" in data) ||
    !Array.isArray((data as { "@graph": unknown[] })["@graph"])
  ) {
    const type = (data as { "@type"?: string | string[] })["@type"];
    return type ? [Array.isArray(type) ? type.join(",") : type] : [];
  }

  return (data as { "@graph": { "@type"?: string | string[] }[] })[
    "@graph"
  ].flatMap((node) => {
    const type = node["@type"];
    if (!type) return [];
    return Array.isArray(type) ? type : [type];
  });
}

describe("conversation SEO and schema", () => {
  const draft = CONVERSATION_EPISODES.find(
    (episode) => episode.slug === "why-we-re-here",
  );

  it("marks draft episode metadata as noindex with correct title and description", () => {
    assert.ok(draft);
    const metadata = conversationEpisodeMetadata(draft);
    assert.deepEqual(metadata.robots, { index: false, follow: false });
    assert.equal(metadata.title, "Why We’re Here");
    assert.ok(metadata.description?.includes("thoughtful guidance"));
    assert.equal(
      (metadata.alternates as { canonical?: string } | undefined)?.canonical,
      "/conversations/why-we-re-here",
    );
  });

  it("builds VideoObject without inventing content URLs when video is absent", () => {
    assert.ok(draft);
    const videoObject = buildConversationVideoObject(draft) as Record<
      string,
      unknown
    >;
    assert.equal(videoObject["@type"], "VideoObject");
    assert.equal(videoObject.name, draft.title);
    assert.ok(typeof videoObject.thumbnailUrl === "string");
    assert.equal("contentUrl" in videoObject, false);
    assert.equal("embedUrl" in videoObject, false);
  });

  it("emits Mux content and embed URLs when Mux playback exists", () => {
    assert.ok(draft);
    const publishedFixture = {
      ...draft,
      status: "published" as const,
      video: {
        provider: "mux" as const,
        playbackId: "abcPlaybackId",
      },
    };
    const withVideo = buildConversationVideoObject(publishedFixture) as Record<
      string,
      unknown
    >;
    assert.equal(
      withVideo.contentUrl,
      "https://stream.mux.com/abcPlaybackId.m3u8",
    );
    assert.equal(withVideo.embedUrl, "https://player.mux.com/abcPlaybackId");
  });

  it("emits YouTube watch and privacy-enhanced embed URLs without autoplay in schema", () => {
    assert.ok(draft);
    const publishedFixture = {
      ...draft,
      status: "published" as const,
      video: {
        provider: "youtube" as const,
        youtubeVideoId: FIXTURE_YOUTUBE_ID,
      },
    };
    const withVideo = buildConversationVideoObject(publishedFixture) as Record<
      string,
      unknown
    >;
    assert.equal(
      withVideo.contentUrl,
      `https://www.youtube.com/watch?v=${FIXTURE_YOUTUBE_ID}`,
    );
    assert.equal(
      withVideo.embedUrl,
      buildYouTubeEmbedUrl(FIXTURE_YOUTUBE_ID, { autoplay: false }),
    );
    assert.equal(String(withVideo.embedUrl).includes("autoplay="), false);
  });

  it("emits VideoObject and BreadcrumbList for episode graphs", () => {
    assert.ok(draft);
    const payload = buildConversationEpisodeJsonLd({
      ...draft,
      status: "published",
    });
    const types = graphTypes(payload);
    assert.ok(types.includes("VideoObject"));
    assert.ok(types.includes("BreadcrumbList"));
    assert.equal(serializeJsonLd(payload).includes("<"), false);
  });

  it("excludes draft conversations from the sitemap", () => {
    const entries = sitemap();
    const conversationUrls = entries
      .map((entry) => entry.url)
      .filter((url) => url.includes("/conversations"));

    assert.equal(getPublishedEpisodes().length, 0);
    assert.deepEqual(conversationUrls, []);
    assert.equal(
      conversationUrls.includes(`${SITE_URL}/conversations/why-we-re-here`),
      false,
    );
  });
});
