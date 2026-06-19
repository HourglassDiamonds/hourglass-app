import type { DiamondIntelligenceUploadErrorKind } from "./upload-format-policy";
import type { ReportUploadMimeHint } from "./upload-mime-hint";

export class DiamondIntelligenceUploadError extends Error {
  readonly kind: DiamondIntelligenceUploadErrorKind;
  readonly code?: string;
  readonly retryAfterSeconds?: number;
  readonly uploadMeta?: Partial<ReportUploadMimeHint>;

  constructor(
    message: string,
    kind: DiamondIntelligenceUploadErrorKind,
    code?: string,
    retryAfterSeconds?: number,
    uploadMeta?: Partial<ReportUploadMimeHint>,
  ) {
    super(message);
    this.name = "DiamondIntelligenceUploadError";
    this.kind = kind;
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
    this.uploadMeta = uploadMeta;
  }
}

export function isDiamondIntelligenceUploadError(
  err: unknown,
): err is DiamondIntelligenceUploadError {
  return err instanceof DiamondIntelligenceUploadError;
}
