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
import {
  isInProgressActive,
  isInProgressStale,
  logCadenceDeliveryEvent,
  resolveCadenceDeliveryOutcome,
  type CadenceDeliveryOutcome,
} from "./outcome";
import { FOUNDER_CADENCE_TIMEZONE } from "../persistence/cadence";
import { localCalendarStamp } from "../persistence/timezone";
import {
  dailyTodayCall,
  localDateFromCadenceWindow,
  resolveBriefCadenceIntent,
} from "../brief-quality";
import { evaluateBriefQualityGate } from "../brief-quality-gate";
import type { RenderedAgentOsEmail } from "./render-email";

export type CadenceExecutionMode =
  | "dry-run"
  | "test"
  | "scheduled-live";

/**
 * Product run identity for founder-brief delivery.
 * - scheduled: normal cron / scheduled-live path (mutates cadence + official delivery)
 * - manual-preview: live reads, no email, no scheduled-state mutation
 * - force-send: authenticated manual recovery — bypasses due gate, sends for real
 */
export type CadenceRunMode = "scheduled" | "manual-preview" | "force-send";

export type ExecuteCadenceOptions = {
  mode: CadenceExecutionMode;
  /**
   * Explicit product run mode. Defaults to "scheduled".
   * manual-preview requires mode "scheduled-live" (live adapters + durable store)
   * and always bypasses the local-time due gate.
   */
  runMode?: CadenceRunMode;
  /** When set, run this cadence (must be due unless force / manual runMode). */
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
  /**
   * Include rendered subject/html/text on the result (CLI review only).
   * Never returned from the public cron HTTP response.
   */
  includePreviewRender?: boolean;
};

export type CadenceExecutionResult = {
  ok: boolean;
  mode: CadenceExecutionMode;
  /** Defaults to "scheduled" when omitted (legacy callers). */
  runMode?: CadenceRunMode;
  cadenceId: string | null;
  cadenceWindow: string | null;
  /** Official day window without manual suffix (for eligibility proofs). */
  officialCadenceWindow?: string | null;
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
  /** Present when includePreviewRender is true (manual modes / CLI). */
  previewRender?: {
    subject: string;
    text: string;
    html: string;
    qualityGateOk: boolean;
    qualityGateCodes: string[];
    recipientAlias: string | null;
    providerMessageId: string | null;
  } | null;
  /** Cadence lastSuccessfulAt before this invocation (manual proof). */
  cadenceLastSuccessfulAtBefore?: string | null;
  /** Cadence lastSuccessfulAt after this invocation (manual proof). */
  cadenceLastSuccessfulAtAfter?: string | null;
  /**
   * Explicit delivery outcome — never rely on ok alone when emailSent is false.
   * sent | skipped_with_reason | failed
   */
  deliveryOutcome?: CadenceDeliveryOutcome;
  /** Provider message id when accepted (safe to return). */
  providerMessageId?: string | null;
};

function resolveRunMode(options: ExecuteCadenceOptions): CadenceRunMode {
  if (
    options.runMode === "manual-preview" ||
    options.runMode === "scheduled" ||
    options.runMode === "force-send"
  ) {
    return options.runMode;
  }
  return "scheduled";
}

function isManualRunMode(runMode: CadenceRunMode): boolean {
  return runMode === "manual-preview";
}

function isForceSendRunMode(runMode: CadenceRunMode): boolean {
  return runMode === "force-send";
}

function triggerForMode(
  mode: CadenceExecutionMode,
  runMode: CadenceRunMode,
): RunTrigger {
  if (isManualRunMode(runMode) || isForceSendRunMode(runMode)) return "manual";
  if (mode === "scheduled-live") return "scheduled";
  if (mode === "test") return "test";
  return "manual";
}

function finalizeResult(
  partial: CadenceExecutionResult,
): CadenceExecutionResult {
  const deliveryOutcome =
    partial.deliveryOutcome ??
    resolveCadenceDeliveryOutcome({
      emailSent: partial.emailSent,
      ok: partial.ok,
      dryRun: partial.dryRun,
      deliveryAction: partial.deliveryAction,
      errorCode: partial.errorCode,
      safeSummary: partial.safeSummary,
      suppressionReason: partial.suppressionReason,
    });

  // Quality-gate / failed outcomes must not present as ok success.
  const ok =
    deliveryOutcome === "failed"
      ? false
      : deliveryOutcome === "sent"
        ? true
        : partial.ok;

  // emailSent:false must always carry an explicit operator-facing reason.
  const suppressionReason =
    partial.emailSent
      ? partial.suppressionReason ?? null
      : partial.suppressionReason ??
        partial.error ??
        partial.safeSummary ??
        "Email not sent";

  const safeSummary =
    partial.safeSummary ||
    suppressionReason ||
    (partial.emailSent ? "Email sent" : "Email not sent");

  return {
    ...partial,
    ok,
    deliveryOutcome,
    providerMessageId: partial.providerMessageId ?? null,
    suppressionReason,
    safeSummary,
  };
}

function adapterMode(
  mode: CadenceExecutionMode,
  runMode: CadenceRunMode,
): "fixture" | "live" {
  if (
    isManualRunMode(runMode) ||
    isForceSendRunMode(runMode) ||
    mode === "scheduled-live"
  ) {
    return "live";
  }
  return "fixture";
}

function deliveryWindowForRun(
  officialWindow: string,
  runMode: CadenceRunMode,
): string {
  if (runMode === "manual-preview") return `${officialWindow}:manual-preview`;
  // Distinct claim key so authenticated recovery can send after a suppressed
  // official-day claim without double-sending the scheduled window.
  if (runMode === "force-send") return `${officialWindow}:force-send`;
  return officialWindow;
}

async function resolveStore(
  options: ExecuteCadenceOptions,
  runMode: CadenceRunMode,
): Promise<{
  store: AgentOsPersistenceStore;
  adapterId: PersistenceAdapterId;
}> {
  const liveDurable =
    options.mode === "scheduled-live" ||
    isManualRunMode(runMode) ||
    isForceSendRunMode(runMode);
  if (options.store) {
    if (liveDurable) {
      assertScheduledLiveDurability({
        store: options.store,
        allowDurableTest: options.allowDurableTest === true,
      });
    }
    return { store: options.store, adapterId: options.store.adapterId };
  }
  if (liveDurable) {
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
  const runMode = resolveRunMode(options);
  if (
    isManualRunMode(runMode) &&
    options.mode !== "scheduled-live"
  ) {
    return {
      ok: false,
      mode: options.mode,
      runMode,
      cadenceId: options.cadenceId ?? null,
      cadenceWindow: null,
      officialCadenceWindow: null,
      runId: null,
      runStatus: null,
      deliveryGuidance: null,
      deliveryAction: "block",
      deliveryStatus: null,
      emailSent: false,
      dryRun: false,
      suppressionReason: null,
      error:
        "manual-preview requires mode=scheduled-live (live adapters + durable store)",
      errorCode: "mode-mismatch",
      safeSummary:
        "manual-preview requires mode=scheduled-live (live adapters + durable store)",
    };
  }
  const force =
    options.force === true ||
    isManualRunMode(runMode) ||
    isForceSendRunMode(runMode);
  const dryRun = options.mode === "dry-run" || runMode === "manual-preview";
  // force-send mutates official delivery (recovery); manual-preview does not.
  const mutateScheduledState = !isManualRunMode(runMode);
  const baseFail = (
    partial: Partial<CadenceExecutionResult> & { error: string; errorCode?: string },
  ): CadenceExecutionResult =>
    finalizeResult({
      ok: false,
      mode: options.mode,
      runMode,
      cadenceId: partial.cadenceId ?? options.cadenceId ?? null,
      cadenceWindow: partial.cadenceWindow ?? null,
      officialCadenceWindow: partial.officialCadenceWindow ?? null,
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
      previewRender: partial.previewRender ?? null,
      cadenceLastSuccessfulAtBefore: partial.cadenceLastSuccessfulAtBefore,
      cadenceLastSuccessfulAtAfter: partial.cadenceLastSuccessfulAtAfter,
      deliveryOutcome: "failed",
      providerMessageId: partial.providerMessageId ?? null,
    });

  let store: AgentOsPersistenceStore;
  try {
    ({ store } = await resolveStore(options, runMode));
  } catch (err) {
    const code =
      err instanceof AgentOsPersistenceError ? err.code : "unconfigured";
    return baseFail({
      error: err instanceof Error ? err.message : "persistence resolve failed",
      errorCode: code,
      deliveryAction: "block",
    });
  }

  if (options.mode === "scheduled-live" || isManualRunMode(runMode)) {
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

  // Reclaim crashed leftovers: shared chief-of-staff scope lock with no TTL
  // previously caused permanent "No founder-brief cadence due" + HTTP 200.
  {
    const progress = { ...state.inProgressByScope };
    let cleared = false;
    for (const [scope, entry] of Object.entries(progress)) {
      if (entry && isInProgressStale(entry.startedAt, nowIso)) {
        logCadenceDeliveryEvent("in_progress_stale_cleared", {
          scope,
          runId: entry.runId,
          startedAt: entry.startedAt,
          nowIso,
        });
        delete progress[scope];
        cleared = true;
      }
    }
    if (cleared) {
      state = {
        ...deepCloneState(state),
        updatedAt: nowIso,
        inProgressByScope: progress,
      };
      await store.save(state).catch(() => undefined);
    }
  }

  // force-send / force: clear lock for recovery so a stuck warm lock cannot block.
  // Scoped to the target cadence when known; otherwise clear founder CoS scope only.
  // Concurrent force-send still cannot double-send: reserveDelivery idempotency
  // admits a single reserved claim per cadence window.
  if (force && mutateScheduledState) {
    if (isForceSendRunMode(runMode)) {
      logCadenceDeliveryEvent("recovery_force_send", {
        cadenceId: options.cadenceId ?? null,
        nowIso,
        note: "Authenticated force-send recovery — bypasses due gate",
      });
    }
    const progress = { ...state.inProgressByScope };
    let cleared = false;
    const scopesToClear = new Set<string>();
    if (options.cadenceId) {
      const target =
        state.cadences[options.cadenceId] ??
        getCadenceById(options.cadenceId) ??
        defaultCadenceDefinitions().find((c) => c.cadenceId === options.cadenceId);
      if (target) scopesToClear.add(String(target.scope));
    } else {
      scopesToClear.add("chief-of-staff");
    }
    for (const scope of scopesToClear) {
      const entry = progress[scope];
      if (entry) {
        logCadenceDeliveryEvent("in_progress_force_cleared", {
          scope,
          runId: entry.runId,
          startedAt: entry.startedAt,
          nowIso,
          recovery: isForceSendRunMode(runMode),
        });
        delete progress[scope];
        cleared = true;
      }
    }
    if (cleared) {
      state = {
        ...deepCloneState(state),
        updatedAt: nowIso,
        inProgressByScope: progress,
      };
      await store.save(state).catch(() => undefined);
    }
  }

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
        const running = state.inProgressByScope[String(c.scope)];
        if (isInProgressActive(running, nowIso)) return false;
        return true;
      })
      .map((e) => e.cadenceId);
    const ordered = listDueFounderCadencesInOrder(due);
    if (ordered.length === 0) {
      const activeLocks = Object.entries(state.inProgressByScope)
        .filter(([, entry]) => isInProgressActive(entry, nowIso))
        .map(([scope, entry]) => `${scope}:${entry.runId}`);
      const summary =
        activeLocks.length > 0
          ? `No founder-brief cadence due (in-progress lock active: ${activeLocks.join(",")})`
          : "No founder-brief cadence due";
      logCadenceDeliveryEvent("run_skipped", {
        nowIso,
        reason: summary,
        deliveryOutcome: "skipped_with_reason",
      });
      return finalizeResult({
        ok: true,
        mode: options.mode,
        runMode,
        cadenceId: null,
        cadenceWindow: null,
        runId: null,
        runStatus: null,
        deliveryGuidance: null,
        deliveryAction: "send-nothing",
        deliveryStatus: null,
        emailSent: false,
        dryRun,
        suppressionReason: summary,
        error: null,
        errorCode: null,
        safeSummary: summary,
        deliveryOutcome: "skipped_with_reason",
      });
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
            results.push(
              finalizeResult({
                ok: true,
                mode: options.mode,
                runMode,
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
                deliveryOutcome: "skipped_with_reason",
              }),
            );
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
      const anyFail = results.some(
        (r) => !r.ok || r.deliveryOutcome === "failed",
      );
      const anySent = results.some((r) => r.emailSent);
      const last = results[results.length - 1]!;
      const deliveryOutcome: CadenceDeliveryOutcome = anySent
        ? "sent"
        : anyFail
          ? "failed"
          : "skipped_with_reason";
      return finalizeResult({
        ...last,
        ok: deliveryOutcome !== "failed",
        emailSent: anySent,
        safeSummary: results
          .map(
            (r) =>
              `${r.cadenceId}:${r.deliveryOutcome ?? r.deliveryAction}`,
          )
          .join("; "),
        error: anyFail
          ? results
              .filter((r) => !r.ok || r.deliveryOutcome === "failed")
              .map((r) => r.error)
              .filter(Boolean)
              .join("; ")
          : null,
        errorCode: anyFail
          ? results.find((r) => !r.ok || r.deliveryOutcome === "failed")
              ?.errorCode ?? "failed"
          : null,
        deliveryOutcome,
      });
    }
    // single due — fall through with explicit id
    options = { ...options, cadenceId: ordered[0] };
  }

  const cadenceId = options.cadenceId ?? null;

  if (!cadenceId) {
    return finalizeResult({
      ok: true,
      mode: options.mode,
      runMode,
      cadenceId: null,
      cadenceWindow: null,
      runId: null,
      runStatus: null,
      deliveryGuidance: null,
      deliveryAction: "send-nothing",
      deliveryStatus: null,
      emailSent: false,
      dryRun,
      suppressionReason: "No founder-brief cadence due",
      error: null,
      errorCode: null,
      safeSummary: "No founder-brief cadence due",
      deliveryOutcome: "skipped_with_reason",
    });
  }

  if (!isFounderBriefCadence(cadenceId)) {
    return baseFail({
      cadenceId,
      error: `Cadence ${cadenceId} is not a founder-brief cadence`,
      errorCode: "mode-mismatch",
    });
  }

  // Same-day anti-redundancy for explicit daily runs (store is source of truth).
  // Manual preview/smoke may proceed even if weekly already occupied — they use
  // a distinct delivery window and do not claim the official day.
  if (cadenceId === "cos-daily-synthesis" && !force) {
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
      return finalizeResult({
        ok: true,
        mode: options.mode,
        runMode,
        cadenceId,
        cadenceWindow: `day:${localDate}`,
        officialCadenceWindow: `day:${localDate}`,
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
        deliveryOutcome: "skipped_with_reason",
      });
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

  const inProgressEntry = state.inProgressByScope[String(cadence.scope)];
  const inProgress = isInProgressActive(inProgressEntry, nowIso)
    ? inProgressEntry?.runId
    : null;
  const evaluation = evaluateCadence({
    cadence,
    nowIso,
    trigger: force ? "test" : triggerForMode(options.mode, runMode),
    inProgressRunId: mutateScheduledState ? inProgress : null,
    sourceHealth: [],
  });

  if (!force && !evaluation.shouldProceed) {
    const window = cadenceWindowId(cadence, nowIso);
    logCadenceDeliveryEvent("run_skipped", {
      cadenceId,
      cadenceWindow: window,
      reasonCodes: evaluation.reasonCodes,
      deliveryOutcome: "skipped_with_reason",
    });
    return finalizeResult({
      ok: true,
      mode: options.mode,
      runMode,
      cadenceId,
      cadenceWindow: window,
      officialCadenceWindow: window,
      runId: null,
      runStatus: null,
      deliveryGuidance: null,
      deliveryAction: "send-nothing",
      deliveryStatus: null,
      emailSent: false,
      dryRun,
      suppressionReason: `Cadence not due: ${evaluation.reasonCodes.join(",")}`,
      error: null,
      errorCode: null,
      safeSummary: `Cadence not due: ${evaluation.reasonCodes.join(",")}`,
      deliveryOutcome: "skipped_with_reason",
    });
  }

  const officialWindow = cadenceWindowId(cadence, nowIso);
  const window = deliveryWindowForRun(officialWindow, runMode);
  const provisionalRunId = `run-${randomUUID()}`;
  const cadenceLastSuccessfulAtBefore = cadence.lastSuccessfulAt ?? null;

  if (mutateScheduledState) {
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
        officialCadenceWindow: officialWindow,
        error: err instanceof Error ? err.message : "in-progress mark failed",
        errorCode: "write-failed",
        cadenceLastSuccessfulAtBefore,
      });
    }
  }

  /**
   * Release this invocation's lock if it still owns the scope.
   * Path-level clearInProgress handles normal exits; this is the backstop for
   * unexpected throws. Does not clear a newer run's lock (runId match required).
   */
  const releaseOwnedInProgressLock = async (): Promise<void> => {
    if (!mutateScheduledState) return;
    try {
      const latest = await store.load();
      const scopeKey = String(cadence.scope);
      const entry = latest.inProgressByScope[scopeKey];
      if (!entry || entry.runId !== provisionalRunId) return;
      const releaseIso = new Date().toISOString();
      await updateCadenceTimestamps({
        store,
        cadenceId,
        nowIso: releaseIso,
        success: false,
        runId: provisionalRunId,
        clearInProgress: true,
      });
      logCadenceDeliveryEvent("in_progress_finally_released", {
        cadenceId,
        runId: provisionalRunId,
        scope: scopeKey,
        startedAt: entry.startedAt,
        releasedAt: releaseIso,
      });
    } catch {
      // Best-effort — stale TTL remains the durable backstop.
    }
  };

  try {
  // Run full Agent OS (all five executives via existing orchestrator)
  const briefCadenceIntent = resolveBriefCadenceIntent(cadenceId);
  const briefLocalDate = localDateFromCadenceWindow(officialWindow, nowIso);
  let run: AgentRun;
  try {
    run = await runAgentOsBrief({
      mode: adapterMode(options.mode, runMode),
      briefCadenceIntent,
      briefLocalDate,
      persistence: {
        enabled: true,
        trigger: triggerForMode(options.mode, runMode),
        store,
        requirePersistenceWrite:
          options.mode === "scheduled-live" && mutateScheduledState,
        skipWrite: isManualRunMode(runMode),
        now: nowIso,
        onDemandRecurrenceBypass: isManualRunMode(runMode),
      },
    });
  } catch (err) {
    if (mutateScheduledState) {
      await updateCadenceTimestamps({
        store,
        cadenceId,
        nowIso,
        success: false,
        runId: provisionalRunId,
        clearInProgress: true,
      }).catch(() => undefined);
    }
    return baseFail({
      cadenceId,
      cadenceWindow: window,
      officialCadenceWindow: officialWindow,
      error: err instanceof Error ? err.message : "runAgentOsBrief failed",
      errorCode: "failed",
      cadenceLastSuccessfulAtBefore,
    });
  }

  const persistenceOk = run.persistence?.ok !== false;
  if (
    options.mode === "scheduled-live" &&
    mutateScheduledState &&
    !persistenceOk
  ) {
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
      officialCadenceWindow: officialWindow,
      runId: run.runId,
      runStatus: run.runStatus,
      deliveryGuidance: run.deliveryGuidance,
      error:
        run.persistence?.error ??
        "Scheduled live persistence failed — fail closed",
      errorCode: run.persistence?.errorCode ?? "write-failed",
      cadenceLastSuccessfulAtBefore,
    });
  }

  const eligibility = evaluateDeliveryEligibility({
    run,
    persistenceOk:
      options.mode === "scheduled-live" && mutateScheduledState
        ? persistenceOk
        : true,
    dryRun,
    intent: resolveBriefCadenceIntent(cadenceId),
  });

  const buildPreviewRender = (
    rendered: RenderedAgentOsEmail,
    extras?: {
      recipientAlias?: string | null;
      providerMessageId?: string | null;
    },
  ) => {
    const todayCall = dailyTodayCall({
      whyItMatters: run.brief.whyItMatters,
      highestRoiAction: run.brief.highestRoiAction,
      sprintOrientation: run.brief.sprintOrientation,
      dayOrientation: run.brief.dayOrientation,
      whatChanged: run.brief.whatChanged,
    });
    const quality = evaluateBriefQualityGate({
      brief: run.brief,
      todayCall,
      opportunityWatch: run.brief.opportunityToWatch,
      intent: "daily",
    });
    return {
      subject: rendered.subject,
      text: rendered.text,
      html: rendered.html,
      qualityGateOk: quality.ok,
      qualityGateCodes: quality.ok
        ? []
        : quality.violations.map((v) => v.code),
      recipientAlias: extras?.recipientAlias ?? null,
      providerMessageId: extras?.providerMessageId ?? null,
    };
  };

  const readCadenceLastSuccessfulAfter = async (): Promise<string | null> => {
    try {
      const latest = await store.load();
      return latest.cadences[cadenceId]?.lastSuccessfulAt ?? null;
    } catch {
      return cadenceLastSuccessfulAtBefore;
    }
  };

  // Dry run / manual-preview: never send; manual modes never mutate scheduled cadence.
  if (dryRun) {
    if (mutateScheduledState) {
      await updateCadenceTimestamps({
        store,
        cadenceId,
        nowIso,
        success:
          run.runStatus === "completed" ||
          run.runStatus === "completed-with-warnings",
        runId: run.runId,
        clearInProgress: true,
      }).catch(() => undefined);
    }
    const rendered = renderFounderBriefEmail({
      run,
      cadenceId,
      cadenceWindow: officialWindow,
      degraded: run.briefEvidenceQuality === "partial-degraded",
    });
    const cadenceLastSuccessfulAtAfter = await readCadenceLastSuccessfulAfter();
    return finalizeResult({
      ok: true,
      mode: options.mode,
      runMode,
      cadenceId,
      cadenceWindow: window,
      officialCadenceWindow: officialWindow,
      runId: run.runId,
      runStatus: run.runStatus,
      deliveryGuidance: run.deliveryGuidance,
      deliveryAction: eligibility.action,
      deliveryStatus:
        runMode === "manual-preview" ? "manual-preview-no-send" : "dry-run-no-send",
      emailSent: false,
      dryRun: true,
      suppressionReason: null,
      error: null,
      errorCode: null,
      safeSummary: `${runMode === "manual-preview" ? "Manual preview" : "Dry run"}: would ${eligibility.action} (${eligibility.reason})`,
      previewRender:
        options.includePreviewRender || runMode === "manual-preview"
          ? buildPreviewRender(rendered)
          : null,
      cadenceLastSuccessfulAtBefore,
      cadenceLastSuccessfulAtAfter,
      deliveryOutcome: "skipped_with_reason",
    });
  }

  if (eligibility.action === "send-nothing") {
    const qualityBlocked = /quality gate/i.test(eligibility.reason);
    if (mutateScheduledState) {
      await updateCadenceTimestamps({
        store,
        cadenceId,
        nowIso,
        // Quiet cycles may close the day; quality-gate blocks must not.
        success: !qualityBlocked,
        runId: run.runId,
        clearInProgress: true,
      }).catch(() => undefined);
    }
    const rendered = renderFounderBriefEmail({
      run,
      cadenceId,
      cadenceWindow: officialWindow,
      degraded: false,
    });
    logCadenceDeliveryEvent(qualityBlocked ? "run_failed" : "run_skipped", {
      cadenceId,
      cadenceWindow: window,
      reason: eligibility.reason,
      deliveryOutcome: qualityBlocked ? "failed" : "skipped_with_reason",
    });
    return finalizeResult({
      ok: !qualityBlocked,
      mode: options.mode,
      runMode,
      cadenceId,
      cadenceWindow: window,
      officialCadenceWindow: officialWindow,
      runId: run.runId,
      runStatus: run.runStatus,
      deliveryGuidance: run.deliveryGuidance,
      deliveryAction: "send-nothing",
      deliveryStatus: null,
      emailSent: false,
      dryRun: false,
      suppressionReason: eligibility.reason,
      error: qualityBlocked ? eligibility.reason : null,
      errorCode: qualityBlocked ? "failed" : null,
      safeSummary: eligibility.reason,
      previewRender:
        options.includePreviewRender || isManualRunMode(runMode)
          ? buildPreviewRender(rendered)
          : null,
      cadenceLastSuccessfulAtBefore,
      cadenceLastSuccessfulAtAfter: await readCadenceLastSuccessfulAfter(),
      deliveryOutcome: qualityBlocked ? "failed" : "skipped_with_reason",
    });
  }

  if (eligibility.action === "block") {
    if (mutateScheduledState) {
      await updateCadenceTimestamps({
        store,
        cadenceId,
        nowIso,
        success: false,
        runId: run.runId,
        clearInProgress: true,
      }).catch(() => undefined);
    }
    return baseFail({
      cadenceId,
      cadenceWindow: window,
      officialCadenceWindow: officialWindow,
      runId: run.runId,
      runStatus: run.runStatus,
      deliveryGuidance: run.deliveryGuidance,
      deliveryAction: "block",
      error: eligibility.reason,
      errorCode: "mode-mismatch",
      cadenceLastSuccessfulAtBefore,
      cadenceLastSuccessfulAtAfter: await readCadenceLastSuccessfulAfter(),
    });
  }

  // Email config — fail closed when sending
  let emailConfig: AgentOsEmailConfig;
  try {
    emailConfig = resolveAgentOsEmailConfig({
      override: options.emailConfigOverride,
    });
  } catch (err) {
    if (mutateScheduledState) {
      await updateCadenceTimestamps({
        store,
        cadenceId,
        nowIso,
        success: false,
        runId: run.runId,
        clearInProgress: true,
      }).catch(() => undefined);
    }
    return baseFail({
      cadenceId,
      cadenceWindow: window,
      officialCadenceWindow: officialWindow,
      runId: run.runId,
      runStatus: run.runStatus,
      deliveryGuidance: run.deliveryGuidance,
      error: err instanceof Error ? err.message : "email config missing",
      errorCode: "unconfigured",
      cadenceLastSuccessfulAtBefore,
      cadenceLastSuccessfulAtAfter: await readCadenceLastSuccessfulAfter(),
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
              runMode,
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

  // force-send recovery: reopen suppressed claims for this official window so a
  // cooldown false-success can be retried. "sent" remains terminal (no duplicate).
  if (isForceSendRunMode(runMode) && mutateScheduledState) {
    try {
      const live = await store.load();
      const deliveries = { ...(live.deliveries ?? {}) };
      let changed = false;
      for (const [id, rec] of Object.entries(deliveries)) {
        if (
          rec.cadenceId === cadenceId &&
          rec.cadenceWindow === window &&
          rec.kind === kind &&
          rec.status === "suppressed"
        ) {
          deliveries[id] = {
            ...rec,
            status: "failed",
            errorSummary:
              "force-send recovery reopened suppressed delivery for retry",
            updatedAt: nowIso,
            suppressionReason: null,
          };
          changed = true;
          logCadenceDeliveryEvent("recovery_reopen_suppressed", {
            cadenceId,
            cadenceWindow: window,
            deliveryId: id,
          });
        }
      }
      if (changed) {
        await store.save({
          ...deepCloneState(live),
          deliveries,
          updatedAt: nowIso,
        });
      }
    } catch {
      // Best-effort reopen; reserve may still skip.
    }
  }

  // Manual preview uses a distinct window (`:manual-preview`) so it never claims
  // the official daily delivery slot. Cooldown is bypassed for manual windows.
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
        : isManualRunMode(runMode) ||
            isForceSendRunMode(runMode) ||
            // Daily Morning Brief is window-idempotent (day:YYYY-MM-DD).
            // A 7-day unchanged-fingerprint cooldown incorrectly suppressed
            // subsequent mornings after a successful send (P0-2).
            cadenceId === "cos-daily-synthesis"
          ? 0
          : DEFAULT_FOUNDER_COOLDOWN_MS,
  });

  if (reserve.outcome === "contention") {
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
          : isManualRunMode(runMode) ||
              isForceSendRunMode(runMode) ||
              cadenceId === "cos-daily-synthesis"
            ? 0
            : DEFAULT_FOUNDER_COOLDOWN_MS,
    });
  }

  if (reserve.outcome === "contention") {
    if (mutateScheduledState) {
      await updateCadenceTimestamps({
        store,
        cadenceId,
        nowIso,
        success: false,
        runId: run.runId,
        clearInProgress: true,
      }).catch(() => undefined);
    }
    return baseFail({
      cadenceId,
      cadenceWindow: window,
      officialCadenceWindow: officialWindow,
      runId: run.runId,
      runStatus: run.runStatus,
      deliveryGuidance: run.deliveryGuidance,
      error: "Delivery reservation contention — fail closed",
      errorCode: "write-failed",
      cadenceLastSuccessfulAtBefore,
      cadenceLastSuccessfulAtAfter: await readCadenceLastSuccessfulAfter(),
    });
  }

  if (reserve.outcome === "already-terminal") {
    const terminalSent = reserve.record.status === "sent";
    if (mutateScheduledState) {
      await updateCadenceTimestamps({
        store,
        cadenceId,
        nowIso,
        success: terminalSent,
        runId: run.runId,
        clearInProgress: true,
      }).catch(() => undefined);
    }
    logCadenceDeliveryEvent("run_skipped", {
      cadenceId,
      cadenceWindow: window,
      reason: reserve.reason,
      deliveryStatus: reserve.record.status,
      deliveryOutcome: "skipped_with_reason",
    });
    return finalizeResult({
      ok: true,
      mode: options.mode,
      runMode,
      cadenceId,
      cadenceWindow: window,
      officialCadenceWindow: officialWindow,
      runId: run.runId,
      runStatus: run.runStatus,
      deliveryGuidance: run.deliveryGuidance,
      deliveryAction: eligibility.action,
      deliveryStatus: reserve.record.status,
      emailSent: false,
      dryRun: false,
      suppressionReason:
        reserve.record.suppressionReason ?? reserve.reason,
      error: null,
      errorCode: null,
      safeSummary: reserve.reason,
      cadenceLastSuccessfulAtBefore,
      cadenceLastSuccessfulAtAfter: await readCadenceLastSuccessfulAfter(),
      deliveryOutcome: "skipped_with_reason",
    });
  }

  if (reserve.outcome === "blocked-uncertain") {
    if (mutateScheduledState) {
      await updateCadenceTimestamps({
        store,
        cadenceId,
        nowIso,
        success: false,
        runId: run.runId,
        clearInProgress: true,
      }).catch(() => undefined);
    }
    return baseFail({
      cadenceId,
      cadenceWindow: window,
      officialCadenceWindow: officialWindow,
      runId: run.runId,
      runStatus: run.runStatus,
      deliveryGuidance: run.deliveryGuidance,
      deliveryAction: eligibility.action,
      deliveryStatus: "uncertain",
      error: reserve.reason,
      errorCode: "write-failed",
      cadenceLastSuccessfulAtBefore,
      cadenceLastSuccessfulAtAfter: await readCadenceLastSuccessfulAfter(),
    });
  }

  if (reserve.outcome === "suppressed") {
    if (mutateScheduledState) {
      await updateCadenceTimestamps({
        store,
        cadenceId,
        nowIso,
        // Suppression is not a delivered brief — do not close the local day.
        success: false,
        runId: run.runId,
        clearInProgress: true,
      }).catch(() => undefined);
    }
    logCadenceDeliveryEvent("run_skipped", {
      cadenceId,
      cadenceWindow: window,
      reason: reserve.reason,
      deliveryOutcome: "skipped_with_reason",
    });
    return finalizeResult({
      ok: true,
      mode: options.mode,
      runMode,
      cadenceId,
      cadenceWindow: window,
      officialCadenceWindow: officialWindow,
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
      cadenceLastSuccessfulAtBefore,
      cadenceLastSuccessfulAtAfter: await readCadenceLastSuccessfulAfter(),
      deliveryOutcome: "skipped_with_reason",
    });
  }

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
          cadenceWindow: officialWindow,
          runId: run.runId,
          runStatus: run.runStatus,
          reason: eligibility.reason,
        })
      : renderFounderBriefEmail({
          run,
          cadenceId,
          cadenceWindow: officialWindow,
          degraded:
            eligibility.action === "send-founder-brief" &&
            eligibility.degraded,
        });

  logCadenceDeliveryEvent("send_attempted", {
    cadenceId,
    cadenceWindow: window,
    kind,
    runId: run.runId,
  });

  const sendResult = await sender({
    config: emailConfig,
    rendered,
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
    if (mutateScheduledState) {
      await updateCadenceTimestamps({
        store,
        cadenceId,
        nowIso,
        success: true,
        runId: run.runId,
        clearInProgress: true,
      }).catch(() => undefined);
    }
    logCadenceDeliveryEvent("provider_accepted", {
      cadenceId,
      cadenceWindow: window,
      providerMessageId: sendResult.providerMessageId,
      deliveryOutcome: "sent",
    });
    return finalizeResult({
      ok: true,
      mode: options.mode,
      runMode,
      cadenceId,
      cadenceWindow: window,
      officialCadenceWindow: officialWindow,
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
      previewRender:
        options.includePreviewRender || isManualRunMode(runMode)
          ? buildPreviewRender(rendered, {
              recipientAlias: emailConfig.recipientAlias,
              providerMessageId: sendResult.providerMessageId,
            })
          : null,
      cadenceLastSuccessfulAtBefore,
      cadenceLastSuccessfulAtAfter: await readCadenceLastSuccessfulAfter(),
      deliveryOutcome: "sent",
      providerMessageId: sendResult.providerMessageId,
    });
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
  if (mutateScheduledState) {
    await updateCadenceTimestamps({
      store,
      cadenceId,
      nowIso,
      success: false,
      runId: run.runId,
      clearInProgress: true,
    }).catch(() => undefined);
  }

  return baseFail({
    cadenceId,
    cadenceWindow: window,
    officialCadenceWindow: officialWindow,
    runId: run.runId,
    runStatus: run.runStatus,
    deliveryGuidance: run.deliveryGuidance,
    deliveryAction: eligibility.action,
    deliveryStatus: nextStatus,
    error: sendResult.error || redactError("email send failed"),
    errorCode: "write-failed",
    previewRender:
      options.includePreviewRender || isManualRunMode(runMode)
        ? buildPreviewRender(rendered, {
            recipientAlias: emailConfig.recipientAlias,
            providerMessageId: null,
          })
        : null,
    cadenceLastSuccessfulAtBefore,
    cadenceLastSuccessfulAtAfter: await readCadenceLastSuccessfulAfter(),
  });
  } finally {
    await releaseOwnedInProgressLock();
  }
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
