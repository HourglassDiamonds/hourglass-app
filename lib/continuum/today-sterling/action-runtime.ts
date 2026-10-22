import "server-only";

import { getConciergeOpenAiApiKey } from "@/lib/continuum/concierge-sol/env";
import { getAuthenticatedGmailHistoryStores } from "@/lib/continuum/gmail/load";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import {
  createSterlingRunLease,
  createSupabaseSterlingRunLeaseStore,
} from "./run-lease";
import {
  getSterlingTodayContinuityHmacKey,
  isSterlingTodayDurableLeaseAvailable,
  isSterlingTodaySemanticFeatureEnabled,
} from "./server-config";
import { createSupabaseSterlingThreadVerificationStore } from "./retrieval-continuity-store";
import {
  assembleSterlingTodayShadow,
  executeSterlingTodaySemantic,
  safeAssemblyResult,
  safeSemanticResult,
  type SterlingTodaySafeResult,
} from "./server-runner";
import { STERLING_TODAY_SARAH_TARGET } from "./scope";

function safeFailure(
  mode: "assembly" | "semantic",
  verdict: "UNAVAILABLE" | "DISABLED" | "BUSY",
  safeError: string,
): SterlingTodaySafeResult {
  return {
    ok: false,
    mode,
    verdict,
    counts: null,
    completeness: null,
    scope: null,
    workUnitCoverage: [],
    namedCaseCoverage: [],
    candidateCoverage: null,
    continuity: null,
    gmail: null,
    performance: null,
    validation: null,
    acceptance: null,
    safeErrors: [safeError],
  };
}

async function authenticatedReadClient(): Promise<ReturnType<typeof getSupabaseAdmin>> {
  const auth = await getAuthenticatedGmailHistoryStores();
  if (!auth.ok) return null;
  return getSupabaseAdmin();
}

async function runAuthenticatedSterlingTodayAssemblyForTarget(
  targetCase?: typeof STERLING_TODAY_SARAH_TARGET,
): Promise<SterlingTodaySafeResult> {
  const client = await authenticatedReadClient();
  if (!client) return safeFailure("assembly", "UNAVAILABLE", "unauthorized-or-unavailable");
  try {
    const hmacKey = getSterlingTodayContinuityHmacKey();
    return safeAssemblyResult(await assembleSterlingTodayShadow({
      client,
      ...(targetCase ? { targetCase } : {}),
      ...(hmacKey ? {
        continuity: {
          mode: "assembly_planning_only" as const,
          hmacKey,
          store: createSupabaseSterlingThreadVerificationStore(client),
        },
      } : {}),
    }));
  } catch {
    return safeFailure("assembly", "UNAVAILABLE", "assembly-unavailable");
  }
}

export async function runAuthenticatedSterlingTodayAssembly(): Promise<SterlingTodaySafeResult> {
  return runAuthenticatedSterlingTodayAssemblyForTarget();
}

/** Fixed founder-only Sarah acceptance path. No caller-owned scope is accepted. */
export async function runAuthenticatedSterlingTodaySarahAssembly(): Promise<SterlingTodaySafeResult> {
  return runAuthenticatedSterlingTodayAssemblyForTarget(STERLING_TODAY_SARAH_TARGET);
}

/**
 * Semantic execution is deliberately fail-closed until both the deployed flag
 * and a separately authorized durable lease are active.
 */
export async function runAuthenticatedSterlingTodaySemantic(): Promise<SterlingTodaySafeResult> {
  const client = await authenticatedReadClient();
  if (!client) return safeFailure("semantic", "UNAVAILABLE", "unauthorized-or-unavailable");
  if (!isSterlingTodaySemanticFeatureEnabled()) {
    return safeFailure("semantic", "DISABLED", "semantic-feature-disabled");
  }
  if (!isSterlingTodayDurableLeaseAvailable()) {
    return safeFailure("semantic", "DISABLED", "durable-lease-unavailable");
  }
  const apiKey = getConciergeOpenAiApiKey();
  if (!apiKey) return safeFailure("semantic", "UNAVAILABLE", "model-credential-unavailable");
  const leaseStore = createSupabaseSterlingRunLeaseStore(client);
  const lease = createSterlingRunLease({ mode: "semantic", scopeVersion: "sterling-today-server-scope-v1" });
  const claim = await leaseStore.claim(lease);
  if (claim === "unavailable") return safeFailure("semantic", "DISABLED", "durable-lease-unavailable");
  if (claim === "busy") return safeFailure("semantic", "BUSY", "semantic-run-in-progress");
  try {
    const assembly = await assembleSterlingTodayShadow({ client });
    const completion = await executeSterlingTodaySemantic({ assembly, apiKey });
    await leaseStore.finish(lease.runId, "completed", new Date().toISOString());
    return safeSemanticResult(completion);
  } catch {
    await leaseStore.finish(lease.runId, "failed", new Date().toISOString()).catch(() => false);
    return safeFailure("semantic", "UNAVAILABLE", "semantic-run-unavailable");
  }
}
