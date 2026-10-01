import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20261001010000_review_velocity.sql"),
  "utf8",
).toLowerCase();

describe("review velocity schema", () => {
  it("prevents duplicate place/date/source snapshots", () => {
    assert.match(migration, /unique\s*\(place_id, captured_on, source\)/);
  });

  it("keeps all three tables service-role only", () => {
    for (const table of ["tracked_places", "review_count_snapshots", "own_google_reviews"]) {
      assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`));
      assert.match(migration, new RegExp(`revoke all on table public\\.${table} from public, anon, authenticated`));
      assert.match(migration, new RegExp(`grant select, insert, update, delete on table public\\.${table} to service_role`));
    }
    assert.doesNotMatch(migration, /create policy/);
    assert.doesNotMatch(migration, /grant .* to anon|grant .* to authenticated/);
  });

  it("enforces that exact review rows belong to the tracked self place", () => {
    assert.match(migration, /own_google_reviews_self_place_guard/);
    assert.match(migration, /where id = new\.place_id\s+and role = 'self'\s+and display_name = 'hourglass diamonds'/);
    assert.match(migration, /tracked_places_single_self_idx/);
    assert.match(migration, /own_google_reviews_reply_shape_check/);
  });

  it("seeds names without inventing Google Place IDs", () => {
    assert.match(migration, /'hourglass diamonds'/);
    assert.match(migration, /'diamonds direct charlotte'/);
    const seedBlock = migration.slice(migration.indexOf("insert into public.tracked_places"));
    assert.doesNotMatch(seedBlock, /chij/i);
    assert.doesNotMatch(seedBlock, /google_place_id\)/);
    const seededNames = [...seedBlock.matchAll(/\('(self|competitor)',\s*'([^']+)'\)/g)];
    assert.equal(seededNames.length, 5);
  });

  it("restricts the tracker to the five canonical business names", () => {
    assert.match(migration, /tracked_places_canonical_business_check/);
    for (const name of [
      "hourglass diamonds",
      "donald haack diamonds",
      "malak jewelers",
      "ballantyne jewelers",
      "diamonds direct charlotte",
    ]) {
      assert.match(migration, new RegExp(name));
    }
  });

  it("does not expose a public RPC or browser policy", () => {
    assert.doesNotMatch(migration, /grant execute .* to (public|anon|authenticated)/);
    assert.doesNotMatch(migration, /create policy/);
  });
});
