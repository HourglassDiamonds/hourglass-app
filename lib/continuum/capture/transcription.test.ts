import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CAPTURE_AUDIO_MAX_BYTES,
  CAPTURE_TRANSCRIPTION_MODEL,
  isAllowedCaptureAudio,
  transcribeCaptureAudio,
} from "./transcription";

function audio(parts: BlobPart[] = ["audio"], type = "audio/webm") {
  return new File(parts, "capture.webm", { type });
}

describe("Quick Capture transcription", () => {
  it("accepts browser recording formats and rejects invalid or oversized input", () => {
    assert.equal(isAllowedCaptureAudio(audio()), true);
    assert.equal(isAllowedCaptureAudio(audio(["audio"], "audio/webm;codecs=opus")), true);
    assert.equal(isAllowedCaptureAudio(audio(["text"], "text/plain")), false);
    assert.equal(isAllowedCaptureAudio(audio([])), false);
    assert.equal(
      isAllowedCaptureAudio(audio([new Uint8Array(CAPTURE_AUDIO_MAX_BYTES + 1)])),
      false,
    );
  });

  it("sends ephemeral multipart audio to the transcription API", async () => {
    let request: RequestInit | undefined;
    const result = await transcribeCaptureAudio({
      apiKey: "test-key",
      file: audio(),
      fetchImpl: async (_input, init) => {
        request = init;
        return Response.json({ text: "Vincent wants the CAD updated." });
      },
    });
    assert.deepEqual(result, { ok: true, text: "Vincent wants the CAD updated." });
    assert.equal(request?.method, "POST");
    assert.equal((request?.headers as Record<string, string>).authorization, "Bearer test-key");
    const form = request?.body as FormData;
    assert.equal(form.get("model"), CAPTURE_TRANSCRIPTION_MODEL);
    assert.equal(form.get("language"), "en");
    assert.ok(form.get("file") instanceof File);
  });

  it("fails closed without leaking provider errors", async () => {
    const result = await transcribeCaptureAudio({
      apiKey: "test-key",
      file: audio(),
      fetchImpl: async () => new Response("provider detail", { status: 500 }),
    });
    assert.deepEqual(result, { ok: false, reason: "unavailable" });
  });
});
