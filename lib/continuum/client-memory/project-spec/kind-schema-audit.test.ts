import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

describe("Client Memory project-kind SQL", () => {
  const sql = readFileSync(
    resolve(process.cwd(), "lib/supabase/continuum-client-memory-project-kind.sql"),
    "utf8",
  );
  const original = readFileSync(
    resolve(process.cwd(), "lib/supabase/continuum-client-memory-schema.sql"),
    "utf8",
  );

  it("is unapplied, additive, and keeps one canonical Project profile", () => {
    assert.match(sql, /UNAPPLIED/);
    assert.match(sql, /DO NOT RUN AGAINST PRODUCTION/);
    assert.match(sql, /continuum_project_profiles remains the ONE current Project record/);
    assert.match(sql, /add column if not exists project_kind text/i);
    assert.match(sql, /continuum_project_profiles_project_kind_check/);
    assert.match(sql, /project_kind is null/);
    assert.match(sql, /'custom_new_jewelry'/);
    assert.match(sql, /'repair_service'/);
    assert.match(sql, /'loose_stone_sourcing'/);
    assert.match(sql, /'consultation_opportunity'/);
    assert.match(sql, /'other'/);
    assert.doesNotMatch(sql, /'unknown'/);
    assert.match(
      sql,
      /create or replace function public\.continuum_client_memory_correct_project_kind\(/,
    );
    assert.match(sql, /security definer/i);
    assert.match(sql, /set search_path = ''/);
    assert.match(sql, /for update/);
    assert.match(sql, /insert into public\.continuum_project_history_revisions/);
    assert.match(sql, /update public\.continuum_project_profiles/);
    assert.match(sql, /'project_kind',\s+current_value/);
    assert.match(sql, /raise exception 'entity-kind-mismatch'/);
    assert.match(sql, /raise exception 'invalid-value'/);
    assert.doesNotMatch(sql, /execute format/i);
    assert.doesNotMatch(sql, /drop table/i);
    assert.doesNotMatch(sql, /create policy/i);
    assert.doesNotMatch(sql, /set project_kind = 'custom_new_jewelry'/);
    assert.doesNotMatch(sql, /set project_kind = 'repair_service'/);
    assert.doesNotMatch(sql, /update public\.continuum_project_history/);
    assert.doesNotMatch(sql, /continuum_person_profiles/);
    assert.doesNotMatch(sql, /continuum_person_facts/);
    assert.doesNotMatch(sql, /continuum_source_notes/);
    assert.doesNotMatch(sql, /continuum_gmail_messages/);
    assert.doesNotMatch(sql, /continuum_attention_items/);
    assert.match(
      original,
      /create table if not exists continuum_project_profiles/,
    );
    assert.doesNotMatch(original, /project_kind text/);
  });

  it("is service-role only", () => {
    const signature =
      "public.continuum_client_memory_correct_project_kind\\(uuid, uuid, uuid, text, timestamptz, text, text\\)";
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
