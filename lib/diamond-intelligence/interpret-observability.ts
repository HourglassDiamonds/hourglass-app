import {
  SCORE_ELIGIBLE_CORE_KEYS,
  assessExtractionCompleteness,
} from "@/lib/diamond-intelligence/extraction-completeness";
import type { UploadExtractionOutput } from "@/lib/calibration-library/extract-upload-pipeline";

/**
 * Narrow production interpret observability — no PDF bytes, PII, or full payloads.
 */
export function logDiamondIntelligenceInterpretObservability(input: {
  finalized: UploadExtractionOutput;
  timedOut?: boolean;
  httpStatus?: number;
}): void {
  try {
    const fields = input.finalized.fields;
    const completeness = assessExtractionCompleteness({ fields });
    const corePopulated = SCORE_ELIGIBLE_CORE_KEYS.filter((k) =>
      Boolean(fields[k]?.trim()),
    );
    const diagramOcrStarted =
      Boolean(input.finalized.ocrAttempted) ||
      (input.finalized.timings?.imageOcrMs ?? 0) > 0 ||
      Boolean(input.finalized.gcalSarineDiagramProportionWait);
    const diagramOcrCompleted =
      diagramOcrStarted &&
      !input.finalized.diagramOcrTimedOut &&
      !input.timedOut;

    let timeoutErrorCategory: string | null = null;
    if (input.finalized.diagramOcrTimedOut) {
      timeoutErrorCategory = "diagram_ocr_timeout";
    } else if (input.timedOut || input.finalized.timedOut) {
      timeoutErrorCategory = "pipeline_timeout";
    } else if (input.finalized.pipelineError?.trim()) {
      timeoutErrorCategory = "pipeline_error";
    }

    console.info("[di-interpret-observability]", {
      laboratory: input.finalized.metadata.lab ?? null,
      parserFamily: input.finalized.parserType ?? null,
      diagramOcrStarted,
      diagramOcrCompleted,
      imageOcrElapsedMs: input.finalized.timings?.imageOcrMs ?? 0,
      coreProportionFieldsPopulated: corePopulated,
      scoreEligible: completeness.scoreEligible,
      timeoutErrorCategory,
      httpStatus: input.httpStatus ?? null,
    });
  } catch {
    // Observability must never affect interpret outcomes.
  }
}
