"use server";

import { revalidatePath } from "next/cache";
import { createLiveGmailApi } from "@/lib/continuum/gmail/adapter";
import { getAuthenticatedGmailHistoryStores } from "@/lib/continuum/gmail/load";
import { liveGmailAccessTokenRefresher } from "@/lib/continuum/gmail/oauth";
import { decryptRefreshToken, loadGmailTokenKek } from "@/lib/continuum/gmail/token-crypto";
import { runGmailNewProjectIntakeScan } from "@/lib/continuum/gmail/intake-scan";
import { getAuthenticatedCandidateStore } from "@/lib/continuum/candidates/load";
import { loadGmailCandidateWorldFromAdmin } from "@/lib/continuum/client-memory/founder-project/gmail-world";
import { CONCIERGE_GMAIL_INTAKE_PATH } from "@/lib/continuum/gmail/types";

export type ScanGmailIntakeState =
  | { ok: true; inserted: number; evidenceCount: number }
  | { ok: false; message: string }
  | null;

export async function scanGmailNewProjectIntake(
  prev: ScanGmailIntakeState,
  formData: FormData,
): Promise<ScanGmailIntakeState> {
  void prev;
  void formData;
  const [gmail, candidates] = await Promise.all([
    getAuthenticatedGmailHistoryStores(),
    getAuthenticatedCandidateStore(),
  ]);
  if (!gmail.ok) {
    return {
      ok: false,
      message: gmail.reason === "unauthorized" ? "Sign in to continue." : "Gmail is unavailable.",
    };
  }
  if (!candidates.ok) {
    return {
      ok: false,
      message:
        candidates.reason === "unauthorized"
          ? "Sign in to continue."
          : "Candidate storage is unavailable.",
    };
  }
  const kek = loadGmailTokenKek();
  if (!kek.ok) return { ok: false, message: "Gmail token custody is unavailable." };
  const connection = await gmail.connections.getFounderConnection();
  let world;
  try {
    world = await loadGmailCandidateWorldFromAdmin(
      connection?.mailboxEmailHash ? [connection.mailboxEmailHash] : [],
    );
  } catch {
    return { ok: false, message: "Continuum people could not be loaded." };
  }
  const result = await runGmailNewProjectIntakeScan({
    founderSessionOk: true,
    index: gmail.index,
    connections: gmail.connections,
    decryptRefreshToken: (wrapped) => decryptRefreshToken(wrapped, kek.key),
    refreshAccessToken: (refreshToken) =>
      liveGmailAccessTokenRefresher.refreshAccessToken(refreshToken),
    createApi: (accessToken) => createLiveGmailApi(accessToken),
    world,
    store: candidates.store,
    nowIso: new Date().toISOString(),
  });
  if (!result.ok) {
    if (result.safeErrorCode === "unauthorized") {
      return { ok: false, message: "Sign in to continue." };
    }
    if (result.safeErrorCode === "gmail-not-connected") {
      return { ok: false, message: "Connect Gmail first." };
    }
    return { ok: false, message: "Gmail evidence could not be read." };
  }
  revalidatePath(CONCIERGE_GMAIL_INTAKE_PATH);
  return {
    ok: true,
    inserted: result.insertedIds.length,
    evidenceCount: result.evidenceCount,
  };
}
