import {
  getGbpAccountId,
  getGbpLocationId,
} from "@/lib/intelligence/env";
import { refreshGoogleAccessTokenDetailed } from "@/lib/intelligence/google-oauth";
import { listActiveTrackedPlaces, upsertOwnGoogleReviews } from "./repository";
import type { OwnGoogleReview, TrackedPlace } from "./types";

const STAR_RATINGS: Record<string, number> = {
  ONE: 1,
  TWO: 2,
  THREE: 3,
  FOUR: 4,
  FIVE: 5,
};

type GbpReview = {
  name?: string;
  createTime?: string;
  starRating?: string;
  reviewReply?: { updateTime?: string };
};

type GbpReviewsPage = { reviews?: GbpReview[]; nextPageToken?: string };

export type GbpReviewSyncResult = {
  ok: boolean;
  synced: number;
  pages: number;
  skipped?: string;
};

export async function syncHourglassGoogleReviews(deps?: {
  places?: readonly TrackedPlace[];
  accountId?: string;
  locationId?: string;
  accessToken?: string;
  fetchImpl?: typeof fetch;
  save?: typeof upsertOwnGoogleReviews;
}): Promise<GbpReviewSyncResult> {
  const accountId = deps?.accountId ?? getGbpAccountId();
  const locationId = deps?.locationId ?? getGbpLocationId();
  if (!accountId || !locationId) {
    return {
      ok: false,
      synced: 0,
      pages: 0,
      skipped: "GBP_ACCOUNT_ID and GBP_LOCATION_ID are required",
    };
  }
  const places = deps?.places ?? await listActiveTrackedPlaces();
  const hourglass = places.find((place) => place.role === "self" && place.active);
  if (!hourglass) {
    return { ok: false, synced: 0, pages: 0, skipped: "Active Hourglass tracked place not found" };
  }
  let accessToken = deps?.accessToken;
  if (!accessToken) {
    const token = await refreshGoogleAccessTokenDetailed();
    if (!token.ok) {
      return { ok: false, synced: 0, pages: 0, skipped: token.message };
    }
    accessToken = token.accessToken;
  }

  const fetchImpl = deps?.fetchImpl ?? fetch;
  const collected: OwnGoogleReview[] = [];
  let pageToken: string | undefined;
  let pages = 0;
  do {
    const url = new URL(
      `https://mybusiness.googleapis.com/v4/accounts/${encodeURIComponent(accountId)}/locations/${encodeURIComponent(locationId)}/reviews`,
    );
    url.searchParams.set("pageSize", "50");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const response = await fetchImpl(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (!response.ok) {
      const scopeHint = response.status === 401 || response.status === 403
        ? " Confirm the refresh token has business.manage consent and access to the configured account/location."
        : "";
      throw new Error(`Business Profile reviews.list returned ${response.status}.${scopeHint}`);
    }
    const body = (await response.json()) as GbpReviewsPage;
    pages += 1;
    for (const review of body.reviews ?? []) {
      const starRating = review.starRating ? STAR_RATINGS[review.starRating] : undefined;
      if (
        !review.name ||
        !review.createTime ||
        !starRating ||
        (review.reviewReply && !review.reviewReply.updateTime)
      ) {
        throw new Error("Business Profile returned an incomplete review resource");
      }
      collected.push({
        reviewName: review.name,
        placeId: hourglass.id,
        publishedAt: review.createTime,
        starRating,
        hasOwnerReply: Boolean(review.reviewReply),
        replyPublishedAt: review.reviewReply?.updateTime ?? null,
      });
    }
    pageToken = body.nextPageToken || undefined;
  } while (pageToken);

  const synced = await (deps?.save ?? upsertOwnGoogleReviews)(collected);
  return { ok: true, synced, pages };
}
