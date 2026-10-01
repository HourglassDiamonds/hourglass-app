import assert from "node:assert/strict";
import { describe, it } from "node:test";
import robots from "./robots";
import sitemap from "./sitemap";

const ORIGIN = "https://www.hourglassdiamonds.com";

describe("public search discovery", () => {
  it("lists unique, bare, canonical public URLs including priority and legal pages", () => {
    const entries = sitemap();
    const urls = entries.map((entry) => entry.url);

    assert.equal(new Set(urls).size, urls.length);
    for (const url of urls) {
      const parsed = new URL(url);
      assert.equal(parsed.origin, ORIGIN);
      assert.equal(parsed.search, "");
      assert.equal(parsed.hash, "");
      assert.doesNotMatch(parsed.pathname, /^\/(api|executive-dashboard|calibration-library)(\/|$)/);
    }

    for (const path of [
      "/",
      "/the-house",
      "/engagement-rings",
      "/custom-design",
      "/diamond-guide",
      "/diamond-studio",
      "/diamond-intelligence",
      "/concierge",
      "/our-approach",
      "/privacy",
      "/terms",
      "/ledger/buffer-health",
    ]) {
      assert.ok(urls.includes(`${ORIGIN}${path}`));
    }
    assert.equal(urls.includes(`${ORIGIN}/executive-dashboard/concierge/local-authority`), false);
    assert.equal(urls.includes(`${ORIGIN}/api/cron/review-velocity`), false);
  });

  it("does not claim a fresh modification time for every static URL", () => {
    const staticEntries = sitemap().filter(
      (entry) => !new URL(entry.url).pathname.startsWith("/conversations/"),
    );
    assert.equal(
      staticEntries.some((entry) => entry.lastModified !== undefined),
      false,
    );
  });

  it("keeps public pages crawlable and advertises the canonical sitemap", () => {
    const config = robots();
    assert.equal(config.sitemap, `${ORIGIN}/sitemap.xml`);
    assert.equal(config.host, ORIGIN);
    assert.deepEqual(config.rules, {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/executive-dashboard/",
        "/calibration-library/",
        "/diamond-shape-studio/capture/",
      ],
    });
  });
});
