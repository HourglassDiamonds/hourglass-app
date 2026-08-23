import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

describe("Client Memory source-note context-layer migration", () => {
  const sql = readFileSync(
    resolve(
      process.cwd(),
      "lib/supabase/continuum-client-memory-source-note-context-layer.sql",
    ),
    "utf8",
  );
  const original = readFileSync(
    resolve(process.cwd(), "lib/supabase/continuum-client-memory-schema.sql"),
    "utf8",
  );

  it("classifies only continuum_source_notes and is marked unapplied", () => {
    assert.match(sql, /UNAPPLIED/);
    assert.match(sql, /continuum_source_notes/);
    assert.match(sql, /add column if not exists context_layer text/i);
    assert.match(
      sql,
      /set context_layer = 'client'\s+where context_layer is null/i,
    );
    assert.match(sql, /alter column context_layer set not null/i);
    assert.match(
      sql,
      /check \(\s*context_layer in \('client', 'networking', 'personal'\)\s*\)/i,
    );
    assert.doesNotMatch(sql, /default 'client'/i);
    assert.doesNotMatch(sql, /continuum_person_profiles/);
    assert.doesNotMatch(sql, /continuum_project_profiles/);
    assert.doesNotMatch(sql, /continuum_person_facts/);
    assert.doesNotMatch(sql, /continuum_wishes/);
    assert.doesNotMatch(sql, /continuum_events/);
    assert.doesNotMatch(sql, /continuum_evidence/);
    assert.doesNotMatch(sql, /continuum_observations/);
    assert.doesNotMatch(sql, /grant .* to anon/i);
    assert.doesNotMatch(sql, /grant .* to authenticated/i);
    assert.doesNotMatch(sql, /create policy/i);
    assert.doesNotMatch(sql, /disable row level security/i);
    assert.doesNotMatch(sql, /drop index/i);
    assert.match(sql, /Unique index continuum_source_notes_import_field_uq is unchanged/);
    assert.match(
      original,
      /create unique index if not exists continuum_source_notes_import_field_uq/,
    );
    assert.match(original, /alter table continuum_source_notes enable row level security/);
  });
});
