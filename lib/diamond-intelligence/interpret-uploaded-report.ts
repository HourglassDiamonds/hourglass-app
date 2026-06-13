import { runCalibrationUploadExtraction } from "@/lib/calibration-library/extract-upload-pipeline";
import { inferReportSourceFromUpload } from "@/lib/calibration-library/infer-report-source";
import {
  CalibrationTimeoutError,
  timeoutErrorMessage,
  validateCalibrationUpload,
  withTimeout,
} from "@/lib/calibration-library/runtime-guard";
import {
  CLIENT_INTERPRET_ROUTE_TIMEOUT_MS,
  CLIENT_UPLOAD_PIPELINE_TIMEOUT_MS,
} from "@/lib/calibration-library/runtime-limits";
import { isDiamondIntelligenceAcceptedMime } from "@/lib/diamond-intelligence/upload-validation";
import { toClientSafeInterpretationPayload } from "@/lib/diamond-intelligence/client-api";
import {
  getCachedClientInterpretation,
  setCachedClientInterpretation,
} from "@/lib/diamond-intelligence/client-interpret-cache";
import {
  CLIENT_PARTIAL_INTERPRETATION_NOTE,
  CLIENT_UPLOAD_INTERPRET_ERROR,
} from "@/lib/diamond-intelligence/client-interpret-messages";
import { classifyFinalized } from "@/lib/diamond-intelligence/client-interpretation-pipeline";
import { shouldPresentScoredCoreRead } from "@/lib/diamond-intelligence/client-presentation-gates";
import { parseReportGradeHints, buildReportGradeHintSource } from "@/lib/diamond-intelligence/report-grade-hints";
import type { ClientSafeInterpretationPayload } from "@/lib/diamond-intelligence/client-api";
import type { ClientInterpretationDecision } from "@/lib/diamond-intelligence/client-interpretation-pipeline";
import type { UploadExtractionOutput } from "@/lib/calibration-library/extract-upload-pipeline";

export type InterpretUploadedReportInput = {
  bytes: Buffer;
  mime: string;
  sourceFilename?: string;
};

export type InterpretUploadedReportSuccess = {
  ok: true;
  interpretation: ClientSafeInterpretationPayload;
  partial: boolean;
  cacheHit: boolean;
  finalized: UploadExtractionOutput;
  decision: ClientInterpretationDecision;
};

export type InterpretUploadedReportFailure = {
  ok: false;
  error: string;
  httpStatus: number;
  timedOut?: boolean;
  pipelineError?: string;
  finalized?: UploadExtractionOutput;
  decision?: ClientInterpretationDecision;
};

export type InterpretUploadedReportResult =
  | InterpretUploadedReportSuccess
  | InterpretUploadedReportFailure;

export async function interpretUploadedReport(
  input: InterpretUploadedReportInput,
): Promise<InterpretUploadedReportResult> {
  const { bytes, mime, sourceFilename } = input;

  if (!isDiamondIntelligenceAcceptedMime(mime)) {
    return {
      ok: false,
      error: "Please upload a PDF or image of your lab report.",
      httpStatus: 400,
    };
  }

  const uploadCheck = await validateCalibrationUpload(bytes, mime);
  if (!uploadCheck.ok) {
    return {
      ok: false,
      error: uploadCheck.error,
      httpStatus: 400,
    };
  }

  const cached = getCachedClientInterpretation(bytes);
  if (cached) {
    return {
      ok: true,
      interpretation: cached,
      partial: false,
      cacheHit: true,
      finalized: {} as UploadExtractionOutput,
      decision: {
        tier: "full",
        useful: true,
        sufficient: true,
        snapshot: {
          lab: cached.metadata.lab,
          reportNumber: cached.metadata.reportNumber,
          shape: "",
          carat: "",
          measurements: "",
          table: "",
          depth: "",
          crownAngle: "",
          pavilionAngle: "",
          polish: "",
          symmetry: "",
          fluorescence: "",
          missingFields: [],
        },
      },
    };
  }

  try {
    const finalized = await withTimeout(
      runCalibrationUploadExtraction({
        bytes,
        mime,
        reportSource: inferReportSourceFromUpload(mime, false),
        mode: "client",
        initialPipelineNotices: [],
        pipelineTimeoutMs: CLIENT_UPLOAD_PIPELINE_TIMEOUT_MS,
      }),
      CLIENT_INTERPRET_ROUTE_TIMEOUT_MS,
      "diamond-intelligence-interpret",
    );

    const decision = classifyFinalized(finalized);

    if (decision.tier === "failure") {
      return {
        ok: false,
        error: CLIENT_UPLOAD_INTERPRET_ERROR,
        httpStatus: 422,
        finalized,
        decision,
        timedOut: finalized.timedOut,
        pipelineError: finalized.pipelineError,
      };
    }

    const partial = decision.tier === "partial";
    const gradeHints = parseReportGradeHints(
      buildReportGradeHintSource({
        reportGradeHintText: finalized.reportGradeHintText,
        rawTextSnippet: finalized.rawTextSnippet?.trim(),
        warnings: finalized.warnings,
      }) ?? "",
    );
    const suppressPartialConsumerNote = shouldPresentScoredCoreRead({
      fields: finalized.fields,
      gradeHints,
    });
    const statusNote =
      partial && !suppressPartialConsumerNote
        ? CLIENT_PARTIAL_INTERPRETATION_NOTE
        : undefined;

    const interpretation = toClientSafeInterpretationPayload(
      finalized,
      undefined,
      {
        clientStatusNote: statusNote,
        partial,
        includeDevDiagnostics: process.env.NODE_ENV === "development",
      },
    );

    if (decision.tier === "full") {
      setCachedClientInterpretation(bytes, interpretation);
    }

    return {
      ok: true,
      interpretation,
      partial,
      cacheHit: false,
      finalized,
      decision,
    };
  } catch (err) {
    const timedOut = err instanceof CalibrationTimeoutError;
    return {
      ok: false,
      error: CLIENT_UPLOAD_INTERPRET_ERROR,
      httpStatus: timedOut ? 504 : 500,
      timedOut,
      pipelineError: timeoutErrorMessage(err),
    };
  }
}
