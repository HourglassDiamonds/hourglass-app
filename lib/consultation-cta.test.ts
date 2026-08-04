import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildConciergeHref,
  isBareConciergeHref,
} from "./consultation-cta";

describe("buildConciergeHref", () => {
  it("falls back to /concierge with no input", () => {
    assert.equal(buildConciergeHref(), "/concierge");
    assert.equal(buildConciergeHref({}), "/concierge");
  });

  it("builds tool and content query params", () => {
    assert.equal(
      buildConciergeHref({
        tool: "diamond-guide",
        content: "what-is-diamond-cut",
      }),
      "/concierge?tool=diamond-guide&content=what-is-diamond-cut",
    );
  });

  it("preserves existing explicit query parameters", () => {
    const href = buildConciergeHref({
      tool: "diamond-studio",
      params: {
        shape: "oval",
        utm_campaign: "spring",
      },
    });
    const url = new URL(href, "https://hourglass.test");
    assert.equal(url.pathname, "/concierge");
    assert.equal(url.searchParams.get("tool"), "diamond-studio");
    assert.equal(url.searchParams.get("shape"), "oval");
    assert.equal(url.searchParams.get("utm_campaign"), "spring");
  });

  it("lets explicit tool/content win over params of the same name", () => {
    const href = buildConciergeHref({
      tool: "diamond-guide",
      content: "article-a",
      params: {
        tool: "stale-tool",
        content: "stale-content",
      },
    });
    const url = new URL(href, "https://hourglass.test");
    assert.equal(url.searchParams.get("tool"), "diamond-guide");
    assert.equal(url.searchParams.get("content"), "article-a");
  });

  it("never includes PII-like values", () => {
    const href = buildConciergeHref({
      tool: "person@example.com",
      content: "+1 (704) 555-0199",
      params: { note: "token=abc123" },
    });
    assert.equal(href, "/concierge");
  });
});

describe("isBareConciergeHref", () => {
  it("detects bare /concierge for new-tab-safe attribution replacement", () => {
    assert.equal(isBareConciergeHref("/concierge"), true);
    assert.equal(isBareConciergeHref("/concierge?"), true);
    assert.equal(isBareConciergeHref("  /concierge  "), true);
  });

  it("leaves attributed and non-concierge hrefs alone", () => {
    assert.equal(
      isBareConciergeHref("/concierge?tool=diamond-guide&content=cut"),
      false,
    );
    assert.equal(
      isBareConciergeHref(
        "/concierge?source=diamond-intelligence&lab=GIA&report=123",
      ),
      false,
    );
    assert.equal(isBareConciergeHref("/diamond-guide"), false);
  });
});
