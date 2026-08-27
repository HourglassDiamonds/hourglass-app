import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

describe("Client Memory source-note lifecycle SQL", () => {
  const sql = readFileSync(
    resolve(
      process.cwd(),
      "lib/supabase/continuum-client-memory-source-note-lifecycle.sql",
    ),
    "utf8",
  );
  const original = readFileSync(
    resolve(process.cwd(), "lib/supabase/continuum-client-memory-schema.sql"),
    "utf8",
  );

  it("is unapplied, additive, and does not free import identity", () => {
    assert.match(sql, /UNAPPLIED/);
    assert.match(sql, /DO NOT RUN AGAINST PRODUCTION/);
    assert.match(sql, /add column if not exists lifecycle_status text/i);
    assert.match(sql, /add column if not exists updated_at timestamptz/i);
    assert.match(sql, /add column if not exists updated_by text/i);
    assert.match(sql, /add column if not exists deleted_at timestamptz/i);
    assert.match(sql, /add column if not exists previous_lifecycle text/i);
    assert.match(
      sql,
      /when source_system = 'concierge-manual' then 'kept'/i,
    );
    assert.match(sql, /else 'absorbed'/i);
    assert.match(sql, /create table if not exists public\.continuum_source_note_revisions/);
    assert.match(sql, /change_kind in \('edit', 'move', 'trash', 'restore', 'absorb', 'keep'\)/);
    assert.match(sql, /continuum_source_note_revisions_mutation_uq/);
    assert.match(sql, /enable row level security/);
    assert.match(sql, /Unique index continuum_source_notes_import_field_uq is unchanged/);
    assert.match(
      original,
      /create unique index if not exists continuum_source_notes_import_field_uq/,
    );
    assert.doesNotMatch(sql, /drop index/i);
    assert.doesNotMatch(sql, /delete from public\.continuum_source_notes/i);
    assert.doesNotMatch(sql, /create policy/i);
    assert.doesNotMatch(sql, /grant .* to anon/i);
    assert.doesNotMatch(sql, /grant .* to authenticated/i);
    assert.doesNotMatch(sql, /continuum_human_sources/);
    assert.doesNotMatch(sql, /continuum_gmail_messages/);
    assert.doesNotMatch(sql, /continuum_attention_items/);
    assert.doesNotMatch(sql, /continuum_identity_exchanges/);
    assert.doesNotMatch(sql, /continuum_project_history/);
  });
});

describe("Client Memory mutate-source-note SQL", () => {
  const sql = readFileSync(
    resolve(
      process.cwd(),
      "lib/supabase/continuum-client-memory-mutate-source-note.sql",
    ),
    "utf8",
  );

  it("is unapplied, transactional, and service-role only", () => {
    assert.match(sql, /UNAPPLIED/);
    assert.match(sql, /DO NOT RUN AGAINST PRODUCTION/);
    assert.match(
      sql,
      /create or replace function public\.continuum_client_memory_mutate_source_note\(/,
    );
    assert.match(sql, /security definer/i);
    assert.match(sql, /set search_path = ''/);
    assert.match(sql, /for update/);
    assert.match(sql, /insert into public\.continuum_source_note_revisions/);
    assert.match(sql, /update public\.continuum_source_notes/);
    assert.match(sql, /raise exception 'entity-kind-mismatch'/);
    assert.match(sql, /raise exception 'cross-person-unconfirmed'/);
    assert.match(sql, /raise exception 'project-not-linked'/);
    assert.match(sql, /Does not create a corrected copy/);
    assert.doesNotMatch(sql, /insert into public\.continuum_source_notes/);
    assert.doesNotMatch(sql, /delete from public\.continuum_source_notes/i);
    assert.doesNotMatch(sql, /continuum_events/);
    assert.doesNotMatch(sql, /continuum_evidence/);
    assert.doesNotMatch(sql, /continuum_observations/);
    assert.doesNotMatch(sql, /continuum_human_sources/);
    assert.doesNotMatch(sql, /create policy/i);
    assert.doesNotMatch(sql, /grant execute on function [^;]+ to anon/i);
    assert.doesNotMatch(sql, /grant execute on function [^;]+ to authenticated/i);
    assert.doesNotMatch(sql, /grant execute on function [^;]+ to public/i);
    const signature =
      "public.continuum_client_memory_mutate_source_note\\(uuid, uuid, text, timestamptz, text, uuid, text, uuid, uuid, text, boolean\\)";
    assert.match(sql, new RegExp(`revoke all on function ${signature} from public;`, "i"));
    assert.match(sql, new RegExp(`revoke all on function ${signature} from anon;`, "i"));
    assert.match(
      sql,
      new RegExp(`revoke all on function ${signature} from authenticated;`, "i"),
    );
    assert.match(
      sql,
      new RegExp(`grant execute on function ${signature} to service_role;`, "i"),
    );
  });
});
