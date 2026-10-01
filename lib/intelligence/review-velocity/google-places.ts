import { getGooglePlacesApiKey } from "@/lib/intelligence/env";
import { listActiveTrackedPlaces, upsertReviewCountSnapshot } from "./repository";
import type { TrackedPlace } from "./types";

type PlaceDetails = { rating?: number; userRatingCount?: number };

export type PlacesSnapshotRunResult = {
  capturedOn: string;
  attempted: number;
  saved: number;
  skippedNullPlaceIds: number;
  errors: Array<{ place: string; error: string }>;
};

export async function fetchPlaceRatingSnapshot(
  googlePlaceId: string,
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ rating: number | null; reviewCount: number }> {
  const response = await fetchImpl(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(googlePlaceId)}`,
    {
      method: "GET",
      headers: {
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "rating,userRatingCount",
      },
      cache: "no-store",
    },
  );
  if (!response.ok) {
    throw new Error(`Places Details returned ${response.status}`);
  }
  const body = (await response.json()) as PlaceDetails;
  if (!Number.isInteger(body.userRatingCount) || (body.userRatingCount ?? -1) < 0) {
    throw new Error("Places Details response omitted a valid userRatingCount");
  }
  return {
    rating: typeof body.rating === "number" ? body.rating : null,
    reviewCount: body.userRatingCount!,
  };
}

export async function runPlacesSnapshotIngestion(deps?: {
  places?: readonly TrackedPlace[];
  apiKey?: string;
  capturedOn?: string;
  fetchImpl?: typeof fetch;
  save?: typeof upsertReviewCountSnapshot;
}): Promise<PlacesSnapshotRunResult> {
  const places = deps?.places ?? await listActiveTrackedPlaces();
  const capturedOn = deps?.capturedOn ?? new Date().toISOString().slice(0, 10);
  const save = deps?.save ?? upsertReviewCountSnapshot;
  const eligible = places.filter((place) => place.active && place.googlePlaceId);
  const result: PlacesSnapshotRunResult = {
    capturedOn,
    attempted: 0,
    saved: 0,
    skippedNullPlaceIds: places.filter((place) => place.active && !place.googlePlaceId).length,
    errors: [],
  };
  if (!eligible.length) return result;
  const apiKey = deps?.apiKey ?? getGooglePlacesApiKey();
  if (!apiKey) throw new Error("GOOGLE_PLACES_API_KEY is required when confirmed Place IDs exist");

  for (const place of eligible) {
    const googlePlaceId = place.googlePlaceId;
    if (!googlePlaceId) continue;
    result.attempted += 1;
    try {
      const snapshot = await fetchPlaceRatingSnapshot(
        googlePlaceId,
        apiKey,
        deps?.fetchImpl,
      );
      await save({
        placeId: place.id,
        capturedOn,
        source: "places-details",
        sourceRef: `places/${googlePlaceId}`,
        ...snapshot,
      });
      result.saved += 1;
    } catch (error) {
      result.errors.push({
        place: place.displayName,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return result;
}
