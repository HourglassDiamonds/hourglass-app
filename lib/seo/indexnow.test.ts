import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildIndexNowPayload,
  indexNowKeyLocation,
  normalizeIndexNowUrls,
} from "./indexnow-core";
import { submitIndexNowUrls } from "./indexnow";

const KEY = "hourglass-indexnow-test-key";

describe("IndexNow", () => {
  it("normalizes, deduplicates, and keeps only bare same-origin canonical URLs", () => {
    assert.deepEqual(
      normalizeIndexNowUrls([
        "/diamond-studio",
        "https://www.hourglassdiamonds.com/diamond-studio",
        "/diamond-guide",
      ]),
      [
        "https://www.hourglassdiamonds.com/diamond-studio",
        "https://www.hourglassdiamonds.com/diamond-guide",
      ],
    );

    assert.throws(() => normalizeIndexNowUrls(["https://example.com/page"]));
    assert.throws(() => normalizeIndexNowUrls(["/diamond-studio?shape=oval"]));
    assert.throws(() => normalizeIndexNowUrls(["/diamond-studio#faq"]));
    assert.throws(() => normalizeIndexNowUrls(["/executive-dashboard/concierge/local-authority"]));
    assert.throws(() => normalizeIndexNowUrls(["/api/cron/review-velocity"]));
    assert.deepEqual(normalizeIndexNowUrls(["/ledger/buffer-health"]), [
      "https://www.hourglassdiamonds.com/ledger/buffer-health",
    ]);
  });

  it("builds a root key location and canonical batch payload", () => {
    assert.equal(
      indexNowKeyLocation(KEY),
      "https://www.hourglassdiamonds.com/indexnow-key.txt",
    );
    assert.deepEqual(buildIndexNowPayload(KEY, ["/diamond-studio"]), {
      host: "www.hourglassdiamonds.com",
      key: KEY,
      keyLocation: "https://www.hourglassdiamonds.com/indexnow-key.txt",
      urlList: ["https://www.hourglassdiamonds.com/diamond-studio"],
    });
  });

  it("accepts 200/202 and safely reports network or endpoint failures", async () => {
    const accepted = await submitIndexNowUrls(["/diamond-studio"], {
      key: KEY,
      fetchImpl: async () => new Response(null, { status: 202 }),
    });
    assert.deepEqual(accepted, {
      status: "accepted",
      httpStatus: 202,
      submitted: 1,
    });

    const rejected = await submitIndexNowUrls(["/diamond-studio"], {
      key: KEY,
      fetchImpl: async () => new Response(null, { status: 429 }),
    });
    assert.deepEqual(rejected, {
      status: "failed",
      httpStatus: 429,
      reason: "rejected",
    });

    const network = await submitIndexNowUrls(["/diamond-studio"], {
      key: KEY,
      fetchImpl: async () => {
        throw new Error("offline");
      },
    });
    assert.deepEqual(network, { status: "failed", reason: "network" });
  });
});
