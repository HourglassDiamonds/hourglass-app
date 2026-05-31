import { readFileSync } from "fs";
import { join } from "path";
import { emptyReportFields } from "@/lib/calibration-library/fields";
import { applyGiaClientPavilionDiagramOcr } from "@/lib/calibration-library/parsers/gia/gia-diagram-extraction";

const id = process.argv[2] ?? "6233708773";
const pdf = readFileSync(
  join("data/light-performance-calibration/validation-reports", `GIA-${id}.pdf`),
);

async function main() {
  const started = Date.now();
  const fields = {
    ...emptyReportFields(),
    tablePercent: "64",
    depthPercent: "58.4",
    crownAngle: "36",
  };
  const result = await applyGiaClientPavilionDiagramOcr(pdf, fields, (k, v) => {
    fields[k] = v;
  });
  console.log(JSON.stringify({ ms: Date.now() - started, result, pavilion: fields.pavilionAngle }));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
