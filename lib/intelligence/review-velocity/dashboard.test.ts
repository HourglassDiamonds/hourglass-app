import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  REVIEW_AUTHORITY_PLACEHOLDER,
  STATIC_GOOGLE_REVIEWS,
} from "../dashboard-data";
import {
  ReviewAuthoritySummary,
  reviewWindowLabel,
} from "@/app/executive-dashboard/dashboard-view";

describe("review authority dashboard states", () => {
  it("does not assign a Stable trend to the static 5.0 fallback", () => {
    assert.equal(STATIC_GOOGLE_REVIEWS.value, "5.0");
    assert.equal(STATIC_GOOGLE_REVIEWS.status, undefined);
    assert.equal(STATIC_GOOGLE_REVIEWS.sourceLabel, "Static fallback");
  });

  it("renders snapshot coverage instead of zero for unavailable windows", () => {
    assert.equal(reviewWindowLabel({
      months: 12,
      method: "unavailable",
      reviewsAdded: null,
      coverageDays: 90,
      monthlyRate: null,
      unavailableReason: "Snapshots since 2026-06-01",
    }), "Snapshots since Jun 2026");
  });

  it("renders only the compact five-business dashboard summary", () => {
    const html = renderToStaticMarkup(createElement(ReviewAuthoritySummary, {
      data: REVIEW_AUTHORITY_PLACEHOLDER,
    }));
    for (const name of [
      "Hourglass Diamonds",
      "Donald Haack Diamonds",
      "Malak Jewelers",
      "Ballantyne Jewelers",
      "Diamonds Direct Charlotte",
    ]) {
      assert.match(html, new RegExp(name));
    }
    assert.match(html, /Tracked competitors · 3m/);
    assert.doesNotMatch(html, /Reviews\/month|Corroboration|Action queue|Observed history/);
  });
});
