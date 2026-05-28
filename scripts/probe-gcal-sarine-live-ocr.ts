import { readFileSync } from "fs";
import { runScriptWithTimeout } from "../lib/calibration-library/runtime-guard";
import { SCRIPT_DEFAULT_TIMEOUT_MS } from "../lib/calibration-library/runtime-limits";
import { emptyReportFields } from "../lib/calibration-library/fields";
import { extractFieldsFromReportText } from "../lib/calibration-library/extract-from-text";
import { extractTextFromDocument } from "../lib/calibration-library/document-extract";
import {
  applyGcalSarineProportionImageOcr,
  needsGcalSarineProportionImageOcr,
  ocrGcalSarineProportionRegionWithDiagnostics,
} from "../lib/calibration-library/parsers/gcal/gcal-sarine-image-ocr";

async function main() {
  const path =
    process.argv[2] ??
    "data/light-performance-calibration/uploads/1779553658775-G1360796191.pdf";
  const bytes = readFileSync(path);
  const doc = await extractTextFromDocument(bytes, "application/pdf");
  const parsed = extractFieldsFromReportText(doc.text, {
    lab: "GCAL",
    textMethod: doc.method,
    pdfTextLayerLength: doc.pdfTextLayerLength,
  });
  console.log("after text parse", parsed.parserType, parsed.fields);

  const { text, diagnostics } = await ocrGcalSarineProportionRegionWithDiagnostics(
    bytes,
    { reportNumber: "LG360796191" },
  );
  console.log("ocr diagnostics", JSON.stringify(diagnostics, null, 2));
  console.log("ocr text preview", text.slice(0, 200));

  const fields = { ...parsed.fields };
  const internal = parsed.gcalInternal ?? {};
  const setField = (key: keyof typeof fields, value: string) => {
    if (value.trim() && !fields[key].trim()) fields[key] = value.trim();
  };
  const { recoveredFields } = await applyGcalSarineProportionImageOcr(
    bytes,
    doc.text,
    fields,
    internal,
    setField as never,
    { reportNumber: "LG360796191", parserPathUsed: parsed.parserType },
  );
  console.log("final fields", fields);
  console.log("recovered", recoveredFields);
  console.log("needs gate after grading", needsGcalSarineProportionImageOcr(parsed.fields));
}

runScriptWithTimeout(main, SCRIPT_DEFAULT_TIMEOUT_MS, "probe-gcal-sarine-live-ocr");
