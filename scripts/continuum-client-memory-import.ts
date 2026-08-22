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
 * Never prints client name, email, phone, or address.
 */

import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { findPiiViolation } from "../lib/continuum/contracts/validation";
import { applyReconciliationWorkbook } from "../lib/continuum/client-memory/apply";
import { AUDITED_RECONCILIATION_V3 } from "../lib/continuum/client-memory/artifact";
import { dryRunReconciliationWorkbook } from "../lib/continuum/client-memory/dry-run";
import {
  envImportEnabled,
  type ApplyTarget,
} from "../lib/continuum/client-memory/gates";
import {
  InMemoryClientMemoryStore,
  type ClientMemoryStore,
} from "../lib/continuum/client-memory/store";

const DEFAULT_WORKBOOK = resolve(
  process.cwd(),
  AUDITED_RECONCILIATION_V3.relativePath,
);

function workbookPathFromArgs(args: string[]): string {
  const flagged = args.find((arg) => arg.startsWith("--workbook="));
  if (flagged) return resolve(process.cwd(), flagged.slice("--workbook=".length));
  const idx = args.indexOf("--workbook");
  if (idx >= 0 && args[idx + 1]) return resolve(process.cwd(), args[idx + 1]);
  return DEFAULT_WORKBOOK;
}

function targetFromArgs(args: string[]): ApplyTarget | null {
  const flagged = args.find((arg) => arg.startsWith("--target="));
  const raw = flagged
    ? flagged.slice("--target=".length)
    : args.includes("--target")
      ? args[args.indexOf("--target") + 1]
      : null;
  if (raw === "memory" || raw === "supabase") return raw;
  return null;
}

function implementationCommit(): string | null {
  try {
    return execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

function emitJson(payload: unknown): void {
  const pii = findPiiViolation(payload);
  if (pii) {
    console.error(JSON.stringify({ ok: false, reason: "refused-pii-in-report" }));
    process.exitCode = 2;
    return;
  }
  console.log(JSON.stringify(payload, null, 2));
}

async function main() {
  const args = process.argv.slice(2);
  const workbookPath = workbookPathFromArgs(args);
  if (!existsSync(workbookPath)) {
    console.error(
      JSON.stringify({
        ok: false,
        reason: "workbook-not-found",
        hint: "Pass --workbook=path to Continuum_Reconciliation_v3.xlsx",
      }),
    );
    process.exitCode = 2;
    return;
  }

  const buffer = readFileSync(workbookPath);

  if (args.includes("--apply")) {
    const target = targetFromArgs(args);
    const confirmProductionClientImport = args.includes(
      "--confirm-production-client-import",
    );
    const envEnabled = envImportEnabled();
    let store: ClientMemoryStore | undefined;
    if (
      target === "supabase" &&
      confirmProductionClientImport &&
      envEnabled
    ) {
      const { createSupabaseClientMemoryStore } = await import(
        "../lib/continuum/client-memory/persistence/supabase"
      );
      store = createSupabaseClientMemoryStore();
    } else if (target === "memory") {
      store = new InMemoryClientMemoryStore();
    }
    const result = await applyReconciliationWorkbook(buffer, {
      apply: true,
      confirmProductionClientImport,
      envEnabled,
      target,
      store,
      implementationCommit: implementationCommit(),
    });
    if (!result.ok) {
      console.error(JSON.stringify(result));
      process.exitCode = 2;
      return;
    }
    emitJson(result);
    return;
  }

  const result = await dryRunReconciliationWorkbook(buffer);
  const verbose = args.includes("--verbose") || args.includes("--debug");
  const payload = verbose
    ? {
        ...result,
        verbose: true,
        piiRedacted: true,
        implementationCommit: implementationCommit(),
      }
    : result;
  emitJson(payload);
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
