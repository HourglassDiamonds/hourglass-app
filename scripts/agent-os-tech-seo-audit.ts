/**
 * Agent OS Technical SEO audit CLI — Search & GEO specialist (standalone).
 *
 * Usage:
 *   npm run agent-os:tech-seo
 *   npm run agent-os:tech-seo -- --live-http
 *   npm run agent-os:tech-seo -- --json
 *
 * Read-only audit. Writes artifacts only under tmp/agent-os/.
 * Does not edit site source, deploy, push, or mutate GSC/GBP.
 */

import {
  runP1Tech1Closeout,
  assertReportContract,
} from "../lib/agent-os/search/tech-seo";
import { writeTechSeoArtifacts } from "../lib/agent-os/search/tech-seo/write-artifacts";

async function main() {
  const args = process.argv.slice(2);
  const liveHttp = args.includes("--live-http");
  const asJson = args.includes("--json");

  const report = await runP1Tech1Closeout({
    mode: liveHttp ? "repository+live-http" : "repository",
  });

  const missing = assertReportContract(report.markdown);
  if (missing.length > 0) {
    console.error("[agent-os:tech-seo] Report contract missing:", missing);
    process.exitCode = 1;
  }

  const { jsonPath, mdPath, stamp } = writeTechSeoArtifacts({
    jsonBody: JSON.stringify(
      {
        ...report,
        markdown: undefined,
      },
      null,
      2,
    ),
    markdownBody: report.markdown,
  });

  if (asJson) {
    console.log(
      JSON.stringify(
        {
          verdict: report.verdict,
          mode: report.mode,
          stamp,
          jsonPath,
          mdPath,
          evidenceRowCount: report.evidenceRows.length,
          rankedNextFixes: report.rankedNextFixes,
          evidenceGaps: report.evidenceGaps,
          gscReadiness: report.gscReadiness,
        },
        null,
        2,
      ),
    );
  } else {
    console.log(report.markdown);
    console.log("");
    console.log(`[agent-os:tech-seo] Wrote ${jsonPath}`);
    console.log(`[agent-os:tech-seo] Wrote ${mdPath}`);
  }
}

main().catch((err) => {
  console.error("[agent-os:tech-seo] Failed:", err);
  process.exitCode = 1;
});
