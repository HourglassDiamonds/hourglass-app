import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

describe("Gmail activation SQL", () => {
  const sql = readFileSync(
    resolve(process.cwd(), "lib/supabase/continuum-gmail-activation.sql"),
    "utf8",
  );
  const original = readFileSync(
    resolve(process.cwd(), "lib/supabase/continuum-client-memory-gmail-index.sql"),
    "utf8",
  );

  it("is unapplied, additive, and does not recreate the existing index", () => {
    assert.match(sql, /UNAPPLIED/);
    assert.match(sql, /DO NOT RUN AGAINST PRODUCTION/);
    assert.match(sql, /Do NOT recreate those tables/);
    assert.match(sql, /Do NOT reapply/);
    assert.doesNotMatch(
      sql,
      /create table if not exists public\.continuum_gmail_messages/,
    );
    assert.doesNotMatch(
      sql,
      /create table if not exists public\.continuum_gmail_checkpoints/,
    );
    assert.match(original, /create table if not exists public\.continuum_gmail_messages/);
    assert.match(
      sql,
      /add column if not exists bcc_email_hashes text\[\] not null default '\{\}'::text\[\]/,
    );
    assert.match(
      sql,
      /create table if not exists public\.continuum_gmail_connections/,
    );
    assert.match(
      sql,
      /create table if not exists public\.continuum_gmail_attachments/,
    );
    assert.match(sql, /status in \('connected', 'paused', 'disconnected', 'revoked'\)/);
    assert.match(sql, /token_enc_alg = 'aes-256-gcm'/);
    assert.match(sql, /mailbox_slot = 'founder-v1'/);
    assert.match(sql, /primary key \(message_id, attachment_id\)/);
  });

  it("is RLS service-role only with no anon/authenticated policies", () => {
    assert.equal((sql.match(/enable row level security/g) ?? []).length, 2);
    assert.doesNotMatch(sql, /create policy/i);
    assert.doesNotMatch(sql, /grant .* to anon/i);
    assert.doesNotMatch(sql, /grant .* to authenticated/i);
    assert.doesNotMatch(sql, /grant .* to public/i);
    assert.match(
      sql,
      /revoke all on table public\.continuum_gmail_connections from public;/,
    );
    assert.match(
      sql,
      /revoke all on table public\.continuum_gmail_connections from anon;/,
    );
    assert.match(
      sql,
      /revoke all on table public\.continuum_gmail_connections from authenticated;/,
    );
    assert.match(
      sql,
      /grant all on table public\.continuum_gmail_connections to service_role;/,
    );
    assert.match(
      sql,
      /revoke all on table public\.continuum_gmail_attachments from public;/,
    );
    assert.match(
      sql,
      /grant all on table public\.continuum_gmail_attachments to service_role;/,
    );
  });

  it("does not store bodies, snippets, or attachment bytes", () => {
    assert.doesNotMatch(sql, /body text/i);
    assert.doesNotMatch(sql, /snippet text/i);
    assert.doesNotMatch(sql, /raw_email/i);
    assert.doesNotMatch(sql, /bytea/);
    assert.doesNotMatch(sql, /refresh_token text/);
    assert.match(sql, /refresh_token_ciphertext text/);
    assert.doesNotMatch(sql, /create table if not exists public\.continuum_entities/);
    assert.doesNotMatch(sql, /continuum_open_jobs/);
    assert.doesNotMatch(sql, /continuum_attention_items/);
    assert.doesNotMatch(sql, /insert into public\.continuum_/);
  });
});
