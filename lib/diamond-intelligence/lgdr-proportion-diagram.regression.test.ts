import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { interpretUploadedReport } from "@/lib/diamond-intelligence/interpret-uploaded-report";
import { needsPartialGradeReview } from "@/app/diamond-intelligence/components/v3-presentation";

const PDF_2536297567 =
  process.env.GIA_2536297567_PDF ??
  "C:/Users/justi/OneDrive/Desktop/2536297567.pdf";

if (existsSync(PDF_2536297567)) {
  describe("GIA LGDR 2536297567 proportion diagram regression", () => {
    it("extracts diagram proportions and reaches full/deep capability", async () => {
      process.env.CLIENT_DOCUMENT_EXTRACT_TIMEOUT_MS ??= "90000";
      const bytes = readFileSync(PDF_2536297567);
      const result = await interpretUploadedReport({
        bytes,
        mime: "application/pdf",
        sourceFilename: "2536297567.pdf",
      });

      assert.equal(result.ok, true, result.ok ? "" : result.error);
      assert.equal(result.decision.tier, "full");
      assert.equal(result.partial, false);

      const f = result.finalized.fields;
      assert.equal(f.tablePercent, "59");
      assert.equal(f.depthPercent, "61.5");
      assert.equal(f.crownAngle, "35.5");
      assert.equal(f.pavilionAngle, "41");
      assert.match(f.culet ?? "", /^none$/i);
      assert.ok(f.girdle?.trim(), "expected girdle");

      assert.equal(result.interpretation.gradeHints?.color, "D");
      assert.equal(result.interpretation.gradeHints?.clarity, "VVS1");
      assert.equal(
        needsPartialGradeReview({
          gradeHints: result.interpretation.gradeHints,
        }),
        false,
      );

      const supportsLevel = result.interpretation.capability?.supportsLevel;
      assert.ok(
        supportsLevel === "proportion" || supportsLevel === "deep",
        `supportsLevel=${supportsLevel}`,
      );
    });
  });
}
