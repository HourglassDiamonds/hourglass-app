/**
 * Internal: run validation gate for one manifest entry, emit JSON row on stdout.
 * Used by the canonical gate to isolate OCR runs in fresh processes.
 */
import {
  runValidationGate,
  type ValidationGateRow,
} from "@/lib/calibration-library/diamond-intelligence-validation-gate";

async function main(): Promise<void> {
  const reportId = process.argv[2];
  if (!reportId) {
    console.error("usage: validate-diamond-intelligence-row.ts <reportId>");
    process.exit(2);
  }

  const result = await runValidationGate({ filter: [reportId] });
  const row = result.rows[0];
  if (!row) {
    const fallback: ValidationGateRow = {
      reportId,
      style: "UNKNOWN",
      table: "—",
      depth: "—",
      crown: "—",
      pavilion: "—",
      scoreEligible: false,
      verdict: "SKIP",
      failures: ["report not in manifest"],
      routeMs: 0,
      timedOut: false,
    };
    process.stdout.write(JSON.stringify(fallback));
    process.exit(1);
  }

  process.stdout.write(JSON.stringify(row));
  process.exit(row.verdict === "FAIL" || row.verdict === "SKIP" ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
