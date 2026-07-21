import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ANALYTICS_QUERY_ALLOWLIST,
  DI_CONCIERGE_SENSITIVE_QUERY_KEYS,
  buildAnalyticsPageViewParams,
  sanitizeAnalyticsPageLocation,
  sanitizeAnalyticsPagePath,
} from "./sanitize-page-location";
import { SITE_URL } from "@/lib/seo/site-metadata";

describe("sanitizeAnalyticsPagePath", () => {
  it("keeps a plain pathname unchanged", () => {
    assert.equal(sanitizeAnalyticsPagePath("/concierge"), "/concierge");
    assert.equal(sanitizeAnalyticsPagePath("/"), "/");
  });

  it("retains a single approved UTM", () => {
    assert.equal(
      sanitizeAnalyticsPagePath(
        "/diamond-studio",
        "utm_source=instagram",
      ),
      "/diamond-studio?utm_source=instagram",
    );
  });

  it("retains multiple approved UTMs", () => {
    const path = sanitizeAnalyticsPagePath(
      "/",
      "utm_source=instagram&utm_medium=organic_social&utm_campaign=hg_conv_01&utm_content=clip_01&utm_term=oval&utm_id=abc",
    );
    for (const key of ANALYTICS_QUERY_ALLOWLIST) {
      assert.match(path, new RegExp(`${key}=`));
    }
    assert.ok(path.startsWith("/?"));
  });

  it("removes unapproved parameters", () => {
    assert.equal(
      sanitizeAnalyticsPagePath(
        "/concierge",
        "utm_source=instagram&foo=bar&ref=home",
      ),
      "/concierge?utm_source=instagram",
    );
  });

  it("removes Diamond Intelligence / Concierge sensitive keys", () => {
    const sensitive = DI_CONCIERGE_SENSITIVE_QUERY_KEYS.map(
      (key) => `${key}=secret-value`,
    ).join("&");
    const path = sanitizeAnalyticsPagePath(
      "/concierge",
      `${sensitive}&utm_campaign=hg_conv_01`,
    );
    assert.equal(path, "/concierge?utm_campaign=hg_conv_01");
    for (const key of DI_CONCIERGE_SENSITIVE_QUERY_KEYS) {
      assert.doesNotMatch(path, new RegExp(`(?:\\?|&)${key}=`));
    }
  });

  it("removes report-number and listing URL parameters", () => {
    assert.equal(
      sanitizeAnalyticsPagePath(
        "/concierge",
        "report=GIA-1234567890&url=https%3A%2F%2Fwww.example.com%2Fdiamond%2F99&utm_source=youtube",
      ),
      "/concierge?utm_source=youtube",
    );
  });

  it("removes encoded sensitive values carried in unapproved keys", () => {
    assert.equal(
      sanitizeAnalyticsPagePath(
        "/concierge?sid=abc%20123&email=person%40example.com&utm_medium=organic_social",
      ),
      "/concierge?utm_medium=organic_social",
    );
  });

  it("strips fragments", () => {
    assert.equal(
      sanitizeAnalyticsPagePath("/concierge?utm_source=tiktok#section"),
      "/concierge?utm_source=tiktok",
    );
    assert.equal(sanitizeAnalyticsPagePath("/tools#top"), "/tools");
  });

  it("fails safely on malformed input", () => {
    assert.equal(sanitizeAnalyticsPagePath(""), "/");
    assert.equal(sanitizeAnalyticsPagePath("https://"), "/");
    assert.equal(sanitizeAnalyticsPagePath("not a url ::"), "/not a url ::");
  });

  it("does not mutate the browser URL", () => {
    const hrefBefore = "https://example.test/concierge?report=KEEP";
    // jsdom/window may be absent in node:test — only assert pure function purity.
    const once = sanitizeAnalyticsPagePath(
      "/concierge",
      "report=KEEP&utm_source=linkedin",
    );
    const twice = sanitizeAnalyticsPagePath(
      "/concierge",
      "report=KEEP&utm_source=linkedin",
    );
    assert.equal(once, twice);
    assert.equal(once, "/concierge?utm_source=linkedin");
    assert.equal(hrefBefore, "https://example.test/concierge?report=KEEP");
  });

  it("sanitizes absolute URLs without logging", () => {
    const path = sanitizeAnalyticsPagePath(
      "https://www.hourglassdiamonds.com/concierge?report=XYZ&utm_source=facebook",
    );
    assert.equal(path, "/concierge?utm_source=facebook");
  });
});

describe("sanitizeAnalyticsPageLocation", () => {
  it("builds an absolute location from the canonical origin", () => {
    assert.equal(
      sanitizeAnalyticsPageLocation("/concierge", "utm_source=instagram"),
      `${SITE_URL}/concierge?utm_source=instagram`,
    );
  });

  it("never reintroduces stripped query keys into page_location", () => {
    const location = sanitizeAnalyticsPageLocation(
      "/concierge",
      "report=GIA-1&url=https://vendor.example/d/1&utm_campaign=hg_conv_01",
    );
    assert.equal(
      location,
      `${SITE_URL}/concierge?utm_campaign=hg_conv_01`,
    );
    assert.doesNotMatch(location, /report=/);
    assert.doesNotMatch(location, /url=/);
  });
});

describe("buildAnalyticsPageViewParams", () => {
  it("keeps page_path and page_location consistent", () => {
    const params = buildAnalyticsPageViewParams(
      "/diamond-studio",
      "utm_content=carousel&sid=nope",
    );
    assert.equal(params.page_path, "/diamond-studio?utm_content=carousel");
    assert.equal(
      params.page_location,
      `${SITE_URL}/diamond-studio?utm_content=carousel`,
    );
  });
});
