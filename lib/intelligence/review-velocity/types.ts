export const TRACKED_PLACE_NAMES = [
  "Hourglass Diamonds",
  "Donald Haack Diamonds",
  "Malak Jewelers",
  "Ballantyne Jewelers",
  "Diamonds Direct Charlotte",
] as const;

export type TrackedPlaceRole = "self" | "competitor";
export type ReviewSnapshotSource =
  | "places-details"
  | "local-falcon-competitor-report"
  | "manual-bootstrap";

export type TrackedPlace = {
  id: string;
  role: TrackedPlaceRole;
  displayName: string;
  googlePlaceId: string | null;
  active: boolean;
};

export type ReviewCountSnapshot = {
  placeId: string;
  capturedOn: string;
  source: ReviewSnapshotSource;
  sourceRef: string | null;
  rating: number | null;
  reviewCount: number;
};

export type OwnGoogleReview = {
  reviewName: string;
  placeId: string;
  publishedAt: string;
  starRating: number;
  hasOwnerReply: boolean;
  replyPublishedAt: string | null;
};

export type ReviewWindowMethod =
  | "exact-timestamps"
  | "snapshot-delta"
  | "unavailable";

export type ReviewWindow = {
  months: 3 | 6 | 12 | 24;
  method: ReviewWindowMethod;
  reviewsAdded: number | null;
  coverageDays: number;
  monthlyRate: number | null;
  unavailableReason?: string;
};

export type ReviewAcceleration =
  | "accelerating"
  | "steady"
  | "decelerating"
  | "unavailable";

export type ReviewAuthorityRow = {
  placeId: string;
  googlePlaceId: string | null;
  role: TrackedPlaceRole;
  business: string;
  rating: number | null;
  ratingEvidence: "observed" | "snapshot-derived" | "static-fallback" | "unavailable";
  totalReviews: number | null;
  totalReviewsEvidence: "exact-timestamps" | "snapshot-derived" | "unavailable";
  windows: Record<3 | 6 | 12 | 24, ReviewWindow>;
  pace: ReviewAcceleration;
  latestReviewAt: string | null;
  latestSnapshotAt: string | null;
};

export type ReviewAuthorityData = {
  rows: ReviewAuthorityRow[];
  shareOfTrackedReviewGrowth: number | null;
  shareWindowMonths: 6;
};

export type ReviewVelocityEvidence = {
  places: TrackedPlace[];
  snapshots: ReviewCountSnapshot[];
  ownReviews: OwnGoogleReview[];
};
