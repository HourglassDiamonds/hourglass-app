import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

describe("founder passkeys schema (unapplied)", () => {
  const sql = readFileSync(
    resolve(process.cwd(), "lib/supabase/continuum-founder-passkeys-schema.sql"),
    "utf8",
  );
  const clientMemory = readFileSync(
    resolve(process.cwd(), "lib/supabase/continuum-client-memory-schema.sql"),
    "utf8",
  );
  const kernel = readFileSync(
    resolve(process.cwd(), "lib/supabase/continuum-schema.sql"),
    "utf8",
  );

  it("creates a dedicated founder passkey table with unique credential IDs", () => {
    assert.match(sql, /create table if not exists continuum_founder_passkeys/);
    assert.match(sql, /credential_id text not null/);
    assert.match(sql, /public_key text not null/);
    assert.match(sql, /counter bigint not null/);
    assert.match(sql, /founder_user_id text not null/);
    assert.match(sql, /revoked_at timestamptz/);
    assert.match(
      sql,
      /create unique index if not exists continuum_founder_passkeys_credential_id_uq/,
    );
    assert.match(sql, /8f3c1d2e-9a70-4b5e-8c11-00c0711aa001/);
    assert.doesNotMatch(sql, /create policy/i);
    assert.match(sql, /UNAPPLIED/);
  });

  it("enables RLS and grants only service_role", () => {
    assert.match(sql, /alter table continuum_founder_passkeys enable row level security/);
    assert.match(sql, /revoke all on table continuum_founder_passkeys from public;/i);
    assert.match(sql, /revoke all on table continuum_founder_passkeys from anon;/i);
    assert.match(
      sql,
      /revoke all on table continuum_founder_passkeys from authenticated;/i,
    );
    assert.match(sql, /grant all on table continuum_founder_passkeys to service_role;/i);
    assert.doesNotMatch(sql, /grant .* to anon/i);
    assert.doesNotMatch(sql, /grant .* to authenticated/i);
    assert.doesNotMatch(sql, /grant .* to public/i);
  });

  it("is not mixed into Client Memory or kernel schema", () => {
    assert.doesNotMatch(clientMemory, /continuum_founder_passkeys/);
    assert.doesNotMatch(kernel, /continuum_founder_passkeys/);
    assert.doesNotMatch(sql, /continuum_person_profiles|continuum_source_notes|note_text/);
    const createBody = sql.slice(sql.indexOf("create table"), sql.indexOf(");"));
    assert.doesNotMatch(createBody, /biometric|face_id|template/i);
  });
});
