import { syncHourglassGoogleReviews } from "./gbp-reviews";
import { runPlacesSnapshotIngestion } from "./google-places";

export type ReviewVelocityJobResult = {
  ok: boolean;
  places?: Awaited<ReturnType<typeof runPlacesSnapshotIngestion>>;
  gbp?: Awaited<ReturnType<typeof syncHourglassGoogleReviews>>;
  errors: string[];
};

export async function runReviewVelocityJob(deps?: {
  runPlaces?: typeof runPlacesSnapshotIngestion;
  syncGbp?: typeof syncHourglassGoogleReviews;
}): Promise<ReviewVelocityJobResult> {
  const result: ReviewVelocityJobResult = { ok: true, errors: [] };
  try {
    result.places = await (deps?.runPlaces ?? runPlacesSnapshotIngestion)();
    if (result.places.errors.length) result.ok = false;
  } catch (error) {
    result.ok = false;
    result.errors.push(error instanceof Error ? error.message : String(error));
  }
  try {
    result.gbp = await (deps?.syncGbp ?? syncHourglassGoogleReviews)();
    if (!result.gbp.ok) result.ok = false;
  } catch (error) {
    result.ok = false;
    result.errors.push(error instanceof Error ? error.message : String(error));
  }
  return result;
}
