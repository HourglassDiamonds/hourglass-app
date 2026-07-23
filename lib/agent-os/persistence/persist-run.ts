/**
 * Persist an Agent OS run: load → reconcile → atomic save.
 * Persistence write failure does not erase prior state and is surfaced explicitly.
 */

import type { AgentRun } from "../types";
import { redactSecretsAndPii } from "../redaction";
import { extractPersistableFromRun } from "./extract";
import { reconcilePersistedState } from "./reconcile";
import {
  assertNoFixtureStateInLive,
  resolvePersistenceAdapter,
  type ResolvePersistenceOptions,
} from "./resolve";
import type { AgentOsPersistenceStore } from "./store";
import {
  AgentOsPersistenceError,
  type ReconciliationSummary,
  type RunTrigger,
} from "./types";
import { isPersistenceError } from "./store";

export type PersistAgentOsRunOptions = {
  run: AgentRun;
  trigger?: RunTrigger;
  startedAt?: string;
  now?: string;
  /** Pre-resolved store; otherwise resolved from resolve options. */
  store?: AgentOsPersistenceStore;
  resolve?: Omit<ResolvePersistenceOptions, "mode"> & {
    mode?: ResolvePersistenceOptions["mode"];
  };
  /**
   * When false, brief/run success does not depend on persistence write.
   * Write failures still return explicit error state.
   */
  requireWriteSuccess?: boolean;
};

export type PersistAgentOsRunResult = {
  ok: boolean;
  summary: ReconciliationSummary | null;
  persistenceError: string | null;
  persistenceErrorCode: string | null;
  adapterId: string;
  durabilityLabel: string;
  nonDurableLive: boolean;
};

export async function persistAgentOsRun(
  options: PersistAgentOsRunOptions,
): Promise<PersistAgentOsRunResult> {
  const run = options.run;
  const resolved =
    options.store != null
      ? {
          store: options.store,
          adapterId: options.store.adapterId,
          durabilityLabel: options.store.durability,
          nonDurableLive:
            run.mode === "live" && options.store.adapterId === "memory",
        }
      : resolvePersistenceAdapter({
          mode: options.resolve?.mode ?? run.mode,
          adapter: options.resolve?.adapter,
          filePath: options.resolve?.filePath,
          allowNonDurableLive: options.resolve?.allowNonDurableLive,
          requireDurableInLive: options.resolve?.requireDurableInLive,
        });

  const emptyFail = (
    code: string,
    message: string,
  ): PersistAgentOsRunResult => ({
    ok: false,
    summary: null,
    persistenceError: redactSecretsAndPii(message),
    persistenceErrorCode: code,
    adapterId: resolved.adapterId,
    durabilityLabel: resolved.durabilityLabel,
    nonDurableLive: resolved.nonDurableLive,
  });

  let prior;
  try {
    prior = await resolved.store.load();
    assertNoFixtureStateInLive(run.mode, prior.modeScope);
  } catch (err) {
    const code = isPersistenceError(err)
      ? err.code
      : err instanceof AgentOsPersistenceError
        ? err.code
        : "read-failed";
    const message =
      err instanceof Error ? err.message : "persistence load failed";
    return emptyFail(code, message);
  }

  const input = extractPersistableFromRun(run, {
    trigger: options.trigger ?? "manual",
    startedAt: options.startedAt,
    now: options.now,
  });

  const { state, summary } = reconcilePersistedState(prior, input, {
    adapterId: resolved.adapterId,
    durability: resolved.store.durability,
  });

  if (summary.skippedDueToWriteGuard) {
    return {
      ok: false,
      summary,
      persistenceError: summary.errors.join("; ") || "write guard",
      persistenceErrorCode: "mode-mismatch",
      adapterId: resolved.adapterId,
      durabilityLabel: resolved.durabilityLabel,
      nonDurableLive: resolved.nonDurableLive,
    };
  }

  try {
    // Mark last run write flag
    const last = state.runs[state.runs.length - 1];
    if (last) last.persistenceWriteOk = true;
    await resolved.store.save(state);
    return {
      ok: true,
      summary,
      persistenceError: null,
      persistenceErrorCode: null,
      adapterId: resolved.adapterId,
      durabilityLabel: resolved.durabilityLabel,
      nonDurableLive: resolved.nonDurableLive,
    };
  } catch (err) {
    const code = isPersistenceError(err)
      ? err.code
      : err instanceof AgentOsPersistenceError
        ? err.code
        : "write-failed";
    const message =
      err instanceof Error ? err.message : "persistence write failed";
    // Do not claim success; prior durable state untouched if save threw before replace
    if (summary) {
      const last = state.runs[state.runs.length - 1];
      if (last) last.persistenceWriteOk = false;
    }
    const result: PersistAgentOsRunResult = {
      ok: false,
      summary: {
        ...summary,
        errors: [...summary.errors, redactSecretsAndPii(message)],
      },
      persistenceError: redactSecretsAndPii(message),
      persistenceErrorCode: code,
      adapterId: resolved.adapterId,
      durabilityLabel: resolved.durabilityLabel,
      nonDurableLive: resolved.nonDurableLive,
    };
    if (options.requireWriteSuccess) {
      return result;
    }
    return result;
  }
}
