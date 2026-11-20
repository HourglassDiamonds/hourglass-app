import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getAuthenticatedGmailHistoryStores } from "@/lib/continuum/gmail/load";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { isSterlingOperationalShadowEnabled } from "./server-config";
import { isVerifiedOperationalShadowRuntime } from "./operational-shadow-review";
import { matchAuthorizedNovember20FounderDirectiveReadback } from
  "./authorized-founder-updates-2026-11-20";
import {
  loadExactClientMemorySourceNotes,
  loadSterlingFounderDirectiveNotes,
} from "./founder-directive-load";
import {
  AUTHORIZED_SUPERVISED_TRIAL_NOTE_IDS,
  matchAuthorizedSupervisedTrialInputReadback,
  type AuthorizedSupervisedTrialInputReadback,
} from "./authorized-supervised-trial-inputs-2026-11-20";

export type FounderDirectivePreflightResult =
  | {
      ok: true;
      status: "ready";
      directives: Array<{
        directiveId: string;
        noteId: string;
        writeStatus: "inserted" | "already-present";
        workUnitId: string;
        projectId: string | null;
        personId: string | null;
      }>;
      trialInputs: AuthorizedSupervisedTrialInputReadback[];
    }
  | { ok: false; reason: string };

async function readAuthorizedFounderDirectives(
  client: SupabaseClient,
): Promise<FounderDirectivePreflightResult> {
  const readable = matchAuthorizedNovember20FounderDirectiveReadback(
    await loadSterlingFounderDirectiveNotes(client),
  );
  if (!readable) {
    return { ok: false, reason: "founder-directive-readback-failed" };
  }
  const trialInputs = matchAuthorizedSupervisedTrialInputReadback(
    await loadExactClientMemorySourceNotes(client, AUTHORIZED_SUPERVISED_TRIAL_NOTE_IDS),
  );
  if (!trialInputs) {
    return { ok: false, reason: "supervised-trial-input-readback-failed" };
  }
  return {
    ok: true,
    status: "ready",
    directives: readable.map(({ noteId, directive }) => ({
      directiveId: directive.directiveId,
      noteId,
      writeStatus: "already-present" as const,
      workUnitId: directive.workUnitId,
      projectId: directive.projectId,
      personId: directive.personId,
    })),
    trialInputs,
  };
}

/** Founder-authenticated gate. It never claims a run lease or touches Gmail/model execution. */
export async function prepareAuthenticatedOperationalShadowFounderDirectives():
  Promise<FounderDirectivePreflightResult> {
  if (!isVerifiedOperationalShadowRuntime() || !isSterlingOperationalShadowEnabled()) {
    return { ok: false, reason: "shadow-runtime-disabled" };
  }
  const auth = await getAuthenticatedGmailHistoryStores();
  if (!auth.ok) return { ok: false, reason: "founder-session-unavailable" };
  const client = getSupabaseAdmin();
  if (!client) return { ok: false, reason: "database-unavailable" };
  try {
    return await readAuthorizedFounderDirectives(client);
  } catch {
    return { ok: false, reason: "founder-directive-preflight-failed" };
  }
}
