/**
 * Client Attention CLI — fixture by default; optional live HubSpot reads.
 * Usage:
 *   npm run agent-os:client-attention
 *   npm run agent-os:client-attention -- --fixture=gmail-failure
 *   npm run agent-os:client-attention -- --live
 *   npm run agent-os:client-attention -- --json
 *
 * --live never falls back to fixtures. Does not send Morning Brief.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  formatClientAttentionReport,
  runClientAttentionAnalysis,
  runClientAttentionAnalysisAsync,
  summarizeAuditJson,
  type ClientAttentionFixturePreset,
} from "../lib/agent-os/bi/client-attention";
import { loadEnvLocalForPreview } from "../lib/agent-os/preview-cli";

const envLoad = loadEnvLocalForPreview();
if (envLoad.loaded) {
  console.error(
    `[client-attention] loaded .env.local gaps-only (${envLoad.keysApplied} keys; values not printed)`,
  );
}

const args = process.argv.slice(2);
const json = args.includes("--json");
const live = args.includes("--live");
const fixtureArg =
  args.find((a) => a.startsWith("--fixture="))?.split("=")[1] ?? "success";

const allowed: ClientAttentionFixturePreset[] = [
  "success",
  "gmail-failure",
  "hubspot-failure",
  "both-failure",
  "recovery",
];

const fixturePreset = allowed.includes(fixtureArg as ClientAttentionFixturePreset)
  ? (fixtureArg as ClientAttentionFixturePreset)
  : "success";

const started = Date.now();
const reportingPeriod = { start: "2026-07-22", end: "2026-07-28" };

async function main() {
  const result = live
    ? await runClientAttentionAnalysisAsync({
        mode: "live",
        reportingPeriod,
      })
    : runClientAttentionAnalysis({
        mode: "fixture",
        reportingPeriod,
        fixturePreset,
      });

  const runtimeMs = Date.now() - started;
  const report = formatClientAttentionReport(result, { redacted: true });
  const outDir = join(process.cwd(), "tmp", "agent-os");
  mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const label = live ? "live" : fixturePreset;
  const mdPath = join(outDir, `client-attention-${label}-${stamp}.md`);
  const jsonPath = join(outDir, `client-attention-${label}-${stamp}.json`);

  writeFileSync(mdPath, `${report}\n\nRuntime: ${runtimeMs}ms\n`, "utf8");
  writeFileSync(
    jsonPath,
    JSON.stringify(
      {
        mode: live ? "live" : "fixture",
        fixturePreset: live ? null : fixturePreset,
        runtimeMs,
        redacted: true,
        summary: summarizeAuditJson(result.audit),
        recommendations: result.recommendations.slice(0, 2).map((r) => ({
          id: r.recommendationId,
          title: r.title,
          action: r.proposedAction,
        })),
      },
      null,
      2,
    ),
    "utf8",
  );

  if (json) {
    console.log(
      JSON.stringify(
        {
          mode: live ? "live" : "fixture",
          fixturePreset: live ? null : fixturePreset,
          runtimeMs,
          summary: summarizeAuditJson(result.audit),
          reportPath: mdPath,
        },
        null,
        2,
      ),
    );
  } else {
    console.log(report);
    console.log(`\nRuntime: ${runtimeMs}ms`);
    console.log(`Wrote ${mdPath}`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : "client-attention-cli-failed");
  process.exit(1);
});
