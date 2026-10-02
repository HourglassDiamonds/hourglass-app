import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { LEDGER_INDEXES } from "./ledger/ledger-data";
import robots from "./robots";
import sitemap from "./sitemap";

const ORIGIN = "https://www.hourglassdiamonds.com";

describe("Ledger public search discovery", () => {
  it("lists the canonical Ledger hub and every active monitor", () => {
    const urls = sitemap().map((entry) => entry.url);

    assert.equal(new Set(urls).size, urls.length);
    assert.ok(urls.includes(`${ORIGIN}/ledger`));
    for (const index of LEDGER_INDEXES) {
      assert.ok(urls.includes(`${ORIGIN}/ledger/${index.slug}`));
    }
  });

  it("keeps Ledger crawlable and advertises the canonical sitemap", () => {
    const config = robots();
    assert.equal(config.sitemap, `${ORIGIN}/sitemap.xml`);
    assert.deepEqual(config.rules, {
      userAgent: "*",
      allow: "/",
    });
  });
});
