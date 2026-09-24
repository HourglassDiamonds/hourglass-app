import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { CalendarHttpError } from "./adapter";
import { calendarEventEvidence } from "./association/fixtures";
import {
  resetTodayUpcomingGuard,
  resolveTodayUpcomingRead,
  TODAY_CALENDAR_CACHE_MS,
  TODAY_CALENDAR_READ_TIMEOUT_MS,
  type TodayUpcomingReadResult,
} from "./today-upcoming-guard";

const NOW = new Date("2026-09-23T14:00:00.000Z");
const DOCKET = { title: "Up next", items: ["duane-cad"], queuedCount: 0 };

function appointment(): TodayUpcomingReadResult {
  return {
    ok: true,
    events: [
      calendarEventEvidence({
        calendar_id: "primary",
        calendar_event_id: "client",
        title: "Client appointment",
        start_at: "2026-09-23T17:00:00.000Z",
        end_at: "2026-09-23T18:00:00.000Z",
        location: "Office",
      }),
    ],
    calendars: [{ calendar_id: "primary", summary: "Founder" }],
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

describe("today calendar read guard", () => {
  it("returns a fast provider without a second read", async () => {
    resetTodayUpcomingGuard();
    let calls = 0;
    const read = async () => {
      calls += 1;
      return appointment();
    };
    const first = await resolveTodayUpcomingRead({ now: NOW, read, nowMs: () => 1_000 });
    const second = await resolveTodayUpcomingRead({ now: NOW, read, nowMs: () => 2_000 });
    assert.equal(calls, 1);
    assert.equal(first[0]?.title, "Client appointment");
    assert.deepEqual(second, first);
  });

  it("stops waiting when the provider is slower than the timeout and still returns the docket", async () => {
    resetTodayUpcomingGuard();
    let calls = 0;
    const started = Date.now();
    const [docket, upcoming] = await Promise.all([
      Promise.resolve(DOCKET),
      resolveTodayUpcomingRead({
        now: NOW,
        timeoutMs: 40,
        cacheMs: 90_000,
        read: async () => {
          calls += 1;
          await delay(800);
          return appointment();
        },
      }),
    ]);
    const elapsed = Date.now() - started;
    assert.deepEqual(docket, DOCKET);
    assert.deepEqual(upcoming, []);
    assert.equal(calls, 1);
    assert.ok(elapsed < 400, `calendar added ${elapsed}ms`);
    await delay(900);
  });

  it("returns an empty upcoming list when the provider throws, is rate limited, or is disconnected", async () => {
    const failures: Array<() => Promise<TodayUpcomingReadResult>> = [
      async () => {
        throw new Error("network");
      },
      async () => {
        throw new CalendarHttpError(429, "http");
      },
      async () => {
        throw new CalendarHttpError(401, "http");
      },
      async () => {
        throw new CalendarHttpError(403, "http");
      },
      async () => {
        throw new CalendarHttpError(503, "http");
      },
      async () => {
        throw new SyntaxError("malformed");
      },
      async () => ({ ok: false }),
    ];
    for (const read of failures) {
      resetTodayUpcomingGuard();
      const upcoming = await resolveTodayUpcomingRead({
        now: NOW,
        read,
        nowMs: () => 5_000,
      });
      assert.deepEqual(upcoming, []);
      const again = await resolveTodayUpcomingRead({
        now: NOW,
        read: async () => {
          throw new Error("should-not-retry");
        },
        nowMs: () => 6_000,
        cacheMs: 90_000,
      });
      assert.deepEqual(again, []);
    }
  });

  it("does not call the provider again while the last failure is inside the cache window", async () => {
    resetTodayUpcomingGuard();
    let calls = 0;
    await resolveTodayUpcomingRead({
      now: NOW,
      cacheMs: 90_000,
      nowMs: () => 10_000,
      read: async () => {
        calls += 1;
        throw new CalendarHttpError(429, "http");
      },
    });
    await resolveTodayUpcomingRead({
      now: NOW,
      cacheMs: 90_000,
      nowMs: () => 70_000,
      read: async () => {
        calls += 1;
        return appointment();
      },
    });
    assert.equal(calls, 1);
  });

  it("joins a second caller onto the same provider call", async () => {
    resetTodayUpcomingGuard();
    let calls = 0;
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const read = async () => {
      calls += 1;
      await gate;
      return appointment();
    };
    const first = resolveTodayUpcomingRead({ now: NOW, read, timeoutMs: 1_000, nowMs: () => 1 });
    const second = resolveTodayUpcomingRead({ now: NOW, read, timeoutMs: 1_000, nowMs: () => 1 });
    release?.();
    const [today, settle] = await Promise.all([first, second]);
    assert.equal(calls, 1);
    assert.equal(today[0]?.title, "Client appointment");
    assert.deepEqual(settle, today);
  });

  it("shares one in-flight read across Today and a later settle", async () => {
    resetTodayUpcomingGuard();
    let calls = 0;
    const read = async () => {
      calls += 1;
      return appointment();
    };
    const today = await resolveTodayUpcomingRead({ now: NOW, read, nowMs: () => 1_000 });
    const settle = await resolveTodayUpcomingRead({ now: NOW, read, nowMs: () => 1_500 });
    assert.equal(calls, 1);
    assert.equal(settle[0]?.sourceRef, today[0]?.sourceRef);
  });

  it("keeps the live bound shorter than the freshness poll and off the poll path", () => {
    assert.ok(TODAY_CALENDAR_READ_TIMEOUT_MS <= 2_000);
    assert.ok(TODAY_CALENDAR_CACHE_MS > 60_000);
    const root = process.cwd();
    const page = readFileSync(join(root, "app/executive-dashboard/concierge/page.tsx"), "utf8");
    const load = readFileSync(join(root, "lib/continuum/calendar/today-upcoming-load.ts"), "utf8");
    const poll = readFileSync(
      join(root, "app/executive-dashboard/concierge/components/gmail-operating-freshness.tsx"),
      "utf8",
    );
    const freshness = readFileSync(
      join(root, "app/executive-dashboard/concierge/gmail-freshness-actions.ts"),
      "utf8",
    );
    const probe = readFileSync(
      join(root, "app/executive-dashboard/concierge/today-read-model-actions.ts"),
      "utf8",
    );
    assert.match(page, /Promise\.all\(\[[\s\S]*loadTodaySurface\(\),[\s\S]*loadTodayUpcoming\(\)/);
    assert.match(load, /resolveTodayUpcomingRead/);
    assert.doesNotMatch(load, /while\s*\(|retry/i);
    assert.doesNotMatch(`${poll}\n${freshness}\n${probe}`, /loadTodayUpcoming|createLiveCalendarApi|calendar\/v3/);
  });
});
