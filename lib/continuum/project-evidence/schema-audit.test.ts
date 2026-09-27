import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

describe("project evidence association schema", () => {
  const sql = readFileSync(
    resolve(process.cwd(), "lib/supabase/continuum-project-evidence-associations-schema.sql"),
    "utf8",
  );

  it("is unapplied, service-role only, and stores membership without message bodies", () => {
    assert.match(sql, /UNAPPLIED/);
    assert.match(sql, /DO NOT RUN AGAINST PRODUCTION/);
    assert.match(sql, /create table if not exists public\.continuum_project_evidence_associations/);
    assert.match(sql, /status in \('candidate', 'trusted', 'rejected', 'ambiguous'\)/);
    assert.match(sql, /project_id, source_type, source_identity/);
    assert.match(sql, /enable row level security/);
    assert.match(sql, /revoke all on table public\.continuum_project_evidence_associations from public;/);
    assert.match(sql, /revoke all on table public\.continuum_project_evidence_associations from anon;/);
    assert.match(sql, /revoke all on table public\.continuum_project_evidence_associations from authenticated;/);
    assert.match(
      sql,
      /grant select, insert, update on table public\.continuum_project_evidence_associations to service_role;/,
    );
    assert.doesNotMatch(sql, /create policy/i);
    assert.doesNotMatch(sql, /grant .* to anon/i);
    assert.doesNotMatch(sql, /grant .* to authenticated/i);
    assert.doesNotMatch(sql, /grant .* to public/i);
    assert.doesNotMatch(sql, /continuum_gmail_messages|continuum_gmail_connections|refresh_token/);
    assert.doesNotMatch(sql, /\bbody text\b|\bphone text\b|bytea/i);
    assert.doesNotMatch(sql, /disable row level security/i);
  });
});
