import type {
  OwnGoogleReview,
  ReviewAcceleration,
  ReviewAuthorityRow,
  ReviewCountSnapshot,
  ReviewWindow,
  TrackedPlace,
} from "./types";

export const REVIEW_WINDOWS = [3, 6, 12, 24] as const;
const MS_PER_DAY = 86_400_000;
const DAYS_PER_MONTH = 30.4375;

function dayStart(value: string | Date): Date {
  const date = value instanceof Date ? value : new Date(value);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function subtractUtcMonths(value: Date, months: number): Date {
  const result = new Date(value);
  const originalDay = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() - months);
  const lastDay = new Date(Date.UTC(
    result.getUTCFullYear(),
    result.getUTCMonth() + 1,
    0,
  )).getUTCDate();
  result.setUTCDate(Math.min(originalDay, lastDay));
  return result;
}

function daysBetween(start: Date, end: Date): number {
  return Math.max(0, Math.round((dayStart(end).getTime() - dayStart(start).getTime()) / MS_PER_DAY));
}

function monthlyRate(count: number, coverageDays: number): number | null {
  if (coverageDays <= 0) return null;
  return count / (coverageDays / DAYS_PER_MONTH);
}

function unavailable(months: 3 | 6 | 12 | 24, reason: string, coverageDays = 0): ReviewWindow {
  return {
    months,
    method: "unavailable",
    reviewsAdded: null,
    coverageDays,
    monthlyRate: null,
    unavailableReason: reason,
  };
}

export function calculateExactWindow(
  reviews: readonly Pick<OwnGoogleReview, "publishedAt">[],
  months: 3 | 6 | 12 | 24,
  asOfInput: string | Date,
): ReviewWindow {
  const asOf = dayStart(asOfInput);
  const start = subtractUtcMonths(asOf, months);
  const coverageDays = daysBetween(start, asOf);
  const reviewsAdded = reviews.filter((review) => {
    const published = new Date(review.publishedAt);
    return published > start && published <= new Date(asOf.getTime() + MS_PER_DAY - 1);
  }).length;
  return {
    months,
    method: "exact-timestamps",
    reviewsAdded,
    coverageDays,
    monthlyRate: monthlyRate(reviewsAdded, coverageDays),
  };
}

export function calculateSnapshotWindow(
  snapshotsInput: readonly ReviewCountSnapshot[],
  months: 3 | 6 | 12 | 24,
  asOfInput: string | Date,
): ReviewWindow {
  const asOf = dayStart(asOfInput);
  const start = subtractUtcMonths(asOf, months);
  const snapshots = [...snapshotsInput]
    .filter((snapshot) => dayStart(snapshot.capturedOn) <= asOf)
    .sort((a, b) => a.capturedOn.localeCompare(b.capturedOn));
  const latest = snapshots.at(-1);
  if (!latest) return unavailable(months, "No review-count snapshots available");

  const first = snapshots[0];
  const baseline = [...snapshots]
    .reverse()
    .find((snapshot) => dayStart(snapshot.capturedOn) <= start);
  if (!baseline) {
    const coverageDays = first
      ? daysBetween(dayStart(first.capturedOn), dayStart(latest.capturedOn))
      : 0;
    return unavailable(
      months,
      `Snapshots since ${first?.capturedOn ?? latest.capturedOn}`,
      coverageDays,
    );
  }

  const coverageDays = daysBetween(dayStart(baseline.capturedOn), dayStart(latest.capturedOn));
  const reviewsAdded = Math.max(0, latest.reviewCount - baseline.reviewCount);
  return {
    months,
    method: "snapshot-delta",
    reviewsAdded,
    coverageDays,
    monthlyRate: monthlyRate(reviewsAdded, coverageDays),
  };
}

function countExactBetween(
  reviews: readonly Pick<OwnGoogleReview, "publishedAt">[],
  after: Date,
  through: Date,
): number {
  return reviews.filter((review) => {
    const published = new Date(review.publishedAt);
    return published > after && published <= through;
  }).length;
}

/**
 * Pace uses an absolute one-review dead band: a difference of zero or one review
 * between adjacent three-month periods is "steady", avoiding false precision at
 * this deliberately small sample size.
 */
export function calculateAcceleration(input: {
  reviews?: readonly Pick<OwnGoogleReview, "publishedAt">[];
  snapshots?: readonly ReviewCountSnapshot[];
  asOf: string | Date;
}): ReviewAcceleration {
  const asOf = dayStart(input.asOf);
  const end = new Date(asOf.getTime() + MS_PER_DAY - 1);
  const threeMonthsAgo = subtractUtcMonths(asOf, 3);
  const sixMonthsAgo = subtractUtcMonths(asOf, 6);
  let latestCount: number;
  let priorCount: number;

  if (input.reviews) {
    latestCount = countExactBetween(input.reviews, threeMonthsAgo, end);
    priorCount = countExactBetween(input.reviews, sixMonthsAgo, threeMonthsAgo);
  } else if (input.snapshots) {
    const sorted = [...input.snapshots]
      .filter((snapshot) => dayStart(snapshot.capturedOn) <= asOf)
      .sort((a, b) => a.capturedOn.localeCompare(b.capturedOn));
    const atOrBefore = (date: Date) => [...sorted]
      .reverse()
      .find((snapshot) => dayStart(snapshot.capturedOn) <= date);
    const start = atOrBefore(sixMonthsAgo);
    const middle = atOrBefore(threeMonthsAgo);
    const latest = atOrBefore(asOf);
    if (!start || !middle || !latest) return "unavailable";
    priorCount = Math.max(0, middle.reviewCount - start.reviewCount);
    latestCount = Math.max(0, latest.reviewCount - middle.reviewCount);
  } else {
    return "unavailable";
  }

  const difference = latestCount - priorCount;
  if (Math.abs(difference) <= 1) return "steady";
  return difference > 0 ? "accelerating" : "decelerating";
}

export function buildReviewAuthorityRow(input: {
  place: TrackedPlace;
  snapshots: readonly ReviewCountSnapshot[];
  ownReviews?: readonly OwnGoogleReview[];
  asOf: string | Date;
  staticFallbackRating?: number;
}): ReviewAuthorityRow {
  const snapshots = [...input.snapshots].sort((a, b) => a.capturedOn.localeCompare(b.capturedOn));
  const latestSnapshot = snapshots.at(-1) ?? null;
  const exact = input.place.role === "self" && input.ownReviews !== undefined;
  const windows = Object.fromEntries(
    REVIEW_WINDOWS.map((months) => [
      months,
      exact
        ? calculateExactWindow(input.ownReviews ?? [], months, input.asOf)
        : calculateSnapshotWindow(snapshots, months, input.asOf),
    ]),
  ) as ReviewAuthorityRow["windows"];
  const reviews = input.ownReviews ?? [];
  const latestReview = [...reviews].sort((a, b) => a.publishedAt.localeCompare(b.publishedAt)).at(-1);
  const hasLegitimateObservation = Boolean(latestSnapshot) || exact;
  const fallbackRating = hasLegitimateObservation ? null : input.staticFallbackRating ?? null;

  return {
    placeId: input.place.id,
    googlePlaceId: input.place.googlePlaceId,
    role: input.place.role,
    business: input.place.displayName,
    rating: latestSnapshot?.rating ?? fallbackRating,
    ratingEvidence: latestSnapshot?.rating != null
      ? input.place.role === "self" ? "observed" : "snapshot-derived"
      : fallbackRating != null ? "static-fallback" : "unavailable",
    totalReviews: latestSnapshot?.reviewCount ?? (exact ? reviews.length : null),
    totalReviewsEvidence: latestSnapshot
      ? "snapshot-derived"
      : exact ? "exact-timestamps" : "unavailable",
    windows,
    pace: calculateAcceleration(exact
      ? { reviews, asOf: input.asOf }
      : { snapshots, asOf: input.asOf }),
    latestReviewAt: latestReview?.publishedAt ?? null,
    latestSnapshotAt: latestSnapshot?.capturedOn ?? null,
  };
}

export function calculateShareOfTrackedReviewGrowth(
  rows: readonly ReviewAuthorityRow[],
  hourglassPlaceId: string,
): number | null {
  if (rows.length !== 5) return null;
  const windows = rows.map((row) => row.windows[6]);
  if (windows.some((window) => window.method === "unavailable" || window.reviewsAdded == null)) {
    return null;
  }
  const methods = new Set(windows.map((window) => window.method));
  if (methods.size !== 1) return null;
  const coverage = windows.map((window) => window.coverageDays);
  if (Math.max(...coverage) - Math.min(...coverage) > 7) return null;
  const total = windows.reduce((sum, window) => sum + (window.reviewsAdded ?? 0), 0);
  if (total <= 0) return null;
  const hourglass = rows.find((row) => row.placeId === hourglassPlaceId)?.windows[6].reviewsAdded;
  return hourglass == null ? null : hourglass / total;
}
