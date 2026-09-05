import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

describe("abuse rate limit schema (unapplied)", () => {
  const sql = readFileSync(
    resolve(process.cwd(), "lib/supabase/abuse-rate-limit-schema.sql"),
    "utf8",
  );

  it("is additive, unapplied, and service-role only", () => {
    assert.match(sql, /UNAPPLIED/);
    assert.match(sql, /create table if not exists public\.abuse_rate_limits/);
    assert.match(sql, /bucket_key text not null/);
    assert.match(sql, /window_start_epoch_ms bigint not null/);
    assert.match(sql, /primary key \(bucket_key\)/);
    assert.doesNotMatch(sql, /primary key \(bucket_key, window_start_epoch_ms\)/);
    assert.doesNotMatch(sql, /drop table/i);
    assert.doesNotMatch(sql, /create policy/i);
    assert.match(
      sql,
      /alter table public\.abuse_rate_limits enable row level security/,
    );
    assert.match(
      sql,
      /revoke all on table public\.abuse_rate_limits from public;/i,
    );
    assert.match(
      sql,
      /revoke all on table public\.abuse_rate_limits from anon;/i,
    );
    assert.match(
      sql,
      /revoke all on table public\.abuse_rate_limits from authenticated;/i,
    );
    assert.match(
      sql,
      /grant all on table public\.abuse_rate_limits to service_role;/,
    );
  });

  it("creates an atomic consume RPC granted only to service_role", () => {
    assert.match(
      sql,
      /create or replace function public\.consume_abuse_rate_limit/,
    );
    assert.match(sql, /on conflict \(bucket_key\)/);
    assert.match(
      sql,
      /when t\.window_start_epoch_ms = excluded\.window_start_epoch_ms/,
    );
    assert.match(sql, /security definer/);
    assert.match(sql, /set search_path = ''/);
    assert.match(
      sql,
      /revoke all on function public\.consume_abuse_rate_limit\(text, bigint, integer, integer, bigint\) from public;/i,
    );
    assert.match(
      sql,
      /revoke all on function public\.consume_abuse_rate_limit\(text, bigint, integer, integer, bigint\) from anon;/i,
    );
    assert.match(
      sql,
      /revoke all on function public\.consume_abuse_rate_limit\(text, bigint, integer, integer, bigint\) from authenticated;/i,
    );
    assert.match(
      sql,
      /grant execute on function public\.consume_abuse_rate_limit\(text, bigint, integer, integer, bigint\) to service_role;/i,
    );
  });

  it("bounds retention by reusing a stable key and indexed expired-row cleanup", () => {
    assert.match(sql, /abuse_rate_limits_expires_at_idx/);
    assert.match(sql, /for update skip locked/i);
    assert.match(sql, /limit 32/);
    assert.match(sql, /s\.expires_at < to_timestamp/);
  });

  it("does not store raw IPs or session secrets", () => {
    assert.doesNotMatch(sql, /client_ip|raw_ip|x-forwarded-for/i);
    assert.match(sql, /length\(p_bucket_key\) <> 64/);
    assert.match(sql, /p_bucket_key !~ '\^\[0-9a-f\]\+\$'/);
  });
});
