import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MockCalendarApi } from "./adapter";
import {
  partitionCalendarEvents,
  readCalendarContext,
  selectReadableCalendars,
} from "./context";
import { toCalendarAssociationHandoff } from "./handoff";
import { normalizeGoogleCalendarEvent } from "./normalize";

const NOW = new Date("2026-03-10T16:00:00.000Z");

describe("Calendar read-through context", () => {
  it("splits upcoming and recent events without associating people or projects", async () => {
    const api = new MockCalendarApi();
    api.setCalendarList({
      calendars: [
        {
          id: "founder@hourglass.example",
          summary: "Founder",
          timeZone: "America/New_York",
          primary: true,
          selected: true,
          accessRole: "owner",
        },
      ],
      nextPageToken: null,
    });
    api.setEventPage("founder@hourglass.example", null, {
      timeZone: "America/New_York",
      nextPageToken: null,
      events: [
        {
          id: "upcoming-1",
          status: "confirmed",
          summary: "Upcoming bench",
          start: {
            dateTime: "2026-03-11T10:00:00-04:00",
            timeZone: "America/New_York",
          },
          end: {
            dateTime: "2026-03-11T11:00:00-04:00",
            timeZone: "America/New_York",
          },
        },
        {
          id: "recent-1",
          status: "confirmed",
          summary: "Recent call",
          start: {
            dateTime: "2026-03-09T14:00:00-04:00",
            timeZone: "America/New_York",
          },
          end: {
            dateTime: "2026-03-09T14:30:00-04:00",
            timeZone: "America/New_York",
          },
        },
        {
          id: "upcoming-1",
          status: "confirmed",
          summary: "Upcoming bench",
          start: {
            dateTime: "2026-03-11T10:00:00-04:00",
            timeZone: "America/New_York",
          },
          end: {
            dateTime: "2026-03-11T11:00:00-04:00",
            timeZone: "America/New_York",
          },
        },
      ],
    });
    const context = await readCalendarContext({ api, now: NOW });
    assert.equal(context.upcoming.length, 1);
    assert.equal(context.recent.length, 1);
    assert.equal(context.upcoming[0]?.title, "Upcoming bench");
    assert.equal(context.recent[0]?.title, "Recent call");
    assert.equal(context.upcoming[0]?.person_id, null);
    assert.equal(context.upcoming[0]?.project_id, null);
    assert.equal(context.association_handoffs[0]?.association_status, "unassociated");
    assert.deepEqual(context.association_handoffs[0]?.association_candidates, []);
    assert.equal(context.association_handoffs[0]?.person_id, null);
    assert.equal(context.association_handoffs[0]?.project_id, null);
  });

  it("skips free/busy-only calendars and does not invent Open Jobs", () => {
    const selected = selectReadableCalendars([
      { id: "busy", accessRole: "freeBusyReader", selected: true },
      { id: "primary", accessRole: "owner", primary: true, selected: true },
    ]);
    assert.deepEqual(
      selected.map((row) => row.calendar_id),
      ["primary"],
    );
    const event = normalizeGoogleCalendarEvent({
      event: {
        id: "x",
        status: "confirmed",
        start: { dateTime: "2026-03-10T12:00:00Z", timeZone: "UTC" },
        end: { dateTime: "2026-03-10T13:00:00Z", timeZone: "UTC" },
      },
      calendarId: "primary",
      calendarTimeZone: "UTC",
      capturedAt: NOW.toISOString(),
    });
    assert.ok(event);
    const parts = partitionCalendarEvents([event], {
      now: NOW,
      recentFrom: new Date(NOW.getTime() - 86400000),
      upcomingUntil: new Date(NOW.getTime() + 86400000),
    });
    assert.equal("open_job_id" in event, false);
    assert.equal(parts.recent.length + parts.upcoming.length, 1);
    const handoff = toCalendarAssociationHandoff(event);
    assert.equal(handoff.relationship_id, null);
  });
});
