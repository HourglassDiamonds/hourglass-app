/**
 * Forensic extraction harness — calibration vs client detail.
 *
 * Canonical regression gate: npm run validate:diamond-intelligence
 *
 * Usage:
 *   npm run validate:extraction-reports
 *   npm run validate:extraction-reports -- --detail
 *   npm run validate:extraction-reports -- --client
 *   npm run validate:extraction-reports -- 2496027047
 *
 * Compares validation PDFs against expected-values.json (calibration + client paths).
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { runCalibrationUploadExtraction } from "@/lib/calibration-library/extract-upload-pipeline";
import {
  buildExtractionForensicReport,
  formatForensicDetail,
  formatHarnessBlock,
  probeProductionRender,
  type ExtractionForensicReport,
  type ExpectedFieldSpec,
} from "@/lib/calibration-library/extraction-forensics";

const VALIDATION_DIR = join(
  process.cwd(),
  "data/light-performance-calibration/validation-reports",
);
const EXPECTED_PATH = join(VALIDATION_DIR, "expected-values.json");
const MANIFEST_PATH = join(VALIDATION_DIR, "manifest.json");
const OUT_JSON = join(
  process.cwd(),
  "data/light-performance-calibration/validation-extraction-report.json",
);

type ManifestEntry = { id: string; filename: string; lab: string; style?: string };

async function extractOne(
  entry: ManifestEntry,
  mode: "calibration" | "client",
): Promise<ExtractionForensicReport> {
  const pdfPath = join(VALIDATION_DIR, entry.filename);
  const bytes = readFileSync(pdfPath);
  const expectedAll = JSON.parse(readFileSync(EXPECTED_PATH, "utf8")) as Record<
    string,
    ExpectedFieldSpec
  >;
  const expected = expectedAll[entry.id] ?? {};

  const renderAudit = await probeProductionRender(bytes);

  const result = await runCalibrationUploadExtraction({
    bytes,
    mime: "application/pdf",
    reportNumber: entry.id,
    lab: entry.lab,
    reportSource: "pdf-upload",
    mode: mode === "client" ? "client" : undefined,
    collectDiagnostics: true,
    collectForensics: true,
    collectRenderAudit: mode !== "client",
  });

  return buildExtractionForensicReport({
    reportId: entry.id,
    lab: entry.lab,
    mode,
    result,
    expected,
    renderAudit,
    snapshots: result.forensicSnapshots ?? [],
  });
}

function printLifecycleCompare(
  cal: ExtractionForensicReport,
  client: ExtractionForensicReport,
): void {
  console.log("\n--- LIFECYCLE COMPARE (calibration vs client) ---");
  console.log(
    `  cal  total=${cal.lifecycle.totalMs}ms ocr=${cal.lifecycle.imageOcrMs}ms timedOut=${cal.lifecycle.timedOut}`,
  );
  console.log(
    `  cli  total=${client.lifecycle.totalMs}ms ocr=${client.lifecycle.imageOcrMs}ms timedOut=${client.lifecycle.timedOut}`,
  );
  const fields = [
    "tablePercent",
    "depthPercent",
    "crownAngle",
    "pavilionAngle",
    "lowerHalfPercent",
    "girdle",
    "culet",
  ] as const;
  for (const f of fields) {
    const c = cal.assignments.find((a) => a.field === f)?.finalValue ?? "—";
    const cl = client.assignments.find((a) => a.field === f)?.finalValue ?? "—";
    const mark = c === cl ? "=" : "!";
    console.log(`  ${mark} ${f}: cal=${c}  client=${cl}`);
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const detail = args.includes("--detail");
  const clientOnly = args.includes("--client");
  const filter = args.filter((a) => !a.startsWith("--"));

  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8")) as {
    reports: ManifestEntry[];
  };
  let entries = manifest.reports;
  if (filter.length) {
    entries = entries.filter((e) =>
      filter.some((f) => e.id.includes(f) || e.filename.includes(f)),
    );
  }

  const allReports: ExtractionForensicReport[] = [];

  console.log("EXTRACTION VALIDATION HARNESS");
  console.log(`reports: ${entries.map((e) => e.id).join(", ")}`);
  console.log("");

  for (const entry of entries) {
    if (!existsSync(join(VALIDATION_DIR, entry.filename))) {
      console.log(`${entry.id}\nSKIP (PDF missing)\n`);
      continue;
    }

    const cal = await extractOne(entry, "calibration");
    allReports.push(cal);

    if (detail) {
      console.log(formatForensicDetail(cal));
    } else {
      console.log(formatHarnessBlock(cal));
      console.log("");
    }

    if (clientOnly || entry.lab === "GIA") {
      const client = await extractOne(entry, "client");
      allReports.push(client);
      if (detail) {
        console.log(formatForensicDetail(client));
        if (entry.id === "6233708773") {
          printLifecycleCompare(cal, client);
        }
      } else {
        console.log(`[client ${entry.id}]`);
        console.log(formatHarnessBlock(client));
        console.log("");
        if (entry.id === "6233708773") {
          printLifecycleCompare(cal, client);
          console.log("");
        }
      }
    }
  }

  const passCount = allReports.filter((r) => r.harnessPass).length;
  console.log(`${"=".repeat(40)}`);
  console.log(`SUMMARY: ${passCount}/${allReports.length} passed (harness)`);

  const byStyle = new Map<string, ExtractionForensicReport[]>();
  for (const r of allReports) {
    const style = r.reportStyle ?? "UNCLASSIFIED";
    const list = byStyle.get(style) ?? [];
    list.push(r);
    byStyle.set(style, list);
  }
  for (const [style, reports] of [...byStyle.entries()].sort()) {
    console.log(`\n${style}`);
    for (const r of reports) {
      const miss = r.missingFields.filter(
        (f) => !r.optionalMissingFields.includes(f),
      );
      console.log(
        `  ${r.reportId} (${r.mode}) core=${r.corePass ? "PASS" : "FAIL"} deep=${r.deepPass ? "PASS" : "PARTIAL"} harness=${r.harnessPass ? "PASS" : "FAIL"}${miss.length ? ` missing=${miss.join(",")}` : ""}`,
      );
    }
  }

  writeFileSync(
    OUT_JSON,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        summary: { passed: passCount, total: allReports.length },
        reports: allReports,
      },
      null,
      2,
    ),
  );
  console.log(`JSON: ${OUT_JSON}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
