import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { toCalendarFounderContextView } from "./presentation";
import { CONCIERGE_CALENDAR_PATH } from "./types";
import type { CalendarEventEvidence } from "./types";

const DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(DIR, "../../..");

const sample: CalendarEventEvidence = {
  calendar_event_id: "evt-1",
  calendar_id: "primary",
  title: "Bench review",
  start_at: "2026-03-10T14:00:00.000Z",
  end_at: "2026-03-10T15:00:00.000Z",
  timezone: "America/New_York",
  all_day: false,
  status: "confirmed",
  occurrence_kind: "single",
  series_id: null,
  original_start_at: null,
  organizer: null,
  attendees: [{ display_name: "Alex", email_hash: "abc", email_present: true, response_status: "accepted", optional: false, organizer: false, self: false }],
  location: "Studio",
  conference: { type: "hangoutsMeet", label: "Google Meet", conference_id: "abc" },
  updated_at: "2026-03-09T12:00:00.000Z",
  description_present: true,
  source_system: "google_calendar",
  source_ref: "google_calendar:primary:evt-1",
  provenance: {
    captured_at: "2026-03-10T16:00:00.000Z",
    provider: "google_calendar_api",
    read_method: "events.list",
    calendar_access_role: "owner",
  },
  person_id: null,
  project_id: null,
};

describe("Calendar founder UI", () => {
  it("renders coming up / recently without association copy", () => {
    const view = toCalendarFounderContextView({
      upcoming: [sample],
      recent: [],
    });
    assert.equal(view.upcoming[0]?.title, "Bench review");
    assert.equal(view.upcoming[0]?.attendees[0], "Alex");
    assert.equal(JSON.stringify(view).includes("Do not leak"), false);
    const ui = readFileSync(
      join(ROOT, "app/executive-dashboard/concierge/components/calendar-context.tsx"),
      "utf8",
    );
    const page = readFileSync(
      join(ROOT, "app/executive-dashboard/concierge/calendar/page.tsx"),
      "utf8",
    );
    const home = readFileSync(
      join(ROOT, "app/executive-dashboard/concierge/components/command-center-home.tsx"),
      "utf8",
    );
    assert.match(ui, /Coming up/);
    assert.match(ui, /Recently/);
    assert.doesNotMatch(ui, /Sarah|Dylan|prep for|follow up/i);
    assert.match(page, /loadCalendarFounderSurface/);
    assert.match(page, /force-dynamic/);
    assert.match(page, /IntakeCandidateReviewList/);
    assert.match(page, /Association review/);
    assert.equal(CONCIERGE_CALENDAR_PATH, "/executive-dashboard/concierge/calendar");
    assert.match(home, /Calendar/);
    assert.match(home, /CONCIERGE_CALENDAR_PATH/);
    assert.doesNotMatch(home, /OpenProjectsHome[\s\S]*Calendar context/);
  });

  it("does not expose descriptions or join URLs in the founder view model", () => {
    const view = toCalendarFounderContextView({ upcoming: [sample], recent: [] });
    const serialized = JSON.stringify(view);
    assert.doesNotMatch(serialized, /description/);
    assert.doesNotMatch(serialized, /hangoutLink|meet\.google/);
    assert.match(serialized, /Google Meet/);
  });
});
