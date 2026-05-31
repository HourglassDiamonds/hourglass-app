/**
 * Persist diagram-first extraction debug artifacts under
 * data/light-performance-calibration/debug/gia/<reportNumber>/.
 */
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import type { GiaDiagramExtractionReport } from "./gia-diagram-extraction";
import type { GiaReportStyle } from "./gia-report-style";

const DEBUG_ROOT = join(
  process.cwd(),
  "data/light-performance-calibration/debug/gia",
);

const VALIDATION_DEBUG_REPORTS = new Set([
  "2496027047",
  "6233708773",
  "6495746732",
  "6532930018",
  "1493739085",
  "6502274288",
  "2527039693",
]);

export function giaDiagramDebugEnabled(reportNumber?: string): boolean {
  if (process.env.CALIBRATION_EXTRACT_DEBUG === "1") return true;
  if (!reportNumber?.trim()) return false;
  return VALIDATION_DEBUG_REPORTS.has(reportNumber.trim());
}

export function exportGiaDiagramDebugArtifacts(input: {
  reportNumber: string;
  reportStyle: GiaReportStyle;
  pagePng: Buffer;
  diagramRegionPng?: Buffer | null;
  report: GiaDiagramExtractionReport;
  bandCropPngs?: Array<{ id: string; raw: Buffer; preprocessed?: Buffer }>;
}): string {
  const outDir = join(DEBUG_ROOT, input.reportNumber);
  mkdirSync(outDir, { recursive: true });

  writeFileSync(join(outDir, "page1-full.png"), input.pagePng);
  if (input.diagramRegionPng) {
    writeFileSync(join(outDir, "diagram-region.png"), input.diagramRegionPng);
  }

  for (const band of input.bandCropPngs ?? []) {
    writeFileSync(join(outDir, `${band.id}-crop.png`), band.raw);
    if (band.preprocessed) {
      writeFileSync(
        join(outDir, `${band.id}-preprocessed-ocr.png`),
        band.preprocessed,
      );
    }
    const ocrPath = join(outDir, `${band.id}-ocr.txt`);
    const bandReport = input.report.bands.find((b) => b.id === band.id);
    writeFileSync(ocrPath, bandReport?.text ?? "");
  }

  writeFileSync(
    join(outDir, "extraction-report.json"),
    JSON.stringify(
      {
        reportStyle: input.reportStyle,
        diagramLocated: input.report.diagramLocated,
        locateReason: input.report.locateReason,
        fields: input.report.fields,
        internal: input.report.internal,
      },
      null,
      2,
    ),
  );

  return outDir;
}
