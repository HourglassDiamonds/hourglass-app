/**
 * Safe local preview of the refined weekly Chief of Staff email.
 * Fixture sources only · no Resend · no production claims.
 *
 * Usage: npx tsx scripts/agent-os-weekly-brief-preview.ts
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runAgentOsBrief } from "../lib/agent-os/run";
import { renderFounderBriefEmail } from "../lib/agent-os/cadence-delivery/render-email";
import {
  formatWeeklyFounderRangeLabel,
  weeklyRangeFromCadenceWindow,
} from "../lib/agent-os/brief-quality";

async function main() {
  const cadenceWindow = "week:2026-W30";
  const range = weeklyRangeFromCadenceWindow(cadenceWindow);
  const run = await runAgentOsBrief({
    mode: "fixture",
    briefCadenceIntent: "weekly",
    // Align analytics period with the cadence window for a fair preview.
    reportingPeriod: range,
  });

  // Simulate the Jul 25 delivered shape: stale reportingPeriod on the run
  // object while the cadence window is ISO W30 — renderer must prefer window.
  const runAsDelivered = {
    ...run,
    reportingPeriod: { start: "2026-07-13", end: "2026-07-19" },
    runStatus: "completed-with-warnings" as const,
  };

  const rendered = renderFounderBriefEmail({
    run: runAsDelivered,
    cadenceId: "cos-weekly-founder-brief",
    cadenceWindow,
    degraded: run.briefEvidenceQuality === "partial-degraded",
  });

  const outDir = join(process.cwd(), "tmp-weekly-brief-preview");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "subject.txt"), rendered.subject, "utf8");
  writeFileSync(join(outDir, "body.txt"), rendered.text, "utf8");
  writeFileSync(join(outDir, "body.html"), rendered.html, "utf8");

  console.log("=== Weekly brief preview (local, no send) ===");
  console.log(
    `Expected founder range: ${formatWeeklyFounderRangeLabel(range.start, range.end)}`,
  );
  console.log(`Subject: ${rendered.subject}`);
  console.log("");
  console.log(rendered.text);
  console.log("");
  console.log(`Wrote ${join(outDir, "body.html")}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
