import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hashEmail } from "@/lib/continuum/client-memory/hashes";
import { normalizeGoogleCalendarEvent } from "./normalize";
import { googleDateTimeToUtcIso } from "./timezone";
import type { GoogleCalendarEvent } from "./types";

const CAPTURED = "2026-03-08T16:00:00.000Z";

function evidence(event: GoogleCalendarEvent, calendarTimeZone = "America/New_York") {
  return normalizeGoogleCalendarEvent({
    event,
    calendarId: "founder@hourglass.example",
    calendarTimeZone,
    calendarAccessRole: "owner",
    capturedAt: CAPTURED,
  });
}

describe("Calendar event normalization", () => {
  it("normalizes a timed event with source timezone and absolute timestamps", () => {
    const row = evidence({
      id: "timed-1",
      status: "confirmed",
      summary: "Bench review",
      start: {
        dateTime: "2026-03-10T10:00:00-04:00",
        timeZone: "America/New_York",
      },
      end: {
        dateTime: "2026-03-10T11:00:00-04:00",
        timeZone: "America/New_York",
      },
      updated: "2026-03-09T12:00:00.000Z",
    });
    assert.ok(row);
    assert.equal(row?.title, "Bench review");
    assert.equal(row?.timezone, "America/New_York");
    assert.equal(row?.all_day, false);
    assert.equal(row?.start_at, "2026-03-10T14:00:00.000Z");
    assert.equal(row?.end_at, "2026-03-10T15:00:00.000Z");
    assert.equal(row?.source_system, "google_calendar");
    assert.equal(
      row?.source_ref,
      "google_calendar:founder@hourglass.example:timed-1",
    );
    assert.equal(row?.person_id, null);
    assert.equal(row?.project_id, null);
  });

  it("normalizes an all-day event using the source calendar timezone, not founder locale", () => {
    const previous = process.env.TZ;
    process.env.TZ = "Pacific/Auckland";
    const row = evidence(
      {
        id: "all-day-1",
        status: "confirmed",
        summary: "Closed",
        start: { date: "2026-03-08" },
        end: { date: "2026-03-09" },
      },
      "America/Los_Angeles",
    );
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
    assert.ok(row);
    assert.equal(row?.all_day, true);
    assert.equal(row?.timezone, "America/Los_Angeles");
    assert.equal(row?.start_at, "2026-03-08T08:00:00.000Z");
    assert.equal(row?.end_at, "2026-03-09T07:00:00.000Z");
  });

  it("preserves DST boundary instants in America/New_York", () => {
    const before = googleDateTimeToUtcIso(
      { dateTime: "2026-03-08T01:30:00", timeZone: "America/New_York" },
      "America/New_York",
    );
    const after = googleDateTimeToUtcIso(
      { dateTime: "2026-03-08T03:30:00", timeZone: "America/New_York" },
      "America/New_York",
    );
    assert.equal(before?.iso, "2026-03-08T06:30:00.000Z");
    assert.equal(after?.iso, "2026-03-08T07:30:00.000Z");
    const london = evidence(
      {
        id: "london-1",
        status: "confirmed",
        summary: "London call",
        start: {
          dateTime: "2026-03-29T10:00:00+01:00",
          timeZone: "Europe/London",
        },
        end: {
          dateTime: "2026-03-29T10:30:00+01:00",
          timeZone: "Europe/London",
        },
      },
      "Europe/London",
    );
    assert.equal(london?.timezone, "Europe/London");
    assert.equal(london?.start_at, "2026-03-29T09:00:00.000Z");
  });

  it("distinguishes series, occurrence, changed occurrence, and cancelled occurrence", () => {
    const series = evidence({
      id: "series-1",
      status: "confirmed",
      summary: "Weekly",
      recurrence: ["RRULE:FREQ=WEEKLY"],
      start: {
        dateTime: "2026-03-10T15:00:00-04:00",
        timeZone: "America/New_York",
      },
      end: {
        dateTime: "2026-03-10T16:00:00-04:00",
        timeZone: "America/New_York",
      },
    });
    const occurrence = evidence({
      id: "series-1_20260317T190000Z",
      recurringEventId: "series-1",
      status: "confirmed",
      summary: "Weekly",
      start: {
        dateTime: "2026-03-17T15:00:00-04:00",
        timeZone: "America/New_York",
      },
      end: {
        dateTime: "2026-03-17T16:00:00-04:00",
        timeZone: "America/New_York",
      },
    });
    const changed = evidence({
      id: "series-1_20260324T190000Z",
      recurringEventId: "series-1",
      status: "confirmed",
      summary: "Weekly — moved",
      originalStartTime: {
        dateTime: "2026-03-24T15:00:00-04:00",
        timeZone: "America/New_York",
      },
      start: {
        dateTime: "2026-03-24T16:00:00-04:00",
        timeZone: "America/New_York",
      },
      end: {
        dateTime: "2026-03-24T17:00:00-04:00",
        timeZone: "America/New_York",
      },
    });
    const cancelled = evidence({
      id: "series-1_20260331T190000Z",
      recurringEventId: "series-1",
      status: "cancelled",
      originalStartTime: {
        dateTime: "2026-03-31T15:00:00-04:00",
        timeZone: "America/New_York",
      },
      start: {
        dateTime: "2026-03-31T15:00:00-04:00",
        timeZone: "America/New_York",
      },
      end: {
        dateTime: "2026-03-31T16:00:00-04:00",
        timeZone: "America/New_York",
      },
    });
    assert.equal(series?.occurrence_kind, "series");
    assert.equal(series?.series_id, "series-1");
    assert.equal(occurrence?.occurrence_kind, "occurrence");
    assert.equal(occurrence?.series_id, "series-1");
    assert.equal(changed?.occurrence_kind, "changed_occurrence");
    assert.equal(cancelled?.occurrence_kind, "cancelled_occurrence");
    assert.equal(cancelled?.status, "cancelled");
    assert.notEqual(occurrence?.source_ref, changed?.source_ref);
  });

  it("hashes attendee emails and keeps a missing attendee list empty", () => {
    const withGuests = evidence({
      id: "att-1",
      status: "confirmed",
      summary: "Fit",
      start: {
        dateTime: "2026-03-11T13:00:00-04:00",
        timeZone: "America/New_York",
      },
      end: {
        dateTime: "2026-03-11T14:00:00-04:00",
        timeZone: "America/New_York",
      },
      attendees: [
        {
          email: "client@example.com",
          displayName: "Client",
          responseStatus: "accepted",
        },
        { displayName: "No email", responseStatus: "needsAction" },
      ],
    });
    const missing = evidence({
      id: "att-2",
      status: "confirmed",
      summary: "Solo block",
      start: {
        dateTime: "2026-03-11T15:00:00-04:00",
        timeZone: "America/New_York",
      },
      end: {
        dateTime: "2026-03-11T16:00:00-04:00",
        timeZone: "America/New_York",
      },
    });
    assert.equal(withGuests?.attendees[0]?.display_name, "Client");
    assert.equal(withGuests?.attendees[0]?.email_hash, hashEmail("client@example.com"));
    assert.equal(withGuests?.attendees[0]?.email_present, true);
    assert.equal(withGuests?.attendees[1]?.email_present, false);
    assert.equal(withGuests?.attendees[1]?.email_hash, null);
    assert.deepEqual(missing?.attendees, []);
    assert.equal(JSON.stringify(withGuests).includes("client@example.com"), false);
  });

  it("does not copy calendar descriptions into evidence", () => {
    const row = evidence({
      id: "desc-1",
      status: "confirmed",
      summary: "Private",
      description: "Do not leak this body",
      start: {
        dateTime: "2026-03-12T09:00:00-04:00",
        timeZone: "America/New_York",
      },
      end: {
        dateTime: "2026-03-12T09:30:00-04:00",
        timeZone: "America/New_York",
      },
      conferenceData: {
        conferenceId: "abc",
        conferenceSolution: { name: "Google Meet", key: { type: "hangoutsMeet" } },
      },
    });
    assert.equal(row?.description_present, true);
    assert.equal(JSON.stringify(row).includes("Do not leak this body"), false);
    assert.equal(row?.conference?.label, "Google Meet");
    assert.equal(row?.conference?.type, "hangoutsMeet");
  });
});
