import "server-only";

import { getConciergeOpenAiApiKey } from "@/lib/continuum/concierge-sol/env";
import { getAuthenticatedGmailHistoryStores } from "@/lib/continuum/gmail/load";
import { CONCIERGE_FOREGROUND_MODEL } from "@/lib/continuum/concierge-sol/models";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import {
  createSterlingRunLease,
  createSupabaseSterlingRunLeaseStore,
} from "./run-lease";
import {
  getSterlingTodayContinuityHmacKey,
  isSterlingTodayDurableLeaseAvailable,
  isSterlingTodaySarahSemanticFeatureEnabled,
  isSterlingTodaySemanticFeatureEnabled,
} from "./server-config";
import {
  createSarahSemanticAuthorizationClaim,
  createSupabaseSarahSemanticAuthorizationStore,
} from "./sarah-semantic-authorization";
import {
  SarahSemanticPreflightError,
  STERLING_TODAY_SARAH_MAX_OUTPUT_TOKENS,
  STERLING_TODAY_SARAH_MAX_REQUEST_BYTES,
  validateSarahSemanticAssembly,
} from "./sarah-semantic";
import { SterlingTodayRequestError } from "./request";
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
    target: null,
    candidateCoverage: null,
    continuity: null,
    gmail: null,
    performance: null,
    validation: null,
    proposal: null,
    acceptance: null,
    safeErrors: [safeError],
  };
}

function safeSemanticFailureFromAssembly(
  assembly: Awaited<ReturnType<typeof assembleSterlingTodayShadow>>,
  safeError: string,
): SterlingTodaySafeResult {
  const result = safeAssemblyResult(assembly);
  const targetFailureStage = [
    "target-resolution-failed",
    "target-thread-live-retrieval-incomplete",
    "target-evidence-binding-incomplete",
    "target-chronology-incomplete",
    "target-package-oversized",
    "target-package-cross-unit-evidence",
  ].includes(safeError) ? safeError as NonNullable<typeof result.target>["stoppedAtStage"] : null;
  return {
    ...result,
    ok: false,
    mode: "semantic",
    verdict: "UNAVAILABLE",
    validation: null,
    proposal: null,
    acceptance: null,
    target: result.target ? {
      ...result.target,
      stoppedAtStage: targetFailureStage ?? result.target.stoppedAtStage,
    } : null,
    safeErrors: [...new Set([...result.safeErrors, safeError])].sort(),
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
 * Fixed, founder-only, one-shot Sarah semantic experiment. It accepts no
 * caller-owned target and consumes its authorization before any Gmail read.
 */
export async function runAuthenticatedSterlingTodaySarahSemantic(): Promise<SterlingTodaySafeResult> {
  const client = await authenticatedReadClient();
  if (!client) return safeFailure("semantic", "UNAVAILABLE", "unauthorized-or-unavailable");
  if (!isSterlingTodaySarahSemanticFeatureEnabled()) {
    return safeFailure("semantic", "DISABLED", "sarah-semantic-feature-disabled");
  }
  const apiKey = getConciergeOpenAiApiKey();
  if (!apiKey) return safeFailure("semantic", "UNAVAILABLE", "model-credential-unavailable");

  const authorization = createSarahSemanticAuthorizationClaim();
  const authorizationStore = createSupabaseSarahSemanticAuthorizationStore(client);
  const claim = await authorizationStore.claim(authorization);
  if (claim !== "acquired") {
    const verdict = claim === "claimed" ? "BUSY" : claim === "not_authorized" || claim === "available"
      ? "DISABLED" : "UNAVAILABLE";
    return safeFailure("semantic", verdict,
      claim === "claimed" ? "sarah-semantic-in-progress"
        : claim === "completed" ? "sarah-semantic-already-completed"
          : claim === "failed" ? "sarah-semantic-already-failed"
            : claim === "outcome_unknown" ? "sarah-semantic-outcome-unknown"
              : claim === "not_authorized" ? "sarah-semantic-not-authorized"
                : "sarah-semantic-authorization-unavailable");
  }

  let assembly: Awaited<ReturnType<typeof assembleSterlingTodayShadow>> | null = null;
  try {
    assembly = await assembleSterlingTodayShadow({
      client,
      targetCase: STERLING_TODAY_SARAH_TARGET,
    });
    const preflight = validateSarahSemanticAssembly(assembly);
    if (!preflight.ok) throw new SarahSemanticPreflightError(preflight.reason);
    const completion = await executeSterlingTodaySemantic({
      assembly,
      apiKey,
      model: CONCIERGE_FOREGROUND_MODEL,
      requestPolicy: {
        maxOutputTokens: STERLING_TODAY_SARAH_MAX_OUTPUT_TOKENS,
        maxRequestBytes: STERLING_TODAY_SARAH_MAX_REQUEST_BYTES,
        disableTruncation: true,
      },
    });
    const finished = await authorizationStore.finish(authorization.claimId, "completed", new Date().toISOString());
    if (!finished) return safeFailure("semantic", "UNAVAILABLE", "sarah-semantic-outcome-unknown");
    return safeSemanticResult(completion);
  } catch (error) {
    const finished = await authorizationStore.finish(authorization.claimId, "failed", new Date().toISOString())
      .catch(() => false);
    const safeError = error instanceof SarahSemanticPreflightError ? error.safeReason
      : error instanceof SterlingTodayRequestError && error.code === "request-package-too-large"
        ? "target-package-oversized"
        : error instanceof SterlingTodayRequestError && error.kind === "timeout"
          ? "sarah-semantic-model-timeout"
          : error instanceof SyntaxError ? "sarah-semantic-output-invalid"
            : "sarah-semantic-run-unavailable";
    const finalSafeError = finished ? safeError : "sarah-semantic-outcome-unknown";
    return assembly ? safeSemanticFailureFromAssembly(assembly, finalSafeError)
      : safeFailure("semantic", "UNAVAILABLE", finalSafeError);
  }
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
