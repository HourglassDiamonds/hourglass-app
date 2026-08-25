import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SQL_PATH = resolve(
  process.cwd(),
  "lib/supabase/continuum-chief-of-staff-schema.sql",
);

describe("Chief of Staff Phase 1B schema SQL", () => {
  const sql = readFileSync(SQL_PATH, "utf8");

  it("is marked UNAPPLIED and creates only attention tables", () => {
    assert.match(sql, /UNAPPLIED/);
    assert.match(sql, /DO NOT RUN AGAINST PRODUCTION/);
    assert.match(sql, /create table if not exists public\.continuum_attention_items/);
    assert.match(sql, /create table if not exists public\.continuum_attention_briefs/);
    assert.doesNotMatch(sql, /continuum_founder_focus/);
    assert.doesNotMatch(sql, /continuum_commitments/);
    assert.doesNotMatch(sql, /continuum_gmail/);
    assert.doesNotMatch(sql, /google_calendar/);
  });

  it("stores opaque specialist ids as text and attention ids as uuid", () => {
    assert.match(sql, /observation_ids text\[] not null default '\{\}'/);
    assert.match(sql, /evidence_ids text\[] not null default '\{\}'/);
    assert.match(sql, /attention_item_ids uuid\[] not null default '\{\}'/);
    assert.doesNotMatch(sql, /observation_ids uuid\[\]/);
    assert.doesNotMatch(sql, /evidence_ids uuid\[\]/);
  });

  it("enforces one brief per local date and open-item dedupe", () => {
    assert.match(sql, /continuum_attention_briefs_local_date_uq/);
    assert.match(sql, /continuum_attention_items_open_dedupe_uq/);
    assert.match(sql, /person_id uuid references public\.continuum_entities/);
    assert.match(sql, /project_id uuid references public\.continuum_entities/);
    assert.match(sql, /worth_knowing jsonb/);
  });

  it("enables RLS with no public, anon, or authenticated policies", () => {
    assert.match(
      sql,
      /alter table public\.continuum_attention_items enable row level security/,
    );
    assert.match(
      sql,
      /alter table public\.continuum_attention_briefs enable row level security/,
    );
    assert.doesNotMatch(sql, /create policy/i);
    assert.doesNotMatch(sql, /grant [^\n]+ to anon/i);
    assert.doesNotMatch(sql, /grant [^\n]+ to authenticated/i);
    assert.match(
      sql,
      /revoke all on table public\.continuum_attention_items from public/,
    );
    assert.match(
      sql,
      /revoke all on table public\.continuum_attention_items from anon/,
    );
    assert.match(
      sql,
      /revoke all on table public\.continuum_attention_items from authenticated/,
    );
    assert.match(sql, /to service_role/);
    assert.doesNotMatch(sql, /security definer/i);
  });
});
