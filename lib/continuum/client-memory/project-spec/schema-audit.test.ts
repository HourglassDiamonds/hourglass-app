import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const ALLOWED_SPEC_FIELDS = [
  "finger_size",
  "order_number",
  "cad_job_number",
  "metal",
  "center_stone",
  "diamond_supply_notes",
] as const;

const FUNCTION_MARKER =
  "create or replace function public.continuum_client_memory_correct_project_spec";

const FUNCTION_SIGNATURE =
  "public.continuum_client_memory_correct_project_spec(uuid, uuid, uuid, text, text, timestamptz, text, text)";

function functionBody(source: string): string {
  const from = source.indexOf(FUNCTION_MARKER);
  assert.ok(from >= 0, "correct_project_spec function missing");
  const end = source.indexOf("$$;", from);
  assert.ok(end >= 0, "correct_project_spec terminator missing");
  return source.slice(from, end + 3).replace(/\r\n/g, "\n");
}

describe("Client Memory correct-project-spec SQL", () => {
  const sql = readFileSync(
    resolve(
      process.cwd(),
      "lib/supabase/continuum-client-memory-correct-project-spec.sql",
    ),
    "utf8",
  );
  const patch = readFileSync(
    resolve(
      process.cwd(),
      "lib/supabase/continuum-client-memory-correct-project-spec-array-append.sql",
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
    const signature = FUNCTION_SIGNATURE.replace(/[()]/g, "\\$&");
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

  it("appends founder_corrected_fields with array_append, not scalar text[] concat", () => {
    // Production defect: text[] || 'cad_job_number' is resolved as
    // text[] || text[] after casting the scalar, which raises
    // malformed array literal: "cad_job_number". Live DB RPC tests
    // are not available in this repo; this is the SQL contract.
    for (const source of [sql, patch]) {
      assert.doesNotMatch(source, /founder_corrected_fields\s*\|\|\s*'/);
      assert.doesNotMatch(functionBody(source), /drop function/i);
      assert.match(source, /security definer/i);
      assert.match(source, /set search_path = ''/);
      assert.match(
        source,
        /create or replace function public\.continuum_client_memory_correct_project_spec\(\s*p_project_id uuid,\s*p_mutation_id uuid,\s*p_revision_id uuid,\s*p_field_name text,\s*p_new_value text,\s*p_changed_at timestamptz,\s*p_changed_by text,\s*p_source_system text\s*\) returns jsonb/,
      );
      for (const field of ALLOWED_SPEC_FIELDS) {
        const escaped = field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        assert.match(
          source,
          new RegExp(
            `when '${escaped}' = any \\(founder_corrected_fields\\) then founder_corrected_fields\\s+else array_append\\(founder_corrected_fields, '${escaped}'\\)`,
          ),
        );
      }
    }
  });

  it("ships a function-only CREATE OR REPLACE that preserves the production contract", () => {
    assert.match(patch, /UNAPPLIED/);
    assert.match(patch, /DO NOT RUN AGAINST PRODUCTION/);
    assert.doesNotMatch(patch, /^\s*create table/im);
    assert.doesNotMatch(patch, /^\s*drop table/im);
    assert.doesNotMatch(patch, /^\s*alter table/im);
    assert.doesNotMatch(patch, /^\s*drop function/im);
    assert.doesNotMatch(patch, /^\s*revoke\b/im);
    assert.doesNotMatch(patch, /^\s*grant\b/im);
    assert.doesNotMatch(patch, /^\s*alter\b/im);
    assert.doesNotMatch(functionBody(patch), /\bgrant\b/i);
    assert.doesNotMatch(functionBody(patch), /\brevoke\b/i);
    assert.equal(functionBody(patch), functionBody(sql));
    assert.match(sql, new RegExp(`grant execute on function ${FUNCTION_SIGNATURE.replace(/[()]/g, "\\$&")} to service_role;`, "i"));
  });
});
