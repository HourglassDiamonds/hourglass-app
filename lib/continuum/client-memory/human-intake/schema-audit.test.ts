import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

describe("Human intake source SQL", () => {
  const sql = readFileSync(
    resolve(process.cwd(), "lib/supabase/continuum-human-sources-schema.sql"),
    "utf8",
  );

  it("is unapplied, RLS-only, and service-role only", () => {
    assert.match(sql, /UNAPPLIED/);
    assert.match(sql, /DO NOT RUN AGAINST PRODUCTION/);
    assert.match(
      sql,
      /create table if not exists public\.continuum_human_sources/,
    );
    assert.match(
      sql,
      /create table if not exists public\.continuum_human_source_links/,
    );
    assert.match(sql, /source_type in \('plaud', 'remarkable'\)/);
    assert.match(sql, /source_author = 'justin'/);
    assert.match(sql, /'reported-text'/);
    assert.match(sql, /parse_status in \('stored', 'parsed', 'no-candidates', 'failed'\)/);
    assert.match(sql, /review_status in \('pending', 'in-review', 'complete', 'discarded'\)/);
    assert.match(sql, /link_status in \('candidate', 'confirmed'\)/);
    assert.match(sql, /entity_kind in \('person', 'project'\)/);
    assert.equal((sql.match(/enable row level security/g) ?? []).length, 2);
    assert.doesNotMatch(sql, /create policy/i);
    assert.match(sql, /revoke all on table public\.continuum_human_sources from public;/);
    assert.match(sql, /revoke all on table public\.continuum_human_sources from anon;/);
    assert.match(
      sql,
      /revoke all on table public\.continuum_human_sources from authenticated;/,
    );
    assert.match(
      sql,
      /grant select, insert, update, delete on table public\.continuum_human_sources to service_role;/,
    );
    assert.match(
      sql,
      /revoke all on table public\.continuum_human_source_links from public;/,
    );
    assert.match(
      sql,
      /revoke all on table public\.continuum_human_source_links from anon;/,
    );
    assert.match(
      sql,
      /revoke all on table public\.continuum_human_source_links from authenticated;/,
    );
    assert.match(
      sql,
      /grant select, insert, update, delete on table public\.continuum_human_source_links to service_role;/,
    );
    assert.doesNotMatch(sql, /grant .* to anon/i);
    assert.doesNotMatch(sql, /grant .* to authenticated/i);
    assert.doesNotMatch(sql, /grant .* to public/i);
  });

  it("defines a private bucket and no public URL helper", () => {
    assert.match(sql, /continuum-human-sources/);
    assert.match(sql, /public = false/);
    assert.doesNotMatch(sql, /public = true/);
    assert.doesNotMatch(sql, /getPublicUrl/);
    assert.match(sql, /Do not create continuum_intake_candidates in this phase/);
  });

  it("does not create canonical memory, Open Jobs, CoS, or Gmail tables", () => {
    assert.doesNotMatch(
      sql,
      /create table if not exists public\.continuum_intake_candidates/,
    );
    assert.doesNotMatch(
      sql,
      /create table if not exists public\.continuum_open_jobs/,
    );
    assert.doesNotMatch(
      sql,
      /create table if not exists public\.continuum_commitments/,
    );
    assert.doesNotMatch(
      sql,
      /create table if not exists public\.continuum_attention_items/,
    );
    assert.doesNotMatch(
      sql,
      /create table if not exists public\.continuum_gmail_messages/,
    );
    assert.doesNotMatch(sql, /insert into public\.continuum_source_notes/);
    assert.doesNotMatch(sql, /insert into public\.continuum_person_facts/);
    assert.doesNotMatch(sql, /insert into public\.continuum_wishes/);
    assert.doesNotMatch(sql, /insert into public\.continuum_project_history/);
    assert.doesNotMatch(sql, /insert into public\.continuum_events/);
  });
});
