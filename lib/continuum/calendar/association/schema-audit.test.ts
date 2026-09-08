import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

describe("Calendar association SQL", () => {
  const sql = readFileSync(
    resolve(process.cwd(), "lib/supabase/continuum-calendar-association.sql"),
    "utf8",
  );

  it("is unapplied, additive, and service-role only", () => {
    assert.match(sql, /UNAPPLIED/);
    assert.match(sql, /DO NOT RUN AGAINST PRODUCTION/);
    assert.match(sql, /create table if not exists public\.continuum_calendar_source_links/);
    assert.match(
      sql,
      /create table if not exists public\.continuum_calendar_participant_mappings/,
    );
    assert.match(sql, /source_ref like 'cal1\|%'/);
    assert.match(sql, /link_status = 'confirmed'/);
    assert.equal((sql.match(/enable row level security/g) ?? []).length, 2);
    assert.doesNotMatch(sql, /create policy/i);
    assert.doesNotMatch(sql, /grant .* to anon/i);
    assert.doesNotMatch(sql, /grant .* to authenticated/i);
    assert.match(
      sql,
      /revoke all on table public\.continuum_calendar_source_links from public;/,
    );
    assert.match(
      sql,
      /grant select, insert, update on table public\.continuum_calendar_source_links to service_role;/,
    );
  });

  it("does not persist events, descriptions, Open Jobs, or OAuth tokens", () => {
    assert.doesNotMatch(sql, /create table if not exists public\.continuum_calendar_events/);
    assert.doesNotMatch(sql, /description text/i);
    assert.doesNotMatch(sql, /hangout_link|conference_uri/);
    assert.doesNotMatch(sql, /continuum_open_jobs/);
    assert.doesNotMatch(sql, /refresh_token/);
    assert.doesNotMatch(sql, /insert into public\.continuum_/);
  });
});
