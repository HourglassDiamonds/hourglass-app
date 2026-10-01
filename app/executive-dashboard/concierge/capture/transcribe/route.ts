import { cookies } from "next/headers";
import { requireInternalClientMemorySession } from "@/lib/continuum/client-memory/read/access";
import {
  CAPTURE_AUDIO_MAX_BYTES,
  transcribeCaptureAudio,
} from "@/lib/continuum/capture/transcription";
import { getConciergeOpenAiApiKey } from "@/lib/continuum/concierge-sol/env";
import { EXECUTIVE_DASHBOARD_SESSION_COOKIE } from "@/lib/executive-dashboard/session";

export const dynamic = "force-dynamic";

const PRIVATE_HEADERS = {
  "cache-control": "private, no-store",
  "x-content-type-options": "nosniff",
};

function json(body: object, status: number) {
  return Response.json(body, { status, headers: PRIVATE_HEADERS });
}

export async function POST(request: Request) {
  const jar = await cookies();
  const session = await requireInternalClientMemorySession(
    jar.get(EXECUTIVE_DASHBOARD_SESSION_COOKIE)?.value,
  );
  if (!session.ok) return json({ ok: false, error: "unauthorized" }, 401);

  const contentLength = Number(request.headers.get("content-length"));
  if (
    Number.isFinite(contentLength) &&
    contentLength > CAPTURE_AUDIO_MAX_BYTES + 256_000
  ) {
    return json({ ok: false, error: "invalid-audio" }, 413);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ ok: false, error: "invalid-audio" }, 400);
  }
  const file = form.get("audio");
  if (!(file instanceof File)) {
    return json({ ok: false, error: "invalid-audio" }, 400);
  }

  const apiKey = getConciergeOpenAiApiKey();
  if (!apiKey) return json({ ok: false, error: "unavailable" }, 503);

  const result = await transcribeCaptureAudio({ apiKey, file });
  if (!result.ok) {
    return json(
      { ok: false, error: result.reason },
      result.reason === "invalid-audio" ? 400 : 502,
    );
  }
  return json(result, 200);
}
