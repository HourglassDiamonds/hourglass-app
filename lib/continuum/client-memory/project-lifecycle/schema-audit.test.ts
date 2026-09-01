import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

describe("Client Memory project-lifecycle SQL", () => {
  const sql = readFileSync(
    resolve(
      process.cwd(),
      "lib/supabase/continuum-client-memory-project-lifecycle.sql",
    ),
    "utf8",
  );

  it("is unapplied, additive, and keeps one canonical Project profile", () => {
    assert.match(sql, /UNAPPLIED/);
    assert.match(sql, /DO NOT RUN AGAINST PRODUCTION/);
    assert.match(sql, /continuum_project_profiles remains the ONE current Project record/);
    assert.match(sql, /create table if not exists public\.continuum_project_lifecycle_states/);
    assert.match(sql, /create table if not exists public\.continuum_project_lifecycle_events/);
    assert.match(sql, /primary key \(project_id, project_kind\)/);
    assert.match(sql, /event_id uuid primary key/);
    assert.match(sql, /mutation_id uuid not null/);
    assert.match(sql, /continuum_project_lifecycle_events_mutation_uq/);
    assert.match(sql, /on delete restrict/);
    assert.match(sql, /enable row level security/);
    assert.doesNotMatch(sql, /drop table/i);
    assert.doesNotMatch(sql, /create policy/i);
    assert.doesNotMatch(sql, /execute format/i);
    assert.doesNotMatch(sql, /insert into public\.continuum_project_lifecycle_states[\s\S]*select project_id from/i);
    assert.doesNotMatch(sql, /continuum_person_profiles/);
    assert.doesNotMatch(sql, /continuum_person_facts/);
    assert.doesNotMatch(sql, /continuum_gmail_messages/);
    assert.doesNotMatch(sql, /continuum_attention_items/);
    assert.doesNotMatch(sql, /continuum_project_open_jobs/);
    assert.doesNotMatch(sql, /continuum_project_operating/);
  });

  it("kind-gates writes server-side and does not delete dormant rows", () => {
    assert.match(
      sql,
      /create or replace function public\.continuum_client_memory_set_project_lifecycle\(/,
    );
    assert.match(sql, /security definer/i);
    assert.match(sql, /set search_path = ''/);
    assert.match(sql, /for update/);
    assert.match(sql, /raise exception 'unsupported-project-kind'/);
    assert.match(sql, /raise exception 'invalid-value'/);
    assert.match(sql, /insert into public\.continuum_project_lifecycle_events/);
    assert.match(sql, /insert into public\.continuum_project_lifecycle_states/);
    assert.match(sql, /on conflict \(project_id, project_kind\) do update/);
    assert.doesNotMatch(sql, /delete from public\.continuum_project_lifecycle_states/i);
    assert.doesNotMatch(sql, /delete from public\.continuum_project_lifecycle_events/i);
    assert.doesNotMatch(sql, /set project_kind/);
    assert.doesNotMatch(sql, /update public\.continuum_project_profiles/);
    assert.doesNotMatch(sql, /continuum_project_custom_details/);
    assert.doesNotMatch(sql, /continuum_project_repair_details/);
    assert.doesNotMatch(sql, /continuum_project_history_revisions/);
  });

  it("is service-role only", () => {
    const signature =
      "public.continuum_client_memory_set_project_lifecycle\\(uuid, text, uuid, uuid, timestamptz, text, text\\)";
    assert.match(sql, new RegExp(`revoke all on function ${signature} from public;`, "i"));
    assert.match(sql, new RegExp(`revoke all on function ${signature} from anon;`, "i"));
    assert.match(
      sql,
      new RegExp(`revoke all on function ${signature} from authenticated;`, "i"),
    );
    assert.match(
      sql,
      new RegExp(`grant execute on function ${signature} to service_role;`, "i"),
    );
    assert.doesNotMatch(sql, /grant execute on function [^;]+ to anon/i);
    assert.doesNotMatch(sql, /grant execute on function [^;]+ to authenticated/i);
    assert.doesNotMatch(sql, /grant execute on function [^;]+ to public/i);
  });
});
