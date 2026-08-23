/**
 * Client Memory V1 dry-run / gated apply importer.
 *
 * Default is DRY RUN. No writes.
 *
 * Apply requires ALL of:
 *   --apply
 *   --confirm-production-client-import
 *   CONTINUUM_CLIENT_MEMORY_IMPORT_ENABLED=true
 *   matching audited workbook fingerprint
 *   --target=memory | --target=supabase
 *
 * --target=supabase is the only path that uses the production adapter.
 * The adapter is loaded only after flags and fingerprint succeed.
 * Never prints client name, email, phone, or address.
 */

import { execSync } from "node:child_process";
import { findPiiViolation } from "../lib/continuum/contracts/validation";
import {
  loadSupabaseClientMemoryStore,
  runClientMemoryImport,
} from "../lib/continuum/client-memory/import-runtime";

function implementationCommit(): string | null {
  try {
    return execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

function emitJson(payload: unknown, stderr = false): void {
  const pii = findPiiViolation(payload);
  if (pii) {
    console.error(JSON.stringify({ ok: false, reason: "refused-pii-in-report" }));
    process.exitCode = 2;
    return;
  }
  const text = JSON.stringify(payload, null, 2);
  if (stderr) console.error(text);
  else console.log(text);
}

async function main() {
  const args = process.argv.slice(2);
  const verbose = args.includes("--verbose") || args.includes("--debug");
  const result = await runClientMemoryImport(args, {
    loadSupabaseStore: loadSupabaseClientMemoryStore,
  });

  if (result.exitCode !== 0) {
    emitJson(result.payload, true);
    process.exitCode = result.exitCode;
    return;
  }

  const payload =
    verbose && !args.includes("--apply")
      ? {
          ...(result.payload as object),
          verbose: true,
          piiRedacted: true,
          implementationCommit: implementationCommit(),
        }
      : result.payload;
  emitJson(payload, result.stderr);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "unknown";
  console.error(
    JSON.stringify({
      ok: false,
      failed: true,
      reason: message.includes("@") ? "redacted" : message,
    }),
  );
  process.exitCode = 1;
});
