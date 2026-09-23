/**
 * Today calendar read. Disabled and failed reads return an empty upcoming list.
 * Does not start OAuth, change scopes, or write events.
 */

import "server-only";

import { isCalendarReadEnabled } from "./env";
import { loadCalendarFounderSurface } from "./load";
import { selectTodayUpcoming, type TodayUpcomingItem } from "./today-upcoming";

export async function loadTodayUpcoming(now = new Date()): Promise<TodayUpcomingItem[]> {
  if (!isCalendarReadEnabled()) return [];
  try {
    const surface = await loadCalendarFounderSurface(now);
    if (surface.status !== "ready" || !surface.context) return [];
    return selectTodayUpcoming({
      events: surface.context.upcoming,
      calendars: surface.context.calendars,
      now,
    });
  } catch {
    return [];
  }
}
