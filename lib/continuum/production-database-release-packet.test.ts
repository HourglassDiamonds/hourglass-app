import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const root = process.cwd();
const read = (path: string) =>
  readFileSync(resolve(root, path), "utf8").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
const sha256 = (value: string) =>
  createHash("sha256").update(value, "utf8").digest("hex");

function sqlWithoutComments(value: string): string {
  return value
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n")
    .replace(/\s+/g, " ")
    .trim();
}

function stripEnvelope(value: string): string {
  const lines = value.trimEnd().split("\n");
  const begin = lines.flatMap((line, index) => (line === "begin;" ? [index] : []));
  const commit = lines.flatMap((line, index) => (line === "commit;" ? [index] : []));
  assert.deepEqual(begin.length, 1);
  assert.deepEqual(commit, [lines.length - 1]);
  lines.splice(commit[0]!, 1);
  lines.splice(begin[0]!, 1);
  return lines.join("\n").trimEnd();
}

describe("Production database release packet", () => {
  const associationSource = read(
    "lib/supabase/continuum-project-evidence-associations-schema.sql",
  );
  const associationMigration = read(
    "supabase/migrations/20261106151236_continuum_project_evidence_associations_schema.sql",
  );
  const conciergeBasePath =
    "supabase/migrations/20261104201449_continuum_concierge_funnel_persistence.sql";
  const conciergeAclPath =
    "supabase/migrations/20261110194159_continuum_concierge_ack_outbox_acl.sql";
  const conciergeBase = read(conciergeBasePath);
  const conciergeAcl = read(conciergeAclPath);
  const conciergeArtifact = read(
    "supabase/release/20261110_continuum_concierge_fresh_install.sql",
  );

  it("tracks the exact association statements and preserves the existing table", () => {
    assert.equal(
      sha256(associationMigration),
      "a1f6e9380a6f0305f2337940a181cbe57907d6570f27f22e55349398d8beedaa",
    );
    assert.equal(
      sqlWithoutComments(associationMigration),
      sqlWithoutComments(associationSource),
    );
    assert.equal(
      sha256(sqlWithoutComments(associationMigration)),
      "8fc849f3aeda42c8f0c03d5c2df0c89dac75246cc2c7e25d333334f661a6f766",
    );
    assert.match(associationMigration, /create table if not exists/);
    assert.match(
      associationMigration,
      /continuum_project_evidence_associations_trusted_source_uq[\s\S]*where status = 'trusted'/,
    );
    assert.match(
      associationMigration,
      /grant select, insert, update[\s\S]*to service_role/,
    );
    assert.doesNotMatch(associationMigration, /drop\s+table|truncate\s+table|delete\s+from/i);
    assert.match(associationMigration, /never drop this table or its rows/i);
  });

  it("preserves the recorded founder-session base before additive hardening", () => {
    const source = read("lib/supabase/continuum-founder-sessions-schema.sql");
    const historical = read(
      "supabase/migrations/20260916094016_add_continuum_founder_sessions.sql",
    );
    assert.equal(sqlWithoutComments(historical), sqlWithoutComments(source));
    assert.equal(
      sha256(sqlWithoutComments(historical)),
      "6329ffcf4067f42548d41000f4d185adc5a05d93ce8cdc4fc08fc178048f282d",
    );
  });

  it("maps Concierge to the Preview history version without an executable legacy version", () => {
    const migrationNames = readdirSync(resolve(root, "supabase/migrations"));
    assert.equal(
      migrationNames.some((name) => name.startsWith("20261104145814_")),
      false,
    );
    assert.equal(
      migrationNames.includes(
        "20261104201449_continuum_concierge_funnel_persistence.sql",
      ),
      true,
    );
    assert.equal(existsSync(resolve(root, conciergeAclPath)), true);
  });

  it("materializes the two tracked Concierge bodies under one transaction", () => {
    assert.equal(
      sha256(conciergeArtifact),
      "2b21179eb227c9b4540aa40baea1bf495c281d72bdbb3bc1df0fb2272141ccf2",
    );
    assert.equal(
      (conciergeArtifact.match(/^begin;$/gm) ?? []).length,
      1,
    );
    assert.equal(
      (conciergeArtifact.match(/^commit;$/gm) ?? []).length,
      1,
    );
    assert.match(conciergeArtifact, new RegExp(sha256(conciergeBase)));
    assert.match(conciergeArtifact, new RegExp(sha256(conciergeAcl)));
    assert.match(conciergeArtifact, new RegExp(stripEnvelope(conciergeBase).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(conciergeArtifact, new RegExp(stripEnvelope(conciergeAcl).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  });

  it("counts one primary-key index plus exactly two secondary partial indexes", () => {
    assert.match(conciergeBase, /outbox_id text primary key/);
    assert.equal(
      (conciergeBase.match(/^create index continuum_concierge_ack_outbox_/gm) ?? [])
        .length,
      2,
    );
    assert.equal((conciergeBase.match(/\swhere\s/gi) ?? []).length >= 2, true);
  });
});
