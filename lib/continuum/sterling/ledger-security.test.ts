import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const migration = readFileSync(
  new URL("../../../supabase/migrations/20261003010000_sterling_proposal_ledger.sql", import.meta.url),
  "utf8",
);
const loader = readFileSync(new URL("./ledger/load.ts", import.meta.url), "utf8");
const service = readFileSync(new URL("./ledger/service.ts", import.meta.url), "utf8");
const controls = readFileSync(
  new URL("../../../app/executive-dashboard/concierge/components/sterling-proposal-controls.tsx", import.meta.url),
  "utf8",
);

describe("Sterling ledger security and migration contract", () => {
  it("is additive, RLS-enabled, and service-role only", () => {
    assert.match(migration, /create table public\.continuum_sterling_proposals/);
    assert.match(migration, /enable row level security/);
    assert.match(migration, /revoke all on table public\.continuum_sterling_proposals from public, anon, authenticated/);
    assert.match(migration, /grant select, insert, update on table public\.continuum_sterling_proposals to service_role/);
    assert.doesNotMatch(migration, /grant\s+(?:all|insert|update|delete).*authenticated/i);
    assert.doesNotMatch(migration, /alter table public\.(?!continuum_sterling_proposals)/);
  });

  it("provides active, entity, and decision-history indexes", () => {
    assert.match(migration, /continuum_sterling_proposals_active_recent_idx/);
    assert.match(migration, /continuum_sterling_proposals_entity_idx/);
    assert.match(migration, /continuum_sterling_proposals_decisions_idx/);
  });

  it("authenticates before constructing the service-role repository", () => {
    assert.match(loader, /requireInternalClientMemorySession/);
    assert.match(loader, /probeSterlingLedger/);
    assert.match(loader, /createSupabaseSterlingProposalRepository/);
  });

  it("keeps canonical writes behind existing Job writer methods", () => {
    assert.match(service, /this\.deps\.jobs\.mutateJob/);
    assert.match(service, /this\.deps\.jobs\.createJob/);
    assert.doesNotMatch(service, /getSupabaseAdmin|\.from\(/);
  });

  it("keeps raw database access out of the client controls", () => {
    assert.match(controls, /^"use client";/);
    assert.doesNotMatch(controls, /supabase|getSupabaseAdmin|\.from\(/);
  });
});
