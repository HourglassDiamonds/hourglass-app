import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { GET } from "../../app/indexnow-key.txt/route";

const ORIGINAL_KEY = process.env.INDEXNOW_KEY;

afterEach(() => {
  if (ORIGINAL_KEY === undefined) delete process.env.INDEXNOW_KEY;
  else process.env.INDEXNOW_KEY = ORIGINAL_KEY;
});

describe("IndexNow verification route", () => {
  it("serves only the configured root key file", async () => {
    process.env.INDEXNOW_KEY = "hourglass-indexnow-test-key";
    const response = await GET();

    assert.equal(response.status, 200);
    assert.equal(await response.text(), "hourglass-indexnow-test-key");
    assert.equal(response.headers.get("content-type"), "text/plain; charset=utf-8");
  });

  it("returns 404 for unknown or invalid key routes", async () => {
    process.env.INDEXNOW_KEY = "invalid key";
    const response = await GET();
    assert.equal(response.status, 404);
  });
});
