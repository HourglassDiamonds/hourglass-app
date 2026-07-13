import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildHumanReadableSource,
  sanitizeAttributionFromFormData,
  sanitizeAttributionRecord,
  sanitizeAttributionValue,
} from "./attribution";

describe("sanitizeAttributionValue", () => {
  it("rejects emails and phone-like values", () => {
    assert.equal(
      sanitizeAttributionValue("person@example.com", 80),
      undefined,
    );
    assert.equal(sanitizeAttributionValue("+1 (704) 555-0199", 80), undefined);
  });

  it("keeps safe utm-like tokens", () => {
    assert.equal(
      sanitizeAttributionValue("google-ads_spring", 80),
      "google-ads_spring",
    );
  });
});

describe("sanitizeAttributionRecord", () => {
  it("keeps UTMs and landing path, drops arbitrary query and full referrer", () => {
    const snapshot = sanitizeAttributionRecord({
      utm_source: "google",
      utm_medium: "cpc",
      utm_campaign: "shape-launch",
      landing_path: "/diamond-shape-studio?secret=abc#frag",
      landing_query: "utm_source=google&email=x@y.com&token=abc",
      referrer: "https://www.google.com/search?q=hourglass&email=x@y.com",
      referrer_host: "www.google.com",
      referrer_path: "/search?q=should-strip",
      last_cta_location: "header:nav_desktop",
      originating_tool: "diamond-intelligence",
      originating_content: "oval-vs-round",
    });

    assert.equal(snapshot.utm_source, "google");
    assert.equal(snapshot.utm_medium, "cpc");
    assert.equal(snapshot.utm_campaign, "shape-launch");
    assert.equal(snapshot.landing_path, "/diamond-shape-studio");
    assert.equal(
      (snapshot as { landing_query?: string }).landing_query,
      undefined,
    );
    assert.equal((snapshot as { referrer?: string }).referrer, undefined);
    assert.equal(snapshot.referrer_host, "www.google.com");
    assert.equal(snapshot.referrer_path, "/search");
    assert.equal(snapshot.last_cta_location, "header:nav_desktop");
    assert.equal(snapshot.originating_tool, "diamond-intelligence");
    assert.equal(snapshot.originating_content, "oval-vs-round");
  });
});

describe("sanitizeAttributionFromFormData", () => {
  it("ignores legacy landing_query and full referrer fields", () => {
    const formData = new FormData();
    formData.set("utm_source", "newsletter");
    formData.set("landing_path", "/concierge");
    formData.set("landing_query", "email=leak@example.com&foo=bar");
    formData.set("referrer", "https://evil.example/path?token=1");
    formData.set("referrer_host", "evil.example");
    formData.set("referrer_path", "/path");

    const snapshot = sanitizeAttributionFromFormData(formData);
    assert.equal(snapshot.utm_source, "newsletter");
    assert.equal(snapshot.landing_path, "/concierge");
    assert.equal(
      (snapshot as { landing_query?: string }).landing_query,
      undefined,
    );
    assert.equal((snapshot as { referrer?: string }).referrer, undefined);
    assert.equal(snapshot.referrer_host, "evil.example");
    assert.equal(snapshot.referrer_path, "/path");
  });
});

describe("buildHumanReadableSource", () => {
  it("builds a compact non-PII source string", () => {
    const source = buildHumanReadableSource({
      originating_tool: "diamond-intelligence",
      utm_source: "google",
      utm_medium: "cpc",
      last_cta_location: "di:results_cta",
    });
    assert.match(source, /tool:diamond-intelligence/);
    assert.match(source, /utm:google/);
    assert.doesNotMatch(source, /@/);
  });
});
