import { readFileSync } from "fs";
import { ocrGcal8xPdfRegions } from "../lib/calibration-library/gcal-image-ocr";

async function main() {
  const path =
    process.argv[2] ??
    "data/light-performance-calibration/uploads/1779546949531-353466126.pdf";
  const pdf = readFileSync(path);
  await ocrGcal8xPdfRegions(pdf, { reportNumber: "LG353466126" });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
