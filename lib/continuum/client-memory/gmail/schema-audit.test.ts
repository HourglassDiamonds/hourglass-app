import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

describe("Client Memory Gmail index SQL", () => {
  const sql = readFileSync(
    resolve(
      process.cwd(),
      "lib/supabase/continuum-client-memory-gmail-index.sql",
    ),
    "utf8",
  );

  it("is unapplied, RLS-only, and service-role only", () => {
    assert.match(sql, /UNAPPLIED/);
    assert.match(sql, /DO NOT RUN AGAINST PRODUCTION/);
    assert.match(sql, /create table if not exists public\.continuum_gmail_messages/);
    assert.match(
      sql,
      /create table if not exists public\.continuum_gmail_checkpoints/,
    );
    assert.match(sql, /message_id text primary key/);
    assert.match(sql, /job_key in \('gmail-historical', 'gmail-memory-daily'\)/);
    assert.equal((sql.match(/enable row level security/g) ?? []).length, 2);
    assert.doesNotMatch(sql, /create policy/i);
    assert.doesNotMatch(sql, /grant .* to anon/i);
    assert.doesNotMatch(sql, /grant .* to authenticated/i);
    assert.doesNotMatch(sql, /grant .* to public/i);
    assert.match(sql, /revoke all on table public\.continuum_gmail_messages from public;/);
    assert.match(sql, /revoke all on table public\.continuum_gmail_messages from anon;/);
    assert.match(
      sql,
      /revoke all on table public\.continuum_gmail_messages from authenticated;/,
    );
    assert.match(
      sql,
      /grant all on table public\.continuum_gmail_messages to service_role;/,
    );
    assert.match(
      sql,
      /revoke all on table public\.continuum_gmail_checkpoints from public;/,
    );
    assert.match(
      sql,
      /revoke all on table public\.continuum_gmail_checkpoints from authenticated;/,
    );
    assert.match(
      sql,
      /grant all on table public\.continuum_gmail_checkpoints to service_role;/,
    );
  });

  it("stores metadata without a payload or raw email column", () => {
    assert.doesNotMatch(sql, /body text/i);
    assert.doesNotMatch(sql, /excerpt text/i);
    assert.doesNotMatch(sql, /raw_email/i);
    assert.doesNotMatch(sql, /from_email text/i);
    assert.doesNotMatch(sql, /to_emails text/i);
    assert.match(sql, /from_email_hash text/);
    assert.match(sql, /to_email_hashes text\[\]/);
    assert.match(sql, /cc_email_hashes text\[\]/);
    assert.match(sql, /source_system = 'gmail'/);
    assert.doesNotMatch(sql, /create table if not exists public\.continuum_entities/);
    assert.doesNotMatch(sql, /create table if not exists public\.continuum_person_facts/);
    assert.doesNotMatch(sql, /insert into public\.continuum_/);
  });
});
