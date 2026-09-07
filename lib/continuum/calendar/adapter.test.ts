import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertCalendarReadApiHasNoWriteMethods,
  calendarReadApiMethodNames,
  CALENDAR_WRITE_METHOD_NAMES,
  createLiveCalendarApi,
  MockCalendarApi,
} from "./adapter";

const DIR = dirname(fileURLToPath(import.meta.url));

describe("Calendar read-only provider contract", () => {
  it("exposes only getCalendarList and listEvents", () => {
    const api = new MockCalendarApi();
    assert.deepEqual(calendarReadApiMethodNames(api), [
      "getCalendarList",
      "listEvents",
    ]);
    assert.doesNotThrow(() => assertCalendarReadApiHasNoWriteMethods(api));
    for (const method of CALENDAR_WRITE_METHOD_NAMES) {
      assert.equal(method in api, false);
    }
  });

  it("does not implement calendar write methods on the live adapter source", () => {
    const source = readFileSync(join(DIR, "adapter.ts"), "utf8");
    const executable = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    assert.match(executable, /method: "GET"/);
    assert.match(executable, /cache: "no-store"/);
    assert.doesNotMatch(executable, /method:\s*"(POST|PUT|PATCH|DELETE)"/);
    assert.doesNotMatch(
      executable,
      /events\.(insert|update|delete|patch|move|import|quickAdd)/,
    );
    assert.doesNotMatch(executable, /calendars\.insert|acl\.insert|calendarList\.insert/);
    const live = createLiveCalendarApi.toString();
    for (const method of CALENDAR_WRITE_METHOD_NAMES) {
      assert.equal(live.includes(`${method}(`), false);
    }
    assertCalendarReadApiHasNoWriteMethods(createLiveCalendarApi("token-in-memory"));
  });

  it("records listEvents reads without a write channel", async () => {
    const api = new MockCalendarApi();
    api.setEventPage("primary", null, {
      events: [{ id: "evt-1", status: "confirmed" }],
      nextPageToken: null,
      timeZone: "America/New_York",
    });
    await api.listEvents({
      calendarId: "primary",
      timeMin: "2026-03-01T00:00:00.000Z",
      timeMax: "2026-03-15T00:00:00.000Z",
      showDeleted: true,
    });
    assert.equal(api.calls[0]?.method, "listEvents");
    assert.equal(
      api.calls.some((call) =>
        (CALENDAR_WRITE_METHOD_NAMES as readonly string[]).includes(call.method),
      ),
      false,
    );
  });
});
