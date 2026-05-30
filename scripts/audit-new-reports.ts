/**
 * One-off audit for newly acquired validation PDFs. Developer-only, no production wiring.
 */
import { readFileSync, writeFileSync } from "fs";
import { runCalibrationUploadExtraction } from "@/lib/calibration-library/extract-upload-pipeline";
import { extractTextFromDocument } from "@/lib/calibration-library/document-extract";
import { extractFieldsFromReportText } from "@/lib/calibration-library/extract-from-text";
import { detectReportFamily } from "@/lib/calibration-library/parsers/router";

const REPORTS = [
  {
    id: "LG636401995",
    path: "C:/Users/justi/OneDrive/Desktop/LG636401995.pdf",
    lab: "IGI",
  },
  {
    id: "GIA2496027047",
    path: "C:/Users/justi/OneDrive/Desktop/GIA2496027047.pdf",
    lab: "GIA",
  },
  {
    id: "GIA6233708773",
    path: "C:/Users/justi/OneDrive/Desktop/GIA6233708773.pdf",
    lab: "GIA",
  },
  {
    id: "LG360796192",
    path: "C:/Users/justi/OneDrive/Desktop/GC360796192.pdf",
    lab: "GCAL",
  },
] as const;

const requested = process.argv.slice(2);
const targets = requested.length
  ? REPORTS.filter((r) => requested.some((t) => r.id.includes(t) || t === r.id))
  : REPORTS;

async function auditOne(r: (typeof REPORTS)[number]) {
  const bytes = readFileSync(r.path);
  const out: Record<string, unknown> = { reportId: r.id, labHint: r.lab };

  const doc = await extractTextFromDocument(bytes, "application/pdf", {
    mode: "calibration",
  });
  const fam = detectReportFamily(doc.text || "", { lab: r.lab });
  out.detection = {
    parserType: fam.parserType,
    lab: fam.lab,
    pdfTextLayerLength: doc.pdfTextLayerLength,
    textMethod: doc.method,
    textLength: doc.text?.length ?? 0,
    textSnippet: (doc.text || "").slice(0, 1200),
  };

  const textOnly = extractFieldsFromReportText(doc.text || "", {
    lab: r.lab,
    reportNumber: r.id,
    textMethod: doc.method,
  });
  out.textParseOnly = {
    fields: textOnly.fields,
    confidence: textOnly.confidence,
    warnings: textOnly.warnings,
    parserType: textOnly.parserType,
  };

  for (const mode of ["calibration", "client"] as const) {
    const result = await runCalibrationUploadExtraction({
      bytes,
      mime: "application/pdf",
      reportSource: "pdf-upload",
      reportNumber: r.id,
      lab: r.lab,
      mode,
      collectDiagnostics: true,
    });
    out[mode] = {
      parserPathUsed: result.parserPathUsed,
      textMethod: result.textMethod,
      usedImageOcr: result.usedImageOcr,
      ocrAttempted: result.ocrAttempted,
      ocrCompleted: result.ocrCompleted,
      eligible: result.eligible,
      excluded: result.excluded,
      timedOut: result.timedOut,
      warnings: result.warnings,
      fields: result.fields,
      confidence: result.confidence,
      timings: result.timings,
      diagnostics: result.diagnostics,
    };
  }

  return out;
}

async function main() {
  const results: Record<string, unknown>[] = [];
  for (const r of targets) {
    console.log(`Auditing ${r.id}...`);
    results.push(await auditOne(r));
    console.log(`Done ${r.id}`);
  }
  const outPath = "data/light-performance-calibration/audit-new-reports-output.json";
  writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log(`Wrote ${outPath} (${results.length} reports)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
