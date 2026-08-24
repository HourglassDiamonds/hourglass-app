import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

describe("Client Memory set-current-fact SQL", () => {
  const sql = readFileSync(
    resolve(process.cwd(), "lib/supabase/continuum-client-memory-set-current-fact.sql"),
    "utf8",
  );

  it("is unapplied, transactional, and service-role only", () => {
    assert.match(sql, /UNAPPLIED/);
    assert.match(sql, /DO NOT RUN AGAINST PRODUCTION/);
    assert.match(
      sql,
      /create or replace function public\.continuum_client_memory_set_current_person_fact\(/,
    );
    assert.match(sql, /security definer/i);
    assert.match(sql, /set search_path = ''/);
    assert.match(sql, /for update/);
    assert.match(sql, /set status = 'superseded'/);
    assert.match(sql, /insert into public\.continuum_person_facts/);
    assert.match(sql, /status = 'current'/);
    assert.match(sql, /supersedes_id/);
    assert.match(sql, /kind = 'person'/);
    assert.match(sql, /public\.continuum_person_facts/);
    assert.match(sql, /public\.continuum_entities/);
    assert.doesNotMatch(sql, /continuum_source_notes/);
    assert.doesNotMatch(sql, /continuum_wishes/);
    assert.doesNotMatch(sql, /continuum_evidence/);
    assert.doesNotMatch(sql, /continuum_observations/);
    assert.doesNotMatch(sql, /continuum_events/);
    assert.doesNotMatch(sql, /continuum_relationships/);
    assert.doesNotMatch(sql, /create policy/i);
    assert.doesNotMatch(sql, /grant execute on function [^;]+ to anon/i);
    assert.doesNotMatch(sql, /grant execute on function [^;]+ to authenticated/i);
    assert.doesNotMatch(sql, /grant execute on function [^;]+ to public/i);
    assert.match(
      sql,
      /revoke all on function public\.continuum_client_memory_set_current_person_fact\([^)]+\) from public;/i,
    );
    assert.match(
      sql,
      /revoke all on function public\.continuum_client_memory_set_current_person_fact\([^)]+\) from anon;/i,
    );
    assert.match(
      sql,
      /revoke all on function public\.continuum_client_memory_set_current_person_fact\([^)]+\) from authenticated;/i,
    );
    assert.match(
      sql,
      /grant execute on function public\.continuum_client_memory_set_current_person_fact\([^)]+\) to service_role;/i,
    );
  });
});
