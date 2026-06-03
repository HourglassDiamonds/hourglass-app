/**
 * Canonical Diamond Intelligence validation gate.
 *
 * Usage:
 *   npm run validate:diamond-intelligence
 *   npm run validate:diamond-intelligence -- --live http://localhost:3000
 *   npm run validate:diamond-intelligence -- 2496027047
 *
 * Default mode runs the client extraction pipeline in-process with the same
 * timeouts as POST /api/diamond-intelligence/interpret (live parity).
 *
 * Forensic detail: npm run validate:extraction-reports -- --detail
 */
import {
  formatValidationGateReport,
  runValidationGate,
  runValidationGateIsolated,
  VALIDATION_GATE_JSON_PATH,
  writeValidationGateJson,
} from "@/lib/calibration-library/diamond-intelligence-validation-gate";

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const liveIdx = args.indexOf("--live");
  const inProcess = args.includes("--in-process");
  const giaOnly = args.includes("--gia");
  const liveBaseUrl =
    liveIdx >= 0 ? args[liveIdx + 1] ?? "http://localhost:3000" : undefined;
  const filter = args.filter((a, i) => {
    if (a.startsWith("--")) return false;
    if (liveIdx >= 0 && (i === liveIdx + 1 || i === liveIdx)) return false;
    return true;
  });

  const gateFilter = giaOnly ? ["GIA"] : filter.length ? filter : undefined;

  if (giaOnly) {
    console.log("scope: GIA anchors only");
  }

  if (liveBaseUrl) {
    console.log(`mode: live HTTP POST → ${liveBaseUrl}`);
    console.log(
      "note: requires a running server (npm run start). CRON_SECRET header sent when set.",
    );
  } else if (inProcess || (gateFilter?.length === 1 && !giaOnly)) {
    console.log("mode: in-process client pipeline (interpret route parity)");
  } else {
    console.log(
      "mode: isolated subprocess per anchor (avoids OCR memory pressure across batch)",
    );
  }
  console.log("");

  const result =
    liveBaseUrl || inProcess || (gateFilter?.length === 1 && !giaOnly)
      ? await runValidationGate({
          filter: gateFilter,
          liveBaseUrl,
        })
      : await runValidationGateIsolated({
          filter: gateFilter,
        });

  console.log(formatValidationGateReport(result));
  writeValidationGateJson(result);
  console.log(`\nJSON: ${VALIDATION_GATE_JSON_PATH}`);

  if (result.summary.overall !== "PASS") {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
