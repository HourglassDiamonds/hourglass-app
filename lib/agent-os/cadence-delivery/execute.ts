/**
 * Automated executive cadence + Chief of Staff email delivery executor.
 *
 * Uses existing runAgentOsBrief orchestration (all five executives).
 * Chief of Staff owns synthesis; this module owns schedule → eligibility →
 * durable reservation → email → outcome persistence.
 *
 * External writes: email only (founder brief + optional failure alert).
 */

import { createHash, randomUUID } from "node:crypto";
import { runAgentOsBrief } from "../run";
import type { AgentRun } from "../types";
import {
  assertScheduledLiveDurability,
  resolvePersistenceAdapter,
} from "../persistence/resolve";
import {
  evaluateCadence,
  evaluateAllCadences,
} from "../persistence/evaluate-cadence";
import {
  defaultCadenceDefinitions,
  getCadenceById,
} from "../persistence/cadence";
import type { AgentOsPersistenceStore } from "../persistence/store";
import {
  AgentOsPersistenceError,
  type AgentOsPersistedState,
  type CadenceDefinition,
  type PersistenceAdapterId,
  type RunTrigger,
} from "../persistence/types";
import { deepCloneState } from "../persistence/migrate";
import { DEFAULT_FOUNDER_COOLDOWN_MS } from "../persistence/recurrence";
import { redactError, redactSecretsAndPii } from "../redaction";
import { evaluateDeliveryEligibility } from "./eligibility";
import {
  briefFingerprintFromFounderBrief,
  buildDeliveryIdempotencyKey,
} from "./fingerprint";
import {
  resolveAgentOsEmailConfig,
  type AgentOsEmailConfig,
} from "./email-config";
import {
  renderFailureAlertEmail,
  renderFounderBriefEmail,
} from "./render-email";
import {
  resendAgentOsEmailSender,
  type AgentOsEmailSender,
} from "./send-email";
import { reserveDelivery, transitionDeliveryStatus } from "./reserve";
import {
  cadenceWindowId,
  isFounderBriefCadence,
  listDueFounderCadencesInOrder,
  weeklyFounderBriefOccupiesLocalDate,
} from "./windows";
import { FOUNDER_CADENCE_TIMEZONE } from "../persistence/cadence";
import { localCalendarStamp } from "../persistence/timezone";
import {
  localDateFromCadenceWindow,
  resolveBriefCadenceIntent,
} from "../brief-quality";

export type CadenceExecutionMode =
  | "dry-run"
  | "test"
  | "scheduled-live";

export type ExecuteCadenceOptions = {
  mode: CadenceExecutionMode;
  /** When set, run this cadence (must be due unless force). */
  cadenceId?: string;
  /** Force run even if evaluateCadence says not due (test/manual only). */
  force?: boolean;
  nowIso?: string;
  store?: AgentOsPersistenceStore;
  adapter?: PersistenceAdapterId;
  filePath?: string;
  allowDurableTest?: boolean;
  allowNonDurableLive?: boolean;
  emailSender?: AgentOsEmailSender;
  emailConfigOverride?: Partial<{
    apiKey: string;
    from: string;
    to: string;
    recipientAlias: string;
  }>;
  /** Failure-alert cooldown (default 6h). */
  failureAlertCooldownMs?: number;
};

export type CadenceExecutionResult = {
  ok: boolean;
  mode: CadenceExecutionMode;
  cadenceId: string | null;
  cadenceWindow: string | null;
  runId: string | null;
  runStatus: string | null;
  deliveryGuidance: string | null;
  deliveryAction: string;
  deliveryStatus: string | null;
  emailSent: boolean;
  dryRun: boolean;
  suppressionReason: string | null;
  error: string | null;
  errorCode: string | null;
  /** Safe summary for HTTP/CLI — no secrets, no recipient, no full brief. */
  safeSummary: string;
};

function triggerForMode(mode: CadenceExecutionMode): RunTrigger {
  if (mode === "scheduled-live") return "scheduled";
  if (mode === "test") return "test";
  return "manual";
}

function adapterMode(mode: CadenceExecutionMode): "fixture" | "live" {
  return mode === "scheduled-live" ? "live" : "fixture";
}

async function resolveStore(
  options: ExecuteCadenceOptions,
): Promise<{
  store: AgentOsPersistenceStore;
  adapterId: PersistenceAdapterId;
}> {
  if (options.store) {
    if (options.mode === "scheduled-live") {
      assertScheduledLiveDurability({
        store: options.store,
        allowDurableTest: options.allowDurableTest === true,
      });
    }
    return { store: options.store, adapterId: options.store.adapterId };
  }
  if (options.mode === "scheduled-live") {
    const resolved = resolvePersistenceAdapter({
      mode: "live",
      // undefined → supabase when configured, else unconfigured
      adapter: options.adapter,
      filePath: options.filePath,
      allowNonDurableLive: false,
      allowDurableTest: options.allowDurableTest === true,
      requireDurableInLive: true,
    });
    assertScheduledLiveDurability({
      store: resolved.store,
      allowDurableTest: options.allowDurableTest === true,
    });
    return { store: resolved.store, adapterId: resolved.adapterId };
  }
  const resolved = resolvePersistenceAdapter({
    mode: "fixture",
    adapter: options.adapter ?? "memory",
    filePath: options.filePath,
    allowDurableTest: options.allowDurableTest === true,
  });
  return { store: resolved.store, adapterId: resolved.adapterId };
}

async function updateCadenceTimestamps(input: {
  store: AgentOsPersistenceStore;
  cadenceId: string;
  nowIso: string;
  success: boolean;
  runId: string;
  clearInProgress: boolean;
}): Promise<void> {
  const prior = await input.store.load();
  const cadence = prior.cadences[input.cadenceId] ?? getCadenceById(input.cadenceId);
  if (!cadence) return;
  const updated: CadenceDefinition = {
    ...cadence,
    lastAttemptedAt: input.nowIso,
    lastSuccessfulAt: input.success
      ? input.nowIso
      : cadence.lastSuccessfulAt,
    nextEligibleAt: null,
  };
  const inProgress = { ...prior.inProgressByScope };
  if (input.clearInProgress) {
    delete inProgress[String(cadence.scope)];
  }
  const next = {
    ...deepCloneState(prior),
    updatedAt: input.nowIso,
    cadences: { ...prior.cadences, [input.cadenceId]: updated },
    inProgressByScope: inProgress,
  };
  await input.store.save(next);
}

async function markInProgress(input: {
  store: AgentOsPersistenceStore;
  cadence: CadenceDefinition;
  runId: string;
  nowIso: string;
}): Promise<void> {
  const prior = await input.store.load();
  const next = {
    ...deepCloneState(prior),
    updatedAt: input.nowIso,
    inProgressByScope: {
      ...prior.inProgressByScope,
      [String(input.cadence.scope)]: {
        runId: input.runId,
        startedAt: input.nowIso,
      },
    },
  };
  await input.store.save(next);
}

function deliveryIdFor(idempotencyKey: string): string {
  return `del:${idempotencyKey.slice(0, 24)}`;
}

/**
 * Execute a due (or forced) founder-brief cadence through Agent OS + optional email.
 */
export async function executeAgentOsCadence(
  options: ExecuteCadenceOptions,
): Promise<CadenceExecutionResult> {
  const nowIso = options.nowIso ?? new Date().toISOString();
  const dryRun = options.mode === "dry-run";
  const baseFail = (
    partial: Partial<CadenceExecutionResult> & { error: string; errorCode?: string },
  ): CadenceExecutionResult => ({
    ok: false,
    mode: options.mode,
    cadenceId: partial.cadenceId ?? options.cadenceId ?? null,
    cadenceWindow: partial.cadenceWindow ?? null,
    runId: partial.runId ?? null,
    runStatus: partial.runStatus ?? null,
    deliveryGuidance: partial.deliveryGuidance ?? null,
    deliveryAction: partial.deliveryAction ?? "block",
    deliveryStatus: partial.deliveryStatus ?? null,
    emailSent: false,
    dryRun,
    suppressionReason: partial.suppressionReason ?? null,
    error: redactSecretsAndPii(partial.error),
    errorCode: partial.errorCode ?? "failed",
    safeSummary: redactSecretsAndPii(partial.error),
  });

  let store: AgentOsPersistenceStore;
  try {
    ({ store } = await resolveStore(options));
  } catch (err) {
    const code =
      err instanceof AgentOsPersistenceError ? err.code : "unconfigured";
    return baseFail({
      error: err instanceof Error ? err.message : "persistence resolve failed",
      errorCode: code,
      deliveryAction: "block",
    });
  }

  if (options.mode === "scheduled-live") {
    try {
      const loaded = await store.load();
      assertScheduledLiveDurability({
        store,
        modeScope: loaded.modeScope,
        allowDurableTest: options.allowDurableTest === true,
      });
    } catch (err) {
      const code =
        err instanceof AgentOsPersistenceError ? err.code : "unconfigured";
      return baseFail({
        error: err instanceof Error ? err.message : "durability check failed",
        errorCode: code,
      });
    }
  }

  // Select cadence(s) — when omitted, process ALL due founder cadences
  // in deterministic order (weekly before daily). One run does not mark
  // another complete; each keeps its own timestamps / delivery keys.
  let state: AgentOsPersistedState;
  try {
    state = await store.load();
  } catch (err) {
    const code =
      err instanceof AgentOsPersistenceError ? err.code : "read-failed";
    return baseFail({
      error: err instanceof Error ? err.message : "load failed",
      errorCode: code,
    });
  }

  const cadences =
    Object.keys(state.cadences).length > 0
      ? Object.values(state.cadences)
      : defaultCadenceDefinitions();

  if (!options.cadenceId) {
    const evaluations = evaluateAllCadences(cadences, {
      nowIso,
      sourceHealth: [],
    });
    const due = evaluations
      .filter((e) => {
        if (!e.shouldProceed || !isFounderBriefCadence(e.cadenceId)) return false;
        const c = cadences.find((x) => x.cadenceId === e.cadenceId);
        if (!c) return false;
        const running = state.inProgressByScope[String(c.scope)]?.runId;
        if (running) return false;
        return true;
      })
      .map((e) => e.cadenceId);
    const ordered = listDueFounderCadencesInOrder(due);
    if (ordered.length === 0) {
      return {
        ok: true,
        mode: options.mode,
        cadenceId: null,
        cadenceWindow: null,
        runId: null,
        runStatus: null,
        deliveryGuidance: null,
        deliveryAction: "send-nothing",
        deliveryStatus: null,
        emailSent: false,
        dryRun,
        suppressionReason: null,
        error: null,
        errorCode: null,
        safeSummary: "No founder-brief cadence due",
      };
    }
    if (ordered.length > 1) {
      const results: CadenceExecutionResult[] = [];
      for (const id of ordered) {
        // Same-day anti-redundancy: after a successful weekly founder-brief
        // claim/send, skip the daily founder brief for that local date.
        if (id === "cos-daily-synthesis") {
          const liveState = await store.load().catch(() => state);
          const localDate = localCalendarStamp(
            nowIso,
            FOUNDER_CADENCE_TIMEZONE,
          ).date;
          if (
            weeklyFounderBriefOccupiesLocalDate(
              liveState,
              localDate,
              FOUNDER_CADENCE_TIMEZONE,
            )
          ) {
            results.push({
              ok: true,
              mode: options.mode,
              cadenceId: id,
              cadenceWindow: `day:${localDate}`,
              runId: null,
              runStatus: null,
              deliveryGuidance: null,
              deliveryAction: "send-nothing",
              deliveryStatus: null,
              emailSent: false,
              dryRun,
              suppressionReason:
                "Weekly founder brief already claimed/sent for this local date",
              error: null,
              errorCode: null,
              safeSummary:
                "Skipped daily founder brief — weekly already occupied this local date",
            });
            continue;
          }
        }
        results.push(
          await executeAgentOsCadence({
            ...options,
            cadenceId: id,
            store,
          }),
        );
      }
      const anyFail = results.some((r) => !r.ok);
      const last = results[results.length - 1]!;
      return {
        ...last,
        ok: !anyFail,
        emailSent: results.some((r) => r.emailSent),
        safeSummary: results.map((r) => `${r.cadenceId}:${r.deliveryAction}`).join("; "),
        error: anyFail
          ? results
              .filter((r) => !r.ok)
              .map((r) => r.error)
              .filter(Boolean)
              .join("; ")
          : null,
        errorCode: anyFail ? results.find((r) => !r.ok)?.errorCode ?? "failed" : null,
      };
    }
    // single due — fall through with explicit id
    options = { ...options, cadenceId: ordered[0] };
  }

  const cadenceId = options.cadenceId ?? null;

  if (!cadenceId) {
    return {
      ok: true,
      mode: options.mode,
      cadenceId: null,
      cadenceWindow: null,
      runId: null,
      runStatus: null,
      deliveryGuidance: null,
      deliveryAction: "send-nothing",
      deliveryStatus: null,
      emailSent: false,
      dryRun,
      suppressionReason: null,
      error: null,
      errorCode: null,
      safeSummary: "No founder-brief cadence due",
    };
  }

  if (!isFounderBriefCadence(cadenceId)) {
    return baseFail({
      cadenceId,
      error: `Cadence ${cadenceId} is not a founder-brief cadence`,
      errorCode: "mode-mismatch",
    });
  }

  // Same-day anti-redundancy for explicit daily runs (store is source of truth).
  if (cadenceId === "cos-daily-synthesis" && !options.force) {
    const localDate = localCalendarStamp(
      nowIso,
      FOUNDER_CADENCE_TIMEZONE,
    ).date;
    if (
      weeklyFounderBriefOccupiesLocalDate(
        state,
        localDate,
        FOUNDER_CADENCE_TIMEZONE,
      )
    ) {
      return {
        ok: true,
        mode: options.mode,
        cadenceId,
        cadenceWindow: `day:${localDate}`,
        runId: null,
        runStatus: null,
        deliveryGuidance: null,
        deliveryAction: "send-nothing",
        deliveryStatus: null,
        emailSent: false,
        dryRun,
        suppressionReason:
          "Weekly founder brief already claimed/sent for this local date",
        error: null,
        errorCode: null,
        safeSummary:
          "Skipped daily founder brief — weekly already occupied this local date",
      };
    }
  }

  // Refresh state after possible multi-cadence recursion sibling work
  try {
    state = await store.load();
  } catch (err) {
    const code =
      err instanceof AgentOsPersistenceError ? err.code : "read-failed";
    return baseFail({
      cadenceId,
      error: err instanceof Error ? err.message : "load failed",
      errorCode: code,
    });
  }

  const cadence =
    state.cadences[cadenceId] ??
    getCadenceById(cadenceId) ??
    defaultCadenceDefinitions().find((c) => c.cadenceId === cadenceId);

  if (!cadence) {
    return baseFail({
      cadenceId,
      error: `Unknown cadence ${cadenceId}`,
      errorCode: "corrupted-state",
    });
  }

  const inProgress = state.inProgressByScope[String(cadence.scope)]?.runId;
  const evaluation = evaluateCadence({
    cadence,
    nowIso,
    trigger: options.force ? "test" : triggerForMode(options.mode),
    inProgressRunId: inProgress,
    sourceHealth: [],
  });

  if (!options.force && !evaluation.shouldProceed) {
    return {
      ok: true,
      mode: options.mode,
      cadenceId,
      cadenceWindow: cadenceWindowId(cadence, nowIso),
      runId: null,
      runStatus: null,
      deliveryGuidance: null,
      deliveryAction: "send-nothing",
      deliveryStatus: null,
      emailSent: false,
      dryRun,
      suppressionReason: null,
      error: null,
      errorCode: null,
      safeSummary: `Cadence not due: ${evaluation.reasonCodes.join(",")}`,
    };
  }

  const window = cadenceWindowId(cadence, nowIso);
  const provisionalRunId = `run-${randomUUID()}`;

  try {
    await markInProgress({
      store,
      cadence,
      runId: provisionalRunId,
      nowIso,
    });
  } catch (err) {
    return baseFail({
      cadenceId,
      cadenceWindow: window,
      error: err instanceof Error ? err.message : "in-progress mark failed",
      errorCode: "write-failed",
    });
  }

  // Run full Agent OS (all five executives via existing orchestrator)
  const briefCadenceIntent = resolveBriefCadenceIntent(cadenceId);
  const briefLocalDate = localDateFromCadenceWindow(window, nowIso);
  let run: AgentRun;
  try {
    run = await runAgentOsBrief({
      mode: adapterMode(options.mode),
      briefCadenceIntent,
      briefLocalDate,
      persistence: {
        enabled: true,
        trigger: triggerForMode(options.mode),
        store,
        requirePersistenceWrite: options.mode === "scheduled-live",
        now: nowIso,
      },
    });
  } catch (err) {
    await updateCadenceTimestamps({
      store,
      cadenceId,
      nowIso,
      success: false,
      runId: provisionalRunId,
      clearInProgress: true,
    }).catch(() => undefined);
    return baseFail({
      cadenceId,
      cadenceWindow: window,
      error: err instanceof Error ? err.message : "runAgentOsBrief failed",
      errorCode: "failed",
    });
  }

  const persistenceOk = run.persistence?.ok !== false;
  if (options.mode === "scheduled-live" && !persistenceOk) {
    await updateCadenceTimestamps({
      store,
      cadenceId,
      nowIso,
      success: false,
      runId: run.runId,
      clearInProgress: true,
    }).catch(() => undefined);
    return baseFail({
      cadenceId,
      cadenceWindow: window,
      runId: run.runId,
      runStatus: run.runStatus,
      deliveryGuidance: run.deliveryGuidance,
      error:
        run.persistence?.error ??
        "Scheduled live persistence failed — fail closed",
      errorCode: run.persistence?.errorCode ?? "write-failed",
    });
  }

  const eligibility = evaluateDeliveryEligibility({
    run,
    persistenceOk:
      options.mode === "scheduled-live" ? persistenceOk : true,
    dryRun,
  });

  // Dry run: never send, never write false delivery-success
  if (dryRun) {
    await updateCadenceTimestamps({
      store,
      cadenceId,
      nowIso,
      success: run.runStatus === "completed" || run.runStatus === "completed-with-warnings",
      runId: run.runId,
      clearInProgress: true,
    }).catch(() => undefined);
    return {
      ok: true,
      mode: options.mode,
      cadenceId,
      cadenceWindow: window,
      runId: run.runId,
      runStatus: run.runStatus,
      deliveryGuidance: run.deliveryGuidance,
      deliveryAction: eligibility.action,
      deliveryStatus: "dry-run-no-send",
      emailSent: false,
      dryRun: true,
      suppressionReason: null,
      error: null,
      errorCode: null,
      safeSummary: `Dry run: would ${eligibility.action} (${eligibility.reason})`,
    };
  }

  if (eligibility.action === "send-nothing") {
    await updateCadenceTimestamps({
      store,
      cadenceId,
      nowIso,
      success: true,
      runId: run.runId,
      clearInProgress: true,
    }).catch(() => undefined);
    return {
      ok: true,
      mode: options.mode,
      cadenceId,
      cadenceWindow: window,
      runId: run.runId,
      runStatus: run.runStatus,
      deliveryGuidance: run.deliveryGuidance,
      deliveryAction: "send-nothing",
      deliveryStatus: null,
      emailSent: false,
      dryRun: false,
      suppressionReason: null,
      error: null,
      errorCode: null,
      safeSummary: eligibility.reason,
    };
  }

  if (eligibility.action === "block") {
    await updateCadenceTimestamps({
      store,
      cadenceId,
      nowIso,
      success: false,
      runId: run.runId,
      clearInProgress: true,
    }).catch(() => undefined);
    return baseFail({
      cadenceId,
      cadenceWindow: window,
      runId: run.runId,
      runStatus: run.runStatus,
      deliveryGuidance: run.deliveryGuidance,
      deliveryAction: "block",
      error: eligibility.reason,
      errorCode: "mode-mismatch",
    });
  }

  // Email config — fail closed when sending
  let emailConfig: AgentOsEmailConfig;
  try {
    emailConfig = resolveAgentOsEmailConfig({
      override: options.emailConfigOverride,
    });
  } catch (err) {
    await updateCadenceTimestamps({
      store,
      cadenceId,
      nowIso,
      success: false,
      runId: run.runId,
      clearInProgress: true,
    }).catch(() => undefined);
    return baseFail({
      cadenceId,
      cadenceWindow: window,
      runId: run.runId,
      runStatus: run.runStatus,
      deliveryGuidance: run.deliveryGuidance,
      error: err instanceof Error ? err.message : "email config missing",
      errorCode: "unconfigured",
    });
  }

  const sender = options.emailSender ?? resendAgentOsEmailSender;
  const kind =
    eligibility.action === "send-failure-alert"
      ? ("failure-alert" as const)
      : ("founder-brief" as const);

  const briefFingerprint =
    kind === "founder-brief"
      ? briefFingerprintFromFounderBrief(
          run.brief,
          run.recommendations
            .filter((r) => run.brief.surfacedPriorityTitles.includes(r.title))
            .slice(0, 5),
        )
      : createHash("sha256")
          .update(
            JSON.stringify({
              kind: "failure-alert",
              cadenceId,
              window,
              status: run.runStatus,
              reason: eligibility.reason,
            }),
            "utf8",
          )
          .digest("hex");

  const idempotencyKey = buildDeliveryIdempotencyKey({
    kind,
    cadenceId,
    cadenceWindow: window,
    recipientConfigFingerprint: emailConfig.recipientConfigFingerprint,
  });

  const deliveryId = deliveryIdFor(idempotencyKey);

  // Failure-alert dedup: shorter cooldown via fingerprint that includes window for alerts
  // For failure alerts we still reserve by window so retries don't storm.
  let reserve = await reserveDelivery({
    store,
    deliveryId,
    idempotencyKey,
    cadenceId,
    cadenceWindow: window,
    runId: run.runId,
    briefFingerprint,
    recipientConfigFingerprint: emailConfig.recipientConfigFingerprint,
    kind,
    nowIso,
    cooldownMs:
      kind === "failure-alert"
        ? (options.failureAlertCooldownMs ?? 6 * 60 * 60 * 1000)
        : DEFAULT_FOUNDER_COOLDOWN_MS,
  });

  if (reserve.outcome === "contention") {
    // One retry after reload
    reserve = await reserveDelivery({
      store,
      deliveryId,
      idempotencyKey,
      cadenceId,
      cadenceWindow: window,
      runId: run.runId,
      briefFingerprint,
      recipientConfigFingerprint: emailConfig.recipientConfigFingerprint,
      kind,
      nowIso,
      cooldownMs:
        kind === "failure-alert"
          ? (options.failureAlertCooldownMs ?? 6 * 60 * 60 * 1000)
          : DEFAULT_FOUNDER_COOLDOWN_MS,
    });
  }

  if (reserve.outcome === "contention") {
    await updateCadenceTimestamps({
      store,
      cadenceId,
      nowIso,
      success: false,
      runId: run.runId,
      clearInProgress: true,
    }).catch(() => undefined);
    return baseFail({
      cadenceId,
      cadenceWindow: window,
      runId: run.runId,
      runStatus: run.runStatus,
      deliveryGuidance: run.deliveryGuidance,
      error: "Delivery reservation contention — fail closed",
      errorCode: "write-failed",
    });
  }

  if (reserve.outcome === "already-terminal") {
    await updateCadenceTimestamps({
      store,
      cadenceId,
      nowIso,
      success: true,
      runId: run.runId,
      clearInProgress: true,
    }).catch(() => undefined);
    return {
      ok: true,
      mode: options.mode,
      cadenceId,
      cadenceWindow: window,
      runId: run.runId,
      runStatus: run.runStatus,
      deliveryGuidance: run.deliveryGuidance,
      deliveryAction: eligibility.action,
      deliveryStatus: reserve.record.status,
      // Prior terminal outcome — no email sent in this invocation
      emailSent: false,
      dryRun: false,
      suppressionReason: reserve.record.suppressionReason,
      error: null,
      errorCode: null,
      safeSummary: reserve.reason,
    };
  }

  if (reserve.outcome === "blocked-uncertain") {
    await updateCadenceTimestamps({
      store,
      cadenceId,
      nowIso,
      success: false,
      runId: run.runId,
      clearInProgress: true,
    }).catch(() => undefined);
    return baseFail({
      cadenceId,
      cadenceWindow: window,
      runId: run.runId,
      runStatus: run.runStatus,
      deliveryGuidance: run.deliveryGuidance,
      deliveryAction: eligibility.action,
      deliveryStatus: "uncertain",
      error: reserve.reason,
      errorCode: "write-failed",
    });
  }

  if (reserve.outcome === "suppressed") {
    await updateCadenceTimestamps({
      store,
      cadenceId,
      nowIso,
      success: true,
      runId: run.runId,
      clearInProgress: true,
    }).catch(() => undefined);
    return {
      ok: true,
      mode: options.mode,
      cadenceId,
      cadenceWindow: window,
      runId: run.runId,
      runStatus: run.runStatus,
      deliveryGuidance: run.deliveryGuidance,
      deliveryAction: "suppressed",
      deliveryStatus: "suppressed",
      emailSent: false,
      dryRun: false,
      suppressionReason: reserve.reason,
      error: null,
      errorCode: null,
      safeSummary: reserve.reason,
    };
  }

  // reserved → sending → send → sent|failed|uncertain
  await transitionDeliveryStatus({
    store,
    deliveryId: reserve.record.deliveryId,
    status: "sending",
    nowIso,
    expectedStatus: "reserved",
    expectedClaimOwner: reserve.record.claimOwner ?? undefined,
  });

  const rendered =
    kind === "failure-alert"
      ? renderFailureAlertEmail({
          cadenceId,
          cadenceWindow: window,
          runId: run.runId,
          runStatus: run.runStatus,
          reason: eligibility.reason,
        })
      : renderFounderBriefEmail({
          run,
          cadenceId,
          cadenceWindow: window,
          degraded:
            eligibility.action === "send-founder-brief" &&
            eligibility.degraded,
        });

  const sendResult = await sender({
    config: emailConfig,
    rendered,
    // Defense in depth: Resend documented Idempotency-Key (24h TTL).
    // Primary safety is durable claim state (sending→uncertain on crash).
    idempotencyKey: reserve.record.idempotencyKey,
  });

  if (sendResult.ok) {
    await transitionDeliveryStatus({
      store,
      deliveryId: reserve.record.deliveryId,
      status: "sent",
      nowIso,
      providerMessageId: sendResult.providerMessageId,
      expectedStatus: "sending",
      expectedClaimOwner: reserve.record.claimOwner ?? undefined,
    });
    await updateCadenceTimestamps({
      store,
      cadenceId,
      nowIso,
      success: true,
      runId: run.runId,
      clearInProgress: true,
    }).catch(() => undefined);
    return {
      ok: true,
      mode: options.mode,
      cadenceId,
      cadenceWindow: window,
      runId: run.runId,
      runStatus: run.runStatus,
      deliveryGuidance: run.deliveryGuidance,
      deliveryAction: eligibility.action,
      deliveryStatus: "sent",
      emailSent: true,
      dryRun: false,
      suppressionReason: null,
      error: null,
      errorCode: null,
      safeSummary: `Email sent for ${cadenceId} (${window})`,
    };
  }

  const nextStatus = sendResult.uncertain ? "uncertain" : "failed";
  await transitionDeliveryStatus({
    store,
    deliveryId: reserve.record.deliveryId,
    status: nextStatus,
    nowIso,
    errorSummary: sendResult.error,
    expectedStatus: "sending",
    expectedClaimOwner: reserve.record.claimOwner ?? undefined,
  });
  await updateCadenceTimestamps({
    store,
    cadenceId,
    nowIso,
    success: false,
    runId: run.runId,
    clearInProgress: true,
  }).catch(() => undefined);

  return baseFail({
    cadenceId,
    cadenceWindow: window,
    runId: run.runId,
    runStatus: run.runStatus,
    deliveryGuidance: run.deliveryGuidance,
    deliveryAction: eligibility.action,
    deliveryStatus: nextStatus,
    error: sendResult.error || redactError("email send failed"),
    errorCode: nextStatus === "uncertain" ? "write-failed" : "write-failed",
  });
}

/** Inspect recent delivery outcomes (safe — no secrets/recipients). */
export async function inspectAgentOsDeliveries(
  store: AgentOsPersistenceStore,
): Promise<
  Array<{
    deliveryId: string;
    cadenceId: string;
    cadenceWindow: string;
    kind: string;
    status: string;
    runId: string;
    suppressionReason: string | null;
    updatedAt: string;
  }>
> {
  const state = await store.load();
  return Object.values(state.deliveries ?? {})
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
    .slice(0, 20)
    .map((d) => ({
      deliveryId: d.deliveryId,
      cadenceId: d.cadenceId,
      cadenceWindow: d.cadenceWindow,
      kind: d.kind,
      status: d.status,
      runId: d.runId,
      suppressionReason: d.suppressionReason,
      updatedAt: d.updatedAt,
    }));
}
