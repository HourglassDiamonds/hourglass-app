import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const migrationUrl = new URL(
  "../supabase/migrations/20260929211152_revoke_source_note_revision_client_privileges.sql",
  import.meta.url,
);

test("Source Note revision migration only removes browser-role table privileges", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  const executableSql = sql.replace(/--.*$/gm, "");

  assert.match(sql, /^\s*--[\s\S]*?\bbegin;/i);
  assert.match(
    sql,
    /revoke all privileges on table public\.continuum_source_note_revisions\s+from anon, authenticated;/i,
  );
  assert.match(sql, /commit;\s*$/i);

  assert.equal((executableSql.match(/\brevoke\b/gi) ?? []).length, 1);
  assert.doesNotMatch(executableSql, /\bgrant\b/i);
  assert.doesNotMatch(executableSql, /\b(?:create|alter|drop)\b/i);
  assert.doesNotMatch(executableSql, /\bpolicy\b/i);
  assert.doesNotMatch(executableSql, /\bfunction\b/i);
  assert.doesNotMatch(executableSql, /continuum_project_job/i);
  assert.doesNotMatch(executableSql, /\b(?:postgres|service_role)\b/i);
});
