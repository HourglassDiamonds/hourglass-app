import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

describe("Gmail copy-in SQL", () => {
  const sql = readFileSync(
    resolve(
      process.cwd(),
      "lib/supabase/continuum-client-memory-project-artifact-gmail-copy.sql",
    ),
    "utf8",
  );

  it("is unapplied, additive, and identity-based", () => {
    assert.match(sql, /UNAPPLIED/);
    assert.match(sql, /DO NOT RUN AGAINST PRODUCTION/);
    assert.match(sql, /already-live #14/);
    assert.match(sql, /continuum_project_artifacts_gmail_copy_identity_uq/);
    assert.match(sql, /split_part\(source_ref, '\|', 2\)/);
    assert.match(sql, /split_part\(source_ref, '\|', 3\)/);
    assert.match(sql, /source_system = 'gmail'/);
    assert.match(sql, /gm1/);
    assert.match(sql, /drop constraint if exists continuum_project_artifacts_source_ref_check/);
    assert.match(sql, /when source_system = 'gmail' then 2048/);
    assert.match(sql, /else 240/);
    assert.match(sql, /source_ref !~ E'/);
    assert.doesNotMatch(sql, /drop table/i);
    assert.doesNotMatch(sql, /create policy/i);
    assert.doesNotMatch(sql, /create table/i);
    assert.doesNotMatch(sql, /enable row level security/i);
    assert.doesNotMatch(sql, /grant /i);
    assert.doesNotMatch(sql, /revoke /i);
    assert.doesNotMatch(sql, /storage\.buckets/i);
    assert.doesNotMatch(sql, /body text/i);
    assert.doesNotMatch(sql, /unique \(original_filename\)/i);
  });
});
