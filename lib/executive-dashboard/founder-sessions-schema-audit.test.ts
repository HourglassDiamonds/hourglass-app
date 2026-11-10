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
  const historicalMigration = readFileSync(
    resolve(
      process.cwd(),
      "supabase/migrations/20260916094016_add_continuum_founder_sessions.sql",
    ),
    "utf8",
  );
  const aclMigration = readFileSync(
    resolve(
      process.cwd(),
      "supabase/migrations/20261110203600_continuum_founder_sessions_acl_hardening.sql",
    ),
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

  it("preserves the recorded base while the additive migration enforces least privilege", () => {
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
    assert.match(
      historicalMigration,
      /grant all on table public\.continuum_founder_sessions to service_role;/,
    );
    assert.match(
      aclMigration,
      /revoke all on table public\.continuum_founder_sessions from service_role;/,
    );
    assert.match(
      aclMigration,
      /grant select, insert, update, delete\s+on table public\.continuum_founder_sessions\s+to service_role;/,
    );
    assert.match(
      aclMigration,
      /DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN/,
    );
    assert.doesNotMatch(
      aclMigration,
      /grant\s+(all|truncate|references|trigger|maintain)[\s\S]*service_role/i,
    );
    assert.doesNotMatch(sql, /^\s*grant\b[^;]*\bto\s+anon\b/im);
    assert.doesNotMatch(sql, /^\s*grant\b[^;]*\bto\s+authenticated\b/im);
    assert.doesNotMatch(aclMigration, /^\s*grant\b[^;]*\bto\s+(anon|authenticated|public)\b/im);
  });

  it("grants exactly the operations exercised by the durable store", () => {
    const store = readFileSync(
      resolve(process.cwd(), "lib/executive-dashboard/founder-sessions.ts"),
      "utf8",
    );
    assert.match(store, /\.insert\(/);
    assert.match(store, /\.select\(/);
    assert.match(store, /\.update\(/);
    assert.match(store, /\.delete\(/);
    for (const privilege of ["select", "insert", "update", "delete"]) {
      assert.match(aclMigration, new RegExp(`grant[\\s\\S]*\\b${privilege}\\b`, "i"));
    }
  });

  it("is not mixed into Client Memory, kernel, or passkey schema", () => {
    assert.doesNotMatch(clientMemory, /continuum_founder_sessions/);
    assert.doesNotMatch(kernel, /continuum_founder_sessions/);
    assert.doesNotMatch(passkeys, /continuum_founder_sessions/);
  });
});
