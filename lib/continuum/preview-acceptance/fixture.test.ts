import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertPreviewFixtureTarget, buildPreviewAcceptanceFixture, PREVIEW_REF, PRODUCTION_REF } from "../../../scripts/continuum-preview-acceptance";

const safe = {
  CONTINUUM_ENV: "preview",
  CONTINUUM_PREVIEW_SUPABASE_PROJECT_REF: PREVIEW_REF,
  CONTINUUM_PRODUCTION_SUPABASE_PROJECT_REF: PRODUCTION_REF,
  SUPABASE_URL: `https://${PREVIEW_REF}.supabase.co`,
  SUPABASE_SERVICE_ROLE_KEY: "sb_secret_test-only",
};

describe("Continuum Preview acceptance fixture", () => {
  it("hard-fails every Production or ambiguous target", () => {
    assert.doesNotThrow(() => assertPreviewFixtureTarget(safe));
    assert.throws(() => assertPreviewFixtureTarget({ ...safe, CONTINUUM_ENV: "production" }), /refused/);
    assert.throws(() => assertPreviewFixtureTarget({ ...safe, SUPABASE_URL: `https://${PRODUCTION_REF}.supabase.co` }), /Production target/);
    assert.throws(() => assertPreviewFixtureTarget({ ...safe, CONTINUUM_PREVIEW_SUPABASE_PROJECT_REF: PRODUCTION_REF }), /unexpected Preview/);
    assert.throws(() => assertPreviewFixtureTarget({ ...safe, SUPABASE_SERVICE_ROLE_KEY: "sb_publishable_nope" }), /privileged/);
  });

  it("contains deterministic synthetic coverage without archive fields", () => {
    const fixture = buildPreviewAcceptanceFixture();
    assert.equal(fixture.jobs.length, 9);
    assert.equal(fixture.proposals.length, 5);
    assert.deepEqual(fixture.holds.map((row) => row.status), ["active", "condition_met"]);
    assert.deepEqual(fixture.quotes.map((row) => row.state), ["draft", "issued", "voided"]);
    assert.ok(fixture.jobs.some((row) => row.project_id === null));
    assert.ok(fixture.jobs.filter((row) => row.attention_mode === "action" && row.state === "open").length >= 3);
    assert.doesNotMatch(JSON.stringify(fixture), /archived_at|archived_by|@|gmail\.com/i);
    assert.ok(fixture.people.every((row) => row.display_name.startsWith("Preview ")));
  });
});
