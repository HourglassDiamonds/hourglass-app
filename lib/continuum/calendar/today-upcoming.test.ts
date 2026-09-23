import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ChiefOfStaffToday } from "../../../app/executive-dashboard/concierge/components/chief-of-staff-today";
import { TODAY_DOCKET_VERSION } from "../chief-of-staff/operating-loop/docket";
import { calendarEventEvidence } from "./association/fixtures";
import { normalizeGoogleCalendarEvent } from "./normalize";
import {
  calendarTimingRecommendation,
  mergeCalendarEvidence,
  selectTodayUpcoming,
  upcomingFromCalendarRead,
  type TodayUpcomingItem,
} from "./today-upcoming";

const NOW = new Date("2026-09-23T14:00:00.000Z");
const CALENDAR = "primary";

function event(
  partial: Parameters<typeof calendarEventEvidence>[0],
) {
  return calendarEventEvidence({ calendar_id: CALENDAR, ...partial });
}

describe("today upcoming calendar context", () => {
  it("keeps an all-day event and a timed event in founder-day order", () => {
    const upcoming = selectTodayUpcoming({
      now: NOW,
      events: [
        event({
          calendar_event_id: "afternoon",
          title: "Client appointment",
          start_at: "2026-09-23T17:00:00.000Z",
          end_at: "2026-09-23T18:00:00.000Z",
          location: "Office",
        }),
        event({
          calendar_event_id: "all-day",
          title: "Shop closed",
          all_day: true,
          start_at: "2026-09-23T04:00:00.000Z",
          end_at: "2026-09-24T04:00:00.000Z",
        }),
      ],
    });
    assert.deepEqual(
      upcoming.map((item) => [item.timeLabel, item.title]),
      [
        ["All day", "Shop closed"],
        ["1:00", "Client appointment"],
      ],
    );
    assert.equal(upcoming[1]?.location, "Office");
    assert.equal(upcoming.every((item) => item.disposition === "advisory"), true);
    assert.doesNotMatch(JSON.stringify(upcoming), /\bscheduled\b/i);
  });

  it("keeps overlapping events and preserves timezone labels", () => {
    const upcoming = selectTodayUpcoming({
      now: NOW,
      events: [
        event({
          calendar_event_id: "later",
          title: "Family commitment",
          start_at: "2026-09-23T19:15:00.000Z",
          end_at: "2026-09-23T20:00:00.000Z",
          timezone: "America/New_York",
        }),
        event({
          calendar_event_id: "meet",
          title: "Vendor call",
          start_at: "2026-09-23T16:30:00.000Z",
          end_at: "2026-09-23T17:15:00.000Z",
          timezone: "America/New_York",
          conference: { type: "hangoutsMeet", label: "Google Meet", conference_id: "abc" },
        }),
      ],
    });
    assert.deepEqual(
      upcoming.map((item) => `${item.timeLabel} ${item.meetingLabel ? `${item.meetingLabel} — ` : ""}${item.title}`),
      ["12:30 Google Meet — Vendor call", "3:15 Family commitment"],
    );
    assert.equal(upcoming[0]?.timezone, "America/New_York");
  });

  it("preserves a Google Meet URL on evidence and keeps it off the Today view", () => {
    const evidence = normalizeGoogleCalendarEvent({
      calendarId: CALENDAR,
      capturedAt: "2026-09-23T13:00:00.000Z",
      event: {
        id: "meet-1",
        status: "confirmed",
        summary: "Vendor call",
        start: { dateTime: "2026-09-23T12:30:00-04:00", timeZone: "America/New_York" },
        end: { dateTime: "2026-09-23T13:00:00-04:00", timeZone: "America/New_York" },
        hangoutLink: "https://meet.google.com/abc-defg-hij",
      },
    });
    assert.ok(evidence);
    assert.equal(evidence?.meeting_url, "https://meet.google.com/abc-defg-hij");
    assert.equal(evidence?.person_id, null);
    assert.equal(evidence?.project_id, null);
    const upcoming = selectTodayUpcoming({ now: NOW, events: [evidence!] });
    const serialized = JSON.stringify(upcoming);
    assert.match(serialized, /Google Meet/);
    assert.doesNotMatch(serialized, /meet\.google|hangoutLink/);
  });

  it("drops cancellations and replaces a changed event idempotently", () => {
    const original = event({
      calendar_event_id: "vendor",
      title: "Vendor call",
      start_at: "2026-09-23T16:30:00.000Z",
      end_at: "2026-09-23T17:00:00.000Z",
      updated_at: "2026-09-23T12:00:00.000Z",
    });
    const changed = event({
      ...original,
      title: "Vendor call moved",
      updated_at: "2026-09-23T13:00:00.000Z",
    });
    const cancelled = event({
      calendar_event_id: "gone",
      title: "Cancelled review",
      status: "cancelled",
      occurrence_kind: "cancelled_occurrence",
      start_at: "2026-09-23T16:00:00.000Z",
      end_at: "2026-09-23T16:30:00.000Z",
    });
    const merged = mergeCalendarEvidence([original, changed, original]);
    assert.equal(merged.length, 1);
    assert.equal(merged[0]?.title, "Vendor call moved");
    assert.equal(merged[0]?.person_id, null);
    assert.equal(merged[0]?.project_id, null);
    const upcoming = selectTodayUpcoming({
      now: NOW,
      events: [original, changed, original, cancelled],
    });
    assert.deepEqual(upcoming.map((item) => item.title), ["Vendor call moved"]);
  });

  it("redacts a personal event and still renders an event with no attendees", () => {
    const personal = event({
      calendar_event_id: "private",
      calendar_id: "personal",
      title: "Therapy with Dana",
      location: "Home office",
      visibility: "private",
      attendees: [],
      start_at: "2026-09-23T19:15:00.000Z",
      end_at: "2026-09-23T20:00:00.000Z",
      conference: { type: "hangoutsMeet", label: "Google Meet", conference_id: "secret" },
    });
    const open = event({
      calendar_event_id: "open",
      title: "Client appointment",
      attendees: [],
      start_at: "2026-09-23T17:00:00.000Z",
      end_at: "2026-09-23T18:00:00.000Z",
    });
    const upcoming = selectTodayUpcoming({
      now: NOW,
      calendars: [{ calendar_id: "personal", summary: "Personal" }],
      events: [personal, open],
    });
    const hidden = upcoming.find((item) => item.eventId === "private");
    assert.equal(hidden?.title, "Personal");
    assert.equal(hidden?.disclosure, "minimal");
    assert.equal(hidden?.location, null);
    assert.equal(hidden?.meetingLabel, null);
    assert.doesNotMatch(JSON.stringify(hidden), /Dana|Home office|Google Meet/);
    assert.equal(upcoming.find((item) => item.eventId === "open")?.title, "Client appointment");
  });

  it("uses calendar timing as a recommendation without erasing a client obligation", () => {
    const obligations = ["duane-cad", "grant-order"];
    const upcoming = selectTodayUpcoming({
      now: NOW,
      events: [
        event({
          calendar_event_id: "client",
          title: "Client appointment",
          start_at: "2026-09-23T17:00:00.000Z",
          end_at: "2026-09-23T18:00:00.000Z",
        }),
      ],
    });
    const advice = calendarTimingRecommendation({
      focusNames: ["Duane"],
      upcoming,
    });
    assert.deepEqual(obligations, ["duane-cad", "grant-order"]);
    assert.equal(
      advice,
      "You have Client appointment at 1:00, so I would clear Duane before then.",
    );
    assert.doesNotMatch(advice ?? "", /\bscheduled\b/i);
    assert.doesNotMatch(advice ?? "", /ignore|erase|drop/i);
  });

  it("degrades to an empty upcoming list when the provider is unavailable", () => {
    const events = [
      event({
        calendar_event_id: "client",
        start_at: "2026-09-23T17:00:00.000Z",
        end_at: "2026-09-23T18:00:00.000Z",
      }),
    ];
    assert.deepEqual(
      upcomingFromCalendarRead({ enabled: false, status: "ready", events, now: NOW }),
      [],
    );
    assert.deepEqual(
      upcomingFromCalendarRead({ enabled: true, status: "unavailable", events, now: NOW }),
      [],
    );
    assert.deepEqual(
      upcomingFromCalendarRead({ enabled: true, status: "read-failed", events, now: NOW }),
      [],
    );
  });

  it("renders Upcoming beside Today without replacing the docket", () => {
    const upcoming: TodayUpcomingItem[] = [
      {
        sourceRef: "google_calendar:primary:meet",
        calendarId: "primary",
        eventId: "meet",
        timeLabel: "12:30",
        title: "Vendor call",
        location: null,
        meetingLabel: "Google Meet",
        allDay: false,
        timezone: "America/New_York",
        observedAt: "2026-09-23T13:00:00.000Z",
        disclosure: "full",
        disposition: "advisory",
      },
    ];
    const html = renderToStaticMarkup(
      createElement(ChiefOfStaffToday, {
        upcoming,
        docket: {
          todayDocketVersion: TODAY_DOCKET_VERSION,
          title: "Up next",
          items: [],
          queuedCount: 0,
          watchingCount: 0,
          watching: [],
          showCaughtUp: true,
          showDisconnected: false,
          caughtUpHeading: "You're caught up.",
          caughtUpDetail: null,
          disconnectedHeading: null,
          disconnectedDetail: null,
        },
      }),
    );
    assert.match(html, /Upcoming/);
    assert.match(html, /12:30/);
    assert.match(html, /Google Meet — Vendor call/);
    assert.match(html, /caught up/i);
    assert.doesNotMatch(html, /\bscheduled\b/i);
    assert.doesNotMatch(html, /meet\.google/);
  });

  it("does not mint people or projects and does not schedule", () => {
    const source = [
      readFileSync(join(process.cwd(), "lib/continuum/calendar/today-upcoming.ts"), "utf8"),
      readFileSync(join(process.cwd(), "lib/continuum/calendar/today-upcoming-load.ts"), "utf8"),
      readFileSync(join(process.cwd(), "app/executive-dashboard/concierge/page.tsx"), "utf8"),
    ].join("\n");
    assert.doesNotMatch(source, /createPerson|mintPerson|createProjectJob|insert\(/);
    assert.doesNotMatch(source, /\bscheduled\b/i);
    assert.match(source, /loadTodayUpcoming/);
    assert.match(
      readFileSync(
        join(process.cwd(), "app/executive-dashboard/concierge/components/chief-of-staff-today.tsx"),
        "utf8",
      ),
      /data-today-upcoming/,
    );
  });
});
