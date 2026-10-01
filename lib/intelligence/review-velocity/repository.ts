import { getSupabaseAdmin } from "@/lib/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildReviewAuthorityRow,
  calculateShareOfTrackedReviewGrowth,
} from "./calculate";
import type {
  OwnGoogleReview,
  ReviewAuthorityData,
  ReviewCountSnapshot,
  ReviewSnapshotSource,
  TrackedPlace,
  ReviewVelocityEvidence,
} from "./types";

type TrackedPlaceRow = {
  id: string;
  role: "self" | "competitor";
  display_name: string;
  google_place_id: string | null;
  active: boolean;
};

function mapPlace(row: TrackedPlaceRow): TrackedPlace {
  return {
    id: row.id,
    role: row.role,
    displayName: row.display_name,
    googlePlaceId: row.google_place_id,
    active: row.active,
  };
}

export async function listActiveTrackedPlaces(
  client: SupabaseClient | null = getSupabaseAdmin(),
): Promise<TrackedPlace[]> {
  const supabase = client;
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("tracked_places")
    .select("id,role,display_name,google_place_id,active")
    .eq("active", true)
    .order("role", { ascending: false })
    .order("display_name");
  if (error) throw new Error(`Failed to load tracked places: ${error.message}`);
  return ((data ?? []) as TrackedPlaceRow[]).map(mapPlace);
}

export async function loadReviewVelocityEvidence(
  client: SupabaseClient | null = getSupabaseAdmin(),
): Promise<ReviewVelocityEvidence> {
  if (!client) return { places: [], snapshots: [], ownReviews: [] };

  const { data: placeRows, error: placeError } = await client
    .from("tracked_places")
    .select("id,role,display_name,google_place_id,active")
    .eq("active", true)
    .order("role", { ascending: false })
    .order("display_name");
  if (placeError) throw new Error(`Failed to load tracked places: ${placeError.message}`);
  const places = ((placeRows ?? []) as TrackedPlaceRow[]).map(mapPlace);
  if (!places.length) return { places, snapshots: [], ownReviews: [] };

  const placeIds = places.map((place) => place.id);
  const [{ data: snapshotRows, error: snapshotError }, { data: reviewRows, error: reviewError }] =
    await Promise.all([
      client
        .from("review_count_snapshots")
        .select("place_id,captured_on,source,source_ref,rating,review_count")
        .in("place_id", placeIds)
        .order("captured_on"),
      client
        .from("own_google_reviews")
        .select("review_name,place_id,published_at,star_rating,has_owner_reply,reply_published_at")
        .in("place_id", placeIds)
        .order("published_at"),
    ]);
  if (snapshotError) throw new Error(`Failed to load review snapshots: ${snapshotError.message}`);
  if (reviewError) throw new Error(`Failed to load Hourglass reviews: ${reviewError.message}`);

  const snapshots: ReviewCountSnapshot[] = (snapshotRows ?? []).map((row) => ({
    placeId: row.place_id as string,
    capturedOn: row.captured_on as string,
    source: row.source as ReviewSnapshotSource,
    sourceRef: (row.source_ref as string | null) ?? null,
    rating: row.rating == null ? null : Number(row.rating),
    reviewCount: Number(row.review_count),
  }));
  const ownReviews: OwnGoogleReview[] = (reviewRows ?? []).map((row) => ({
    reviewName: row.review_name as string,
    placeId: row.place_id as string,
    publishedAt: row.published_at as string,
    starRating: Number(row.star_rating),
    hasOwnerReply: Boolean(row.has_owner_reply),
    replyPublishedAt: (row.reply_published_at as string | null) ?? null,
  }));
  return { places, snapshots, ownReviews };
}

export async function upsertReviewCountSnapshot(input: {
  placeId: string;
  capturedOn: string;
  source: ReviewSnapshotSource;
  sourceRef?: string | null;
  rating: number | null;
  reviewCount: number;
}): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase is not configured");
  const { error } = await supabase.from("review_count_snapshots").upsert(
    {
      place_id: input.placeId,
      captured_on: input.capturedOn,
      source: input.source,
      source_ref: input.sourceRef ?? null,
      rating: input.rating,
      review_count: input.reviewCount,
    },
    { onConflict: "place_id,captured_on,source" },
  );
  if (error) throw new Error(`Failed to save review snapshot: ${error.message}`);
}

export async function upsertOwnGoogleReviews(reviews: readonly OwnGoogleReview[]): Promise<number> {
  if (!reviews.length) return 0;
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase is not configured");
  const ingestedAt = new Date().toISOString();
  const { error } = await supabase.from("own_google_reviews").upsert(
    reviews.map((review) => ({
      review_name: review.reviewName,
      place_id: review.placeId,
      published_at: review.publishedAt,
      star_rating: review.starRating,
      has_owner_reply: review.hasOwnerReply,
      reply_published_at: review.replyPublishedAt,
      ingested_at: ingestedAt,
    })),
    { onConflict: "review_name" },
  );
  if (error) throw new Error(`Failed to save Hourglass reviews: ${error.message}`);
  return reviews.length;
}

export async function loadReviewAuthorityData(
  asOf = new Date(),
): Promise<ReviewAuthorityData> {
  const supabase = getSupabaseAdmin();
  const empty: ReviewAuthorityData = {
    rows: [],
    shareOfTrackedReviewGrowth: null,
    shareWindowMonths: 6,
  };
  if (!supabase) return empty;

  const { places, snapshots, ownReviews } = await loadReviewVelocityEvidence(supabase);
  if (!places.length) return empty;

  const rows = places.map((place) => {
    const placeSnapshots = snapshots.filter((snapshot) => snapshot.placeId === place.id);
    const placeReviews = ownReviews.filter((review) => review.placeId === place.id);
    return buildReviewAuthorityRow({
      place,
      snapshots: placeSnapshots,
      ownReviews: place.role === "self" && placeReviews.length ? placeReviews : undefined,
      asOf,
      staticFallbackRating: place.role === "self" ? 5 : undefined,
    });
  });
  const hourglass = places.find((place) => place.role === "self");
  // Share uses one comparable methodology across all five. Hourglass still
  // prefers exact timestamps in its display row, but the share denominator is
  // computed from six-month snapshot deltas only when all five support them.
  const snapshotComparableRows = places.map((place) => buildReviewAuthorityRow({
    place,
    snapshots: snapshots.filter((snapshot) => snapshot.placeId === place.id),
    asOf,
  }));
  return {
    rows,
    shareOfTrackedReviewGrowth: hourglass
      ? calculateShareOfTrackedReviewGrowth(snapshotComparableRows, hourglass.id)
      : null,
    shareWindowMonths: 6,
  };
}
