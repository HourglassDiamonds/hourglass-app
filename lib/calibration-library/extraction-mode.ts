/** Upload extraction mode — client path must not change calibration/admin defaults. */
export type ExtractionPipelineMode = "calibration" | "client";

export function isClientExtractionMode(
  mode: ExtractionPipelineMode | undefined,
): boolean {
  return mode === "client";
}
