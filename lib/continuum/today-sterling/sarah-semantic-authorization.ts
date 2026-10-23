import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export const STERLING_TODAY_SARAH_SEMANTIC_AUTHORIZATION_DIGEST =
  "f81a67e7e1dc06701be29c2b7ae3c20aea9715242819030ed9320eb0e134b430" as const;
export const STERLING_TODAY_SARAH_SEMANTIC_AUTHORIZATION_MS = 6 * 60 * 1000;

export type SarahSemanticAuthorizationClaim = {
  authorizationDigest: typeof STERLING_TODAY_SARAH_SEMANTIC_AUTHORIZATION_DIGEST;
  claimId: string;
  claimedAt: string;
  expiresAt: string;
};

export type SarahSemanticAuthorizationState =
  | "not_authorized"
  | "available"
  | "claimed"
  | "completed"
  | "failed"
  | "outcome_unknown"
  | "unavailable";

export type SarahSemanticAuthorizationStore = {
  claim(claim: SarahSemanticAuthorizationClaim): Promise<"acquired" | SarahSemanticAuthorizationState>;
  finish(
    claimId: string,
    state: "completed" | "failed" | "outcome_unknown",
    finishedAt: string,
  ): Promise<boolean>;
};

export function createSarahSemanticAuthorizationClaim(now = new Date()): SarahSemanticAuthorizationClaim {
  return {
    authorizationDigest: STERLING_TODAY_SARAH_SEMANTIC_AUTHORIZATION_DIGEST,
    claimId: randomUUID(),
    claimedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + STERLING_TODAY_SARAH_SEMANTIC_AUTHORIZATION_MS).toISOString(),
  };
}

function authorizationState(value: unknown): SarahSemanticAuthorizationState {
  return value === "not_authorized" || value === "available" || value === "claimed" ||
    value === "completed" || value === "failed" || value === "outcome_unknown"
    ? value : "unavailable";
}

/** Calls the separately reviewed one-shot metadata RPCs. Missing schema fails closed. */
export function createSupabaseSarahSemanticAuthorizationStore(
  client: SupabaseClient,
): SarahSemanticAuthorizationStore {
  return {
    async claim(claim) {
      const { data, error } = await client.rpc("continuum_claim_sterling_today_sarah_semantic", {
        p_authorization_digest: claim.authorizationDigest,
        p_claim_id: claim.claimId,
        p_claimed_at: claim.claimedAt,
        p_expires_at: claim.expiresAt,
      });
      if (error) return "unavailable";
      return data === "acquired" ? "acquired" : authorizationState(data);
    },
    async finish(claimId, state, finishedAt) {
      const { data, error } = await client.rpc("continuum_finish_sterling_today_sarah_semantic", {
        p_authorization_digest: STERLING_TODAY_SARAH_SEMANTIC_AUTHORIZATION_DIGEST,
        p_claim_id: claimId,
        p_outcome_state: state,
        p_finished_at: finishedAt,
      });
      return !error && data === true;
    },
  };
}

/** Test/reference implementation. A terminal or expired claim can never be made available again. */
export class InMemorySarahSemanticAuthorizationStore implements SarahSemanticAuthorizationStore {
  private state: SarahSemanticAuthorizationState;
  private current: SarahSemanticAuthorizationClaim | null = null;

  constructor(initialState: SarahSemanticAuthorizationState = "available") {
    this.state = initialState;
  }

  async claim(claim: SarahSemanticAuthorizationClaim) {
    if (this.state !== "available") {
      if (this.state === "claimed" && this.current &&
          Date.parse(this.current.expiresAt) <= Date.parse(claim.claimedAt)) return "outcome_unknown" as const;
      return this.state === "claimed" ? "claimed" as const : this.state;
    }
    this.state = "claimed";
    this.current = claim;
    return "acquired" as const;
  }

  async finish(claimId: string, state: "completed" | "failed" | "outcome_unknown", finishedAt: string) {
    if (!this.current || this.current.claimId !== claimId) return false;
    if (this.state === state) return true;
    if (this.state !== "claimed" || Date.parse(finishedAt) > Date.parse(this.current.expiresAt)) return false;
    this.state = state;
    return true;
  }

  currentState(): SarahSemanticAuthorizationState {
    return this.state;
  }
}
