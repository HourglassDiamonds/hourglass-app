import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { runReviewVelocityJob } from "./job";

describe("weekly review velocity job", () => {
  it("combines mocked Places and GBP read-only ingestion", async () => {
    const result = await runReviewVelocityJob({
      runPlaces: async () => ({
        capturedOn: "2026-10-01",
        attempted: 5,
        saved: 5,
        skippedNullPlaceIds: 0,
        errors: [],
      }),
      syncGbp: async () => ({ ok: true, synced: 120, pages: 3 }),
    });
    assert.equal(result.ok, true);
    assert.equal(result.places?.saved, 5);
    assert.equal(result.gbp?.synced, 120);
  });

  it("reports missing GBP configuration without hiding a successful snapshot run", async () => {
    const result = await runReviewVelocityJob({
      runPlaces: async () => ({
        capturedOn: "2026-10-01",
        attempted: 0,
        saved: 0,
        skippedNullPlaceIds: 5,
        errors: [],
      }),
      syncGbp: async () => ({
        ok: false,
        synced: 0,
        pages: 0,
        skipped: "GBP_ACCOUNT_ID and GBP_LOCATION_ID are required",
      }),
    });
    assert.equal(result.ok, false);
    assert.equal(result.places?.skippedNullPlaceIds, 5);
    assert.match(result.gbp?.skipped ?? "", /GBP_ACCOUNT_ID/);
  });
});
