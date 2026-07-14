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
import sitemap from "@/app/sitemap";
import { SITE_URL } from "@/lib/seo/site-metadata";

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

  it("marks draft episode metadata as noindex", () => {
    assert.ok(draft);
    const metadata = conversationEpisodeMetadata(draft);
    assert.deepEqual(metadata.robots, { index: false, follow: false });
    assert.equal(metadata.title, "Why We’re Here");
    assert.ok(metadata.description?.includes("thoughtful guidance"));
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
