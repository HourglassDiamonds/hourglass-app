import type { ClientSafeInterpretationPayload } from "./client-api";
import {
  CLIENT_PARTIAL_INTERPRETATION_NOTE,
  CLIENT_UPLOAD_INTERPRET_ERROR,
} from "./client-interpret-messages";

export {
  CLIENT_PARTIAL_INTERPRETATION_NOTE,
  CLIENT_UPLOAD_INTERPRET_ERROR,
} from "./client-interpret-messages";

/** Browser-side guard — slightly above server route budget (28s). */
const CLIENT_FETCH_TIMEOUT_MS = 30_000;

export type InterpretApiPayload = {
  ok?: boolean;
  error?: string;
  partial?: boolean;
  interpretation?: ClientSafeInterpretationPayload;
};

export type ClientInterpretUploadResult = {
  interpretation: ClientSafeInterpretationPayload;
  partial: boolean;
};

export async function postReportForInterpretation(
  file: File,
): Promise<ClientInterpretUploadResult> {
  const fd = new FormData();
  fd.append("file", file);

  const controller = new AbortController();
  const timeoutId = window.setTimeout(
    () => controller.abort(),
    CLIENT_FETCH_TIMEOUT_MS,
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

  if (!res.ok || !data.ok || !data.interpretation) {
    throw new Error(CLIENT_UPLOAD_INTERPRET_ERROR);
  }

  const interpretation = data.interpretation;
  const partial = Boolean(
    data.partial ||
      interpretation.partial ||
      interpretation.clientStatusNote,
  );

  if (partial && !interpretation.clientStatusNote) {
    interpretation.clientStatusNote = CLIENT_PARTIAL_INTERPRETATION_NOTE;
    interpretation.partial = true;
  }

  return { interpretation, partial };
}
