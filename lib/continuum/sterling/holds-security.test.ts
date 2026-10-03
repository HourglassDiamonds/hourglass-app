import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
const migration = readFileSync(new URL("../../../supabase/migrations/20261003020000_conditional_holds.sql", import.meta.url), "utf8");
describe("conditional hold migration", () => {
  it("is explicitly additive and unapplied", () => assert.match(migration, /ADDITIVE \/ UNAPPLIED/));
  it("keeps the table service-role only", () => { assert.match(migration, /enable row level security/); assert.match(migration, /revoke all .* from public, anon, authenticated/); assert.match(migration, /grant select, insert, update .* to service_role/); });
  it("enforces one live hold per canonical job", () => assert.match(migration, /one_live_entity_idx[\s\S]*status in \('active','condition_met'\)/));
});
