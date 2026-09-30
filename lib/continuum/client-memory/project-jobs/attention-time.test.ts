import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeAttentionTime } from "./attention-time";

const base = { originalWording: "tomorrow at 9 AM", referenceInstant: "2026-03-07T15:00:00.000Z", timezone: "America/New_York" };

test("date-only is civil-date start and missing year requires confirmation", () => {
  const full = normalizeAttentionTime({ ...base, kind: "date-only", localDate: "2026-03-08" });
  assert.equal(full.ok && full.instant, "2026-03-08T05:00:00.000Z");
  const missing = normalizeAttentionTime({ ...base, kind: "date-only", localDate: "03-08" });
  assert.equal(missing.ok && missing.requiresConfirmation, true);
});

test("DST gap, overlap, and timezone-offset mismatch clarify instead of falling back", () => {
  assert.deepEqual(normalizeAttentionTime({ ...base, kind: "local-date-time", localDateTime: "2026-03-08T02:30:00" }),
    { ok: false, reason: "nonexistent-local-time" });
  const overlap = { ...base, referenceInstant: "2026-10-31T14:00:00Z", kind: "local-date-time" as const, localDateTime: "2026-11-01T01:30:00" };
  assert.deepEqual(normalizeAttentionTime(overlap), { ok: false, reason: "ambiguous-local-time" });
  const resolved = normalizeAttentionTime({ ...overlap, offset: "-04:00" });
  assert.equal(resolved.ok && resolved.instant, "2026-11-01T05:30:00.000Z");
  assert.deepEqual(normalizeAttentionTime({ ...overlap, offset: "-06:00" }), { ok: false, reason: "timezone-offset-mismatch" });
});

test("calendar dates, elapsed hours, and business days retain different semantics", () => {
  const calendar = normalizeAttentionTime({ ...base, kind: "calendar-days", amount: 1, localTime: "10:00" });
  const duration = normalizeAttentionTime({ ...base, kind: "duration-hours", amount: 24 });
  assert.equal(calendar.ok && calendar.instant, "2026-03-08T14:00:00.000Z");
  assert.equal(duration.ok && duration.instant, "2026-03-08T15:00:00.000Z");
  const business = normalizeAttentionTime({ ...base, referenceInstant: "2026-03-06T15:00:00Z",
    kind: "business-days", amount: 1, localTime: "10:00" });
  assert.equal(business.ok && business.localDateTime.startsWith("2026-03-09"), true);
  assert.match(business.ok ? business.metadata.assumptions.join(" ") : "", /Monday-Friday/);
});

test("relative references are captured once and ambiguous meridiem/vendor windows require a choice", () => {
  const source = normalizeAttentionTime({ ...base, kind: "tomorrow", localTime: "9 AM", referenceKind: "source" });
  assert.equal(source.ok && source.metadata.referenceInstant, "2026-03-07T15:00:00.000Z");
  assert.match(source.ok ? source.metadata.assumptions.join(" ") : "", /source timestamp/);
  assert.deepEqual(normalizeAttentionTime({ ...base, kind: "tomorrow", localTime: "9" }), { ok: false, reason: "ambiguous-meridiem" });
  assert.deepEqual(normalizeAttentionTime({ ...base, kind: "vendor-window" }), { ok: false, reason: "advisory-window-requires-checkpoint" });
});

test("founder timezone fallback is explicit", () => {
  const result = normalizeAttentionTime({ ...base, timezone: null, kind: "tomorrow", localTime: "9 AM" });
  assert.equal(result.ok && result.metadata.timezone, "America/New_York");
  assert.match(result.ok ? result.metadata.assumptions.join(" ") : "", /Founder default timezone/);
});
