/**
 * Client Memory V1 dry-run importer.
 *
 * Usage:
 *   npx tsx scripts/continuum-client-memory-import.ts
 *   npx tsx scripts/continuum-client-memory-import.ts --workbook=.review/client-memory/Continuum_Reconciliation_v3.xlsx
 *
 * Default is DRY RUN. No writes.
 * --apply fails closed in this phase.
 * Never prints client name, email, phone, or address.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { findPiiViolation } from "../lib/continuum/contracts/validation";
import {
  APPLY_NOT_IMPLEMENTED,
  dryRunReconciliationWorkbook,
} from "../lib/continuum/client-memory/dry-run";

const DEFAULT_WORKBOOK = resolve(
  process.cwd(),
  ".review/client-memory/Continuum_Reconciliation_v3.xlsx",
);

function workbookPathFromArgs(args: string[]): string {
  const flagged = args.find((arg) => arg.startsWith("--workbook="));
  if (flagged) return resolve(process.cwd(), flagged.slice("--workbook=".length));
  const idx = args.indexOf("--workbook");
  if (idx >= 0 && args[idx + 1]) return resolve(process.cwd(), args[idx + 1]);
  return DEFAULT_WORKBOOK;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--apply")) {
    console.error(APPLY_NOT_IMPLEMENTED);
    process.exitCode = 2;
    return;
  }

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
  const result = await dryRunReconciliationWorkbook(buffer);
  const pii = findPiiViolation(result);
  if (pii) {
    console.error(
      JSON.stringify({
        ok: false,
        reason: "refused-pii-in-dry-run-report",
      }),
    );
    process.exitCode = 2;
    return;
  }

  const verbose = args.includes("--verbose") || args.includes("--debug");
  const payload = verbose
    ? { ...result, verbose: true, piiRedacted: true }
    : result;
  const again = findPiiViolation(payload);
  if (again) {
    console.error(
      JSON.stringify({
        ok: false,
        reason: "refused-pii-in-dry-run-report",
      }),
    );
    process.exitCode = 2;
    return;
  }
  console.log(JSON.stringify(payload, null, 2));
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
