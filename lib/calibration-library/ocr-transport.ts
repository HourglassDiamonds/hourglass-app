/**
 * Remote OCR transport — routes recognition to an external worker when OCR_WORKER_URL is set.
 */

import { logCalibrationRuntimeCheck } from "./runtime-guard";
import {
  MAX_IMAGE_UPLOAD_BYTES,
  OCR_REMOTE_HEALTH_TIMEOUT_MS,
  OCR_REMOTE_RECOGNIZE_TIMEOUT_MS,
} from "./runtime-limits";

export type RemoteOcrResult = {
  text: string;
  ok: boolean;
  error?: string;
};

type HealthResponse = {
  ok?: boolean;
  available?: boolean;
  workerWarm?: boolean;
  lang?: string;
};

type RecognizeResponse = {
  ok?: boolean;
  text?: string;
  error?: string;
  durationMs?: number;
};

export function isRemoteOcrConfigured(): boolean {
  return Boolean(process.env.OCR_WORKER_URL?.trim());
}

function remoteBaseUrl(): string {
  const url = process.env.OCR_WORKER_URL?.trim();
  if (!url) throw new Error("OCR_WORKER_URL is not configured");
  return url.replace(/\/$/, "");
}

function remoteAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  const secret = process.env.OCR_WORKER_SECRET?.trim();
  if (secret) {
    headers.Authorization = `Bearer ${secret}`;
  }
  return headers;
}

export async function remoteOcrRuntimeAvailable(): Promise<boolean> {
  const started = Date.now();
  let available = false;
  let error: string | undefined;

  try {
    const res = await fetch(`${remoteBaseUrl()}/health`, {
      method: "GET",
      headers: remoteAuthHeaders(),
      signal: AbortSignal.timeout(OCR_REMOTE_HEALTH_TIMEOUT_MS),
    });
    if (!res.ok) {
      error = `health-http-${res.status}`;
      return false;
    }
    const body = (await res.json()) as HealthResponse;
    available = body.ok === true && body.available === true;
    if (!available) {
      error = "remote-ocr-unavailable";
    }
    return available;
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
    return false;
  } finally {
    logCalibrationRuntimeCheck({
      operation: "remote-ocr-health",
      durationMs: Date.now() - started,
      error,
    });
  }
}

export async function remoteOcrImageBuffer(
  buffer: Buffer,
  opts?: { requestId?: string; mime?: string; lang?: string },
): Promise<RemoteOcrResult> {
  const started = Date.now();

  if (buffer.length > MAX_IMAGE_UPLOAD_BYTES) {
    return {
      text: "",
      ok: false,
      error: `OCR image exceeds ${Math.floor(MAX_IMAGE_UPLOAD_BYTES / 1024 / 1024)}MB limit`,
    };
  }

  try {
    const res = await fetch(`${remoteBaseUrl()}/recognize`, {
      method: "POST",
      headers: {
        ...remoteAuthHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        imageBase64: buffer.toString("base64"),
        mime: opts?.mime ?? "image/png",
        lang: opts?.lang ?? "eng",
        ...(opts?.requestId ? { requestId: opts.requestId } : {}),
      }),
      signal: AbortSignal.timeout(OCR_REMOTE_RECOGNIZE_TIMEOUT_MS),
    });

    let body: RecognizeResponse;
    try {
      body = (await res.json()) as RecognizeResponse;
    } catch {
      return {
        text: "",
        ok: false,
        error: `Remote OCR invalid response (${res.status})`,
      };
    }

    if (!res.ok || body.ok !== true) {
      return {
        text: "",
        ok: false,
        error: body.error ?? `Remote OCR failed (${res.status})`,
      };
    }

    return { text: (body.text ?? "").trim(), ok: true };
  } catch (err) {
    return {
      text: "",
      ok: false,
      error: err instanceof Error ? err.message : "Remote OCR failed",
    };
  } finally {
    logCalibrationRuntimeCheck({
      operation: "ocr-image-remote",
      ocrDurationMs: Date.now() - started,
      durationMs: Date.now() - started,
    });
  }
}
