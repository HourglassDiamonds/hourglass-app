import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CONVERSATION_EPISODES,
  getPublishedEpisodes,
} from "@/lib/conversations/episodes";
import { buildYouTubeEmbedUrl } from "@/lib/conversations/youtube";
import { conversationEpisodeMetadata } from "@/lib/seo/conversations-metadata";
import {
  buildConversationEpisodeJsonLd,
  buildConversationVideoObject,
} from "@/lib/seo/schema/conversations";
import { serializeJsonLd } from "@/lib/seo/schema/json-ld";
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
  const episode = CONVERSATION_EPISODES.find(
    (item) => item.slug === "why-we-re-here",
  );

  it("marks the published episode as indexable with aligned title metadata", () => {
    assert.ok(episode);
    const metadata = conversationEpisodeMetadata(episode);
    assert.equal(metadata.robots, undefined);
    assert.equal(metadata.title, "Why Diamond Buying Should Still Feel Human");
    assert.ok(metadata.description?.toLowerCase().includes("human"));
    assert.equal(
      (metadata.alternates as { canonical?: string } | undefined)?.canonical,
      "/conversations/why-we-re-here",
    );
    assert.equal(
      (metadata.openGraph as { images?: Array<{ url?: string }> } | undefined)
        ?.images?.[0]?.url,
      "https://i.ytimg.com/vi/8glfuhElhnA/maxresdefault.jpg",
    );
  });

  it("emits VideoObject with verified YouTube URLs and no invented fields", () => {
    assert.ok(episode);
    const videoObject = buildConversationVideoObject(episode) as Record<
      string,
      unknown
    >;
    assert.equal(videoObject["@type"], "VideoObject");
    assert.equal(videoObject.name, episode.title);
    assert.equal(
      videoObject.thumbnailUrl,
      "https://i.ytimg.com/vi/8glfuhElhnA/maxresdefault.jpg",
    );
    assert.equal(
      videoObject.contentUrl,
      "https://www.youtube.com/watch?v=8glfuhElhnA",
    );
    assert.equal(
      videoObject.embedUrl,
      buildYouTubeEmbedUrl("8glfuhElhnA", { autoplay: false }),
    );
    assert.equal(String(videoObject.embedUrl).includes("autoplay="), false);
    assert.equal(String(videoObject.embedUrl).includes("youtube-nocookie.com"), true);
    assert.equal(videoObject.uploadDate, "2026-07-21");
    assert.equal(videoObject.duration, "PT11M42S");
  });

  it("omits playback URLs when video is absent rather than inventing them", () => {
    assert.ok(episode);
    const withoutVideo = buildConversationVideoObject({
      ...episode,
      video: undefined,
    }) as Record<string, unknown>;
    assert.equal("contentUrl" in withoutVideo, false);
    assert.equal("embedUrl" in withoutVideo, false);
  });

  it("emits VideoObject and BreadcrumbList for episode graphs", () => {
    assert.ok(episode);
    const payload = buildConversationEpisodeJsonLd(episode);
    const types = graphTypes(payload);
    assert.ok(types.includes("VideoObject"));
    assert.ok(types.includes("BreadcrumbList"));
    assert.equal(serializeJsonLd(payload).includes("<"), false);
  });

  it("includes the published conversation hub and episode in the sitemap", () => {
    const entries = sitemap();
    const conversationUrls = entries
      .map((entry) => entry.url)
      .filter((url) => url.includes("/conversations"));

    assert.equal(getPublishedEpisodes().length, 1);
    assert.ok(conversationUrls.includes(`${SITE_URL}/conversations`));
    assert.ok(
      conversationUrls.includes(`${SITE_URL}/conversations/why-we-re-here`),
    );
  });
});
