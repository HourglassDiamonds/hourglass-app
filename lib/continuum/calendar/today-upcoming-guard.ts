/**
 * Bounded Today calendar read.
 * One in-flight provider call, a short timeout, and a short memory cache.
 * No event table and no retry loop. A failed or slow read cannot hold Today.
 */

import { selectTodayUpcoming, type TodayUpcomingItem } from "./today-upcoming";
import type { CalendarEventEvidence, CalendarSourceCalendar } from "./types";

export const TODAY_CALENDAR_READ_TIMEOUT_MS = 1_500;
export const TODAY_CALENDAR_CACHE_MS = 90_000;

export type TodayUpcomingReadResult =
  | {
      ok: true;
      events: readonly CalendarEventEvidence[];
      calendars?: readonly Pick<CalendarSourceCalendar, "calendar_id" | "summary">[];
    }
  | { ok: false; suppress?: boolean };

type CacheEntry = { at: number; items: TodayUpcomingItem[] };

let cache: CacheEntry | null = null;
let failedAt: number | null = null;
let inflight: Promise<TodayUpcomingItem[] | null> | null = null;

export function resetTodayUpcomingGuard(): void {
  cache = null;
  failedAt = null;
  inflight = null;
}

export async function resolveTodayUpcomingRead(input: {
  now: Date;
  read: () => Promise<TodayUpcomingReadResult>;
  timeoutMs?: number;
  cacheMs?: number;
  nowMs?: () => number;
}): Promise<TodayUpcomingItem[]> {
  const nowMs = input.nowMs ?? Date.now;
  const cacheMs = input.cacheMs ?? TODAY_CALENDAR_CACHE_MS;
  const timeoutMs = input.timeoutMs ?? TODAY_CALENDAR_READ_TIMEOUT_MS;
  const clock = nowMs();
  const fresh = freshItems(clock, cacheMs);
  if (fresh) return fresh;
  if (failedAt != null && clock - failedAt < cacheMs) return [];

  if (!inflight) inflight = run(input.now, input.read, nowMs);
  const current = inflight;
  const raced = await raceTimeout(current, timeoutMs);
  if (raced === "timeout") return freshItems(nowMs(), cacheMs) ?? [];
  return raced ?? freshItems(nowMs(), cacheMs) ?? [];
}

function freshItems(nowMs: number, cacheMs: number): TodayUpcomingItem[] | null {
  if (!cache) return null;
  if (nowMs - cache.at >= cacheMs) return null;
  return cache.items;
}

async function run(
  now: Date,
  read: () => Promise<TodayUpcomingReadResult>,
  nowMs: () => number,
): Promise<TodayUpcomingItem[] | null> {
  try {
    const result = await read();
    if (!result.ok) {
      if (result.suppress) failedAt = nowMs();
      return null;
    }
    const items = selectTodayUpcoming({
      events: result.events,
      calendars: result.calendars,
      now,
    });
    cache = { at: nowMs(), items };
    failedAt = null;
    return items;
  } catch {
    failedAt = nowMs();
    return null;
  } finally {
    inflight = null;
  }
}

function raceTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T | "timeout"> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve("timeout"), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve("timeout");
      },
    );
  });
}
