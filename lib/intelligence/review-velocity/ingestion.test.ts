import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { runPlacesSnapshotIngestion } from "./google-places";
import { syncHourglassGoogleReviews } from "./gbp-reviews";
import { importLocalFalconCompetitorReport } from "./local-falcon-import";
import type { TrackedPlace } from "./types";

const places: TrackedPlace[] = [
  { id: "self", role: "self", displayName: "Hourglass Diamonds", googlePlaceId: null, active: true },
  { id: "competitor", role: "competitor", displayName: "Competitor", googlePlaceId: "confirmed-place-id", active: true },
];

describe("review ingestion", () => {
  it("needs no API credential when every Place ID is null", async () => {
    const result = await runPlacesSnapshotIngestion({ places: [places[0]] });
    assert.equal(result.attempted, 0);
    assert.equal(result.skippedNullPlaceIds, 1);
  });

  it("skips null Google Place IDs and requests only rating fields", async () => {
    const requests: Array<string | URL | Request> = [];
    const saved: unknown[] = [];
    const result = await runPlacesSnapshotIngestion({
      places,
      apiKey: "test-key",
      capturedOn: "2026-10-01",
      fetchImpl: async (input, init) => {
        requests.push(input);
        assert.equal((init?.headers as Record<string, string>)["X-Goog-FieldMask"], "rating,userRatingCount");
        return Response.json({ rating: 4.8, userRatingCount: 123 });
      },
      save: async (row) => { saved.push(row); },
    });
    assert.equal(result.skippedNullPlaceIds, 1);
    assert.equal(result.saved, 1);
    assert.equal(requests.length, 1);
    assert.equal(saved.length, 1);
  });

  it("is idempotent by the place/date/source persistence key", async () => {
    const persisted = new Map<string, unknown>();
    const save = async (row: {
      placeId: string;
      capturedOn: string;
      source: "places-details" | "local-falcon-competitor-report" | "manual-bootstrap";
    }) => {
      persisted.set(`${row.placeId}:${row.capturedOn}:${row.source}`, row);
    };
    const deps = {
      places: [places[1]],
      apiKey: "test-key",
      capturedOn: "2026-10-01",
      fetchImpl: async () => Response.json({ rating: 4.8, userRatingCount: 123 }),
      save,
    };
    await runPlacesSnapshotIngestion(deps);
    await runPlacesSnapshotIngestion(deps);
    assert.equal(persisted.size, 1);
  });

  it("paginates Hourglass reviews and never calls a write endpoint", async () => {
    const urls: string[] = [];
    const saved: unknown[] = [];
    const result = await syncHourglassGoogleReviews({
      places,
      accountId: "account-1",
      locationId: "location-1",
      accessToken: "token",
      fetchImpl: async (input, init) => {
        assert.equal(init?.method, undefined);
        const url = String(input);
        urls.push(url);
        return urls.length === 1
          ? Response.json({
              reviews: [{ name: "reviews/1", createTime: "2026-09-01T12:00:00Z", starRating: "FIVE" }],
              nextPageToken: "next",
            })
          : Response.json({
              reviews: [{
                name: "reviews/2",
                createTime: "2026-08-01T12:00:00Z",
                starRating: "FOUR",
                reviewReply: { updateTime: "2026-08-02T12:00:00Z" },
              }],
            });
      },
      save: async (rows) => { saved.push(...rows); return rows.length; },
    });
    assert.deepEqual(result, { ok: true, synced: 2, pages: 2 });
    assert.equal(urls.length, 2);
    assert.match(urls[1], /pageToken=next/);
    assert.equal(saved.length, 2);
  });

  it("refuses Local Falcon Review Velocity as review-count input", async () => {
    await assert.rejects(
      importLocalFalconCompetitorReport({
        rows: [{ date: "2026-09-01", googlePlaceId: "confirmed-place-id", reviewVelocity: 81 }],
      }, { places, save: async () => {} }),
      /not review counts/,
    );
  });
});
