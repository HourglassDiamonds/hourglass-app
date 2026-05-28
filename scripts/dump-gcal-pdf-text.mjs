import { readFileSync } from "node:fs";
import { extractPdfTextLayer } from "../lib/calibration-library/extract-pdf-server.ts";

const path =
  process.argv[2] ??
  "data/light-performance-calibration/uploads/1779487121104-353466126.pdf";
const bytes = readFileSync(path);
const pdf = await extractPdfTextLayer(bytes);
console.log(pdf.text);
