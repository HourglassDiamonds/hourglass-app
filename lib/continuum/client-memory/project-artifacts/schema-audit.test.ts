import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

describe("Client Memory project-artifacts SQL", () => {
  const sql = readFileSync(
    resolve(
      process.cwd(),
      "lib/supabase/continuum-client-memory-project-artifacts.sql",
    ),
    "utf8",
  );

  it("is unapplied, additive, private, and retains rows", () => {
    assert.match(sql, /UNAPPLIED/);
    assert.match(sql, /DO NOT RUN AGAINST PRODUCTION/);
    assert.match(sql, /continuum_project_profiles remains the ONE current Project record/);
    assert.match(sql, /create table if not exists public\.continuum_project_artifacts/);
    assert.match(sql, /artifact_id uuid primary key/);
    assert.match(sql, /created_mutation_id uuid not null/);
    assert.match(sql, /continuum_project_artifacts_created_mutation_uq/);
    assert.match(sql, /continuum_project_artifacts_storage_path_uq/);
    assert.match(sql, /on delete restrict/);
    assert.match(sql, /enable row level security/);
    assert.match(sql, /Deletion is not available/);
    assert.match(sql, /public = false/);
    assert.match(sql, /continuum-project-artifacts/);
    assert.doesNotMatch(sql, /drop table/i);
    assert.doesNotMatch(sql, /create policy/i);
    assert.doesNotMatch(sql, /execute format/i);
    assert.doesNotMatch(sql, /getPublicUrl/);
    assert.doesNotMatch(sql, /continuum_gmail_messages/);
    assert.doesNotMatch(sql, /continuum_project_jobs/);
    assert.doesNotMatch(sql, /continuum_attention_items/);
    assert.doesNotMatch(sql, /continuum_project_lifecycle/);
    assert.doesNotMatch(sql, /shape-studio-captures/);
    assert.doesNotMatch(sql, /diamond-intelligence-submissions/);
  });

  it("locks bounded kinds, MIME types, and pointer-only provenance", () => {
    for (const kind of [
      "render",
      "cad",
      "inspiration",
      "finished_image",
      "production_image",
      "document",
      "other",
    ]) {
      assert.match(sql, new RegExp(`'${kind}'`));
    }
    for (const mime of [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/heic",
      "image/heif",
      "application/pdf",
    ]) {
      assert.match(sql, new RegExp(`'${mime}'`));
    }
    assert.match(sql, /source_ref text/);
    assert.match(sql, /Does not copy Gmail attachments/);
    assert.doesNotMatch(sql, /body text/i);
    assert.doesNotMatch(sql, /transcript/i);
    assert.doesNotMatch(sql, /bytea/);
  });

  it("is service-role only with no public grants and no deletion grant", () => {
    assert.match(sql, /revoke all on table public\.continuum_project_artifacts from public;/);
    assert.match(sql, /revoke all on table public\.continuum_project_artifacts from anon;/);
    assert.match(
      sql,
      /revoke all on table public\.continuum_project_artifacts from authenticated;/,
    );
    assert.match(
      sql,
      /grant select, insert on table public\.continuum_project_artifacts to service_role;/,
    );
    assert.doesNotMatch(sql, /grant .* to anon/i);
    assert.doesNotMatch(sql, /grant .* to authenticated/i);
    assert.doesNotMatch(sql, /grant .* to public/i);
    assert.doesNotMatch(sql, /grant update on table public\.continuum_project_artifacts/i);
    assert.doesNotMatch(sql, /grant delete on table public\.continuum_project_artifacts/i);
  });
});
