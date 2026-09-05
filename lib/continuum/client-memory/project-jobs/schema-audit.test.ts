import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

describe("Client Memory project-jobs SQL", () => {
  const sql = readFileSync(
    resolve(process.cwd(), "lib/supabase/continuum-client-memory-project-jobs.sql"),
    "utf8",
  );

  it("is unapplied, additive, and keeps one canonical Project profile", () => {
    assert.match(sql, /UNAPPLIED/);
    assert.match(sql, /DO NOT RUN AGAINST PRODUCTION/);
    assert.match(sql, /continuum_project_profiles remains the ONE current Project record/);
    assert.match(sql, /create table if not exists public\.continuum_project_jobs/);
    assert.match(sql, /job_id uuid primary key/);
    assert.match(sql, /created_mutation_id uuid not null/);
    assert.match(sql, /continuum_project_jobs_created_mutation_uq/);
    assert.match(sql, /on delete restrict/);
    assert.match(sql, /enable row level security/);
    assert.doesNotMatch(sql, /drop table/i);
    assert.doesNotMatch(sql, /create policy/i);
    assert.doesNotMatch(sql, /execute format/i);
    assert.doesNotMatch(sql, /insert into public\.continuum_project_jobs[\s\S]*select project_id from/i);
    assert.doesNotMatch(sql, /continuum_commitments/);
    assert.doesNotMatch(sql, /continuum_open_jobs/);
    assert.doesNotMatch(sql, /continuum_attention_items/);
    assert.doesNotMatch(sql, /continuum_gmail_messages/);
    assert.doesNotMatch(sql, /continuum_project_artifacts/);
    assert.doesNotMatch(sql, /continuum_project_lifecycle/);
  });

  it("locks bounded kinds, actors, states, and pointer-only provenance", () => {
    for (const kind of [
      "request",
      "commitment",
      "question",
      "required_action",
      "approval",
      "blocked_issue",
    ]) {
      assert.match(sql, new RegExp(`'${kind}'`));
    }
    for (const actor of ["founder", "hourglass", "client", "vendor", "unknown"]) {
      assert.match(sql, new RegExp(`'${actor}'`));
    }
    for (const state of ["open", "snoozed", "resolved", "cancelled"]) {
      assert.match(sql, new RegExp(`'${state}'`));
    }
    assert.match(sql, /source_ref text/);
    assert.match(sql, /Never a Gmail body, captured speech, or attachment URL/);
    assert.doesNotMatch(sql, /body text/i);
    assert.doesNotMatch(sql, /transcript/i);
    assert.doesNotMatch(sql, /snippet text/i);
    assert.doesNotMatch(sql, /raw_email/i);
    assert.doesNotMatch(sql, /bytea/);
    assert.match(sql, /state in \('open', 'snoozed'\)/);
    assert.match(sql, /Snooze is not resolution/);
  });

  it("is service-role only with no public grants", () => {
    assert.match(sql, /revoke all on table public\.continuum_project_jobs from public;/);
    assert.match(sql, /revoke all on table public\.continuum_project_jobs from anon;/);
    assert.match(
      sql,
      /revoke all on table public\.continuum_project_jobs from authenticated;/,
    );
    assert.match(
      sql,
      /grant select, insert, update on table public\.continuum_project_jobs to service_role;/,
    );
    assert.doesNotMatch(sql, /grant .* to anon/i);
    assert.doesNotMatch(sql, /grant .* to authenticated/i);
    assert.doesNotMatch(sql, /grant .* to public/i);
    assert.doesNotMatch(sql, /grant delete on table public\.continuum_project_jobs/i);
  });
});
