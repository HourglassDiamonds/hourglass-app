import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { CONVERSATIONS_PUBLIC_DISCOVERY_ENABLED } from "./public-discovery";

const root = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

describe("Conversations discoverability — temporarily retired", () => {
  it("keeps the public discovery flag off pending Case Studies", () => {
    assert.equal(CONVERSATIONS_PUBLIC_DISCOVERY_ENABLED, false);
  });

  it("removes Conversations from the public footer", () => {
    const footer = readSource("app/shared-components/Footer.tsx");
    assert.equal(footer.includes("/conversations"), false);
    assert.equal(footer.includes("Conversations"), false);
    assert.match(footer, /href=["']\/our-approach["']/);
    assert.match(footer, /href=["']\/engagement-rings["']/);
  });

  it("keeps Conversations out of the primary Header and mobile navigation", () => {
    const header = readSource("app/shared-components/Header.tsx");
    assert.equal(header.includes("/conversations"), false);
    assert.equal(/label:\s*["']Conversations["']/.test(header), false);
    assert.match(header, /const NAV_ITEMS = \[/);
    assert.match(header, /aria-label=["']Mobile navigation["']/);
  });

  it("does not mount a Conversations feature on the homepage", () => {
    const homePage = readSource("app/home-page-client.tsx");
    assert.equal(homePage.includes("HomeConversationsFeature"), false);
    assert.equal(homePage.includes("home-conversations-feature"), false);
    assert.equal(homePage.includes("/conversations"), false);

    const ringsIdx = homePage.indexOf("<FeaturedRingSection />");
    const praiseIdx = homePage.indexOf("<TestimonialSection />");
    assert.ok(ringsIdx > 0);
    assert.ok(praiseIdx > ringsIdx);
    assert.equal(
      homePage.slice(ringsIdx, praiseIdx).includes("Conversation"),
      false,
    );
  });

  it("temporarily redirects /conversations to /the-house", () => {
    const config = readSource("next.config.ts");
    assert.match(
      config,
      /source:\s*["']\/conversations["'][\s\S]*?destination:\s*["']\/the-house["'][\s\S]*?permanent:\s*false/,
    );
    assert.match(
      config,
      /source:\s*["']\/conversations\/:path\*["'][\s\S]*?destination:\s*["']\/the-house["'][\s\S]*?permanent:\s*false/,
    );

    const hub = readSource("app/conversations/page.tsx");
    assert.match(hub, /redirect\(["']\/the-house["']\)/);
    assert.match(hub, /ConversationsHubClient/);

    const episode = readSource("app/conversations/[slug]/page.tsx");
    assert.match(episode, /redirect\(["']\/the-house["']\)/);
    assert.match(episode, /EpisodePageClient/);
  });

  it("preserves episode Concierge attribution without disturbing Agent OS cron", () => {
    const episodePage = readSource(
      "app/conversations/[slug]/episode-page-client.tsx",
    );
    assert.match(episodePage, /tool=["']conversations["']/);
    assert.match(episodePage, /content=\{episode\.slug\}/);
    assert.match(episodePage, /conversation:footer/);

    const vercel = JSON.parse(readSource("vercel.json")) as {
      crons?: Array<{ path: string }>;
    };
    const paths = (vercel.crons ?? []).map((cron) => cron.path);
    // Discoverability work must not strip the Agent OS cadence cron.
    assert.ok(paths.includes("/api/cron/agent-os-cadence"));
  });
});
