import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import { normalizeEmail, normalizePhone } from "../client-memory/hashes";
import {
  isPublicCardSlug,
  parseDigitalCardFields,
  parseHttpUrl,
  parseInstagramUrl,
  parseShareContact,
  parseSlug,
  suggestSlugFromName,
} from "./parse";

describe("digital-card parsing", () => {
  it("normalizes email and US phone the same way as Client Memory", () => {
    assert.equal(normalizeEmail("  John@Example.com "), "john@example.com");
    assert.equal(normalizeEmail("not-an-email"), null);
    assert.equal(normalizePhone("(704) 555-1212"), "7045551212");
    assert.equal(normalizePhone("17045551212"), "7045551212");
    assert.equal(normalizePhone("441234567890"), null);
  });

  it("accepts durable lowercase slugs and rejects malformed public slugs", () => {
    assert.equal(isPublicCardSlug("justin-smith"), true);
    assert.equal(suggestSlugFromName("Justin Smith"), "justin-smith");
    assert.equal(parseSlug("Justin Smith").ok, false);
    assert.equal(parseSlug("Justin").ok, true);
    assert.equal(isPublicCardSlug("ab"), false);
    assert.equal(isPublicCardSlug("../etc"), false);
    assert.equal(isPublicCardSlug("vcard"), false);
    assert.equal(isPublicCardSlug("justin smith"), false);
    assert.equal(isPublicCardSlug(""), false);
  });

  it("rejects javascript and non-http URLs", () => {
    assert.equal(parseHttpUrl("javascript:alert(1)").ok, false);
    const https = parseHttpUrl("https://hourglassdiamonds.com");
    assert.equal(https.ok, true);
    if (https.ok) assert.equal(https.url, "https://hourglassdiamonds.com/");
    const instagram = parseInstagramUrl("@hourglassdiamonds");
    assert.equal(instagram.ok, true);
    if (instagram.ok) {
      assert.equal(instagram.url, "https://www.instagram.com/hourglassdiamonds");
    }
    const blank = parseDigitalCardFields({
      displayName: "Ada",
      websiteUrl: " ",
      linkedinUrl: "",
      avatarUrl: "\n",
    });
    assert.equal(blank.ok, true);
    const website = parseDigitalCardFields({
      displayName: "Ada",
      websiteUrl: "www.hourglassdiamonds.com",
    });
    assert.equal(website.ok, false);
    if (!website.ok) {
      assert.equal(website.fieldErrors.websiteUrl, "Enter a valid website URL.");
      assert.doesNotMatch(website.message, /Enter a valid web address/);
    }
  });

  it("requires a name and valid optional contact fields on the owner card", () => {
    const missing = parseDigitalCardFields({ displayName: "  " });
    assert.equal(missing.ok, false);
    if (!missing.ok) assert.equal(missing.code, "missing-name");
    const ok = parseDigitalCardFields({
      displayName: "Justin Smith",
      memorableTitle: "The Diamond Guy",
      professionalTitle: "Graduate Gemologist",
      company: "Hourglass Diamonds",
      email: "Justin@HourglassDiamonds.com",
      phone: "704-555-0100",
      slug: "justin-smith",
      published: true,
    });
    assert.equal(ok.ok, true);
    if (!ok.ok) return;
    assert.equal(ok.value.email, "justin@hourglassdiamonds.com");
    assert.equal(ok.value.phone, "7045550100");
  });

  it("requires visitor consent and a name, and keeps the form short", () => {
    const noConsent = parseShareContact({
      slug: "justin-smith",
      submissionId: randomUUID(),
      name: "Ada Lovelace",
      consent: false,
    });
    assert.equal(noConsent.ok, false);
    if (!noConsent.ok) assert.equal(noConsent.code, "consent-required");
    const parsed = parseShareContact({
      slug: "justin-smith",
      submissionId: randomUUID(),
      name: "Ada Lovelace",
      phone: "704-555-0199",
      email: "ada@example.com",
      company: "Analytical Engines",
      jobTitle: "Mathematician",
      consent: true,
    });
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.value.email, "ada@example.com");
    assert.equal(parsed.value.phone, "7045550199");
    assert.equal(parsed.value.givenName, "Ada");
    assert.equal(parsed.value.familyName, "Lovelace");
  });
});
