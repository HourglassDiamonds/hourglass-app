import { readFileSync } from "fs";
import {
  ocrGiaFacsimileDiagramRegion,
  ocrGiaFacsimileFullPages,
} from "@/lib/calibration-library/parsers/gia/gia-facsimile-image-ocr";
import { extractGiaProportionDiagram } from "@/lib/calibration-library/parsers/gia/gia-diagram-extraction";

async function main() {
  const bytes = readFileSync(
    "data/light-performance-calibration/validation-reports/GIA-6233708773.pdf",
  );
  const full = await ocrGiaFacsimileFullPages(bytes);
  console.log("full OCR len", full.text.length);
  console.log(full.text);
  console.log("\n--- diagram region ---\n");
  const region = await ocrGiaFacsimileDiagramRegion(bytes);
  console.log("region len", region.text.length);
  for (const t of region.cropTexts) {
    if (/80|girdle|thin|medium|lower/i.test(t)) {
      console.log("HIT:", t.slice(0, 300));
    }
  }
  const diagram = await extractGiaProportionDiagram(bytes);
  for (const f of diagram.fields) {
    console.log(f.field, f.parsedValue, f.confidence);
  }
}

main().catch(console.error);
