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
    assert.match(sql, /continuum_project_artifacts_gmail_copy_identity_uq/);
    assert.match(sql, /split_part\(source_ref, '\|', 2\)/);
    assert.match(sql, /split_part\(source_ref, '\|', 3\)/);
    assert.match(sql, /source_system = 'gmail'/);
    assert.match(sql, /gm1/);
    assert.doesNotMatch(sql, /drop table/i);
    assert.doesNotMatch(sql, /create policy/i);
    assert.doesNotMatch(sql, /create table/i);
    assert.doesNotMatch(sql, /body text/i);
    assert.doesNotMatch(sql, /unique \(original_filename\)/i);
  });
});
