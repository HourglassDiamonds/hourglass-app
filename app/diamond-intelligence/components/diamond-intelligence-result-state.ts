import type { ClientUploadPhase } from "./ReportUploadDock";
import type { V3RenderPhase } from "./v3-presentation";
import type { DiamondIntelligenceUploadErrorKind } from "@/lib/diamond-intelligence/upload-format-policy";

export type DiamondIntelligenceResultState =
  | "NO_RESULT"
  | "PROCESSING"
  | "PARTIAL"
  | "SUCCESS"
  | "ERROR"
  | "RATE_LIMITED";

export function resolveDiamondIntelligenceResultState(input: {
  uploadPhase: ClientUploadPhase;
  uploadError: string | null;
  uploadErrorKind?: DiamondIntelligenceUploadErrorKind | null;
  hasReport: boolean;
  partialListing: boolean;
  v3RenderPhase: V3RenderPhase;
  canRenderFullResult: boolean;
}): DiamondIntelligenceResultState {
  if (
    input.uploadPhase === "reading" ||
    input.uploadPhase === "checking" ||
    input.uploadPhase === "building"
  ) {
    return "PROCESSING";
  }

  if (input.uploadPhase === "error" && input.uploadError) {
    if (input.uploadErrorKind === "unsupported_format") {
      return "NO_RESULT";
    }
    if (input.uploadErrorKind === "rate_limited") {
      return "RATE_LIMITED";
    }
    return "ERROR";
  }

  if (input.v3RenderPhase === "partial" && input.hasReport) {
    return "PARTIAL";
  }

  if (
    input.v3RenderPhase === "full" &&
    input.hasReport &&
    input.canRenderFullResult
  ) {
    return "SUCCESS";
  }

  if (input.v3RenderPhase === "full" && input.hasReport && !input.canRenderFullResult) {
    return "ERROR";
  }

  if (input.partialListing) {
    return "NO_RESULT";
  }

  return "NO_RESULT";
}

/** Suppress upload-dock inline error when the editorial V3 failure card is showing. */
export function shouldShowUploadInlineError(input: {
  resultState: DiamondIntelligenceResultState;
  errorMessage?: string | null;
}): boolean {
  return (
    Boolean(input.errorMessage?.trim()) &&
    input.resultState !== "ERROR" &&
    input.resultState !== "RATE_LIMITED"
  );
}
