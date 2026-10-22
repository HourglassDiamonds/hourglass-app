import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const MIGRATION = "supabase/migrations/20261022111113_continuum_sterling_today_thread_verification_continuity.sql";
const sql = readFileSync(MIGRATION, "utf8");
const executableSql = sql
  .split(/\r?\n/)
  .filter((line) => !line.trimStart().startsWith("--"))
  .join("\n");

describe("Sterling verification continuity schema", () => {
  it("creates one additive metadata-only table with deterministic expiry", () => {
    assert.match(sql, /^-- Metadata-only continuity/m);
    assert.match(sql, /begin;[\s\S]*commit;/);
    assert.match(sql, /create table public\.continuum_sterling_today_thread_verifications/);
    assert.match(sql, /thread_key_digest text primary key/);
    assert.match(sql, /verification_status = 'complete_live'/);
    assert.match(sql, /expires_at = verified_at \+ interval '15 minutes'/);
    assert.doesNotMatch(sql, /alter table public\.(?!continuum_sterling_today_thread_verifications)/);
    assert.doesNotMatch(executableSql, /\b(drop|truncate|delete)\b/i);
  });

  it("allows only narrow service-role table and RPC access", () => {
    assert.match(sql, /enable row level security/);
    assert.match(sql, /revoke all on table[\s\S]*from public, anon, authenticated, service_role/);
    assert.match(sql, /grant select, insert, update on table[\s\S]*to service_role/);
    assert.doesNotMatch(sql, /grant[^;]*(delete|truncate|references|trigger)/i);
    assert.match(sql, /security invoker/g);
    assert.match(sql, /set search_path = ''/g);
    assert.match(sql, /revoke all on function[\s\S]*from public, anon, authenticated, service_role/g);
    assert.match(sql, /grant execute on function[\s\S]*to service_role/g);
    assert.doesNotMatch(sql, /alter default privileges/i);
    assert.doesNotMatch(sql, /create policy/i);
  });

  it("stores no raw Gmail, identity, evidence, or model material", () => {
    for (const forbidden of ["thread_id", "message_id", "subject", "sender", "recipient", "body", "snippet",
      "attachment", "evidence_excerpt", "prompt", "model_response", "person_id", "project_id", "client_id"]) {
      assert.doesNotMatch(sql, new RegExp(`\\b${forbidden}\\b`, "i"));
    }
    assert.match(sql, /thread_key_digest ~ '\^\[a-f0-9\]\{64\}\$'/);
  });

  it("uses an atomic revision-safe compare-and-swap write", () => {
    assert.match(sql, /for update/);
    assert.match(sql, /p_expected_revision/);
    assert.match(sql, /existing\.revision <> p_expected_revision/);
    assert.match(sql, /revision = existing\.revision \+ 1/);
    assert.match(sql, /and revision = existing\.revision/);
    assert.match(sql, /on conflict \(thread_key_digest\) do nothing/);
  });
});
