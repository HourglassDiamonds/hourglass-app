import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

describe("Client Memory correct-project-spec SQL", () => {
  const sql = readFileSync(
    resolve(
      process.cwd(),
      "lib/supabase/continuum-client-memory-correct-project-spec.sql",
    ),
    "utf8",
  );
  const original = readFileSync(
    resolve(process.cwd(), "lib/supabase/continuum-client-memory-schema.sql"),
    "utf8",
  );

  it("is unapplied, additive, and keeps one current project-history snapshot", () => {
    assert.match(sql, /UNAPPLIED/);
    assert.match(sql, /DO NOT RUN AGAINST PRODUCTION/);
    assert.match(sql, /continuum_project_history remains the ONE current snapshot/);
    assert.match(sql, /add column if not exists founder_corrected_fields text\[\]/i);
    assert.match(
      sql,
      /create table if not exists public\.continuum_project_history_revisions/,
    );
    assert.match(sql, /continuum_project_history_revisions_mutation_uq/);
    assert.match(sql, /enable row level security/);
    assert.match(sql, /No dynamic SQL from field_name/);
    assert.match(
      sql,
      /create or replace function public\.continuum_client_memory_correct_project_spec\(/,
    );
    assert.match(sql, /security definer/i);
    assert.match(sql, /set search_path = ''/);
    assert.match(sql, /for update/);
    assert.match(sql, /insert into public\.continuum_project_history_revisions/);
    assert.match(sql, /update public\.continuum_project_history/);
    assert.match(sql, /raise exception 'entity-kind-mismatch'/);
    assert.match(sql, /raise exception 'implausible-finger-size'/);
    assert.match(sql, /entity_kind <> 'project'/);
    assert.doesNotMatch(sql, /execute format/i);
    assert.doesNotMatch(sql, /execute 'select/i);
    assert.doesNotMatch(sql, /drop table/i);
    assert.doesNotMatch(sql, /create policy/i);
    assert.doesNotMatch(sql, /continuum_human_sources/);
    assert.doesNotMatch(sql, /continuum_gmail_messages/);
    assert.doesNotMatch(sql, /continuum_attention_items/);
    assert.doesNotMatch(sql, /continuum_person_facts/);
    assert.doesNotMatch(sql, /continuum_source_notes/);
    assert.match(
      original,
      /create table if not exists continuum_project_history/,
    );
  });

  it("is service-role only", () => {
    const signature =
      "public.continuum_client_memory_correct_project_spec\\(uuid, uuid, uuid, text, text, timestamptz, text, text\\)";
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
