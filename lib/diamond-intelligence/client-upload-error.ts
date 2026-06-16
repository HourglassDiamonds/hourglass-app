import type { DiamondIntelligenceUploadErrorKind } from "./upload-format-policy";

export class DiamondIntelligenceUploadError extends Error {
  readonly kind: DiamondIntelligenceUploadErrorKind;
  readonly code?: string;
  readonly retryAfterSeconds?: number;

  constructor(
    message: string,
    kind: DiamondIntelligenceUploadErrorKind,
    code?: string,
    retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "DiamondIntelligenceUploadError";
    this.kind = kind;
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export function isDiamondIntelligenceUploadError(
  err: unknown,
): err is DiamondIntelligenceUploadError {
  return err instanceof DiamondIntelligenceUploadError;
}
