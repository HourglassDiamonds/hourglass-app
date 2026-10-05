import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  emitTodaySnapshotPublished,
  latestTodaySourceDigests,
} from "./today-publication-telemetry";

describe("Today publication telemetry", () => {
  it("emits only hashed identities for the newest incorporated sources", () => {
    const payload = {
      subject: "private subject",
      person: "Private Person",
      evidence: [
        {
          sourceRef: "gc1|thread-old|message-old",
          timestamp: "2026-10-04T12:00:00Z",
        },
        {
          sourceHref: "gc1|thread-new|message-new",
          at: "2026-10-04T12:01:00Z",
        },
      ],
    };
    const digests = latestTodaySourceDigests(payload);
    assert.equal(digests.length, 2);
    assert.ok(digests.every((value) => /^[a-f0-9]{20}$/.test(value)));

    const lines: string[] = [];
    const original = console.info;
    console.info = (line?: unknown) => lines.push(String(line));
    try {
      emitTodaySnapshotPublished({
        sourceWatermark: "private-watermark",
        composedAt: "2026-10-04T12:01:02Z",
        publishedAt: "2026-10-04T12:01:03Z",
        payload,
      });
    } finally {
      console.info = original;
    }
    assert.equal(lines.length, 1);
    assert.match(lines[0], /continuum\.today\.snapshot_published/);
    assert.doesNotMatch(lines[0], /private|thread-|message-|Person/);
  });
});
