/**
 * Privacy Policy disclosure regression — current vendors and retention truth.
 * Source-string assertions by repo convention.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const root = dirname(fileURLToPath(import.meta.url));
const privacy = readFileSync(join(root, "page.tsx"), "utf8");

describe("Privacy Policy current-system disclosures", () => {
  it("names consultation HubSpot handling", () => {
    assert.match(privacy, /Consultation information/);
    assert.match(privacy, /HubSpot as our CRM/);
  });

  it("names Google Analytics and visitor choice", () => {
    assert.match(privacy, /Google Analytics/);
    assert.match(privacy, /only after you choose to allow it/);
    assert.match(privacy, /Analytics in the site footer/);
    assert.match(privacy, /anonymized before analytics processing/);
  });

  it("names See It On Your Hand session storage and cleanup", () => {
    assert.match(privacy, /See It On Your Hand/);
    assert.match(privacy, /Supabase/);
    assert.match(privacy, /expire after 30 minutes/);
  });

  it("names Analyze Sparkle files, OCR text, listing URLs, and 30-day deletion", () => {
    assert.match(privacy, /Analyze Sparkle/);
    assert.match(privacy, /optical character recognition/);
    assert.match(privacy, /source filename/);
    assert.match(privacy, /listing or report URLs/);
    assert.match(privacy, /eligible[\s\S]*automatic deletion after 30 days/);
    assert.match(privacy, /optional remote OCR processor/);
  });

  it("names Email This View and Resend without claiming image archives", () => {
    assert.match(privacy, /Email This View/);
    assert.match(privacy, /Resend/);
    assert.match(privacy, /not kept[\s\S]*permanent file/);
  });

  it("names Cloudinary and YouTube, not unused Mux", () => {
    assert.match(privacy, /Cloudinary/);
    assert.match(privacy, /YouTube/);
    assert.doesNotMatch(privacy, /\bMux\b/);
  });

  it("names the existing privacy-request inbox", () => {
    assert.match(privacy, /Your rights and how to reach us/);
    assert.match(privacy, /justin@hourglassdiamonds.com/);
  });

  it("includes a children statement", () => {
    assert.match(privacy, /Children/);
    assert.match(privacy, /not directed to children under 13/);
  });

  it("does not invent immediate deletion or model training", () => {
    assert.doesNotMatch(privacy, /deleted immediately/);
    assert.doesNotMatch(privacy, /never transferred/);
    assert.doesNotMatch(privacy, /do not sell, rent,\s+or distribute personal information/);
    assert.match(
      privacy,
      /We do not sell or\s+rent your personal information/,
    );
    assert.match(
      privacy,
      /share information with service\s+providers only as needed/,
    );
    assert.match(
      privacy,
      /Hourglass does not use\s+your uploaded reports or photos to train a public AI model/,
    );
  });
});
