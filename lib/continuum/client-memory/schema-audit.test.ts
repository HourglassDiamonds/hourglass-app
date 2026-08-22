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

  it("depends on the kernel identity_kind check and extends it via catalog lookup", () => {
    assert.match(
      kernel,
      /identity_kind in \(\s*'hubspot_contact_id',\s*'email_hash',\s*'phone_hash',\s*'google_contact_id'\s*\)/,
    );
    assert.doesNotMatch(kernel, /import_row_key/);
    assert.match(sql, /pg_get_constraintdef\(c\.oid\) ~\* 'identity_kind'/);
    assert.match(sql, /not like '%import_row_key%'/);
    assert.match(sql, /continuum_external_identities_identity_kind_check/);
    assert.match(sql, /'import_row_key'/);
    assert.match(sql, /'hubspot_contact_id'/);
    assert.equal(sql.includes("hubspot_deal_id');"), false);
    assert.match(sql, /continuum_external_identities_active_uq is unchanged/);
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
    assert.match(sql, /revoke all on function continuum_client_memory_create_person/i);
    assert.match(sql, /continuum_client_memory_apply_existing_person/);
    assert.equal((sql.match(/enable row level security/g) ?? []).length, 10);
  });
});
