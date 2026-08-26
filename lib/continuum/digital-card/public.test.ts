import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { toPublicDigitalCard } from "./public";
import { buildPublicVcard, vcardFilename } from "./vcard";
import type { DigitalCard } from "./types";
import { DIGITAL_CARD_SOURCE_SYSTEM } from "./types";

const NOW = "2026-08-25T17:00:00.000Z";

function card(overrides: Partial<DigitalCard> = {}): DigitalCard {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    slug: "justin-smith",
    ownerUsername: "justin@hourglassdiamonds.com",
    ownerPersonId: "22222222-2222-4222-8222-222222222222",
    displayName: "Justin Smith",
    memorableTitle: "The Diamond Guy",
    professionalTitle: "Graduate Gemologist",
    company: "Hourglass Diamonds",
    email: "justin@hourglassdiamonds.com",
    phone: "7045550100",
    emailPublic: true,
    phonePublic: true,
    websiteUrl: "https://www.hourglassdiamonds.com",
    linkedinUrl: "https://www.linkedin.com/in/example",
    instagramUrl: "https://www.instagram.com/hourglassdiamonds/",
    additionalLinks: [],
    avatarUrl: null,
    published: true,
    sourceSystem: DIGITAL_CARD_SOURCE_SYSTEM,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe("public digital-card projection", () => {
  it("returns published contact fields without internal ids", () => {
    const publicCard = toPublicDigitalCard(card());
    assert.ok(publicCard);
    const json = JSON.stringify(publicCard);
    assert.match(json, /Justin Smith/);
    assert.doesNotMatch(json, /11111111-1111-4111-8111-111111111111/);
    assert.doesNotMatch(json, /ownerUsername|ownerPersonId|published|sourceSystem/);
    assert.equal(publicCard?.email, "justin@hourglassdiamonds.com");
  });

  it("never leaks unpublished email or phone", () => {
    const publicCard = toPublicDigitalCard(
      card({
        emailPublic: false,
        phonePublic: false,
        email: "private@hourglassdiamonds.com",
        phone: "7045550199",
      }),
    );
    assert.ok(publicCard);
    assert.equal(publicCard?.email, null);
    assert.equal(publicCard?.phone, null);
    assert.doesNotMatch(JSON.stringify(publicCard), /private@hourglassdiamonds/);
    assert.doesNotMatch(JSON.stringify(publicCard), /7045550199/);
  });

  it("hides unpublished cards entirely", () => {
    assert.equal(toPublicDigitalCard(card({ published: false })), null);
  });
});

describe("vCard generation", () => {
  it("emits a vCard 3.0 with public fields only", () => {
    const publicCard = toPublicDigitalCard(card());
    assert.ok(publicCard);
    const vcf = buildPublicVcard(publicCard);
    assert.match(vcf, /BEGIN:VCARD/);
    assert.match(vcf, /VERSION:3.0/);
    assert.match(vcf, /FN:Justin Smith/);
    assert.match(vcf, /ORG:Hourglass Diamonds/);
    assert.match(vcf, /TITLE:Graduate Gemologist/);
    assert.match(vcf, /TEL;TYPE=CELL,VOICE:\+17045550100/);
    assert.match(vcf, /EMAIL;TYPE=INTERNET:justin@hourglassdiamonds.com/);
    assert.match(vcf, /URL:https:\/\/www\.hourglassdiamonds\.com/);
    assert.match(vcf, /NOTE:The Diamond Guy/);
    assert.doesNotMatch(vcf, /11111111-1111-4111-8111/);
    assert.doesNotMatch(vcf, /ownerUsername|continuum|personId/i);
    assert.equal(vcardFilename("justin-smith"), "justin-smith.vcf");
  });

  it("omits private phone and email from the vCard", () => {
    const publicCard = toPublicDigitalCard(
      card({ emailPublic: false, phonePublic: false }),
    );
    assert.ok(publicCard);
    const vcf = buildPublicVcard(publicCard);
    assert.doesNotMatch(vcf, /TEL;/);
    assert.doesNotMatch(vcf, /EMAIL;/);
    assert.doesNotMatch(vcf, /justin@hourglassdiamonds.com/);
  });

  it("escapes newlines and cannot inject a new property via CR or CRLF", () => {
    const publicCard = toPublicDigitalCard(
      card({
        memorableTitle: "Line one\nLine two",
        additionalLinks: [
          { label: "Extra", url: "https://example.com/a,b;c" },
        ],
      }),
    );
    assert.ok(publicCard);
    const newlineVcf = buildPublicVcard(publicCard);
    assert.match(newlineVcf, /NOTE:Line one\\nLine two/);
    assert.match(newlineVcf, /\r\nEND:VCARD\r\n/);
    assert.match(newlineVcf, /URL;TYPE=Extra:https:\/\/example.com\/a\\,b\\;c/);

    const injected = toPublicDigitalCard(
      card({
        displayName: "Justin\rTEL:+15555555555",
        memorableTitle: "Justin\r\nTEL:+15555555555",
        additionalLinks: [
          { label: "Extra\rEMAIL:evil@x.com", url: "https://example.com" },
        ],
      }),
    );
    assert.ok(injected);
    const vcf = buildPublicVcard(injected);
    const records = vcf.split("\r\n").filter((line) => line.length > 0 && !line.startsWith(" "));
    assert.equal(records.filter((line) => line.startsWith("TEL")).length, 1);
    assert.equal(records.filter((line) => line.startsWith("EMAIL")).length, 1);
    assert.equal(records.filter((line) => line.startsWith("NOTE")).length, 1);
    assert.equal(records.filter((line) => line.startsWith("ORG")).length, 1);
    assert.doesNotMatch(vcf, /\rTEL:/);
    assert.match(vcf, /NOTE:Justin\\nTEL:\+15555555555/);
  });
});
