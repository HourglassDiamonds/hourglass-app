import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

describe("Calendar read-only SQL", () => {
  const sql = readFileSync(
    resolve(process.cwd(), "lib/supabase/continuum-calendar-readonly.sql"),
    "utf8",
  );

  it("is unapplied, additive, and does not persist events", () => {
    assert.match(sql, /UNAPPLIED/);
    assert.match(sql, /DO NOT RUN AGAINST PRODUCTION/);
    assert.match(sql, /create table if not exists public\.continuum_calendar_connections/);
    assert.doesNotMatch(sql, /create table if not exists public\.continuum_calendar_events/);
    assert.match(sql, /calendar_slot = 'founder-v1'/);
    assert.match(sql, /token_enc_alg = 'aes-256-gcm'/);
  });

  it("is RLS service-role only with no anon/authenticated policies", () => {
    assert.equal((sql.match(/enable row level security/g) ?? []).length, 1);
    assert.doesNotMatch(sql, /create policy/i);
    assert.doesNotMatch(sql, /grant .* to anon/i);
    assert.doesNotMatch(sql, /grant .* to authenticated/i);
    assert.match(
      sql,
      /revoke all on table public\.continuum_calendar_connections from public;/,
    );
    assert.match(
      sql,
      /revoke all on table public\.continuum_calendar_connections from authenticated;/,
    );
    assert.match(
      sql,
      /grant all on table public\.continuum_calendar_connections to service_role;/,
    );
  });

  it("does not store descriptions, join URLs, plaintext tokens, or canonical rows", () => {
    assert.doesNotMatch(sql, /description text/i);
    assert.doesNotMatch(sql, /hangout_link|conference_uri/);
    assert.doesNotMatch(sql, /refresh_token text/);
    assert.match(sql, /refresh_token_ciphertext text/);
    assert.doesNotMatch(sql, /continuum_open_jobs/);
    assert.doesNotMatch(sql, /continuum_gmail_/);
    assert.doesNotMatch(sql, /continuum_entities/);
    assert.doesNotMatch(sql, /insert into public\.continuum_/);
  });
});
