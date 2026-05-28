/**
 * Phase 1 — field-by-field extraction audit for locked anchor reports.
 * Run: npx tsx scripts/audit-anchor-extractions.ts
 */
import {
  buildLockedAnchorExtractionAudits,
  formatAnchorAuditReport,
} from "../lib/calibration-library/extraction-field-audit";

const audits = buildLockedAnchorExtractionAudits();
console.log(formatAnchorAuditReport(audits));
console.log("\n--- JSON ---\n");
console.log(JSON.stringify(audits, null, 2));

const incomplete = audits.filter((a) => a.completenessPercent < 100);
if (incomplete.length > 0) {
  console.error(
    `\nAnchor audit gate: ${incomplete.length} scenario(s) below 100% completeness`,
  );
  for (const a of incomplete) {
    const missing = a.fields.filter((f) => !f.populated).map((f) => f.field);
    console.error(`  ${a.scenarioId}: missing ${missing.join(", ")}`);
  }
  process.exit(1);
}

console.log("\nAnchor audit gate: OK (all anchors 100% on fixtures)");
