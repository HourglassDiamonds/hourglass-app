import {
  CORROBORATION_SOURCE_IDS,
  defaultAuthorityRegister,
  type AuthorityRegisterEntry,
} from "@/lib/intelligence/review-velocity/corroboration-register";
import {
  buildReviewAuthorityRow,
  calculateShareOfTrackedReviewGrowth,
} from "@/lib/intelligence/review-velocity/calculate";
import {
  TRACKED_PLACE_NAMES,
  type TrackedPlace,
} from "@/lib/intelligence/review-velocity/types";
import type {
  BusinessReviewView,
  LocalAuthorityAction,
  LocalAuthorityInput,
  LocalAuthorityWorkspace,
} from "./types";

function validDate(value: string): boolean {
  return Number.isFinite(Date.parse(value));
}

function normalizePlaces(places: readonly TrackedPlace[]): TrackedPlace[] {
  return TRACKED_PLACE_NAMES.map((displayName, index) => {
    const match = places.find((place) => place.displayName === displayName);
    return match ?? {
      id: `unconfigured-${index}`,
      role: index === 0 ? "self" : "competitor",
      displayName,
      googlePlaceId: null,
      active: true,
    };
  });
}

function normalizeCorroboration(
  rows: readonly AuthorityRegisterEntry[] | undefined,
): LocalAuthorityWorkspace["corroboration"] {
  const supplied = new Map((rows ?? []).map((row) => [row.sourceId, row]));
  return defaultAuthorityRegister().map((fallback) => {
    const row = supplied.get(fallback.sourceId) ?? fallback;
    return {
      ...row,
      provenance: row.lastChecked ? "Observed" as const : "Static fallback" as const,
    };
  });
}

function action(
  id: string,
  title: string,
  priority: LocalAuthorityAction["priority"],
  evidence: string,
  related: string,
): LocalAuthorityAction {
  return { id, title, status: "proposed", priority, evidence, related };
}

export function composeLocalAuthorityWorkspace(
  input: LocalAuthorityInput,
  asOf = new Date(input.loadedAt),
): LocalAuthorityWorkspace {
  const places = normalizePlaces(input.places);
  const businesses: BusinessReviewView[] = places.map((place) => {
    const snapshots = input.snapshots
      .filter((snapshot) => snapshot.placeId === place.id && validDate(snapshot.capturedOn))
      .sort((a, b) => a.capturedOn.localeCompare(b.capturedOn));
    const ownReviews = input.ownReviews
      .filter((review) => review.placeId === place.id && validDate(review.publishedAt))
      .sort((a, b) => a.publishedAt.localeCompare(b.publishedAt));
    const row = buildReviewAuthorityRow({
      place,
      snapshots,
      ownReviews: place.role === "self" && ownReviews.length ? ownReviews : undefined,
      asOf,
      staticFallbackRating: place.role === "self" ? 5 : undefined,
    });
    return {
      ...row,
      placeIdConfirmed: Boolean(place.googlePlaceId),
      snapshots,
      exactReviewHistory: ownReviews.map((review, index) => ({
        observedAt: review.publishedAt,
        reviewCount: index + 1,
      })),
    };
  });
  const hourglass = businesses[0]!;
  const snapshotComparableRows = places.map((place) => buildReviewAuthorityRow({
    place,
    snapshots: input.snapshots.filter((snapshot) => snapshot.placeId === place.id),
    asOf,
  }));
  const shareOfTrackedReviewGrowth = calculateShareOfTrackedReviewGrowth(
    snapshotComparableRows,
    hourglass.placeId,
  );
  const corroboration = normalizeCorroboration(input.corroboration);

  const changes: string[] = [];
  for (const business of businesses) {
    const latest = business.snapshots.at(-1);
    const previous = business.snapshots.at(-2);
    if (!latest || !previous) continue;
    const delta = latest.reviewCount - previous.reviewCount;
    if (delta > 0) {
      changes.push(`${business.business} added ${delta} review${delta === 1 ? "" : "s"} since the prior snapshot.`);
    }
  }
  for (const row of corroboration) {
    if (row.previousStatus && row.previousStatus !== row.status) {
      changes.push(`${row.authority} moved from ${row.previousStatus} to ${row.status}.`);
    }
  }

  const attention: string[] = [];
  const actions: LocalAuthorityAction[] = [];
  for (const business of businesses) {
    if (!business.placeIdConfirmed) {
      attention.push(`${business.business} Place ID is not confirmed.`);
      actions.push(action(
        `place-id:${business.business}`,
        `Confirm ${business.business} Place ID`,
        business.role === "self" ? "high" : "medium",
        "Tracked place has no verified Place ID.",
        business.business,
      ));
    }
  }
  if (hourglass.latestReviewAt === null) {
    attention.push("Google Business Profile exact review sync is not configured or has no evidence.");
    actions.push(action(
      "gbp-review-sync",
      "Configure or verify GBP review sync",
      "high",
      "No exact Hourglass review timestamps are available.",
      "Google Business Profile",
    ));
  }
  const limitedCompetitors = businesses.filter(
    (row) => row.role === "competitor" && row.windows[3].method === "unavailable",
  );
  if (limitedCompetitors.length) {
    attention.push(`${limitedCompetitors.length} competitor${limitedCompetitors.length === 1 ? " has" : "s have"} insufficient history for a 3-month comparison.`);
  }
  for (const row of corroboration) {
    if (row.status === "live" || row.status === "not-worth-pursuing") continue;
    attention.push(`${row.authority} is ${row.status}.`);
    actions.push(action(
      `corroboration:${row.sourceId}`,
      row.nextAction ?? `Review ${row.authority}`,
      row.sourceId === "google-business-profile" ? "high" : "medium",
      row.evidence ?? "No evidence recorded.",
      row.authority,
    ));
  }

  const localFalconRows = input.snapshots.filter(
    (snapshot) => snapshot.source === "local-falcon-competitor-report",
  );
  if (!localFalconRows.length) attention.push("No imported Local Falcon competitor evidence yet.");
  const localFalconDates = localFalconRows.map((row) => row.capturedOn).sort();
  const localFalcon = {
    latestCapturedOn: localFalconDates.at(-1) ?? null,
    importedSnapshotRows: localFalconRows.length,
    sourceReferences: [...new Set(localFalconRows.flatMap((row) => row.sourceRef ? [row.sourceRef] : []))],
  };

  const timestamps = [
    ...input.snapshots.map((snapshot) => snapshot.capturedOn),
    ...input.ownReviews.map((review) => review.publishedAt),
    ...corroboration.flatMap((row) => row.lastChecked ? [row.lastChecked] : []),
  ].filter(validDate);
  const trackingDates = input.snapshots.map((snapshot) => snapshot.capturedOn).filter(validDate);
  const liveCount = corroboration.filter((row) => row.status === "live").length;
  const latestVisibilitySignal = localFalcon.latestCapturedOn
    ? `Local Falcon competitor report · ${localFalcon.latestCapturedOn}`
    : input.searchSignals[0]
      ? `${input.searchSignals[0].label} · ${input.searchSignals[0].value}`
      : "Unavailable";

  return {
    businesses,
    hourglass,
    changes,
    attention: [...new Set(attention)],
    corroboration,
    actions: [...new Map(actions.map((row) => [row.id, row])).values()],
    localFalcon,
    searchSignals: input.searchSignals,
    shareOfTrackedReviewGrowth,
    corroborationSummary: `${liveCount} of ${CORROBORATION_SOURCE_IDS.length} sources verified live`,
    latestVisibilitySignal,
    lastUpdated: timestamps.sort((a, b) => Date.parse(b) - Date.parse(a))[0] ?? input.loadedAt,
    trackingStartedAt: trackingDates.sort((a, b) => Date.parse(a) - Date.parse(b))[0] ?? null,
  };
}
