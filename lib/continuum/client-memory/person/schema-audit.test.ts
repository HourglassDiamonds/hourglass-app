import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

describe("Client Memory update-person-contact SQL", () => {
  const sql = readFileSync(
    resolve(process.cwd(), "lib/supabase/continuum-client-memory-update-person-contact.sql"),
    "utf8",
  );

  it("is unapplied, transactional, and service-role only", () => {
    assert.match(sql, /UNAPPLIED/);
    assert.match(sql, /DO NOT RUN AGAINST PRODUCTION/);
    assert.match(
      sql,
      /create or replace function public\.continuum_client_memory_update_person_contact\(/,
    );
    assert.match(sql, /security definer/i);
    assert.match(sql, /set search_path = ''/);
    assert.match(sql, /for update/);
    assert.match(sql, /pg_advisory_xact_lock/);
    assert.match(sql, /identity_conflict/);
    assert.match(sql, /revoked_at = p_updated_at/);
    assert.match(sql, /ident_kind not in \('email_hash', 'phone_hash'\)/);
    assert.match(sql, /public\.continuum_person_profiles/);
    assert.match(sql, /public\.continuum_external_identities/);
    assert.match(sql, /kind = 'person'/);
    assert.doesNotMatch(sql, /continuum_source_notes/);
    assert.doesNotMatch(sql, /continuum_wishes/);
    assert.doesNotMatch(sql, /continuum_person_facts/);
    assert.doesNotMatch(sql, /continuum_evidence/);
    assert.doesNotMatch(sql, /continuum_observations/);
    assert.doesNotMatch(sql, /continuum_events/);
    assert.doesNotMatch(sql, /create policy/i);
    assert.doesNotMatch(sql, /roles\s*=/);
    assert.doesNotMatch(sql, /source_system\s*=/);
    assert.doesNotMatch(sql, /grant execute on function [^;]+ to anon/i);
    assert.doesNotMatch(sql, /grant execute on function [^;]+ to authenticated/i);
    assert.doesNotMatch(sql, /grant execute on function [^;]+ to public/i);
    assert.match(
      sql,
      /revoke all on function public\.continuum_client_memory_update_person_contact\(uuid, timestamptz, jsonb, jsonb\) from public;/i,
    );
    assert.match(
      sql,
      /revoke all on function public\.continuum_client_memory_update_person_contact\(uuid, timestamptz, jsonb, jsonb\) from anon;/i,
    );
    assert.match(
      sql,
      /revoke all on function public\.continuum_client_memory_update_person_contact\(uuid, timestamptz, jsonb, jsonb\) from authenticated;/i,
    );
    assert.match(
      sql,
      /grant execute on function public\.continuum_client_memory_update_person_contact\(uuid, timestamptz, jsonb, jsonb\) to service_role;/i,
    );
  });
});
