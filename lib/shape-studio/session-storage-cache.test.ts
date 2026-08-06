import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { SESSION_META_CACHE_CONTROL } from "./session-storage";

describe("shape-studio storage session meta caching", () => {
  it("disables Storage CDN caching and writes unique revision keys", () => {
    assert.equal(SESSION_META_CACHE_CONTROL, "0");
    const source = readFileSync(
      new URL("./session-storage.ts", import.meta.url),
      "utf8",
    );
    assert.match(source, /cacheControl:\s*SESSION_META_CACHE_CONTROL/);
    assert.match(source, /buildSessionMetaRevisionId/);
    assert.match(source, /pruneOlderSessionMetaRevisions/);
    assert.match(source, /deleteShapeStudioSessionMetaObjects/);
    assert.match(source, /selectNewestSessionMetaRevisionName/);
    assert.doesNotMatch(source, /cacheControl:\s*["']3600["']/);
  });

  it("purges terminal tombstones past retention during cleanup listing", () => {
    const source = readFileSync(
      new URL("./session-storage.ts", import.meta.url),
      "utf8",
    );
    assert.match(source, /isTerminalPastTombstone/);
    assert.match(source, /SHAPE_STUDIO_TOMBSTONE_TTL_MS/);
  });
});

describe("shape-studio session meta delete helpers", () => {
  it("exports full meta delete and prune in the capture-delete module", () => {
    const source = readFileSync(
      new URL("./session-capture-delete.ts", import.meta.url),
      "utf8",
    );
    assert.match(source, /export async function deleteShapeStudioSessionMetaObjects/);
    assert.match(source, /export async function pruneOlderSessionMetaRevisions/);
    assert.match(source, /sessionMetaObjectPath\(sessionId\)/);
  });
});
