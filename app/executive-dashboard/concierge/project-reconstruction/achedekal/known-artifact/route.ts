import { NextResponse } from "next/server";
import { createSupabaseClientMemoryStore } from "@/lib/continuum/client-memory/persistence/supabase";
import {
  ACHEDEKAL_KNOWN_ARTIFACT_MIME,
  ACHEDEKAL_PROJECT_ID,
  isPermittedAchedekalProjectId,
} from "@/lib/continuum/gmail/achedekal-acceptance";
import {
  executeAchedekalKnownArtifactPreview,
} from "@/lib/continuum/gmail/achedekal-known-artifact";
import { pointerFromProjectHistory } from "@/lib/continuum/gmail/achedekal-review";
import { lookupFromGetProjectHistory } from "@/lib/continuum/gmail/exact-thread";
import { createLiveKnownArtifactGmailApi } from "@/lib/continuum/gmail/known-artifact-gmail";
import { getAuthenticatedGmailHistoryStores } from "@/lib/continuum/gmail/load";
import { liveGmailAccessTokenRefresher } from "@/lib/continuum/gmail/oauth";
import { decryptRefreshToken, loadGmailTokenKek } from "@/lib/continuum/gmail/token-crypto";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const fetchCache = "force-no-store";

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};

function fail(status: number) {
  return NextResponse.json(
    { ok: false },
    { status, headers: NO_STORE_HEADERS },
  );
}

export async function GET(request: Request) {
  void new URL(request.url).searchParams;

  const auth = await getAuthenticatedGmailHistoryStores();
  if (!auth.ok) {
    return fail(auth.reason === "unauthorized" ? 401 : 404);
  }

  const kek = loadGmailTokenKek();
  if (!kek.ok) return fail(404);

  let memory: ReturnType<typeof createSupabaseClientMemoryStore>;
  try {
    memory = createSupabaseClientMemoryStore();
  } catch {
    return fail(404);
  }

  const result = await executeAchedekalKnownArtifactPreview({
    founderSessionOk: true,
    projects: lookupFromGetProjectHistory(async (projectId) => {
      if (!isPermittedAchedekalProjectId(projectId)) return null;
      const history = await memory.getProjectHistory(ACHEDEKAL_PROJECT_ID);
      return pointerFromProjectHistory(history);
    }),
    index: auth.index,
    attachments: auth.attachments,
    connections: auth.connections,
    decryptRefreshToken: (wrapped) => decryptRefreshToken(wrapped, kek.key),
    refreshAccessToken: (refreshToken) =>
      liveGmailAccessTokenRefresher.refreshAccessToken(refreshToken),
    createApi: (accessToken) => createLiveKnownArtifactGmailApi(accessToken),
  });

  if (!result.ok) {
    if (result.safeErrorCode === "unauthorized") return fail(401);
    if (result.safeErrorCode === "forbidden") return fail(403);
    return fail(404);
  }

  return new NextResponse(new Uint8Array(result.bytes), {
    status: 200,
    headers: {
      ...NO_STORE_HEADERS,
      "Content-Type": ACHEDEKAL_KNOWN_ARTIFACT_MIME,
      "Content-Disposition": "inline",
    },
  });
}
