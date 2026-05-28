import { extractFieldsFromReportText } from "../lib/calibration-library/extract-from-text.ts";

const sample = `59%
34.1°
40.8°
43%
14%
Pointed
60.2%
Measurements 8.01 - 8.05 X 4.84 MM
LG773657228
Girdle Medium to Slightly Thick (Faceted)
Polish Excellent`;

const r = extractFieldsFromReportText(sample, { textMethod: "ocr" });

const ok =
  r.fields.lowerHalfPercent === "" &&
  r.fields.starLengthPercent === "14" &&
  r.igiInternal?.pavilionDepthPercent === "43" &&
  r.fields.girdle === "Medium to Slightly Thick (Faceted)";

console.log(
  JSON.stringify(
    {
      ok,
      lowerHalfPercent: r.fields.lowerHalfPercent,
      starLengthPercent: r.fields.starLengthPercent,
      pavilionDepthPercent: r.igiInternal?.pavilionDepthPercent,
      girdle: r.fields.girdle,
      tablePercent: r.fields.tablePercent,
      depthPercent: r.fields.depthPercent,
    },
    null,
    2,
  ),
);

process.exit(ok ? 0 : 1);
