import { readFileSync } from "node:fs";
import { interpretUploadedReport } from "../lib/diamond-intelligence/interpret-uploaded-report.ts";

const specs = [
  {
    id: "7496507350",
    path: "C:/Users/justi/OneDrive/Desktop/7496507350.pdf",
    mime: "application/pdf",
  },
  {
    id: "360796191",
    path: "C:/Users/justi/OneDrive/Desktop/360796191.pdf",
    mime: "application/pdf",
  },
  {
    id: "555278130",
    path: "C:/Users/justi/OneDrive/Desktop/555278130.pdf",
    mime: "application/pdf",
  },
];

for (const spec of specs) {
  process.stdout.write(`\n========== ${spec.id} ==========\n`);
  const bytes = readFileSync(spec.path);
  const started = Date.now();
  const result = await interpretUploadedReport({
    bytes,
    mime: spec.mime,
    sourceFilename: `${spec.id}.pdf`,
  });
  const ms = Date.now() - started;

  if (!result.ok) {
    const finalized = result.finalized;
  const fields = finalized?.fields ?? {};
    const presentKeys = Object.keys(fields).filter((k) => fields[k]);
    console.log(
      JSON.stringify(
        {
          tag: "[DI interpret debug] FAIL",
          reportNumber: spec.id,
          ok: result.ok,
          httpStatus: result.httpStatus,
          error: result.error,
          timedOut: result.timedOut,
          pipelineError: result.pipelineError,
          tier: result.decision?.tier,
          useful: result.decision?.useful,
          sufficient: result.decision?.sufficient,
          lab: finalized?.metadata?.lab ?? result.decision?.snapshot?.lab,
          parserFamily: finalized?.parserFamily,
          reportFormat: finalized?.reportFormat,
          diagramOcrTimedOut: finalized?.diagramOcrTimedOut,
          warnings: finalized?.warnings,
          fieldsKeys: presentKeys,
          snapshot: result.decision?.snapshot,
          gradeHintText: finalized?.reportGradeHintText?.slice(0, 240),
          ms,
        },
        null,
        2,
      ),
    );
    continue;
  }

  const interpretation = result.interpretation;
  const finalized = result.finalized;
  const fields = finalized?.fields ?? {};
  console.log(
    JSON.stringify(
      {
        tag: "[DI interpret debug] OK",
        reportNumber: spec.id,
        ok: result.ok,
        partial: result.partial,
        cacheHit: result.cacheHit,
        tier: result.decision?.tier,
        useful: result.decision?.useful,
        sufficient: result.decision?.sufficient,
        lab: interpretation.metadata.lab,
        reportFormat: interpretation.metadata.reportFormat,
        parserFamily: finalized?.parserFamily,
        color: interpretation.gradeHints?.color,
        clarity: interpretation.gradeHints?.clarity,
        capability: interpretation.capability,
        recommendation:
          interpretation.decisionProfile?.overallRecommendation?.band,
        scoreEligible:
          interpretation.devDiagnostics?.extractionCompleteness?.scoreEligible,
        fieldsCount: Object.values(fields).filter(Boolean).length,
        table: fields.tablePercent,
        depth: fields.depthPercent,
        crown: fields.crownAngle,
        pavilion: fields.pavilionAngle,
        warnings: finalized?.warnings,
        ms,
      },
      null,
      2,
    ),
  );
}
