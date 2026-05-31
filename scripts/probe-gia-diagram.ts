import { readFileSync } from "fs";
import { join } from "path";
import { extractGiaProportionDiagram } from "@/lib/calibration-library/parsers/gia/gia-diagram-extraction";

const id = process.argv[2] ?? "6233708773";
const pdf = readFileSync(
  join("data/light-performance-calibration/validation-reports", `GIA-${id}.pdf`),
);

async function main() {
  const report = await extractGiaProportionDiagram(pdf, { tryLayouts: true });
  console.log(`located=${report.diagramLocated} ${report.locateReason}`);
  for (const f of report.fields) {
    console.log(
      `${f.field}: ${f.parsedValue ?? "—"} [${f.confidence}] band=${f.bandId ?? "—"}`,
    );
    if (f.ocrText.trim()) {
      console.log(`  ocr: ${f.ocrText.replace(/\s+/g, " ").slice(0, 100)}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
