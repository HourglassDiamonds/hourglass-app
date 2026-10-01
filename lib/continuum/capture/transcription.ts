export const CAPTURE_TRANSCRIPTION_ENDPOINT =
  "https://api.openai.com/v1/audio/transcriptions" as const;
export const CAPTURE_TRANSCRIPTION_MODEL = "gpt-4o-mini-transcribe" as const;
export const CAPTURE_AUDIO_MAX_BYTES = 6 * 1024 * 1024;

const CAPTURE_AUDIO_TYPES = new Set([
  "audio/mp4",
  "audio/mpeg",
  "audio/ogg",
  "audio/wav",
  "audio/webm",
]);

export type CaptureTranscriptionResult =
  | { ok: true; text: string }
  | { ok: false; reason: "invalid-audio" | "unavailable" };

export function isAllowedCaptureAudio(file: File): boolean {
  const mime = file.type.split(";", 1)[0]?.trim().toLowerCase();
  return Boolean(
    file.size > 0 &&
      file.size <= CAPTURE_AUDIO_MAX_BYTES &&
      mime &&
      CAPTURE_AUDIO_TYPES.has(mime),
  );
}

export async function transcribeCaptureAudio(options: {
  apiKey: string;
  file: File;
  fetchImpl?: typeof fetch;
}): Promise<CaptureTranscriptionResult> {
  if (!isAllowedCaptureAudio(options.file)) {
    return { ok: false, reason: "invalid-audio" };
  }

  const form = new FormData();
  form.set("file", options.file, options.file.name || "quick-capture.webm");
  form.set("model", CAPTURE_TRANSCRIPTION_MODEL);
  form.set("language", "en");
  form.set("response_format", "json");

  try {
    const response = await (options.fetchImpl ?? fetch)(
      CAPTURE_TRANSCRIPTION_ENDPOINT,
      {
        method: "POST",
        headers: { authorization: `Bearer ${options.apiKey}` },
        body: form,
        signal: AbortSignal.timeout(45_000),
      },
    );
    if (!response.ok) return { ok: false, reason: "unavailable" };
    const json = (await response.json()) as { text?: unknown };
    const text = typeof json.text === "string" ? json.text.trim() : "";
    return text
      ? { ok: true, text }
      : { ok: false, reason: "unavailable" };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}
