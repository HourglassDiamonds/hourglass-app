import { readFileSync } from "fs";
import { extractPdfTextLayer } from "@/lib/calibration-library/extract-pdf-server";
import { ocrPdfBuffer, renderPdfPagePngAtScale } from "@/lib/calibration-library/ocr";

async function test(path: string) {
  console.log("\n===", path.split(/[/\\]/).pop(), "===");
  const bytes = readFileSync(path);
  const layer = await extractPdfTextLayer(bytes);
  console.log("text layer pages:", layer.pageCount, "chars:", layer.text.length);
  console.log("dossier:", /dossier/i.test(layer.text));
  console.log("preview:", layer.text.slice(0, 500).replace(/\n/g, "\\n"));

  const r = await renderPdfPagePngAtScale(bytes, 1, 5);
  console.log("render:", r ? `OK ${r.width}x${r.height}` : "FAIL");

  const ocr = await ocrPdfBuffer(bytes);
  console.log("ocr ok:", ocr.ok, "len:", ocr.text.length);
  if (ocr.text) console.log("ocr preview:", ocr.text.slice(0, 400));
}

async function main() {
  await test("data/light-performance-calibration/validation-reports/GIA-2496027047.pdf");
  await test("data/light-performance-calibration/validation-reports/GIA-6233708773.pdf");
}

main().catch(console.error);
