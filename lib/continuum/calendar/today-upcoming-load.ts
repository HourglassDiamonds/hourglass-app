/**
 * Today calendar read. Disabled and failed reads return an empty upcoming list.
 * Does not start OAuth, change scopes, or write events.
 */

import "server-only";

import { isCalendarReadEnabled } from "./env";
import { loadCalendarFounderSurface } from "./load";
import { resolveTodayUpcomingRead, type TodayUpcomingReadResult } from "./today-upcoming-guard";
import type { TodayUpcomingItem } from "./today-upcoming";

export async function loadTodayUpcoming(now = new Date()): Promise<TodayUpcomingItem[]> {
  if (!isCalendarReadEnabled()) return [];
  return resolveTodayUpcomingRead({
    now,
    read: () => readTodayCalendar(now),
  });
}

async function readTodayCalendar(now: Date): Promise<TodayUpcomingReadResult> {
  const surface = await loadCalendarFounderSurface(now);
  if (surface.status === "read-failed") return { ok: false, suppress: true };
  if (surface.status !== "ready" || !surface.context) return { ok: false };
  return {
    ok: true,
    events: surface.context.upcoming,
    calendars: surface.context.calendars,
  };
}
