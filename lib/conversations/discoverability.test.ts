import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const root = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

describe("Conversations discoverability — footer only", () => {
  it("includes a Conversations footer link to /conversations", () => {
    const footer = readSource("app/shared-components/Footer.tsx");
    assert.match(
      footer,
      /href=["']\/conversations["'][\s\S]*?>\s*Conversations\s*</,
    );
    const matches = footer.match(/href=["']\/conversations["']/g) ?? [];
    assert.equal(matches.length, 1);

    // Positioned after Our Approach in the brand/editorial footer group.
    const ourApproachIdx = footer.indexOf('href="/our-approach"');
    const conversationsIdx = footer.indexOf('href="/conversations"');
    const engagementIdx = footer.indexOf('href="/engagement-rings"');
    assert.ok(ourApproachIdx > 0);
    assert.ok(conversationsIdx > ourApproachIdx);
    assert.ok(engagementIdx > conversationsIdx);
  });

  it("keeps Conversations out of the primary Header navigation", () => {
    const header = readSource("app/shared-components/Header.tsx");
    assert.equal(header.includes("/conversations"), false);
    assert.equal(/label:\s*["']Conversations["']/.test(header), false);
    assert.match(header, /const NAV_ITEMS = \[/);
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
