import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

describe("founder sessions schema (Preview-applied)", () => {
  const sql = readFileSync(
    resolve(process.cwd(), "lib/supabase/continuum-founder-sessions-schema.sql"),
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

  it("creates a narrowly scoped session table with opaque ids", () => {
    assert.match(sql, /Applied to Continuum Preview/);
    assert.match(sql, /Production application remains separately founder-approved/);
    assert.doesNotMatch(sql, /UNAPPLIED/);
    assert.match(
      sql,
      /create table if not exists public\.continuum_founder_sessions/,
    );
    assert.match(sql, /session_id text primary key/);
    assert.match(sql, /founder_user_id text not null/);
    assert.match(sql, /issued_at timestamptz not null/);
    assert.match(sql, /expires_at timestamptz not null/);
    assert.match(sql, /revoked_at timestamptz/);
    assert.match(sql, /8f3c1d2e-9a70-4b5e-8c11-00c0711aa001/);
    assert.match(
      sql,
      /create index if not exists continuum_founder_sessions_expires_idx/,
    );
    assert.doesNotMatch(sql, /create policy/i);
    assert.doesNotMatch(sql, /tenant_id/);
    const createBody = sql.slice(
      sql.indexOf("create table if not exists public.continuum_founder_sessions"),
      sql.indexOf("grant all on table public.continuum_founder_sessions"),
    );
    assert.doesNotMatch(createBody, /password|passkey|oauth|gmail|refresh_token/i);
    assert.doesNotMatch(createBody, /\bip\b|user_agent|header/i);
  });

  it("enables RLS and grants only service_role", () => {
    assert.match(
      sql,
      /alter table public\.continuum_founder_sessions enable row level security/,
    );
    assert.match(
      sql,
      /revoke all on table public\.continuum_founder_sessions from public;/,
    );
    assert.match(
      sql,
      /revoke all on table public\.continuum_founder_sessions from anon;/,
    );
    assert.match(
      sql,
      /revoke all on table public\.continuum_founder_sessions from authenticated;/,
    );
    assert.match(
      sql,
      /grant all on table public\.continuum_founder_sessions to service_role;/,
    );
    assert.doesNotMatch(sql, /^\s*grant\b[^;]*\bto\s+anon\b/im);
    assert.doesNotMatch(sql, /^\s*grant\b[^;]*\bto\s+authenticated\b/im);
  });

  it("is not mixed into Client Memory, kernel, or passkey schema", () => {
    assert.doesNotMatch(clientMemory, /continuum_founder_sessions/);
    assert.doesNotMatch(kernel, /continuum_founder_sessions/);
    assert.doesNotMatch(passkeys, /continuum_founder_sessions/);
  });
});
