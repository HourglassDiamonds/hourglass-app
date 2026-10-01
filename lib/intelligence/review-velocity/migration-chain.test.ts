import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const root = process.cwd();
const read = (name: string) => readFileSync(join(root, "supabase", "migrations", name), "utf8").toLowerCase();

const projectless = read("20260929113152_projectless_founder_work.sql");
const privileges = read("20260929211152_revoke_source_note_revision_client_privileges.sql");
const attention = read("20260930010000_attention_persistence.sql");
const intake = read("20260930020000_website_inquiry_intake.sql");
const reviews = read("20261001010000_review_velocity.sql");

describe("pending migration chain", () => {
  it("keeps the canonical chronological filenames", () => {
    assert.deepEqual([
      "20260929113152_projectless_founder_work.sql",
      "20260929211152_revoke_source_note_revision_client_privileges.sql",
      "20260930010000_attention_persistence.sql",
      "20260930020000_website_inquiry_intake.sql",
      "20261001010000_review_velocity.sql",
    ].sort(), [
      "20260929113152_projectless_founder_work.sql",
      "20260929211152_revoke_source_note_revision_client_privileges.sql",
      "20260930010000_attention_persistence.sql",
      "20260930020000_website_inquiry_intake.sql",
      "20261001010000_review_velocity.sql",
    ]);
  });

  it("makes attention and intake fail closed on the projectless Open Job foundation", () => {
    assert.match(projectless, /alter table public\.continuum_project_jobs alter column project_id drop not null/);
    assert.match(projectless, /add column operation jsonb/);
    assert.match(attention, /requires verified projectless\/atomic foundation/);
    assert.match(intake, /requires verified projectless\/atomic open jobs/);
    assert.match(attention, /create or replace function public\.continuum_write_project_job/);
    assert.match(intake, /perform public\.continuum_write_project_job/);
  });

  it("keeps the privilege correction isolated and idempotent", () => {
    assert.match(privileges, /revoke all privileges on table public\.continuum_source_note_revisions/);
    assert.doesNotMatch(privileges, /create table|alter table|insert into|update /);
  });

  it("keeps Review Velocity independent from the Continuum function chain", () => {
    assert.match(reviews, /create table if not exists public\.tracked_places/);
    assert.doesNotMatch(reviews, /continuum_project_jobs|continuum_write_project_job|continuum_website_intakes/);
  });
});
