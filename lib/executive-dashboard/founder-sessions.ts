/**
 * Preview-only durable founder session store.
 *
 * Pattern A: isolated Continuum Preview persists session_id at login and
 * denies revoked/expired rows on every request. Production and every
 * non-isolated runtime keep today's stateless HMAC cookie and must never
 * invoke this store.
 *
 * The Preview table is live. Production application remains separately
 * founder-approved. Preview code fail-closes when the isolation gate is
 * on and the store is missing/unavailable.
 * Fail-closed auth must not throw into public site chrome.
 *
 * Logout always clears the browser cookie. If Preview revoke fails, this
 * browser is logged out but a copied cookie may remain valid until expiry.
 * Do not leak store or SQL details.
 */

import { getSupabaseAdmin } from "@/lib/supabase/client";
import { CONTINUUM_FOUNDER_WEBAUTHN_USER_ID } from "@/lib/executive-dashboard/passkeys/config";
import {
  CONTINUUM_PREVIEW_SUPABASE_PROJECT_REF,
  CONTINUUM_PRODUCTION_SUPABASE_PROJECT_REF,
  parseContinuumEnv,
  previewSupabaseProjectRef,
  productionSupabaseProjectRef,
  resolveContinuumIsolationState,
  supabaseProjectRefFromUrl,
} from "@/lib/continuum/runtime-env";

export const FOUNDER_SESSIONS_TABLE = "continuum_founder_sessions";
export const FOUNDER_SESSION_EXPIRE_SWEEP = 32;

export type FounderSessionRow = {
  sessionId: string;
  founderUserId: string;
  issuedAtMs: number;
  expiresAtMs: number;
  revokedAtMs: number | null;
};

export type FounderSessionStore = {
  persist(row: FounderSessionRow): Promise<void>;
  getActive(sessionId: string, nowMs: number): Promise<FounderSessionRow | null>;
  revoke(sessionId: string, nowMs: number): Promise<void>;
};

/**
 * Same isolation contract as durable founder-auth rate limiting.
 * Production identity must not ride this path.
 */
export function isDurableFounderSessionStoreEnabled(): boolean {
  if (parseContinuumEnv() !== "preview") return false;
  if (resolveContinuumIsolationState() !== "preview-isolated") return false;

  const currentRef = supabaseProjectRefFromUrl();
  const previewRef = previewSupabaseProjectRef();
  const productionRef = productionSupabaseProjectRef();
  const previewCanon: string = CONTINUUM_PREVIEW_SUPABASE_PROJECT_REF;
  const productionCanon: string = CONTINUUM_PRODUCTION_SUPABASE_PROJECT_REF;

  if (currentRef !== previewCanon) return false;
  if (previewRef !== previewCanon) return false;
  if (productionRef !== productionCanon) return false;
  if (currentRef === productionCanon) return false;
  if (previewRef === productionRef) return false;
  return true;
}

export function founderSessionSubjectId(): string {
  return CONTINUUM_FOUNDER_WEBAUTHN_USER_ID;
}

const failClosedFounderSessionStore: FounderSessionStore = {
  async persist() {
    throw new Error("founder-session-store-unavailable");
  },
  async getActive() {
    throw new Error("founder-session-store-unavailable");
  },
  async revoke() {
    throw new Error("founder-session-store-unavailable");
  },
};

let testStore: FounderSessionStore | null = null;

export function setFounderSessionStoreForTests(
  store: FounderSessionStore | null,
): void {
  testStore = store;
}

export function getTestFounderSessionStore(): FounderSessionStore | null {
  return testStore;
}

export function createMemoryFounderSessionStore(): FounderSessionStore & {
  rows: () => FounderSessionRow[];
} {
  const rows = new Map<string, FounderSessionRow>();

  function sweep(nowMs: number): void {
    let swept = 0;
    for (const [id, row] of rows) {
      if (swept >= FOUNDER_SESSION_EXPIRE_SWEEP) break;
      if (row.expiresAtMs <= nowMs) {
        rows.delete(id);
        swept += 1;
      }
    }
  }

  return {
    async persist(row) {
      sweep(row.issuedAtMs);
      rows.set(row.sessionId, { ...row });
    },
    async getActive(sessionId, nowMs) {
      sweep(nowMs);
      const row = rows.get(sessionId);
      if (!row) return null;
      if (row.revokedAtMs != null) return null;
      if (row.expiresAtMs <= nowMs) return null;
      return { ...row };
    },
    async revoke(sessionId, nowMs) {
      sweep(nowMs);
      const row = rows.get(sessionId);
      if (!row) return;
      if (row.revokedAtMs == null) {
        rows.set(sessionId, { ...row, revokedAtMs: nowMs });
      }
    },
    rows: () => [...rows.values()].map((row) => ({ ...row })),
  };
}

function mapSessionRow(row: {
  session_id: string;
  founder_user_id: string;
  issued_at: string;
  expires_at: string;
  revoked_at: string | null;
}): FounderSessionRow {
  return {
    sessionId: row.session_id,
    founderUserId: row.founder_user_id,
    issuedAtMs: Date.parse(row.issued_at),
    expiresAtMs: Date.parse(row.expires_at),
    revokedAtMs: row.revoked_at ? Date.parse(row.revoked_at) : null,
  };
}

export function createSupabaseFounderSessionStore(
  admin: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
): FounderSessionStore {
  return {
    async persist(row) {
      const nowIso = new Date(row.issuedAtMs).toISOString();
      try {
        await admin
          .from(FOUNDER_SESSIONS_TABLE)
          .delete()
          .lt("expires_at", nowIso);
      } catch {
        // Sweep is opportunistic. Persist must still proceed.
      }

      const { error } = await admin.from(FOUNDER_SESSIONS_TABLE).insert({
        session_id: row.sessionId,
        founder_user_id: row.founderUserId,
        issued_at: new Date(row.issuedAtMs).toISOString(),
        expires_at: new Date(row.expiresAtMs).toISOString(),
        revoked_at: null,
      });
      if (error) throw error;
    },
    async getActive(sessionId, nowMs) {
      const { data, error } = await admin
        .from(FOUNDER_SESSIONS_TABLE)
        .select(
          "session_id, founder_user_id, issued_at, expires_at, revoked_at",
        )
        .eq("session_id", sessionId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const mapped = mapSessionRow(data);
      if (mapped.revokedAtMs != null) return null;
      if (mapped.expiresAtMs <= nowMs) return null;
      return mapped;
    },
    async revoke(sessionId, nowMs) {
      const { error } = await admin
        .from(FOUNDER_SESSIONS_TABLE)
        .update({ revoked_at: new Date(nowMs).toISOString() })
        .eq("session_id", sessionId)
        .is("revoked_at", null);
      if (error) throw error;
    },
  };
}

function resolveFounderSessionStore(): FounderSessionStore {
  const override = getTestFounderSessionStore();
  if (override) return override;

  if (process.env.NODE_TEST_CONTEXT) {
    return failClosedFounderSessionStore;
  }

  try {
    const admin = getSupabaseAdmin();
    if (admin) return createSupabaseFounderSessionStore(admin);
  } catch {
    return failClosedFounderSessionStore;
  }

  return failClosedFounderSessionStore;
}

export async function persistDurableFounderSession(
  row: FounderSessionRow,
): Promise<{ ok: true } | { ok: false }> {
  if (!isDurableFounderSessionStoreEnabled()) return { ok: true };
  try {
    await resolveFounderSessionStore().persist(row);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export async function confirmDurableFounderSession(
  sessionId: string | undefined,
  nowMs = Date.now(),
): Promise<{ ok: true } | { ok: false; reason: "invalid-session" }> {
  if (!isDurableFounderSessionStoreEnabled()) return { ok: true };
  if (!sessionId) return { ok: false, reason: "invalid-session" };
  try {
    const row = await resolveFounderSessionStore().getActive(sessionId, nowMs);
    if (!row) return { ok: false, reason: "invalid-session" };
    return { ok: true };
  } catch {
    return { ok: false, reason: "invalid-session" };
  }
}

/**
 * Best-effort Preview revoke. Callers must still clear the browser cookie
 * when this returns `{ ok: false }`.
 */
export async function revokeDurableFounderSession(
  sessionId: string | undefined,
  nowMs = Date.now(),
): Promise<{ ok: true } | { ok: false }> {
  if (!isDurableFounderSessionStoreEnabled()) return { ok: true };
  if (!sessionId) return { ok: true };
  try {
    await resolveFounderSessionStore().revoke(sessionId, nowMs);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
