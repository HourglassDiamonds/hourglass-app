import { readFileSync } from "fs";
import { runCalibrationUploadExtraction } from "@/lib/calibration-library/extract-upload-pipeline";

async function main() {
  const bytes = readFileSync(
    "data/light-performance-calibration/validation-reports/GIA-6233708773.pdf",
  );
  const r = await runCalibrationUploadExtraction({
    bytes,
    mime: "application/pdf",
    reportNumber: "6233708773",
    lab: "GIA",
    mode: "client",
  });
  console.log(JSON.stringify({
    timedOut: r.timedOut,
    method: r.timings,
    fields: {
      table: r.fields.tablePercent,
      depth: r.fields.depthPercent,
      crown: r.fields.crownAngle,
      pavilion: r.fields.pavilionAngle,
      lower: r.fields.lowerHalfPercent,
      girdle: r.fields.girdle,
      culet: r.fields.culet,
    },
    imageOcrMs: r.timings.imageOcrMs,
    totalMs: r.timings.totalMs,
  }, null, 2));
}

main().catch(console.error);
