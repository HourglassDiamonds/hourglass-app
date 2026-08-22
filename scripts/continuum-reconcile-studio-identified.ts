/**
 * Continuum Studio identified-event reconciliation CLI.
 *
 * Phase 1B.1: do NOT run against production.
 *
 * Usage:
 *   npx tsx scripts/continuum-reconcile-studio-identified.ts
 *   npx tsx scripts/continuum-reconcile-studio-identified.ts --apply
 *
 * Default is dry-run. Never prints email, name, phone, or hashes.
 */

import { reconcileStudioIdentifiedEvents } from "../lib/continuum/reconcile/studio-identified";
import { createSupabaseStudioIdentifiedSource } from "../lib/continuum/reconcile/source";
import { tryCreateContinuumStore } from "../lib/continuum/persistence/supabase";
import { studioViewEmailedEventIdempotencyKey } from "../lib/continuum/contracts/ids";
import { findPiiViolation } from "../lib/continuum/contracts/validation";

async function main() {
  const apply = process.argv.includes("--apply");
  const source = createSupabaseStudioIdentifiedSource();
  const store = tryCreateContinuumStore();
  if (!source || !store) {
    console.error("[continuum-reconcile] supabase unconfigured; aborting");
    process.exitCode = 2;
    return;
  }

  if (!apply) {
    const page = await source.list({ offset: 0, limit: 100 });
    let missingEvents = 0;
    for (const row of page.rows) {
      const existing = await store.getEventByIdempotencyKey(
        studioViewEmailedEventIdempotencyKey(row.identifiedRecordId),
      );
      if (!existing) missingEvents += 1;
    }
    const report = {
      mode: "dry-run",
      scanned: page.rows.length,
      missingEvents,
      applyRequiredToWrite: true,
    };
    const pii = findPiiViolation(report);
    if (pii) {
      console.error("[continuum-reconcile] refused PII in report");
      process.exitCode = 2;
      return;
    }
    console.log(JSON.stringify(report));
    return;
  }

  const result = await reconcileStudioIdentifiedEvents({ source, store });
  const pii = findPiiViolation(result);
  if (pii) {
    console.error("[continuum-reconcile] refused PII in report");
    process.exitCode = 2;
    return;
  }
  console.log(JSON.stringify({ mode: "apply", ...result }));
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "unknown";
  console.error("[continuum-reconcile]", {
    failed: true,
    reason: message.includes("@") ? "redacted" : message,
  });
  process.exitCode = 1;
});
