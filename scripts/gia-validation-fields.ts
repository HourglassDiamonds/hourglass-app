import { readFileSync } from "fs";
import { runCalibrationUploadExtraction } from "@/lib/calibration-library/extract-upload-pipeline";

async function main() {
  const id = process.argv[2] ?? "6233708773";
  const mode = process.argv[3] ?? "client";
  const bytes = readFileSync(
    `data/light-performance-calibration/validation-reports/GIA-${id}.pdf`,
  );
  const r = await runCalibrationUploadExtraction({
    bytes,
    mime: "application/pdf",
    reportNumber: id,
    lab: "GIA",
    mode: mode === "client" ? "client" : undefined,
  });
  console.log(id, mode, {
    timedOut: r.timedOut,
    totalMs: r.timings.totalMs,
    imageOcrMs: r.timings.imageOcrMs,
    table: r.fields.tablePercent || "-",
    depth: r.fields.depthPercent || "-",
    crown: r.fields.crownAngle || "-",
    pavilion: r.fields.pavilionAngle || "-",
    lower: r.fields.lowerHalfPercent || "-",
    girdle: r.fields.girdle || "-",
    culet: r.fields.culet || "-",
  });
}

main().catch(console.error);
