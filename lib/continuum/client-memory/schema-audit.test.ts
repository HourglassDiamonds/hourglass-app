import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Client Memory schema activation SQL", () => {
  const sql = readFileSync(
    resolve(process.cwd(), "lib/supabase/continuum-client-memory-schema.sql"),
    "utf8",
  );
  const kernel = readFileSync(
    resolve(process.cwd(), "lib/supabase/continuum-schema.sql"),
    "utf8",
  );

  it("depends on the kernel identity_kind check and extends it deterministically", () => {
    assert.match(
      kernel,
      /identity_kind in \(\s*'hubspot_contact_id',\s*'email_hash',\s*'phone_hash',\s*'google_contact_id'\s*\)/,
    );
    assert.doesNotMatch(kernel, /import_row_key/);
    assert.match(
      sql,
      /drop constraint if exists continuum_external_identities_identity_kind_check/,
    );
    assert.doesNotMatch(sql, /pg_get_constraintdef/);
    assert.match(sql, /continuum_external_identities_identity_kind_check/);
    assert.match(sql, /'import_row_key'/);
    assert.match(sql, /'hubspot_contact_id'/);
    assert.equal(sql.includes("hubspot_deal_id');"), false);
    assert.match(sql, /continuum_external_identities_active_uq is unchanged/);
  });

  it("locks SECURITY DEFINER search_path and grants execute only to service_role", () => {
    assert.match(sql, /set search_path = ''/);
    assert.doesNotMatch(sql, /set search_path = public/);
    const createBody = sql.slice(
      sql.indexOf("create or replace function public.continuum_client_memory_create_person"),
      sql.indexOf(
        "grant execute on function public.continuum_client_memory_create_person",
      ),
    );
    const applyBody = sql.slice(
      sql.indexOf(
        "create or replace function public.continuum_client_memory_apply_existing_person",
      ),
      sql.indexOf(
        "grant execute on function public.continuum_client_memory_apply_existing_person",
      ),
    );
    for (const body of [createBody, applyBody]) {
      assert.match(body, /security definer/i);
      assert.match(body, /set search_path = ''/);
      assert.doesNotMatch(body, /(?<!public\.)continuum_entities/);
      assert.doesNotMatch(body, /(?<!public\.)continuum_person_profiles/);
      assert.doesNotMatch(body, /(?<!public\.)continuum_external_identities/);
      assert.match(body, /public\.continuum_entities/);
      assert.match(body, /public\.continuum_person_profiles/);
      assert.match(body, /public\.continuum_external_identities/);
    }
    assert.match(
      sql,
      /revoke all on function public\.continuum_client_memory_create_person\(uuid, timestamptz, text, jsonb, jsonb\) from public;/i,
    );
    assert.match(
      sql,
      /revoke all on function public\.continuum_client_memory_create_person\(uuid, timestamptz, text, jsonb, jsonb\) from anon;/i,
    );
    assert.match(
      sql,
      /revoke all on function public\.continuum_client_memory_create_person\(uuid, timestamptz, text, jsonb, jsonb\) from authenticated;/i,
    );
    assert.match(
      sql,
      /grant execute on function public\.continuum_client_memory_create_person\(uuid, timestamptz, text, jsonb, jsonb\) to service_role;/i,
    );
    assert.match(
      sql,
      /revoke all on function public\.continuum_client_memory_apply_existing_person\(uuid, timestamptz, jsonb, jsonb\) from public;/i,
    );
    assert.match(
      sql,
      /revoke all on function public\.continuum_client_memory_apply_existing_person\(uuid, timestamptz, jsonb, jsonb\) from anon;/i,
    );
    assert.match(
      sql,
      /revoke all on function public\.continuum_client_memory_apply_existing_person\(uuid, timestamptz, jsonb, jsonb\) from authenticated;/i,
    );
    assert.match(
      sql,
      /grant execute on function public\.continuum_client_memory_apply_existing_person\(uuid, timestamptz, jsonb, jsonb\) to service_role;/i,
    );
    assert.doesNotMatch(sql, /grant execute on function [^;]+ to anon/i);
    assert.doesNotMatch(sql, /grant execute on function [^;]+ to authenticated/i);
    assert.doesNotMatch(sql, /grant execute on function [^;]+ to public/i);
  });

  it("uses valid CHECK, partial unique, FK, and RLS-only statements", () => {
    assert.match(
      sql,
      /create unique index if not exists continuum_person_facts_one_current_uq/,
    );
    assert.match(sql, /where status = 'current'/);
    assert.match(
      sql,
      /create unique index if not exists continuum_source_notes_import_field_uq/,
    );
    assert.match(sql, /\(source_system, import_row_key, source_field\)/);
    assert.match(sql, /check \(from_entity_id <> to_entity_id\)/);
    assert.match(sql, /visibility in \('internal-only', 'client-visible', 'household-visible'\)/);
    assert.match(sql, /usage_permission in \(/);
    assert.match(sql, /references continuum_entities \(id\)/);
    assert.match(sql, /references continuum_project_profiles \(project_id\)/);
    assert.doesNotMatch(sql, /create policy/i);
    assert.doesNotMatch(sql, /grant .* to anon/i);
    assert.doesNotMatch(sql, /grant .* to authenticated/i);
    assert.match(sql, /revoke all on function public.continuum_client_memory_create_person/i);
    assert.match(sql, /continuum_client_memory_apply_existing_person/);
    assert.equal((sql.match(/enable row level security/g) ?? []).length, 10);
  });
});
