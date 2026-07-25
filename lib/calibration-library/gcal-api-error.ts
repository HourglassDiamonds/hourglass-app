/** JSON-safe logging and error payloads for calibration extract-file API. */

export type GcalApiErrorContext = {
  parserPath?: string;
  reportNumber?: string;
  ocrStarted?: boolean;
  ocrCompleted?: boolean;
  debugImageWrite?: string;
  phase?: string;
};

export type GcalApiErrorPayload = GcalApiErrorContext & {
  error: string;
  stack?: string;
  name?: string;
};

function jsonSafeReplacer(_key: string, value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (Buffer.isBuffer(value)) return `[Buffer ${value.length}b]`;
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }
  return value;
}

/** Strip non-JSON values and break circular references before logging or responding. */
export function toJsonSafe<T>(value: T): T {
  try {
    return JSON.parse(JSON.stringify(value, jsonSafeReplacer)) as T;
  } catch {
    return { serializationFailed: true } as T;
  }
}

export function logGcalApiError(payload: GcalApiErrorPayload): void {
  try {
    console.error("[GCAL API ERROR]", {
      parserPath: payload.parserPath ?? null,
      phase: payload.phase ?? null,
      ocrStarted: payload.ocrStarted ?? null,
      ocrCompleted: payload.ocrCompleted ?? null,
      errorCategory: payload.name ?? "Error",
      errorClass: payload.error?.slice(0, 120) ?? null,
    });
  } catch {
    console.error("[GCAL API ERROR]", { errorCategory: "log-failed" });
  }
}

export function errorMessageFromUnknown(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(toJsonSafe(err));
  } catch {
    return "Unknown error";
  }
}

export function errorDetailsFromUnknown(
  err: unknown,
): { name?: string; stack?: string } {
  if (err instanceof Error) {
    return { name: err.name, stack: err.stack };
  }
  return {};
}
