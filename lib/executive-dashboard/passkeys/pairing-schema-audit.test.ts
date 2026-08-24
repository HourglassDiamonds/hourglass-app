import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

describe("founder passkey pairing schema (unapplied)", () => {
  const sql = readFileSync(
    resolve(
      process.cwd(),
      "lib/supabase/continuum-founder-passkey-pairings-schema.sql",
    ),
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
  const passkeys = readFileSync(
    resolve(process.cwd(), "lib/supabase/continuum-founder-passkeys-schema.sql"),
    "utf8",
  );

  it("creates a protected pairing table that stores token hashes only", () => {
    assert.match(sql, /UNAPPLIED/);
    assert.match(
      sql,
      /create table if not exists public\.continuum_founder_passkey_pairings/,
    );
    assert.match(sql, /token_hash text not null/);
    assert.doesNotMatch(sql, /raw_token|plaintext_token|session_cookie/);
    assert.match(sql, /match_code text not null/);
    assert.match(
      sql,
      /status text not null check \(\s*status in \('pending', 'claimed', 'approved', 'completed', 'cancelled'\)/,
    );
    assert.match(
      sql,
      /create unique index if not exists continuum_founder_passkey_pairings_token_hash_uq/,
    );
    assert.match(sql, /8f3c1d2e-9a70-4b5e-8c11-00c0711aa001/);
    assert.doesNotMatch(sql, /create policy/i);
  });

  it("enables RLS and grants only service_role", () => {
    assert.match(
      sql,
      /alter table public\.continuum_founder_passkey_pairings enable row level security/,
    );
    assert.match(
      sql,
      /revoke all on table public\.continuum_founder_passkey_pairings from public;/i,
    );
    assert.match(
      sql,
      /revoke all on table public\.continuum_founder_passkey_pairings from anon;/i,
    );
    assert.match(
      sql,
      /revoke all on table public\.continuum_founder_passkey_pairings from authenticated;/i,
    );
    assert.match(
      sql,
      /grant all on table public\.continuum_founder_passkey_pairings to service_role;/i,
    );
    assert.doesNotMatch(sql, /grant .* to anon/i);
    assert.doesNotMatch(sql, /grant .* to authenticated/i);
    assert.doesNotMatch(sql, /grant .* to public/i);
  });

  it("uses atomic SECURITY DEFINER claim and transition with empty search_path", () => {
    assert.match(
      sql,
      /create or replace function public\.continuum_founder_passkey_pairing_claim/,
    );
    assert.match(
      sql,
      /create or replace function public\.continuum_founder_passkey_pairing_transition/,
    );
    assert.match(
      sql,
      /create or replace function public\.continuum_founder_passkey_pairing_cancel/,
    );
    assert.match(sql, /and p\.status = 'pending'/);
    assert.match(sql, /and p\.expires_at > now\(\)/);
    assert.match(sql, /set search_path = ''/);
    assert.match(sql, /security definer/);
    assert.match(sql, /grant execute on function public\.continuum_founder_passkey_pairing_claim\(text, text, text\) to service_role;/i);
    assert.match(
      sql,
      /create or replace function public\.continuum_founder_passkey_pairing_finalize/,
    );
    assert.match(sql, /insert into public\.continuum_founder_passkeys/);
    assert.match(sql, /for update/);
    assert.match(
      sql,
      /grant execute on function public\.continuum_founder_passkey_pairing_finalize\(uuid, text, text, text, text, bigint, jsonb, text, boolean, text, timestamptz\) to service_role;/i,
    );
    assert.match(
      sql,
      /revoke all on function public\.continuum_founder_passkey_pairing_finalize\(uuid, text, text, text, text, bigint, jsonb, text, boolean, text, timestamptz\) from public;/i,
    );
    assert.match(sql, /and p_from_status = 'claimed'/);
    assert.match(sql, /and p_to_status = 'approved'/);
  });

  it("is not mixed into Client Memory, kernel, or the applied passkeys schema file", () => {
    assert.doesNotMatch(clientMemory, /continuum_founder_passkey_pairings/);
    assert.doesNotMatch(kernel, /continuum_founder_passkey_pairings/);
    assert.doesNotMatch(passkeys, /continuum_founder_passkey_pairings/);
    assert.doesNotMatch(sql, /continuum_person_profiles|continuum_source_notes|note_text/);
    const createBody = sql.slice(sql.indexOf("create table"));
    assert.doesNotMatch(createBody, /biometric|face_id|template/i);
  });
});
