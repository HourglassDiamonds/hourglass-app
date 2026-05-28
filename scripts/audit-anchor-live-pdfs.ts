/**
 * Bounded live-PDF anchor extraction audit (upload pipeline).
 * Run: npm run audit:anchor-live-pdfs
 */
import {
  buildAllLiveAnchorAudits,
  compareFixtureAndLiveAnchorAudits,
  formatFixtureLiveParityReport,
  formatLiveAnchorAuditReport,
} from "../lib/calibration-library/anchor-live-audit";
import { buildLockedAnchorExtractionAudits } from "../lib/calibration-library/extraction-field-audit";
import { runScriptWithTimeout } from "../lib/calibration-library/runtime-guard";
import { SCRIPT_DEFAULT_TIMEOUT_MS } from "../lib/calibration-library/runtime-limits";

async function main() {
  const fixtureAudits = buildLockedAnchorExtractionAudits();
  const liveAudits = await buildAllLiveAnchorAudits();

  console.log(formatLiveAnchorAuditReport(liveAudits));

  const parity = fixtureAudits.map((fixture) => {
    const live = liveAudits.find(
      (l) => l.reportNumber === fixture.reportNumber,
    );
    if (!live) {
      throw new Error(`Missing live audit for ${fixture.reportNumber}`);
    }
    return compareFixtureAndLiveAnchorAudits(fixture, live);
  });

  console.log("\n" + formatFixtureLiveParityReport(parity));

  const missingPdf = liveAudits.filter((a) => !a.pdfFound);
  const timedOut = liveAudits.filter((a) => a.timedOut);
  const belowNinety = liveAudits.filter((a) => a.completenessPercent < 90);

  if (missingPdf.length) {
    console.error(
      `\nLive anchor gate: ${missingPdf.length} PDF(s) not found — place files under data/light-performance-calibration/anchor-pdfs/ or uploads/`,
    );
    for (const m of missingPdf) {
      console.error(`  ${m.reportNumber}`);
    }
    process.exit(1);
  }

  if (timedOut.length) {
    console.error(`\nLive anchor gate: ${timedOut.length} timed out`);
    process.exit(1);
  }

  if (belowNinety.length) {
    console.warn(
      `\nLive anchor warning: ${belowNinety.length} below 90% completeness (see parity report)`,
    );
    for (const b of belowNinety) {
      console.warn(
        `  ${b.reportNumber}: ${b.completenessPercent}% · misses=${b.targetMisses.join(",")}`,
      );
    }
  }

  console.log("\nLive anchor audit: completed (see parity for fixture optimism check)");
}

runScriptWithTimeout(
  main,
  Math.max(SCRIPT_DEFAULT_TIMEOUT_MS, 180_000),
  "audit-anchor-live-pdfs",
).catch((e) => {
  console.error(e);
  process.exit(1);
});
