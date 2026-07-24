import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  CONVERSATION_EPISODES,
  episodeIsPubliclyEligible,
  episodePath,
  formatEpisodeLabel,
  getLatestPublishedEpisode,
  getPublishedEpisodes,
  type ConversationEpisode,
} from "./episodes";

const root = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
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

describe("Conversations discoverability — footer and nav", () => {
  it("includes a Conversations footer link to /conversations", () => {
    const footer = readSource("app/shared-components/Footer.tsx");
    assert.match(
      footer,
      /href=["']\/conversations["'][\s\S]*?>\s*Conversations\s*</,
    );
    const matches = footer.match(/href=["']\/conversations["']/g) ?? [];
    assert.equal(matches.length, 1);
  });

  it("keeps Conversations out of the primary Header navigation", () => {
    const header = readSource("app/shared-components/Header.tsx");
    assert.equal(header.includes("/conversations"), false);
    assert.equal(/label:\s*["']Conversations["']/.test(header), false);
    assert.match(header, /const NAV_ITEMS = \[/);
  });
});

describe("Conversations discoverability — homepage feature", () => {
  const homeFeature = readSource("app/home-conversations-feature.tsx");
  const homePage = readSource("app/home-page-client.tsx");

  it("renders the latest published Conversation from the episode registry", () => {
    const latest = getLatestPublishedEpisode();
    assert.ok(latest);
    assert.equal(latest.slug, "why-we-re-here");
    assert.equal(latest.title, "Why Diamond Buying Should Still Feel Human");
    assert.equal(formatEpisodeLabel(latest), "Hourglass Conversations 01");
    assert.equal(episodePath(latest.slug), "/conversations/why-we-re-here");

    assert.match(homeFeature, /getLatestPublishedEpisode/);
    assert.match(homeFeature, /Hourglass Conversations/);
    assert.match(homeFeature, /Watch the Conversation/);
    assert.match(homeFeature, /Explore all Conversations/);
    assert.match(homeFeature, /episode\.summary/);
    assert.match(homeFeature, /formatEpisodeLabel/);
  });

  it("wires the feature into the homepage after House Designs and before Whispered Praise", () => {
    assert.match(homePage, /import HomeConversationsFeature from "\.\/home-conversations-feature"/);
    assert.match(homePage, /<FeaturedRingSection \/>/);
    assert.match(homePage, /<HomeConversationsFeature \/>/);
    assert.match(homePage, /<TestimonialSection \/>/);

    const ringsIdx = homePage.indexOf("<FeaturedRingSection />");
    const featureIdx = homePage.indexOf("<HomeConversationsFeature />");
    const praiseIdx = homePage.indexOf("<TestimonialSection />");
    assert.ok(ringsIdx > 0);
    assert.ok(featureIdx > ringsIdx);
    assert.ok(praiseIdx > featureIdx);
  });

  it("links the feature to the latest episode and the Conversations hub", () => {
    assert.match(homeFeature, /episodePath\(episode\.slug\)/);
    assert.match(homeFeature, /href=["']\/conversations["']/);
    assert.match(homeFeature, /data-conversations-home-episode=\{episode\.slug\}/);
    assert.match(homeFeature, /data-conversations-home-series=["']true["']/);
  });

  it("excludes drafts from the latest-published selector", () => {
    const latest = getLatestPublishedEpisode();
    assert.ok(latest);
    assert.equal(latest.status, "published");
    assert.equal(episodeIsPubliclyEligible(latest), true);

    for (const episode of getPublishedEpisodes()) {
      assert.equal(episode.status, "published");
      assert.equal(episodeIsPubliclyEligible(episode), true);
    }

    const draftOnly = CONVERSATION_EPISODES.filter(
      (episode) => episode.status === "draft",
    );
    for (const draft of draftOnly) {
      assert.notEqual(getLatestPublishedEpisode()?.slug, draft.slug);
    }
  });

  it("selects a newer published episode without a homepage rewrite", () => {
    const base = CONVERSATION_EPISODES.find(
      (episode) => episode.slug === "why-we-re-here",
    );
    assert.ok(base);

    const newer: ConversationEpisode = {
      ...withYouTubePlayback(base, "AbCdefGh_12"),
      slug: "options-without-clarity",
      title: "Options Without Clarity",
      episodeNumber: 2,
      publishedAt: "2026-08-15",
      transcript: [],
    };

    const inventory = [newer, base].filter(episodeIsPubliclyEligible).sort(
      (a, b) => {
        const aTime = a.publishedAt ? Date.parse(a.publishedAt) : 0;
        const bTime = b.publishedAt ? Date.parse(b.publishedAt) : 0;
        if (bTime !== aTime) return bTime - aTime;
        return (b.episodeNumber ?? 0) - (a.episodeNumber ?? 0);
      },
    );

    assert.equal(inventory[0]?.slug, "options-without-clarity");
    assert.equal(episodePath(inventory[0]!.slug), "/conversations/options-without-clarity");
    assert.match(homeFeature, /getLatestPublishedEpisode\(\)/);
    assert.equal(homeFeature.includes("why-we-re-here"), false);
  });

  it("does not introduce homepage autoplay or an embedded player iframe", () => {
    assert.equal(homeFeature.includes("autoplay"), false);
    assert.equal(homeFeature.includes("<iframe"), false);
    assert.equal(homeFeature.includes("youtube.com/embed"), false);
    assert.equal(homeFeature.includes("youtube-nocookie.com/embed"), false);
    assert.equal(homePage.includes("youtube.com/embed"), false);
    assert.match(homeFeature, /loading=["']lazy["']/);
  });

  it("keeps the homepage feature mobile-safe without fixed overflow traps", () => {
    assert.match(homeFeature, /aspect-\[16\/9\]/);
    assert.match(homeFeature, /w-full/);
    assert.match(homeFeature, /flex-col/);
    assert.equal(/w-\[[0-9]+px\]/.test(homeFeature), false);
    assert.equal(homeFeature.includes("overflow-x-hidden"), false);
  });
});

describe("Conversations discoverability — analytics and Agent OS isolation", () => {
  it("attributes homepage feature clicks with Conversations context only", () => {
    const analytics = readSource("lib/conversations/analytics.ts");
    const homeFeature = readSource("app/home-conversations-feature.tsx");
    assert.match(analytics, /trackConversationDiscoverabilityClicked/);
    assert.match(analytics, /conversation_discoverability_clicked/);
    assert.match(homeFeature, /trackConversationDiscoverabilityClicked/);
    assert.match(homeFeature, /destination_path: href/);
    assert.match(homeFeature, /destination_path: "\/conversations"/);
    assert.equal(homeFeature.includes("email"), false);
    assert.equal(homeFeature.includes("phone"), false);
  });

  it("preserves episode Concierge attribution and leaves Agent OS cron untouched", () => {
    const episodePage = readSource(
      "app/conversations/[slug]/episode-page-client.tsx",
    );
    assert.match(episodePage, /buildConversationConciergeHref/);
    assert.match(episodePage, /tool=conversations|conversations:/);

    const vercel = JSON.parse(readSource("vercel.json")) as {
      crons?: Array<{ path: string }>;
    };
    const paths = (vercel.crons ?? []).map((cron) => cron.path);
    assert.equal(
      paths.some((path) => path.includes("agent-os")),
      false,
    );
  });
});
