import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

describe("Continuum Candidate SQL", () => {
  const sql = readFileSync(
    resolve(process.cwd(), "lib/supabase/continuum-candidates-schema.sql"),
    "utf8",
  );

  it("is unapplied, additive, and service-role only", () => {
    assert.match(sql, /UNAPPLIED/);
    assert.match(sql, /DO NOT RUN AGAINST PRODUCTION/);
    assert.match(sql, /create table if not exists public\.continuum_candidates/);
    assert.match(sql, /canonical boolean not null default false check \(canonical = false\)/);
    assert.match(sql, /automatic_apply boolean not null default false check \(automatic_apply = false\)/);
    assert.match(sql, /char_length\(source_ref\) <= 2048/);
    assert.match(sql, /structured_spec/);
    assert.match(sql, /candidate_state in \('active', 'conflict', 'superseded'\)/);
    assert.match(sql, /review_status in \('pending', 'approved', 'discarded', 'deferred'\)/);
    assert.match(sql, /last_review_action in \('approve', 'edit', 'discard', 'defer'\)/);
    assert.match(sql, /founder_edited_payload jsonb/);
    assert.match(sql, /founder_edited_target jsonb/);
    assert.match(sql, /human-intake/);
    assert.match(sql, /google_calendar/);
    assert.equal((sql.match(/enable row level security/g) ?? []).length, 1);
    assert.doesNotMatch(sql, /create policy/i);
    assert.doesNotMatch(sql, /grant .* to anon/i);
    assert.doesNotMatch(sql, /grant .* to authenticated/i);
    assert.doesNotMatch(sql, /grant .* to public/i);
    assert.match(sql, /revoke all on table public\.continuum_candidates from public;/);
    assert.match(sql, /grant select, insert, update on table public\.continuum_candidates to service_role;/);
  });

  it("does not create canonical memory, Open Jobs, or Gmail tables", () => {
    assert.doesNotMatch(sql, /create table if not exists public\.continuum_open_jobs/);
    assert.doesNotMatch(sql, /create table if not exists public\.continuum_person_profiles/);
    assert.doesNotMatch(sql, /create table if not exists public\.continuum_gmail_messages/);
    assert.doesNotMatch(sql, /continuum_client_memory_correct_project_spec/);
    assert.doesNotMatch(sql, /body text|snippet text|payload_html/);
  });
});
