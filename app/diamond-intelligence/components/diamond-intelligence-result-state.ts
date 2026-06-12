import type { ClientUploadPhase } from "./ReportUploadDock";
import type { V3RenderPhase } from "./v3-presentation";

export type DiamondIntelligenceResultState =
  | "NO_RESULT"
  | "PROCESSING"
  | "PARTIAL"
  | "SUCCESS"
  | "ERROR";

export function resolveDiamondIntelligenceResultState(input: {
  uploadPhase: ClientUploadPhase;
  uploadError: string | null;
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
