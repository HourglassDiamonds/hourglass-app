import type { DiamondIntelligenceUploadErrorKind } from "./upload-format-policy";

export class DiamondIntelligenceUploadError extends Error {
  readonly kind: DiamondIntelligenceUploadErrorKind;
  readonly code?: string;

  constructor(
    message: string,
    kind: DiamondIntelligenceUploadErrorKind,
    code?: string,
  ) {
    super(message);
    this.name = "DiamondIntelligenceUploadError";
    this.kind = kind;
    this.code = code;
  }
}

export function isDiamondIntelligenceUploadError(
  err: unknown,
): err is DiamondIntelligenceUploadError {
  return err instanceof DiamondIntelligenceUploadError;
}
