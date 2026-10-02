import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import LedgerIndexBreadcrumb from "./components/ledger-index-breadcrumb";
import { LEDGER_INDEXES } from "./ledger-data";
import {
  buildLedgerHubJsonLd,
  buildLedgerMonitorJsonLd,
  LEDGER_HUB_DESCRIPTION,
  ledgerMetadata,
} from "./ledger-seo";

const ORIGIN = "https://www.hourglassdiamonds.com";

describe("Ledger SEO contracts", () => {
  it("builds complete topic-first metadata without inheriting jewelry copy", () => {
    const metadata = ledgerMetadata({
      topic: "Infrastructure Strain Monitor",
      path: "/ledger/infrastructure-strain-index",
      description: "Tracks pressure across essential infrastructure.",
    });

    assert.deepEqual(metadata.title, {
      absolute:
        "Infrastructure Strain Monitor | Ledger | Hourglass Diamonds",
    });
    assert.equal(
      metadata.alternates?.canonical,
      "/ledger/infrastructure-strain-index",
    );
    assert.equal(metadata.openGraph?.title, (metadata.title as { absolute: string }).absolute);
    assert.equal(metadata.openGraph?.description, metadata.description);
    assert.equal(metadata.twitter?.title, (metadata.title as { absolute: string }).absolute);
    assert.equal(metadata.twitter?.description, metadata.description);
  });

  it("describes the hub as a collection of every active monitor", () => {
    const monitors = LEDGER_INDEXES.map((index) => ({
      name: index.displayTitle,
      path: `/ledger/${index.slug}`,
    }));
    const schema = buildLedgerHubJsonLd(monitors);
    const serialized = JSON.stringify(schema);
    const page = schema["@graph"][0] as Record<string, unknown>;

    assert.equal(page["@type"], "CollectionPage");
    assert.equal(page.description, LEDGER_HUB_DESCRIPTION);
    assert.equal((page.hasPart as unknown[]).length, LEDGER_INDEXES.length);
    for (const index of LEDGER_INDEXES) {
      assert.match(serialized, new RegExp(`/ledger/${index.slug}`));
    }
    assert.doesNotMatch(serialized, /LocalBusiness|JewelryStore|Product|Review|FAQPage|Dataset/);
  });

  it("gives monitor pages a clean Home > Ledger > Monitor hierarchy", () => {
    const schema = buildLedgerMonitorJsonLd({
      name: "Infrastructure Strain Monitor",
      path: "/ledger/infrastructure-strain-index",
      description: "Tracks pressure across essential infrastructure.",
    });
    const breadcrumb = schema["@graph"][1] as {
      itemListElement: Array<{ position: number; name: string; item: string }>;
    };

    assert.deepEqual(
      breadcrumb.itemListElement.map(({ position, name, item }) => ({
        position,
        name,
        item,
      })),
      [
        { position: 1, name: "Home", item: `${ORIGIN}/` },
        { position: 2, name: "Ledger", item: `${ORIGIN}/ledger` },
        {
          position: 3,
          name: "Infrastructure Strain Monitor",
          item: `${ORIGIN}/ledger/infrastructure-strain-index`,
        },
      ],
    );

    const html = renderToStaticMarkup(
      createElement(LedgerIndexBreadcrumb, {
        current: "Infrastructure Strain Monitor",
      }),
    );
    assert.match(html, /href="\/"[^>]*>Home<\/a>/);
    assert.match(html, /href="\/ledger"[^>]*>Ledger<\/a>/);
    assert.match(html, /aria-current="page"/);
  });
});
