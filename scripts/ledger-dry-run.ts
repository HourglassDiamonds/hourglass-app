import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { loadEnvConfig } from "@next/env";
import { runLedgerAutomation } from "@/lib/ledger-automation/engine";
import { createLiveLedgerAdapter } from "@/lib/ledger-automation/live-adapters";
import { LEDGER_SOURCE_REGISTRY } from "@/lib/ledger-automation/source-registry";
import type { LedgerRunType } from "@/lib/ledger-automation/types";

async function main(): Promise<void> {
  loadEnvConfig(process.cwd());

  const runType: LedgerRunType = process.argv.includes("--friday") ? "FRIDAY_DELTA" : "TUESDAY_FULL";
  const now = new Date();
  const scheduledDate = now.toISOString().slice(0, 10);
  const adapter = createLiveLedgerAdapter();
  const run = await runLedgerAutomation({
    runType,
    scheduledDate,
    startedAt: now.toISOString(),
    registry: LEDGER_SOURCE_REGISTRY,
    adapter,
  });

  const checks = run.evidencePacket.sourceChecks;
  const localDirectory = join(process.cwd(), ".tmp", "ledger-dry-runs");
  const outputPath = join(localDirectory, `${run.runId}.json`);
  await mkdir(localDirectory, { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(run, null, 2)}\n`, { encoding: "utf8", flag: "w" });

  const summary = {
  runType,
  runId: run.runId,
  sourceHealth: Object.fromEntries(
    [...new Set(checks.map((check) => check.status))].sort().map((status) => [
      status,
      checks.filter((check) => check.status === status).length,
    ]),
  ),
  sourceModes: Object.fromEntries(
    [...new Set(checks.map((check) => check.sourceMode))].sort().map((mode) => [
      mode,
      checks.filter((check) => check.sourceMode === mode).length,
    ]),
  ),
  staleSources: checks.filter((check) => check.status === "STALE").map((check) => check.sourceId),
  unavailableSources: checks.filter((check) => check.failure).map((check) => ({
    sourceId: check.sourceId,
    status: check.status,
    reason: check.failureReason,
  })),
  monitorProposals: run.evidencePacket.monitorObservations,
  bufferHealthProposals: run.evidencePacket.bufferHealthChanges,
  proposedOverallState: {
    degrees: run.evidencePacket.overallTemperature.proposedDegrees,
    state: run.evidencePacket.overallTemperature.proposedState,
  },
  approvalClassification: run.classification,
  evidencePacketPath: outputPath,
  publicationOccurred: run.publicationOccurred,
  };

  console.log(JSON.stringify(summary, null, 2));
}

void main().catch((error: unknown) => {
  console.error("Ledger dry run failed safely; nothing was published.", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
