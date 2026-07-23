/**
 * Resolve persistence adapter for fixture / live modes.
 * Live mode never silently uses fixture or implicit in-memory storage.
 */

import type { AdapterMode } from "../adapters/types";
import { InMemoryPersistenceAdapter } from "./adapters/memory";
import { FileLocalPersistenceAdapter } from "./adapters/file";
import { UnconfiguredProductionAdapter } from "./adapters/unconfigured";
import {
  AgentOsPersistenceError,
  type PersistenceAdapterId,
} from "./types";
import type { AgentOsPersistenceStore } from "./store";

export type ResolvePersistenceOptions = {
  mode: AdapterMode;
  /**
   * Explicit adapter selection.
   * Live mode refuses "memory" unless allowNonDurableLive is true.
   */
  adapter?: PersistenceAdapterId;
  /** Absolute path for file-local adapter. */
  filePath?: string;
  /**
   * Allow explicitly labeled non-durable in-memory for local/manual live runs.
   * Never implicit.
   */
  allowNonDurableLive?: boolean;
  /**
   * When true, live mode without a durable adapter throws (default true).
   */
  requireDurableInLive?: boolean;
};

export type ResolvedPersistence = {
  store: AgentOsPersistenceStore;
  adapterId: PersistenceAdapterId;
  durabilityLabel: string;
  nonDurableLive: boolean;
};

/**
 * Resolve the persistence store for a run.
 * Fixture default: memory.
 * Live default: unconfigured (explicit failure) unless file-local opted in.
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
  const id = options.adapter ?? "unconfigured-production";

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

  const store = new UnconfiguredProductionAdapter();
  if (requireDurable) {
    // Return the adapter; load/save will throw explicitly when used.
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
