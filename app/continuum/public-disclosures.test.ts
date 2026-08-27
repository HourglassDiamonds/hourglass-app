/**
 * Public Continuum OAuth disclosure pages.
 * Source-string assertions. No secrets, no implementation details.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import sitemap from "@/app/sitemap";
import { pageMetadata, SITE_URL } from "@/lib/seo/site-metadata";

const root = dirname(fileURLToPath(import.meta.url));
const appRoot = join(root, "..");
const privacy = readFileSync(join(appRoot, "privacy/page.tsx"), "utf8");
const continuum = readFileSync(join(root, "page.tsx"), "utf8");
const header = readFileSync(join(appRoot, "shared-components/Header.tsx"), "utf8");
const footer = readFileSync(join(appRoot, "shared-components/Footer.tsx"), "utf8");

const INTERNAL_LEAKS = [
  /client[_-]?secret/i,
  /OAuth client ID/i,
  /continuum_gmail/,
  /continuum_events/,
  /gmail\.googleapis/,
  /hourglass-app-gmail-index/,
  /executive-dashboard/,
  /SUPABASE_/,
  /service_role/,
];

describe("Continuum public OAuth disclosures", () => {
  it("adds a Google Account and Gmail Data section to the privacy policy", () => {
    assert.match(privacy, /Google Account and Gmail Data/);
    assert.match(privacy, /read-only Gmail permission/);
    assert.match(privacy, /does not use this permission to send, modify, or delete/);
    assert.match(privacy, /protected message metadata/);
    assert.match(privacy, /accessed on demand/);
    assert.match(privacy, /Gmail and Google data is not sold/);
    assert.match(privacy, /not used for advertising/);
    assert.match(privacy, /protected server-side\s+credentials/);
    assert.match(privacy, /Disconnecting stops future Gmail access/);
    assert.match(
      privacy,
      /already-created legitimate\s+business records are not silently destroyed/i,
    );
    assert.match(
      privacy,
      /Hourglass Diamonds&apos; use and transfer of information received[\s\S]*Google APIs will adhere to the/,
    );
    assert.match(privacy, /Limited Use requirements/);
    assert.match(
      privacy,
      /href="https:\/\/developers\.google\.com\/terms\/api-services-user-data-policy"/,
    );
    assert.match(privacy, /Google API Services User Data Policy/);
    assert.doesNotMatch(privacy, /bodies are never accessed/i);
    assert.doesNotMatch(privacy, /never access(?:es)? message (?:bodies|content)/i);
  });

  it("keeps privacy canonical and metadata aligned with site conventions", () => {
    assert.match(privacy, /pageMetadata\(/);
    assert.match(privacy, /path: "\/privacy"/);
    const meta = pageMetadata({
      title: "Privacy",
      description: "probe",
      path: "/privacy",
    });
    assert.equal(meta.alternates?.canonical, "/privacy");
  });

  it("publishes a restrained Continuum information page", () => {
    assert.match(
      continuum,
      /Private relationship and project intelligence for Hourglass Diamonds/,
    );
    assert.match(continuum, /private business operating\s+system/);
    assert.match(continuum, /read-only Gmail access/);
    assert.match(continuum, /does not use Gmail permission to send, edit, or delete/);
    assert.match(continuum, /href="\/privacy"/);
    assert.match(continuum, /Privacy Policy/);
    assert.match(
      continuum,
      /not offered as a public consumer service/,
    );
    assert.match(continuum, /pageMetadata\(/);
    assert.match(continuum, /path: "\/continuum"/);
    const meta = pageMetadata({
      title: "Continuum",
      description:
        "Learn about Continuum, the private relationship and project intelligence system used by Hourglass Diamonds, including how authorized Google account data is handled.",
      path: "/continuum",
    });
    assert.equal(meta.alternates?.canonical, "/continuum");
    assert.equal(meta.title, "Continuum");
  });

  it("keeps Continuum off the main public navigation", () => {
    assert.doesNotMatch(header, /href: "\/continuum"/);
    assert.doesNotMatch(footer, /href="\/continuum"/);
    assert.match(footer, /href="\/privacy"/);
  });

  it("includes privacy and Continuum in the public sitemap", () => {
    const urls = sitemap().map((entry) => entry.url);
    assert.ok(urls.includes(`${SITE_URL}/privacy`));
    assert.ok(urls.includes(`${SITE_URL}/continuum`));
  });

  it("does not expose internal architecture or secrets on the public pages", () => {
    for (const pattern of INTERNAL_LEAKS) {
      assert.doesNotMatch(continuum, pattern);
    }
    const gmailSection = privacy.slice(
      privacy.indexOf("Google Account and Gmail Data"),
    );
    for (const pattern of INTERNAL_LEAKS) {
      assert.doesNotMatch(gmailSection, pattern);
    }
    assert.doesNotMatch(continuum, /@gmail\.com/);
    assert.doesNotMatch(gmailSection, /@gmail\.com/);
    assert.doesNotMatch(continuum, /MarketingPageJsonLd|JsonLd/);
    assert.doesNotMatch(privacy, /MarketingPageJsonLd|JsonLd/);
  });
});
