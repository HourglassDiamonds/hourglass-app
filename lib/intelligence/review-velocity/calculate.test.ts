import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildReviewAuthorityRow,
  calculateAcceleration,
  calculateExactWindow,
  calculateShareOfTrackedReviewGrowth,
  calculateSnapshotWindow,
} from "./calculate";
import type { OwnGoogleReview, ReviewCountSnapshot, TrackedPlace } from "./types";

const SELF: TrackedPlace = {
  id: "self",
  role: "self",
  displayName: "Hourglass Diamonds",
  googlePlaceId: null,
  active: true,
};

function review(publishedAt: string, index: number): OwnGoogleReview {
  return {
    reviewName: `reviews/${index}`,
    placeId: "self",
    publishedAt,
    starRating: 5,
    hasOwnerReply: false,
    replyPublishedAt: null,
  };
}

function snapshot(date: string, count: number, placeId = "competitor"): ReviewCountSnapshot {
  return {
    placeId,
    capturedOn: date,
    source: "places-details",
    sourceRef: null,
    rating: 4.9,
    reviewCount: count,
  };
}

describe("review-window calculations", () => {
  it("uses exact Hourglass timestamps for each trailing window", () => {
    const reviews = [
      review("2026-09-20T12:00:00Z", 1),
      review("2026-08-01T12:00:00Z", 2),
      review("2026-05-01T12:00:00Z", 3),
      review("2025-12-01T12:00:00Z", 4),
    ];
    const three = calculateExactWindow(reviews, 3, "2026-10-01");
    const twelve = calculateExactWindow(reviews, 12, "2026-10-01");
    assert.equal(three.method, "exact-timestamps");
    assert.equal(three.reviewsAdded, 2);
    assert.equal(twelve.reviewsAdded, 4);
    assert.ok((three.monthlyRate ?? 0) > 0);
    const row = buildReviewAuthorityRow({
      place: SELF,
      snapshots: [],
      ownReviews: reviews,
      asOf: "2026-10-01",
      staticFallbackRating: 5,
    });
    assert.equal(row.rating, null);
    assert.equal(row.ratingEvidence, "unavailable");
  });

  it("calculates competitor growth only from a baseline at or before the window", () => {
    const rows = [snapshot("2026-03-20", 100), snapshot("2026-10-01", 114)];
    const six = calculateSnapshotWindow(rows, 6, "2026-10-01");
    assert.equal(six.method, "snapshot-delta");
    assert.equal(six.reviewsAdded, 14);
  });

  it("leaves 12m and 24m unavailable when only 90 days are observed", () => {
    const rows = [snapshot("2026-07-01", 100), snapshot("2026-10-01", 108)];
    for (const months of [12, 24] as const) {
      const window = calculateSnapshotWindow(rows, months, "2026-10-01");
      assert.equal(window.method, "unavailable");
      assert.equal(window.reviewsAdded, null);
      assert.match(window.unavailableReason ?? "", /Snapshots since 2026-07-01/);
    }
  });

  it("uses a one-review dead band for acceleration", () => {
    const steady = [
      review("2026-04-10T12:00:00Z", 1),
      review("2026-04-20T12:00:00Z", 2),
      review("2026-05-10T12:00:00Z", 3),
      review("2026-05-20T12:00:00Z", 4),
      review("2026-06-10T12:00:00Z", 5),
      review("2026-07-10T12:00:00Z", 6),
      review("2026-07-20T12:00:00Z", 7),
      review("2026-08-10T12:00:00Z", 8),
      review("2026-08-20T12:00:00Z", 9),
      review("2026-09-10T12:00:00Z", 10),
      review("2026-09-20T12:00:00Z", 11),
    ];
    assert.equal(calculateAcceleration({ reviews: steady, asOf: "2026-10-01" }), "steady");

    const accelerating = [
      review("2026-04-10T12:00:00Z", 30),
      ...Array.from({ length: 4 }, (_, i) => review(`2026-09-${10 + i}T12:00:00Z`, 40 + i)),
    ];
    assert.equal(calculateAcceleration({ reviews: accelerating, asOf: "2026-10-01" }), "accelerating");
  });

  it("hides tracked-growth share when methods or coverage differ", () => {
    const own = buildReviewAuthorityRow({
      place: SELF,
      snapshots: [],
      ownReviews: [review("2026-09-01T12:00:00Z", 1)],
      asOf: "2026-10-01",
    });
    const competitors = Array.from({ length: 4 }, (_, index) => buildReviewAuthorityRow({
      place: {
        id: `c${index}`,
        role: "competitor",
        displayName: `Competitor ${index}`,
        googlePlaceId: `confirmed-${index}`,
        active: true,
      },
      snapshots: [snapshot("2026-03-01", 10, `c${index}`), snapshot("2026-10-01", 15, `c${index}`)],
      asOf: "2026-10-01",
    }));
    assert.equal(calculateShareOfTrackedReviewGrowth([own, ...competitors], "self"), null);
  });
});
