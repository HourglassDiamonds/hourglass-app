import type { ClientSafeInterpretationPayload } from "./client-api";
import { CLIENT_INTERPRET_FETCH_TIMEOUT_MS } from "@/lib/calibration-library/runtime-limits";
import {
  CLIENT_PARTIAL_INTERPRETATION_NOTE,
  CLIENT_RATE_LIMIT_ERROR,
  CLIENT_UPLOAD_INTERPRET_ERROR,
} from "./client-interpret-messages";
import { shouldPresentScoredCoreRead } from "./client-presentation-gates";
import { DiamondIntelligenceUploadError } from "./client-upload-error";
import {
  buildReportUploadMimeHintFromApi,
  type ReportUploadMimeHint,
} from "./upload-mime-hint";
import {
  DI_UNSUPPORTED_FILE_TYPE_MESSAGE,
  isUnsupportedUploadValidationCode,
} from "./upload-format-policy";

export {
  CLIENT_PARTIAL_INTERPRETATION_NOTE,
  CLIENT_RATE_LIMIT_ERROR,
  CLIENT_UPLOAD_INTERPRET_ERROR,
} from "./client-interpret-messages";

export { DiamondIntelligenceUploadError, isDiamondIntelligenceUploadError } from "./client-upload-error";

export { CLIENT_INTERPRET_FETCH_TIMEOUT_MS } from "@/lib/calibration-library/runtime-limits";

export type InterpretUploadMeta = {
  mime?: string;
  normalizedMime?: string;
  originalMime?: string;
};

export type InterpretApiPayload = {
  ok?: boolean;
  error?: string;
  code?: string;
  partial?: boolean;
  interpretation?: ClientSafeInterpretationPayload;
  uploadMeta?: InterpretUploadMeta;
};

/** Parse Retry-After response header (seconds) for rate-limit UI. */
export function parseRetryAfterHeader(
  value: string | null | undefined,
): number | undefined {
  if (!value?.trim()) return undefined;
  const seconds = Number.parseInt(value.trim(), 10);
  if (!Number.isFinite(seconds) || seconds < 1) return undefined;
  return seconds;
}

export type ClientInterpretUploadResult = {
  interpretation: ClientSafeInterpretationPayload;
  partial: boolean;
};

/** Maps interpret API failure payloads to client-thrown errors. */
export function resolveInterpretUploadFailure(
  status: number,
  data: InterpretApiPayload,
  uploadMeta?: Partial<ReportUploadMimeHint>,
): Error {
  const code = typeof data.code === "string" ? data.code : undefined;
  const apiMeta =
    uploadMeta ?? buildReportUploadMimeHintFromApi(data.uploadMeta);
  if (status === 400 && isUnsupportedUploadValidationCode(code)) {
    return new DiamondIntelligenceUploadError(
      DI_UNSUPPORTED_FILE_TYPE_MESSAGE,
      "unsupported_format",
      code,
      undefined,
      apiMeta,
    );
  }

  if (status === 422 && code === "unsupported_report_format") {
    return new DiamondIntelligenceUploadError(
      typeof data.error === "string" && data.error.trim()
        ? data.error
        : "This report format is not currently supported by Diamond Intelligence.",
      "unsupported_report_format",
      code,
      undefined,
      apiMeta,
    );
  }

  if (status === 422) {
    return new DiamondIntelligenceUploadError(
      typeof data.error === "string" && data.error.trim()
        ? data.error
        : CLIENT_UPLOAD_INTERPRET_ERROR,
      "interpret_failure",
      code,
      undefined,
      apiMeta,
    );
  }

  return new Error(
    typeof data.error === "string" && data.error.trim()
      ? data.error
      : CLIENT_UPLOAD_INTERPRET_ERROR,
  );
}

export async function postReportForInterpretation(
  file: File,
): Promise<ClientInterpretUploadResult> {
  const fd = new FormData();
  fd.append("file", file);

  const controller = new AbortController();
  const timeoutId = window.setTimeout(
    () => controller.abort(),
    CLIENT_INTERPRET_FETCH_TIMEOUT_MS,
  );

  let res: Response;
  try {
    res = await fetch("/api/diamond-intelligence/interpret", {
      method: "POST",
      headers: { Accept: "application/json" },
      body: fd,
      signal: controller.signal,
    });
  } catch {
    throw new Error(CLIENT_UPLOAD_INTERPRET_ERROR);
  } finally {
    window.clearTimeout(timeoutId);
  }

  const contentType = res.headers.get("content-type") ?? "";
  const text = await res.text();

  if (
    !contentType.includes("application/json") &&
    !text.trimStart().startsWith("{")
  ) {
    throw new Error(CLIENT_UPLOAD_INTERPRET_ERROR);
  }

  let data: InterpretApiPayload;
  try {
    data = JSON.parse(text) as InterpretApiPayload;
  } catch {
    throw new Error(CLIENT_UPLOAD_INTERPRET_ERROR);
  }

  if (res.status === 429) {
    const code = typeof data.code === "string" ? data.code : undefined;
    if (code === "rate_limited") {
      throw new DiamondIntelligenceUploadError(
        typeof data.error === "string" && data.error.trim()
          ? data.error
          : CLIENT_RATE_LIMIT_ERROR,
        "rate_limited",
        code,
        parseRetryAfterHeader(res.headers.get("retry-after")),
      );
    }
    throw new Error(data.error ?? CLIENT_RATE_LIMIT_ERROR);
  }

  if (!res.ok || !data.ok || !data.interpretation) {
    throw resolveInterpretUploadFailure(
      res.status,
      data,
      buildReportUploadMimeHintFromApi(data.uploadMeta),
    );
  }

  const interpretation = data.interpretation;
  const partial = Boolean(
    data.partial ||
      interpretation.partial ||
      interpretation.clientStatusNote,
  );

  if (partial && !interpretation.clientStatusNote) {
    const suppressPartialConsumerNote = shouldPresentScoredCoreRead({
      fields: interpretation.extractedFields,
      gradeHints: interpretation.gradeHints,
    });
    if (!suppressPartialConsumerNote) {
      interpretation.clientStatusNote = CLIENT_PARTIAL_INTERPRETATION_NOTE;
      interpretation.partial = true;
    }
  }

  return { interpretation, partial };
}
