/**
 * Fail-closed legacy Concierge -> canonical Person/Project promotion.
 * Dry-run by default. `--apply` performs only an evidence-qualified,
 * deterministic, idempotent canonical write.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { SupabaseClientMemoryStore } from "../lib/continuum/client-memory/persistence/supabase";
import { SupabaseProjectJobWriter } from "../lib/continuum/client-memory/project-jobs/supabase-writer";
import {
  assessLegacyConciergePromotion,
  legacyConciergeStableUuid,
  promoteLegacyConciergeLead,
  type LegacyConciergeEvidence,
} from "../lib/continuum/legacy-concierge/promotion";

function argument(name: string): string | null {
  const prefix = `${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length) ?? null;
}

function required(name: string): string {
  const value = process.env[name]?.trim() ?? "";
  if (!value) throw new Error(`missing-${name}`);
  return value;
}

async function main() {
  const inputPath = argument("--input");
  if (!inputPath) throw new Error("usage: --input=<verified-evidence.json> [--apply]");
  const evidence = JSON.parse(readFileSync(resolve(inputPath), "utf8")) as LegacyConciergeEvidence;
  const assessment = assessLegacyConciergePromotion(evidence);
  if (!assessment.qualified || !process.argv.includes("--apply")) {
    process.stdout.write(`${JSON.stringify({ mode: "dry-run", assessment }, null, 2)}\n`);
    if (!assessment.qualified) process.exitCode = 2;
    return;
  }
  const client = createClient(required("SUPABASE_URL"), required("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const result = await promoteLegacyConciergeLead(new SupabaseClientMemoryStore(client), evidence);
  let currentAction = null;
  if (result.ok && evidence.currentAction) {
    currentAction = await new SupabaseProjectJobWriter(client).createJob({
      mutationId: legacyConciergeStableUuid(`legacy-concierge:hubspot-deal:${evidence.hubspotDealId}:current-action`),
      projectId: result.projectId,
      kind: "required_action",
      subject: evidence.currentAction.subject,
      detail: evidence.currentAction.detail ?? null,
      waitingOnActor: "founder",
      associatedPersonId: result.personId,
      dueAt: evidence.currentAction.dueAt,
      actor: "legacy-concierge-promotion",
      sourceSystem: "continuum",
      sourceRef: `legacy-concierge:hubspot-deal:${evidence.hubspotDealId}:scheduled-consultation`,
    });
  }
  process.stdout.write(`${JSON.stringify({ mode: "apply", result, currentAction }, null, 2)}\n`);
  if (!result.ok) process.exitCode = 2;
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
