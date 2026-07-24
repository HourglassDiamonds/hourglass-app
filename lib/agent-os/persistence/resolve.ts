/**
 * Resolve persistence adapter for fixture / live modes.
 * Live mode never silently uses fixture or implicit in-memory storage.
 * Scheduled live prefers Supabase when configured; never selects durable-test
 * in production without explicit harness flags.
 */

import type { AdapterMode } from "../adapters/types";
import { InMemoryPersistenceAdapter } from "./adapters/memory";
import { FileLocalPersistenceAdapter } from "./adapters/file";
import { UnconfiguredProductionAdapter } from "./adapters/unconfigured";
import { DurableTestPersistenceAdapter } from "./adapters/durable-test";
import { tryCreateSupabasePersistenceAdapter } from "./adapters/supabase";
import {
  AgentOsPersistenceError,
  type PersistenceAdapterId,
} from "./types";
import type { AgentOsPersistenceStore } from "./store";
import { isProductionRuntime } from "@/lib/intelligence/env";

export type ResolvePersistenceOptions = {
  mode: AdapterMode;
  adapter?: PersistenceAdapterId;
  filePath?: string;
  allowNonDurableLive?: boolean;
  requireDurableInLive?: boolean;
  /** Harness/tests only — never true in production scheduled-live. */
  allowDurableTest?: boolean;
};

export type ResolvedPersistence = {
  store: AgentOsPersistenceStore;
  adapterId: PersistenceAdapterId;
  durabilityLabel: string;
  nonDurableLive: boolean;
};

function refuseDurableTestInProduction(allowDurableTest?: boolean): void {
  const vercelProd = process.env.VERCEL_ENV === "production";
  if ((isProductionRuntime() || vercelProd) && allowDurableTest) {
    throw new AgentOsPersistenceError(
      "mode-mismatch",
      "durable-test adapter is unavailable in production / scheduled-live production runtimes",
    );
  }
}

/**
 * Resolve the persistence store for a run.
 * Fixture default: memory.
 * Live default: supabase when configured, else unconfigured (explicit failure).
 */
export function resolvePersistenceAdapter(
  options: ResolvePersistenceOptions,
): ResolvedPersistence {
  const mode = options.mode;
  const requireDurable = options.requireDurableInLive !== false;

  if (mode === "fixture") {
    const id = options.adapter ?? "memory";
    if (id === "unconfigured-production") {
      throw new AgentOsPersistenceError(
        "mode-mismatch",
        "Fixture mode cannot use unconfigured-production adapter",
      );
    }
    if (id === "supabase") {
      throw new AgentOsPersistenceError(
        "mode-mismatch",
        "Fixture mode cannot use supabase adapter (live-only)",
      );
    }
    if (id === "durable-test") {
      refuseDurableTestInProduction(options.allowDurableTest);
      if (!options.allowDurableTest) {
        throw new AgentOsPersistenceError(
          "mode-mismatch",
          "durable-test adapter requires explicit allowDurableTest",
        );
      }
      const store = new DurableTestPersistenceAdapter({
        modeScope: "fixture",
      });
      return {
        store,
        adapterId: "durable-test",
        durabilityLabel: "test-durable-explicit",
        nonDurableLive: false,
      };
    }
    if (id === "file-local") {
      const store = new FileLocalPersistenceAdapter({
        filePath: options.filePath,
        modeScope: "fixture",
      });
      return {
        store,
        adapterId: "file-local",
        durabilityLabel: "local-durable-crash-resistant-not-serverless-safe",
        nonDurableLive: false,
      };
    }
    const store = new InMemoryPersistenceAdapter({ modeScope: "fixture" });
    return {
      store,
      adapterId: "memory",
      durabilityLabel: "ephemeral",
      nonDurableLive: false,
    };
  }

  // Live mode
  let id = options.adapter;
  if (!id) {
    // Prefer production Supabase when configured — never durable-test
    const supabase = tryCreateSupabasePersistenceAdapter({ modeScope: "live" });
    if (supabase) {
      return {
        store: supabase,
        adapterId: "supabase",
        durabilityLabel: "remote-durable-supabase",
        nonDurableLive: false,
      };
    }
    id = "unconfigured-production";
  }

  if (id === "memory") {
    if (!options.allowNonDurableLive) {
      throw new AgentOsPersistenceError(
        "mode-mismatch",
        "Live mode refused implicit in-memory persistence. " +
          "Pass allowNonDurableLive: true only for explicit local/manual non-durable runs.",
      );
    }
    const store = new InMemoryPersistenceAdapter({ modeScope: "live" });
    return {
      store,
      adapterId: "memory",
      durabilityLabel: "ephemeral-non-durable-live",
      nonDurableLive: true,
    };
  }

  if (id === "file-local") {
    const store = new FileLocalPersistenceAdapter({
      filePath: options.filePath,
      modeScope: "live",
    });
    return {
      store,
      adapterId: "file-local",
      durabilityLabel: "local-durable-crash-resistant-not-serverless-safe",
      nonDurableLive: false,
    };
  }

  if (id === "durable-test") {
    refuseDurableTestInProduction(true);
    if (!options.allowDurableTest) {
      throw new AgentOsPersistenceError(
        "mode-mismatch",
        "durable-test adapter requires explicit allowDurableTest (harness/tests only)",
      );
    }
    const store = new DurableTestPersistenceAdapter({ modeScope: "live" });
    return {
      store,
      adapterId: "durable-test",
      durabilityLabel: "test-durable-explicit",
      nonDurableLive: false,
    };
  }

  if (id === "supabase") {
    const store = tryCreateSupabasePersistenceAdapter({ modeScope: "live" });
    if (!store) {
      throw new AgentOsPersistenceError(
        "unconfigured",
        "Supabase Agent OS persistence requested but SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing",
      );
    }
    return {
      store,
      adapterId: "supabase",
      durabilityLabel: "remote-durable-supabase",
      nonDurableLive: false,
    };
  }

  const store = new UnconfiguredProductionAdapter();
  if (requireDurable) {
    return {
      store,
      adapterId: "unconfigured-production",
      durabilityLabel: "none",
      nonDurableLive: false,
    };
  }

  return {
    store,
    adapterId: "unconfigured-production",
    durabilityLabel: "none",
    nonDurableLive: false,
  };
}

export function assertNoFixtureStateInLive(
  mode: AdapterMode,
  modeScope: string,
): void {
  if (mode === "live" && modeScope === "fixture") {
    throw new AgentOsPersistenceError(
      "fixture-leak",
      "Live mode refused to load fixture-scoped persisted state",
    );
  }
}

/**
 * Scheduled live mode: fail closed on non-production-durable adapters.
 * Rejects memory, file-local, fixture-scoped state, unconfigured, and durable-test
 * (unless explicitly allowed in non-production harness).
 */
export function assertScheduledLiveDurability(input: {
  store: AgentOsPersistenceStore;
  modeScope?: string;
  allowDurableTest?: boolean;
}): void {
  const { store } = input;
  if (input.modeScope === "fixture") {
    throw new AgentOsPersistenceError(
      "fixture-leak",
      "Scheduled live refused fixture-scoped persistence",
    );
  }
  if (store.adapterId === "memory") {
    throw new AgentOsPersistenceError(
      "mode-mismatch",
      "Scheduled live refused in-memory persistence (non-durable)",
    );
  }
  if (store.adapterId === "file-local") {
    throw new AgentOsPersistenceError(
      "mode-mismatch",
      "Scheduled live refused file-local persistence (not serverless/production-safe)",
    );
  }
  if (store.adapterId === "unconfigured-production") {
    throw new AgentOsPersistenceError(
      "unconfigured",
      "Scheduled live requires configured durable persistence — unconfigured adapter fails closed",
    );
  }
  if (store.adapterId === "durable-test") {
    refuseDurableTestInProduction(true);
    if (!input.allowDurableTest) {
      throw new AgentOsPersistenceError(
        "mode-mismatch",
        "Scheduled live refused durable-test without explicit allowDurableTest",
      );
    }
  }
  if (!store.isDurable || !store.liveEligible) {
    throw new AgentOsPersistenceError(
      "mode-mismatch",
      "Scheduled live requires a durable, live-eligible persistence adapter",
    );
  }
  if (
    store.adapterId !== "supabase" &&
    store.adapterId !== "durable-test"
  ) {
    throw new AgentOsPersistenceError(
      "mode-mismatch",
      `Scheduled live refused adapter ${store.adapterId}`,
    );
  }
}
