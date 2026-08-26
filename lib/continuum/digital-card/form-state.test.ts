import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import {
  clientMyCardFieldErrors,
  myCardFormValuesFromCard,
  myCardFormValuesFromFormData,
  optionalHttpUrlOk,
  optionalHttpsUrlOk,
  optionalUrlIsAbsent,
  resolveMyCardFormDisplay,
  saveDigitalCardInputFromValues,
} from "./form-state";
import { parseDigitalCardFields, parseHttpUrl, parseHttpsUrl } from "./parse";
import { saveOwnerDigitalCard } from "./owner";
import { InMemoryDigitalCardStore } from "./store";
import { DIGITAL_CARD_SOURCE_SYSTEM, type DigitalCard } from "./types";

const NOW = "2026-08-26T18:00:00.000Z";

function completedValues(overrides: Record<string, string | boolean> = {}) {
  return {
    ...myCardFormValuesFromCard(null),
    displayName: "Justin Smith",
    memorableTitle: "The Diamond Guy",
    professionalTitle: "Graduate Gemologist",
    company: "Hourglass Diamonds",
    email: "justin@hourglassdiamonds.com",
    emailPublic: true,
    phone: "7045550100",
    phonePublic: true,
    websiteUrl: "https://www.hourglassdiamonds.com",
    linkedinUrl: "https://www.linkedin.com/in/example",
    instagramUrl: "@hourglassdiamonds",
    avatarUrl: "https://www.hourglassdiamonds.com/portrait.jpg",
    slug: "justin-smith",
    published: true,
    link1Label: "Studio",
    link1Url: "https://www.hourglassdiamonds.com/diamond-studio",
    link2Label: "",
    link2Url: "",
    ...overrides,
  };
}

describe("My Card form validation recovery", () => {
  it("A. reports one invalid URL and preserves every other submitted value", () => {
    const submitted = completedValues({ websiteUrl: "www.hourglassdiamonds.com" });
    const parsed = parseDigitalCardFields(saveDigitalCardInputFromValues(submitted));
    assert.equal(parsed.ok, false);
    if (parsed.ok) return;
    assert.equal(parsed.fieldErrors.websiteUrl, "Enter a valid website URL.");
    assert.equal(parsed.fieldErrors.linkedinUrl, undefined);
    const display = resolveMyCardFormDisplay({
      card: null,
      status: "error",
      submitted,
      fieldErrors: parsed.fieldErrors,
      message: parsed.message,
    });
    assert.equal(display.values.displayName, "Justin Smith");
    assert.equal(display.values.memorableTitle, "The Diamond Guy");
    assert.equal(display.values.professionalTitle, "Graduate Gemologist");
    assert.equal(display.values.company, "Hourglass Diamonds");
    assert.equal(display.values.email, "justin@hourglassdiamonds.com");
    assert.equal(display.values.phone, "7045550100");
    assert.equal(display.values.websiteUrl, "www.hourglassdiamonds.com");
    assert.equal(display.values.linkedinUrl, "https://www.linkedin.com/in/example");
    assert.equal(display.values.instagramUrl, "@hourglassdiamonds");
    assert.equal(display.values.avatarUrl, "https://www.hourglassdiamonds.com/portrait.jpg");
    assert.equal(display.values.slug, "justin-smith");
    assert.equal(display.values.published, true);
    assert.equal(display.values.link1Label, "Studio");
    assert.equal(display.values.link1Url, "https://www.hourglassdiamonds.com/diamond-studio");
    assert.equal(display.fieldErrors.websiteUrl, "Enter a valid website URL.");
    assert.doesNotMatch(display.summary ?? "", /Enter a valid web address/);
  });

  it("B. accepts blank optional URLs", () => {
    assert.equal(optionalUrlIsAbsent("   "), true);
    assert.equal(optionalHttpUrlOk(""), true);
    assert.equal(optionalHttpUrlOk("   "), true);
    assert.equal(optionalHttpsUrlOk(""), true);
    const parsed = parseDigitalCardFields({
      displayName: "Justin Smith",
      websiteUrl: " ",
      linkedinUrl: "",
      instagramUrl: "\t",
      avatarUrl: "  ",
      additionalLinks: [
        { label: "", url: "" },
        { label: "  ", url: " " },
      ],
    });
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.value.websiteUrl, null);
    assert.equal(parsed.value.linkedinUrl, null);
    assert.equal(parsed.value.instagramUrl, null);
    assert.equal(parsed.value.avatarUrl, null);
    assert.deepEqual(parsed.value.additionalLinks, []);
  });

  it("C. reports a portrait-specific HTTPS error and preserves other values", () => {
    const submitted = completedValues({
      avatarUrl: "http://www.hourglassdiamonds.com/portrait.jpg",
    });
    const parsed = parseDigitalCardFields(saveDigitalCardInputFromValues(submitted));
    assert.equal(parsed.ok, false);
    if (parsed.ok) return;
    assert.equal(parsed.code, "invalid-portrait-url");
    assert.equal(parsed.fieldErrors.avatarUrl, "Portrait must use an HTTPS URL.");
    const display = resolveMyCardFormDisplay({
      card: null,
      status: "error",
      submitted,
      fieldErrors: parsed.fieldErrors,
      message: parsed.message,
    });
    assert.equal(display.values.displayName, "Justin Smith");
    assert.equal(display.values.websiteUrl, "https://www.hourglassdiamonds.com");
    assert.equal(
      display.values.avatarUrl,
      "http://www.hourglassdiamonds.com/portrait.jpg",
    );
    assert.equal(display.fieldErrors.websiteUrl, undefined);
  });

  it("D. reports the invalid additional-link row and preserves the other row", () => {
    const submitted = completedValues({
      link2Label: "Press",
      link2Url: "javascript:alert(1)",
    });
    const parsed = parseDigitalCardFields(saveDigitalCardInputFromValues(submitted));
    assert.equal(parsed.ok, false);
    if (parsed.ok) return;
    assert.equal(parsed.fieldErrors.link2Url, "Enter a valid URL for this link.");
    assert.equal(parsed.fieldErrors.link1Url, undefined);
    const display = resolveMyCardFormDisplay({
      card: null,
      status: "error",
      submitted,
      fieldErrors: parsed.fieldErrors,
      message: parsed.message,
    });
    assert.equal(display.values.link1Label, "Studio");
    assert.equal(display.values.link1Url, "https://www.hourglassdiamonds.com/diamond-studio");
    assert.equal(display.values.link2Label, "Press");
    assert.equal(display.values.link2Url, "javascript:alert(1)");
  });

  it("E. preserves the publish checkbox after failed validation", () => {
    const submitted = completedValues({
      published: true,
      websiteUrl: "not-a-url",
    });
    const display = resolveMyCardFormDisplay({
      card: myCardFormValuesFromCard(null) && null,
      status: "error",
      submitted,
      fieldErrors: { websiteUrl: "Enter a valid website URL." },
      message: "Enter a valid website URL.",
    });
    assert.equal(display.values.published, true);
  });

  it("F. preserves the slug after failed validation", () => {
    const submitted = completedValues({
      slug: "justin-smith",
      linkedinUrl: "linkedin.com/in/example",
    });
    const parsed = parseDigitalCardFields(saveDigitalCardInputFromValues(submitted));
    assert.equal(parsed.ok, false);
    if (parsed.ok) return;
    assert.equal(parsed.fieldErrors.linkedinUrl, "Enter a valid LinkedIn URL.");
    const display = resolveMyCardFormDisplay({
      card: null,
      status: "error",
      submitted,
      fieldErrors: parsed.fieldErrors,
      message: parsed.message,
    });
    assert.equal(display.values.slug, "justin-smith");
  });

  it("G. successful save still works and reloads canonical values", async () => {
    const store = new InMemoryDigitalCardStore();
    const submitted = completedValues({ websiteUrl: "https://www.hourglassdiamonds.com" });
    const result = await saveOwnerDigitalCard(
      {
        nowIso: () => NOW,
        newId: () => randomUUID(),
        ownerUsername: "founder",
        getCardByOwner: (owner) => store.getCardByOwner(owner),
        getCardBySlug: (slug) => store.getCardBySlug(slug),
        upsertCard: (card: DigitalCard) => store.upsertCard(card),
      },
      saveDigitalCardInputFromValues(submitted),
    );
    assert.equal(result.status, "saved");
    if (result.status !== "saved") return;
    const display = resolveMyCardFormDisplay({
      card: result.card,
      status: "saved",
      message: "Saved.",
    });
    assert.equal(display.saved, true);
    assert.equal(display.summary, "Saved.");
    assert.equal(display.values.displayName, "Justin Smith");
    assert.equal(display.values.websiteUrl, "https://www.hourglassdiamonds.com/");
    assert.equal(display.values.published, true);
    assert.equal(display.values.slug, "justin-smith");
    assert.equal(result.card.sourceSystem, DIGITAL_CARD_SOURCE_SYSTEM);
  });

  it("H. rejects javascript and data URLs on every URL field", () => {
    assert.equal(parseHttpUrl("javascript:alert(1)").ok, false);
    assert.equal(parseHttpUrl("data:text/html,hi").ok, false);
    assert.equal(parseHttpsUrl("javascript:alert(1)").ok, false);
    const website = parseDigitalCardFields(
      saveDigitalCardInputFromValues(completedValues({ websiteUrl: "javascript:alert(1)" })),
    );
    const portrait = parseDigitalCardFields(
      saveDigitalCardInputFromValues(
        completedValues({ avatarUrl: "data:image/png;base64,abc" }),
      ),
    );
    const extra = parseDigitalCardFields(
      saveDigitalCardInputFromValues(
        completedValues({ link1Url: "javascript:alert(1)", link1Label: "Bad" }),
      ),
    );
    assert.equal(website.ok, false);
    assert.equal(portrait.ok, false);
    assert.equal(extra.ok, false);
    if (!website.ok) assert.equal(website.fieldErrors.websiteUrl, "Enter a valid website URL.");
    if (!portrait.ok) {
      assert.equal(portrait.fieldErrors.avatarUrl, "Portrait must use an HTTPS URL.");
    }
    if (!extra.ok) assert.equal(extra.fieldErrors.link1Url, "Enter a valid URL for this link.");
  });

  it("does not replace submitted values with an empty persisted card", () => {
    const submitted = completedValues({ websiteUrl: "www.hourglassdiamonds.com" });
    const display = resolveMyCardFormDisplay({
      card: null,
      status: "error",
      submitted,
      fieldErrors: { websiteUrl: "Enter a valid website URL." },
      message: "Enter a valid website URL.",
    });
    assert.notEqual(display.values.displayName, "");
    assert.equal(myCardFormValuesFromCard(null).displayName, "");
  });

  it("reads checkbox and link rows from FormData the same way the action does", () => {
    const formData = new FormData();
    formData.set("displayName", "Justin Smith");
    formData.set("slug", "justin-smith");
    formData.set("published", "true");
    formData.set("emailPublic", "true");
    formData.set("link1Label", "Studio");
    formData.set("link1Url", "https://example.com");
    const values = myCardFormValuesFromFormData(formData);
    assert.equal(values.published, true);
    assert.equal(values.phonePublic, false);
    assert.equal(values.link1Label, "Studio");
    assert.equal(values.link2Url, "");
    const errors = clientMyCardFieldErrors(values);
    assert.equal(errors.displayName, undefined);
    assert.equal(
      clientMyCardFieldErrors(completedValues({ websiteUrl: "www.hourglassdiamonds.com" }))
        .websiteUrl,
      "Enter a valid website URL.",
    );
  });
});
