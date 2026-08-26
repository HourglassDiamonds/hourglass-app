import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PublicCardView } from "../../../app/c/[slug]/components/public-card";
import { QuickCapture } from "../../../app/executive-dashboard/concierge/components/quick-capture";
import { toPublicDigitalCard } from "./public";
import { DIGITAL_CARD_SOURCE_SYSTEM, type DigitalCard } from "./types";
import { isPublicCardSlug } from "./parse";
import { saveOwnerDigitalCard } from "./owner";
import { InMemoryDigitalCardStore } from "./store";
import {
  checkDigitalCardShareRateLimit,
  DIGITAL_CARD_SHARE_BURST_MAX,
  resetDigitalCardRateLimits,
} from "./rate-limit";
import { randomUUID } from "node:crypto";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const NOW = "2026-08-25T18:30:00.000Z";

function sampleCard(): DigitalCard {
  return {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    slug: "justin-smith",
    ownerUsername: "founder",
    ownerPersonId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    displayName: "Justin Smith",
    memorableTitle: "The Diamond Guy",
    professionalTitle: "Graduate Gemologist",
    company: "Hourglass Diamonds",
    email: "private-owner@example.com",
    phone: "7045550100",
    emailPublic: false,
    phonePublic: true,
    websiteUrl: "https://www.hourglassdiamonds.com",
    linkedinUrl: null,
    instagramUrl: "https://www.instagram.com/hourglassdiamonds/",
    additionalLinks: [],
    avatarUrl: null,
    published: true,
    sourceSystem: DIGITAL_CARD_SOURCE_SYSTEM,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

describe("digital-card UI and public retrieval", () => {
  it("renders a restrained public card without leaking internal ids", () => {
    const publicCard = toPublicDigitalCard(sampleCard());
    assert.ok(publicCard);
    const html = renderToStaticMarkup(
      createElement(PublicCardView, { card: publicCard }),
    );
    assert.match(html, /Justin Smith/);
    assert.match(html, /The Diamond Guy/);
    assert.match(html, /Graduate Gemologist/);
    assert.match(html, /Hourglass Diamonds/);
    assert.doesNotMatch(html, /aaaaaaaa-aaaa-4aaa-8aaa/);
    assert.doesNotMatch(html, /founder|private-owner@example.com/);
    assert.doesNotMatch(html, /gradient|neon|blinq|popl/i);
  });

  it("exposes My Card inside Continuum Quick Capture", () => {
    const html = renderToStaticMarkup(createElement(QuickCapture));
    assert.match(html, /My Card/);
    assert.match(html, /\/executive-dashboard\/concierge\/card/);
    const form = readFileSync(
      join(ROOT, "app", "executive-dashboard", "concierge", "components", "my-card-form.tsx"),
      "utf8",
    );
    const qr = readFileSync(
      join(ROOT, "app", "executive-dashboard", "concierge", "components", "card-qr.tsx"),
      "utf8",
    );
    const page = readFileSync(
      join(ROOT, "app", "executive-dashboard", "concierge", "card", "page.tsx"),
      "utf8",
    );
    assert.match(page, /Share your Continuum card/);
    assert.match(page, /My Card/);
    assert.match(page, /A simple way to exchange your details and stay connected/);
    assert.doesNotMatch(page, /\?\?\?/);
    assert.doesNotMatch(page, /quiet public profile/);
    assert.match(form, /Full name/);
    assert.match(form, /Memorable title/);
    assert.match(form, /Publish this card/);
    assert.match(qr, /Preview Public Card/);
    assert.match(qr, /Copy Link/);
    assert.match(qr, /value=\{url\}/);
    assert.match(form, /Card Details/);
    assert.match(form, /aria-invalid/);
    assert.match(form, /aria-describedby/);
    assert.match(form, /clientMyCardFieldErrors/);
    assert.match(form, /resolveMyCardFormDisplay/);
    assert.doesNotMatch(form, /break-all/);
    assert.doesNotMatch(form, /drag-and-drop|Justin Smith/);
  });

  it("returns not-found for malformed and unpublished public slugs", async () => {
    const store = new InMemoryDigitalCardStore();
    await saveOwnerDigitalCard(
      {
        nowIso: () => NOW,
        newId: () => randomUUID(),
        ownerUsername: "founder",
        getCardByOwner: (owner) => store.getCardByOwner(owner),
        getCardBySlug: (slug) => store.getCardBySlug(slug),
        upsertCard: (card) => store.upsertCard(card),
      },
      { displayName: "Justin Smith", slug: "justin-smith", published: false },
    );
    assert.equal(isPublicCardSlug("Not A Slug"), false);
    assert.equal(await store.getPublishedCardBySlug("../etc"), null);
    assert.equal(await store.getPublishedCardBySlug("nope"), null);
    assert.equal(await store.getPublishedCardBySlug("justin-smith"), null);
    await saveOwnerDigitalCard(
      {
        nowIso: () => NOW,
        newId: () => randomUUID(),
        ownerUsername: "founder",
        getCardByOwner: (owner) => store.getCardByOwner(owner),
        getCardBySlug: (slug) => store.getCardBySlug(slug),
        upsertCard: (card) => store.upsertCard(card),
      },
      { displayName: "Justin Smith", slug: "justin-smith", published: true },
    );
    const found = await store.getPublishedCardBySlug("justin-smith");
    assert.ok(found);
    const publicCard = toPublicDigitalCard(found);
    assert.equal(publicCard?.displayName, "Justin Smith");
    assert.doesNotMatch(JSON.stringify(publicCard), /founder/);
  });

  it("rate-limits repeated public share attempts", () => {
    resetDigitalCardRateLimits();
    for (let i = 0; i < DIGITAL_CARD_SHARE_BURST_MAX; i += 1) {
      assert.equal(checkDigitalCardShareRateLimit("1.1.1.1").allowed, true);
    }
    const blocked = checkDigitalCardShareRateLimit("1.1.1.1");
    assert.equal(blocked.allowed, false);
    resetDigitalCardRateLimits();
  });

  it("does not hard-code owner identity into reusable card components", () => {
    const view = readFileSync(
      join(ROOT, "app", "c", "[slug]", "components", "public-card.tsx"),
      "utf8",
    );
    const form = readFileSync(
      join(ROOT, "app", "executive-dashboard", "concierge", "components", "my-card-form.tsx"),
      "utf8",
    );
    assert.doesNotMatch(view, /Justin Smith|The Diamond Guy|Hourglass Diamonds/);
    assert.doesNotMatch(form, /Justin Smith/);
  });
});
