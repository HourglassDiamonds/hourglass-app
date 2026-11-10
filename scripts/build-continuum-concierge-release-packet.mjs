import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const basePath = "supabase/migrations/20261104201449_continuum_concierge_funnel_persistence.sql";
const aclPath = "supabase/migrations/20261110194159_continuum_concierge_ack_outbox_acl.sql";
const outputPath = "supabase/release/20261110_continuum_concierge_fresh_install.sql";

function normalizeLf(value) {
  return value.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function stripTransactionEnvelope(sql, label) {
  const lines = normalizeLf(sql).trimEnd().split("\n");
  const beginLines = lines.flatMap((line, index) =>
    line === "begin;" ? [index] : [],
  );
  const commitLines = lines.flatMap((line, index) =>
    line === "commit;" ? [index] : [],
  );
  if (
    beginLines.length !== 1 ||
    commitLines.length !== 1 ||
    beginLines[0] >= commitLines[0] ||
    commitLines[0] !== lines.length - 1
  ) {
    throw new Error(`${label} must have one top-level BEGIN/COMMIT envelope`);
  }
  lines.splice(commitLines[0], 1);
  lines.splice(beginLines[0], 1);
  return lines.join("\n").trimEnd();
}

const base = normalizeLf(readFileSync(resolve(root, basePath), "utf8"));
const acl = normalizeLf(readFileSync(resolve(root, aclPath), "utf8"));
const artifact = [
  "-- GENERATED RELEASE ARTIFACT. Do not edit by hand.",
  "-- Executes the tracked Concierge base and ACL correction atomically.",
  `-- Base: ${basePath}`,
  `-- Base SHA-256 (LF): ${sha256(base)}`,
  `-- ACL: ${aclPath}`,
  `-- ACL SHA-256 (LF): ${sha256(acl)}`,
  "-- This file is outside supabase/migrations and is never auto-replayed.",
  "",
  "begin;",
  "",
  `-- BEGIN EXACT BODY: ${basePath}`,
  stripTransactionEnvelope(base, "Concierge base migration"),
  `-- END EXACT BODY: ${basePath}`,
  "",
  `-- BEGIN EXACT BODY: ${aclPath}`,
  stripTransactionEnvelope(acl, "Concierge ACL migration"),
  `-- END EXACT BODY: ${aclPath}`,
  "",
  "commit;",
  "",
].join("\n");

const target = resolve(root, outputPath);
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, artifact, "utf8");
console.log(`${outputPath} ${sha256(artifact)}`);
