import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { parseXlsxWorkbook } from "../lib/continuum/client-memory/xlsx";
import {
  parseGellerRepairSkuSheet,
  rejectionCounts,
} from "../lib/continuum/repair-quoting/parse-export";

const CANDIDATES = [
  process.env.GELLER_REPAIR_SKU_XLSX,
  "C:/Users/justi/OneDrive/Desktop/RepairTaskSKUs.2026-08-26-17-29-10.xlsx",
  "C:/Users/justi/OneDrive/Desktop/RepairTaskSKUs.2026-08-26-17-29-10(1).xlsx",
  resolve(process.cwd(), "RepairTaskSKUs.2026-08-26-17-29-10.xlsx"),
].filter((path): path is string => Boolean(path));

function findExport(): string {
  for (const path of CANDIDATES) {
    if (existsSync(path)) return path;
  }
  throw new Error(
    "Geller RepairTaskSKUs xlsx not found. Set GELLER_REPAIR_SKU_XLSX or place the founder export on the Desktop.",
  );
}

const exportPath = findExport();
const bytes = readFileSync(exportPath);
const sha256 = createHash("sha256").update(bytes).digest("hex");
const workbook = parseXlsxWorkbook(new Uint8Array(bytes));
const sheet = workbook.sheets[0];
if (!sheet) throw new Error("Geller export has no sheets");
const parsed = parseGellerRepairSkuSheet(sheet, {
  exportFile: basename(exportPath),
  sha256,
});
const outPath = resolve(process.cwd(), "lib/continuum/repair-quoting/catalog.json");
const artifact = {
  source: parsed.source,
  absentColumns: ["Express", "JLRC"],
  importedCount: parsed.rows.length,
  rejectedCount: parsed.rejected.length,
  rejectionCounts: rejectionCounts(parsed.rejected),
  rows: parsed.rows,
};
writeFileSync(outPath, `${JSON.stringify(artifact)}\n`, "utf8");
process.stdout.write(
  [
    `export ${parsed.source.exportFile}`,
    `sha256 ${sha256}`,
    `sourceRows ${parsed.source.sourceRowCount}`,
    `imported ${parsed.rows.length}`,
    `rejected ${parsed.rejected.length}`,
    `reasons ${JSON.stringify(artifact.rejectionCounts)}`,
    `wrote ${outPath}`,
  ].join("\n") + "\n",
);
