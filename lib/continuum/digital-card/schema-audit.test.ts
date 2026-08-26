import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

describe("digital-card SQL", () => {
  const sql = readFileSync(
    resolve(process.cwd(), "lib/supabase/continuum-digital-card-schema.sql"),
    "utf8",
  );

  it("is unapplied, RLS-only, and service-role only", () => {
    assert.match(sql, /UNAPPLIED/);
    assert.match(sql, /DO NOT RUN AGAINST PRODUCTION/);
    assert.match(sql, /create table if not exists public\.continuum_digital_cards/);
    assert.match(
      sql,
      /create table if not exists public\.continuum_digital_card_contexts/,
    );
    assert.match(
      sql,
      /create table if not exists public\.continuum_identity_exchanges/,
    );
    assert.equal((sql.match(/enable row level security/g) ?? []).length, 3);
    assert.doesNotMatch(sql, /create policy/i);
    assert.doesNotMatch(sql, /grant .* to anon/i);
    assert.doesNotMatch(sql, /grant .* to authenticated/i);
    assert.doesNotMatch(sql, /grant .* to public/i);
    assert.match(sql, /grant all on table public\.continuum_digital_cards to service_role;/);
    assert.match(
      sql,
      /grant all on table public\.continuum_identity_exchanges to service_role;/,
    );
  });

  it("uses a public slug and keeps identity exchanges off the kernel", () => {
    assert.match(sql, /slug text not null/);
    assert.match(sql, /event_type in \('identity_exchange', 'digital_card_exchange'\)/);
    assert.match(sql, /status in \('draft', 'active', 'ended'\)/);
    assert.doesNotMatch(sql, /create table if not exists public\.continuum_events/);
    assert.doesNotMatch(sql, /create table if not exists public\.continuum_person_facts/);
    assert.doesNotMatch(sql, /insert into public\.continuum_/);
    assert.match(sql, /Never copy submitted contact snapshots into the PII-free kernel/);
  });
});

describe("client-memory identity uniqueness used by digital-card create", () => {
  it("keeps active email/phone hashes unique so concurrent creates cannot insert two People", () => {
    const sql = readFileSync(
      resolve(process.cwd(), "lib/supabase/continuum-schema.sql"),
      "utf8",
    );
    assert.match(
      sql,
      /create unique index if not exists continuum_external_identities_active_uq/,
    );
    assert.match(
      sql,
      /on continuum_external_identities \(source_system, identity_kind, identifier\)/,
    );
    assert.match(sql, /where revoked_at is null/);
  });
});
