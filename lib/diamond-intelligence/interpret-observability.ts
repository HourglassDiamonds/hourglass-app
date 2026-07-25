import {
  SCORE_ELIGIBLE_CORE_KEYS,
  assessExtractionCompleteness,
} from "@/lib/diamond-intelligence/extraction-completeness";
import type { UploadExtractionOutput } from "@/lib/calibration-library/extract-upload-pipeline";
import {
  getOcrRuntimeProbeSnapshot,
  isOcrDisabledByEnv,
} from "@/lib/calibration-library/ocr";
import { randomUUID } from "node:crypto";

export type InterpretStageName =
  | "interpret-start"
  | "extraction-complete"
  | "diagram-ocr"
  | "interpret-complete"
  | "interpret-failed";

export type InterpretStageEvent = {
  stage: InterpretStageName;
  status: "start" | "complete" | "failed";
  elapsedMs?: number;
  errorCategory?: string | null;
  errorClass?: string | null;
};

/**
 * Narrow production interpret observability — no PDF bytes, PII, or full payloads.
 */
export function createInterpretRequestId(): string {
  return randomUUID();
}

export function logDiamondIntelligenceInterpretStage(input: {
  requestId: string;
  event: InterpretStageEvent;
  extras?: Record<string, unknown>;
}): void {
  try {
    const safeExtras: Record<string, unknown> = {};
    const allowed = new Set([
      "parserFamily",
      "ocrTransport",
      "imageOcrElapsedMs",
      "scoreEligible",
      "partial",
      "errorCategory",
      "errorClass",
    ]);
    for (const [k, v] of Object.entries(input.extras ?? {})) {
      if (allowed.has(k)) safeExtras[k] = v;
    }
    console.info("[di-interpret-stage]", {
      requestId: input.requestId,
      stage: input.event.stage,
      status: input.event.status,
      elapsedMs: input.event.elapsedMs ?? null,
      errorCategory: input.event.errorCategory ?? null,
      errorClass: input.event.errorClass ?? null,
      ...safeExtras,
    });
  } catch {
    // Observability must never affect interpret outcomes.
  }
}

export function logDiamondIntelligenceInterpretObservability(input: {
  finalized: UploadExtractionOutput;
  timedOut?: boolean;
  httpStatus?: number;
  requestId?: string;
}): void {
  try {
    const fields = input.finalized.fields;
    const completeness = assessExtractionCompleteness({ fields });
    const corePopulated = SCORE_ELIGIBLE_CORE_KEYS.filter((k) =>
      Boolean(fields[k]?.trim()),
    );
    const diagramOcrRequired =
      Boolean(input.finalized.gcalSarineDiagramProportionWait) ||
      Boolean(input.finalized.giaDiagramProportionWait);
    const diagramOcrStarted =
      Boolean(input.finalized.ocrAttempted) ||
      (input.finalized.timings?.imageOcrMs ?? 0) > 0 ||
      diagramOcrRequired;
    const ocrProbe = getOcrRuntimeProbeSnapshot();
    const infrastructureOcrUnavailable =
      diagramOcrRequired &&
      corePopulated.length === 0 &&
      (isOcrDisabledByEnv() ||
        (ocrProbe.checked && !ocrProbe.available) ||
        input.finalized.gcalSarineDiagramOcrFailure ===
          "F-ocr-runtime-unavailable");
    const diagramOcrCompleted =
      diagramOcrStarted &&
      !input.finalized.diagramOcrTimedOut &&
      !input.timedOut &&
      !infrastructureOcrUnavailable;

    let timeoutErrorCategory: string | null = null;
    let errorClass: string | null = null;
    if (infrastructureOcrUnavailable) {
      timeoutErrorCategory = "ocr_runtime_unavailable";
      errorClass = ocrProbe.error?.split(";")[0] ?? "ocr-unavailable";
    } else if (input.finalized.diagramOcrTimedOut) {
      timeoutErrorCategory = "diagram_ocr_timeout";
      errorClass = "CalibrationTimeoutError";
    } else if (input.timedOut || input.finalized.timedOut) {
      timeoutErrorCategory = "pipeline_timeout";
      errorClass = "CalibrationTimeoutError";
    } else if (input.finalized.pipelineError?.trim()) {
      timeoutErrorCategory = "pipeline_error";
      errorClass = "pipeline_error";
    } else if (input.finalized.gcalSarineDiagramOcrFailure?.trim()) {
      timeoutErrorCategory = "diagram_ocr_failure";
      errorClass = input.finalized.gcalSarineDiagramOcrFailure;
    }

    const sarine = input.finalized.gcalSarineOcrDiagnostics;
    const pageWidth = sarine?.pageWidth ?? null;
    const pageHeight = sarine?.pageHeight ?? null;
    const cropSucceeded = sarine?.cropSucceeded ?? null;
    const pageRendered = sarine?.pageRendered ?? null;
    const ocrTokenCount =
      typeof sarine?.ocrRawLength === "number" ? sarine.ocrRawLength : null;
    const imageNonBlank =
      pageRendered === true &&
      typeof pageWidth === "number" &&
      pageWidth > 0 &&
      typeof pageHeight === "number" &&
      pageHeight > 0 &&
      cropSucceeded !== false
        ? true
        : pageRendered === false
          ? false
          : null;

    console.info("[di-interpret-observability]", {
      requestId: input.requestId ?? null,
      laboratory: input.finalized.metadata.lab ?? null,
      parserFamily: input.finalized.parserType ?? null,
      diagramOcrRequired,
      diagramOcrStarted,
      diagramOcrCompleted,
      imageOcrElapsedMs: input.finalized.timings?.imageOcrMs ?? 0,
      pageWidth,
      pageHeight,
      imageNonBlank,
      ocrTokenCount,
      ocrTransport: ocrProbe.transport ?? null,
      ocrRuntimeAvailable: ocrProbe.available,
      coreProportionFieldsPopulated: corePopulated,
      populatedFieldKeys: Object.entries(fields)
        .filter(([, v]) => Boolean(v?.trim()))
        .map(([k]) => k),
      scoreEligible: completeness.scoreEligible,
      timeoutErrorCategory,
      errorClass,
      httpStatus: input.httpStatus ?? null,
    });
  } catch {
    // Observability must never affect interpret outcomes.
  }
}
