import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("project evidence migration preflight", () => {
  const associations = read("lib/supabase/continuum-project-evidence-associations-schema.sql");
  const functions = read("lib/supabase/continuum-gmail-attachment-project-numbers.sql");
  const index = read("lib/supabase/continuum-gmail-attachment-project-numbers-index.sql");

  it("keeps membership service-role only with one trusted project per provider thread", () => {
    assert.match(associations, /enable row level security/);
    assert.match(associations, /revoke all on table .* from public/);
    assert.match(associations, /revoke all on table .* from anon/);
    assert.match(associations, /revoke all on table .* from authenticated/);
    assert.match(associations, /grant select, insert, update .* to service_role/);
    assert.match(associations, /unique index if not exists continuum_project_evidence_associations_trusted_source_uq/);
    assert.match(associations, /where status = 'trusted'/);
    assert.doesNotMatch(associations, /grant delete|create policy/i);
  });

  it("explicitly defeats default PUBLIC and browser-role function execution", () => {
    assert.equal((functions.match(/security invoker/g) ?? []).length, 2);
    for (const role of ["public", "anon", "authenticated"]) {
      assert.equal((functions.match(new RegExp(`revoke all on function [\\s\\S]*? from ${role};`, "g")) ?? []).length >= 1, true);
    }
    assert.equal((functions.match(/grant execute on function [\s\S]*? to service_role;/g) ?? []).length, 2);
    assert.doesNotMatch(functions, /security definer/i);
  });

  it("keeps the optional attachment index isolated and concurrent", () => {
    const statements = index.split("\n").filter((line) => !line.trim().startsWith("--")).join("\n");
    assert.match(statements, /create index concurrently continuum_gmail_attachments_project_numbers_idx/);
    assert.doesNotMatch(statements, /if not exists/i);
    assert.doesNotMatch(statements, /\bbegin\b|\bcommit\b/i);
    assert.doesNotMatch(functions + associations, /alter table public\.continuum_gmail_(messages|attachments)/i);
  });
});
