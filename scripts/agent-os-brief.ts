/**
 * Manual Agent OS founder brief runner (Node / server only).
 *
 * Usage:
 *   npm run agent-os:brief          → --fixture (intentional sample data)
 *   npm run agent-os:brief:live     → --live (never falls back to fixtures)
 *
 * Writes artifacts only under tmp/agent-os/ (gitignored).
 * Read-only: no external writes, no public routes, no email/scheduling.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runAgentOsBrief } from "../lib/agent-os/run";
import {
  containsLikelyPiiOrSecret,
  redactSecretsAndPii,
} from "../lib/agent-os/redaction";

async function main() {
  const args = process.argv.slice(2);
  const live = args.includes("--live");
  const fixture = args.includes("--fixture") || !live;
  if (live && args.includes("--fixture")) {
    console.error("[agent-os] Pass either --live or --fixture, not both");
    process.exitCode = 2;
    return;
  }
  const mode = live ? "live" : "fixture";
  if (!fixture && !live) {
    // unreachable — fixture defaults when not live
  }

  console.log(`[agent-os] Starting ${mode} brief run…`);

  const run = await runAgentOsBrief({ mode });

  if (run.mode !== mode) {
    console.error(
      `[agent-os] Mode mismatch: requested ${mode}, run.mode=${run.mode}`,
    );
    process.exitCode = 2;
    return;
  }

  if (
    mode === "live" &&
    run.sourceHealth.some((h) => h.retrievalState === "fixture")
  ) {
    console.error(
      "[agent-os] Live run contained fixture retrieval state — refusing artifacts",
    );
    process.exitCode = 2;
    return;
  }

  const outDir = join(process.cwd(), "tmp", "agent-os");
  mkdirSync(outDir, { recursive: true });

  const stamp = run.generatedAt.replace(/[:.]/g, "-");
  const jsonPath = join(outDir, `brief-${mode}-${stamp}.json`);
  const mdPath = join(outDir, `brief-${mode}-${stamp}.md`);

  const json = JSON.stringify(run, null, 2);
  const markdown = run.brief.markdown;

  if (containsLikelyPiiOrSecret(json) || containsLikelyPiiOrSecret(markdown)) {
    console.error(
      "[agent-os] Refusing to write artifacts: possible PII or secret detected after redaction pass",
    );
    process.exitCode = 2;
    return;
  }

  writeFileSync(jsonPath, redactSecretsAndPii(json), "utf8");
  writeFileSync(mdPath, redactSecretsAndPii(markdown), "utf8");

  console.log(`[agent-os] mode=${run.mode}`);
  console.log(`[agent-os] runId=${run.runId}`);
  console.log(
    `[agent-os] status=${run.runStatus} recommendationAvailability=${run.recommendationAvailability} durationMs=${run.durationMs}`,
  );
  console.log(
    `[agent-os] evidence=${run.briefEvidenceQuality} delivery=${run.deliveryGuidance}`,
  );
  console.log(
    `[agent-os] executiveStatuses=${run.executiveStatuses.map((e) => `${e.executiveId}:${e.status}`).join(",")}`,
  );
  console.log(
    `[agent-os] executives invoked=${run.executivesInvoked.join(",")} scaffold=${run.executivesNotOperational.join(",")}`,
  );
  console.log(
    `[agent-os] opportunities=${run.briefSurfacing.opportunitiesDetected} ranked=${run.briefSurfacing.recommendationsRanked} surfacedInBrief=${run.briefSurfacing.recommendationsSurfacedInBrief} (jsonRecs=${run.recommendations.length}) anomalies=${run.anomalies.length} gaps=${run.dataGaps.length}`,
  );
  console.log(`[agent-os] wrote ${jsonPath}`);
  console.log(`[agent-os] wrote ${mdPath}`);
  console.log("\n--- Founder Brief ---\n");
  console.log(markdown);
}

main().catch((err) => {
  console.error("[agent-os] failed:", redactSecretsAndPii(String(err)));
  process.exitCode = 1;
});
