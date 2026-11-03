import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TodayIntelligenceStatus } from "./today-intelligence-status";

describe("Today intelligence source status", () => {
  it("states when Today is using canonical fallback instead of Sterling", () => {
    const html = renderToStaticMarkup(createElement(TodayIntelligenceStatus, {
      status: {
        source: "canonical_fallback",
        sterlingStatus: "unavailable",
        runId: null,
        sourceWatermark: null,
        validationResult: null,
        publishedAt: null,
        expiresAt: null,
      },
    }));
    assert.match(html, /Canonical Today/);
    assert.match(html, /No current validated Sterling publication is available/);
    assert.match(html, /correspondence freshness is reported separately/);
    assert.doesNotMatch(html, /Sterling verified/);
  });

  it("shows the complete provenance contract for a fresh Sterling publication", () => {
    const html = renderToStaticMarkup(createElement(TodayIntelligenceStatus, {
      status: {
        source: "sterling",
        sterlingStatus: "active",
        runId: "00000000-0000-5000-8000-000000000001",
        sourceWatermark: "gmail:42|canonical:17",
        validationResult: "PASS",
        publishedAt: "2026-11-03T14:00:00.000Z",
        expiresAt: "2026-11-03T14:15:00.000Z",
      },
    }));
    assert.match(html, /Sterling verified/);
    assert.match(html, /Validation:.*PASS/);
    assert.match(html, /00000000-0000-5000-8000-000000000001/);
    assert.match(html, /gmail:42\|canonical:17/);
    assert.match(html, /expires/i);
  });
});
