/**
 * Local Morning Brief preview for Client Attention review — NEVER sends email.
 *
 * Usage:
 *   npx tsx scripts/agent-os-client-attention-morning-brief-preview.ts
 *   npx tsx scripts/agent-os-client-attention-morning-brief-preview.ts --live
 *
 * Shows Client Attention, Highest ROI Move, Top Priorities, and Data Gaps.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadAllSources } from "../lib/agent-os/adapters/load";
import {
  loadClientAttentionSourcesAsync,
  summarizeAuditJson,
} from "../lib/agent-os/bi/client-attention";
import { conciergeReconstructionQualityReport } from "../lib/agent-os/bi/client-attention/adapters/concierge-from-hubspot";
import { gmailLiveReadiness } from "../lib/agent-os/bi/client-attention/adapters/gmail";
import { runBusinessIntelligence } from "../lib/agent-os/executives/business-intelligence";
import { runChiefOfStaff } from "../lib/agent-os/executives/chief-of-staff";
import { loadOperatingBacklog } from "../lib/agent-os/operating-backlog";
import { loadEnvLocalForPreview } from "../lib/agent-os/preview-cli";

const envLoad = loadEnvLocalForPreview();
if (envLoad.loaded) {
  console.error(
    `[client-attention-preview] loaded .env.local gaps-only (${envLoad.keysApplied} keys; values not printed)`,
  );
}

const live = process.argv.includes("--live");
const mode = live ? "live" : "fixture";
const reportingPeriod = { start: "2026-07-22", end: "2026-07-28" };

async function main() {
  const started = Date.now();
  const bundle = await loadAllSources(mode === "live" ? "live" : "fixture");
  const clientAttentionSources =
    mode === "live"
      ? await loadClientAttentionSourcesAsync({ mode })
      : undefined;
  const bi = runBusinessIntelligence(bundle, reportingPeriod, {
    mode,
    clientAttentionSources,
  });
  const cos = runChiefOfStaff({
    bi,
    reportingPeriod,
    warnings: [],
    mode,
    briefCadenceIntent: "daily",
    operatingBacklog: loadOperatingBacklog(),
  });

  const runtimeMs = Date.now() - started;
  const brief = cos.brief;
  const preview = {
    mode,
    sent: false,
    note: "Local preview only — Morning Brief was NOT sent.",
    runtimeMs,
    clientAttention: brief.clientAttentionItems ?? [],
    highestRoiMove: brief.highestRoiAction,
    topPriorities: brief.needsAttentionToday ?? [],
    surfacedPriorityTitles: brief.surfacedPriorityTitles ?? [],
    dataGaps: [
      ...bi.dataGaps.map((g) => ({
        id: g.id,
        description: g.description,
        remedy: g.suggestedRemedy,
      })),
      ...(bi.clientAttentionAudit.dataGaps ?? []).map((g) => ({
        id: g.id,
        description: g.scope,
        remedy: g.resolutionPrerequisite,
      })),
      ...(brief.missingOrUnreliableData ?? []).map((line, i) => ({
        id: `brief-missing-${i}`,
        description: line,
        remedy: null as string | null,
      })),
    ],
    clientAttentionSummary: summarizeAuditJson(bi.clientAttentionAudit),
    gmailReadiness: gmailLiveReadiness(),
    conciergeReconstruction: conciergeReconstructionQualityReport(),
    sourceAvailability: bi.clientAttentionAudit.sourceAvailability,
  };

  const outDir = join(process.cwd(), "tmp", "agent-os");
  mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const path = join(
    outDir,
    `morning-brief-client-attention-preview-${mode}-${stamp}.json`,
  );
  writeFileSync(path, JSON.stringify(preview, null, 2), "utf8");

  console.log("=== Morning Brief preview (NOT SENT) ===");
  console.log(`Mode: ${mode}`);
  console.log("\n## Client Attention (CoS-surfaced)");
  if (!preview.clientAttention.length) {
    console.log("(none surfaced in Highest/priority pool)");
  } else {
    for (const item of preview.clientAttention) {
      console.log(`- ${item.title}: ${item.summary}`);
      console.log(`  Action: ${item.action}`);
    }
  }
  console.log("\n## Client Attention (BI ranked — for review)");
  const ranked = bi.clientAttentionAudit.rankedSignals ?? [];
  if (!ranked.length) {
    console.log("(no ranked client signals)");
  } else {
    for (const r of ranked.slice(0, 4)) {
      console.log(
        `- [${r.signal.signalType}] ${r.signal.displayName} (score ${r.totalScore.toFixed(1)})`,
      );
      console.log(`  ${r.signal.recommendedAction}`);
    }
  }
  console.log("\n## Highest ROI Move");
  console.log(preview.highestRoiMove || "(none)");
  console.log("\n## Top Priorities (needs attention today)");
  for (const p of preview.topPriorities.slice(0, 5)) {
    console.log(`- ${p}`);
  }
  if (preview.surfacedPriorityTitles.length) {
    console.log("\nSurfaced priority titles:");
    for (const t of preview.surfacedPriorityTitles) console.log(`- ${t}`);
  }
  console.log("\n## Data Gaps");
  for (const g of preview.dataGaps.slice(0, 12)) {
    console.log(`- ${g.description}`);
  }
  console.log(`\nWrote ${path}`);
  console.log(`Runtime: ${runtimeMs}ms`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : "preview-failed");
  process.exit(1);
});
