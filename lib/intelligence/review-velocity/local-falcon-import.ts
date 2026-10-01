import { listActiveTrackedPlaces, upsertReviewCountSnapshot } from "./repository";
import type { TrackedPlace } from "./types";

export type LocalFalconCompetitorReportRow = {
  date: string;
  googlePlaceId: string;
  reviewCount: number;
  rating?: number | null;
  reportReference?: string | null;
};

function containsVelocityField(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  return Object.entries(value).some(([key, child]) =>
    /review.?velocity/i.test(key) || containsVelocityField(child),
  );
}

export async function importLocalFalconCompetitorReport(
  payload: unknown,
  deps?: {
    places?: readonly TrackedPlace[];
    save?: typeof upsertReviewCountSnapshot;
  },
): Promise<{ imported: number; skipped: number }> {
  if (containsVelocityField(payload)) {
    throw new Error("Local Falcon Review Velocity scores are not review counts and cannot be imported");
  }
  const rows = Array.isArray(payload)
    ? payload
    : payload && typeof payload === "object" && Array.isArray((payload as { rows?: unknown }).rows)
      ? (payload as { rows: unknown[] }).rows
      : null;
  if (!rows) throw new Error("Expected a Local Falcon competitor-report row array");

  const places = deps?.places ?? await listActiveTrackedPlaces();
  const byGoogleId = new Map(
    places
      .filter((place) => place.googlePlaceId)
      .map((place) => [place.googlePlaceId!, place]),
  );
  const save = deps?.save ?? upsertReviewCountSnapshot;
  let imported = 0;
  let skipped = 0;

  for (const raw of rows) {
    if (!raw || typeof raw !== "object") {
      skipped += 1;
      continue;
    }
    const row = raw as Partial<LocalFalconCompetitorReportRow>;
    const place = row.googlePlaceId ? byGoogleId.get(row.googlePlaceId) : undefined;
    if (
      !place ||
      place.role !== "competitor" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(row.date ?? "") ||
      !Number.isInteger(row.reviewCount) ||
      (row.reviewCount ?? -1) < 0 ||
      (row.rating != null && (typeof row.rating !== "number" || row.rating < 0 || row.rating > 5))
    ) {
      skipped += 1;
      continue;
    }
    await save({
      placeId: place.id,
      capturedOn: row.date!,
      source: "local-falcon-competitor-report",
      sourceRef: row.reportReference ?? null,
      rating: row.rating ?? null,
      reviewCount: row.reviewCount!,
    });
    imported += 1;
  }
  return { imported, skipped };
}
